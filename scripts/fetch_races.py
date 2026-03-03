#!/usr/bin/env python3
"""
Scrape ProCyclingStats and generate src/data/races.json with UCI race data.

Requirements:
    pip install procyclingstats cloudscraper beautifulsoup4

Usage:
    python3 scripts/fetch_races.py [--year 2026]
"""

import json
import sys
import time
import argparse
import warnings
from typing import Optional
from pathlib import Path

# Suppress urllib3 SSL warning on older macOS
warnings.filterwarnings("ignore", category=UserWarning, module="urllib3")

import cloudscraper
from bs4 import BeautifulSoup
from procyclingstats import Race

# ---------------------------------------------------------------------------
# Category mapping
# ---------------------------------------------------------------------------
# UCI tour codes returned by Race.uci_tour() → app RaceCategory enum value
# Categories not listed here are excluded from the output (e.g. NC, CC, WC).
UCI_TOUR_TO_CATEGORY = {
    "1.UWT": "WorldTour",
    "2.UWT": "WorldTour",
    "1.WWT": "WomenWorldTour",
    "2.WWT": "WomenWorldTour",
    "1.Pro": "ProSeries",    # Men's ProSeries one-day
    "2.Pro": "ProSeries",    # Men's ProSeries stage
    "1.PRO": "ProSeries",    # alternate capitalisation seen on PCS
    "2.PRO": "ProSeries",
    "1.1":   "Continental",  # UCI Continental one-day
    "2.1":   "Continental",  # UCI Continental stage race
}

# Gender override for WWT races (PCS category() sometimes says "Men Elite" for
# WWT because it refers to the race format, not the rider gender).
WWT_CATEGORIES = {"1.WWT", "2.WWT"}

OUTPUT_PATH = Path(__file__).parent.parent / "src" / "data" / "races.json"
STARTLISTS_PATH = Path(__file__).parent.parent / "src" / "data" / "startlists"


def create_scraper():
    return cloudscraper.create_scraper(
        browser={"browser": "chrome", "platform": "darwin", "mobile": False}
    )


def fetch_race_slugs(year: int) -> list[dict]:
    """
    Scrape races.php for the given year (all circuits) and return a list of
    dicts with {slug, uci_tour} for each race we care about.
    """
    scraper = create_scraper()
    url = f"https://www.procyclingstats.com/races.php?year={year}&circuit="
    print(f"Fetching race list from {url} …")

    resp = scraper.get(url, timeout=30)
    resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "html.parser")
    table = soup.find("table", class_="basic")
    if not table:
        raise RuntimeError("Could not find races table on PCS races.php")

    results = []
    for row in table.find_all("tr"):
        cols = row.find_all("td")
        if len(cols) < 5:
            continue

        uci_tour = cols[4].get_text(strip=True)
        if uci_tour not in UCI_TOUR_TO_CATEGORY:
            continue  # skip Continental, NC, WC, etc.

        link = row.find("a", href=True)
        if not link:
            continue

        href = link["href"]  # e.g. "race/tour-de-france/2026/gc"
        # Strip the last segment if it's a result/gc/startlist page
        parts = href.rstrip("/").split("/")
        if parts and parts[-1] in ("gc", "result", "startlist", "overview"):
            parts = parts[:-1]
        slug = "/".join(parts)  # e.g. "race/tour-de-france/2026"

        results.append({"slug": slug, "uci_tour": uci_tour})

    print(f"Found {len(results)} races to fetch details for.")
    return results


def fetch_race_details(slug: str, uci_tour: str) -> Optional[dict]:
    """
    Use procyclingstats.Race to enrich a race with structured data.
    Returns None on error (the race is skipped).
    """
    try:
        race = Race(slug)
        name = race.name()
        start_date = race.startdate()
        end_date = race.enddate()
        country = race.nationality()
        pcs_category = race.category()  # e.g. "Men Elite", "Women Elite"
    except Exception as exc:
        print(f"  ! Skipping {slug}: {exc}")
        return None

    app_category = UCI_TOUR_TO_CATEGORY[uci_tour]

    # Determine gender:
    # - WWT races are always Women
    # - For ProSeries, use the pcs_category string
    if uci_tour in WWT_CATEGORIES:
        gender = "Women"
    elif "woman" in pcs_category.lower():
        gender = "Women"
        # Promote Women's ProSeries to WomenProSeries category
        if app_category == "ProSeries":
            app_category = "WomenProSeries"
    else:
        gender = "Men"

    return {
        "id": slug.replace("/", "-"),   # stable, unique string id
        "pcsSlug": slug,
        "name": name,
        "startDate": start_date,
        "endDate": end_date,
        "country": country,
        "category": app_category,
        "gender": gender,
    }


def fetch_startlist(pcs_slug: str) -> Optional[list]:
    """
    Fetch startlist for a race using procyclingstats.
    Returns a list of { teamName, riders } dicts, or None if not available.

    procyclingstats.RaceStartlist.startlist() returns a flat list of rider dicts:
      [{ rider_name, rider_url, nationality, rider_number, team_name, team_url }, ...]
    We group by team_name to produce the nested structure.
    """
    from procyclingstats import RaceStartlist
    from collections import OrderedDict

    try:
        startlist_obj = RaceStartlist(f"{pcs_slug}/startlist")
        raw = startlist_obj.startlist()

        # Group flat rider list by team_name, preserving first-seen order
        teams: dict = OrderedDict()
        for rider in raw:
            team_name = rider.get("team_name", "")
            if team_name not in teams:
                teams[team_name] = []
            rider_name = rider.get("rider_name", "")
            if rider_name:
                teams[team_name].append({"name": rider_name})

        result = [
            {"teamName": team_name, "riders": riders}
            for team_name, riders in teams.items()
        ]
        return result if result else None
    except Exception as exc:
        print(f"  ! No startlist for {pcs_slug}: {exc}")
        return None


def main():
    parser = argparse.ArgumentParser(description="Fetch UCI race data from ProCyclingStats")
    parser.add_argument("--year", type=int, default=2026, help="Season year (default: 2026)")
    parser.add_argument(
        "--delay", type=float, default=1.0, help="Delay between requests in seconds (default: 1)"
    )
    parser.add_argument(
        "--startlists-only", action="store_true",
        help="Skip race metadata fetch; regenerate startlists from existing races.json"
    )
    args = parser.parse_args()

    if args.startlists_only:
        with open(OUTPUT_PATH, encoding="utf-8") as f:
            races = json.load(f)
        print(f"Loaded {len(races)} races from {OUTPUT_PATH}")
    else:
        slugs = fetch_race_slugs(args.year)
        races = []

        for i, item in enumerate(slugs, 1):
            slug = item["slug"]
            uci_tour = item["uci_tour"]
            print(f"[{i}/{len(slugs)}] {slug} ({uci_tour})")

            details = fetch_race_details(slug, uci_tour)
            if details:
                races.append(details)

            if i < len(slugs):
                time.sleep(args.delay)

        OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
            json.dump(races, f, indent=2, ensure_ascii=False)

        print(f"\nWrote {len(races)} races to {OUTPUT_PATH}")

        # Summary by category
        from collections import Counter
        by_cat = Counter(r["category"] for r in races)
        for cat, count in sorted(by_cat.items()):
            print(f"  {cat}: {count}")

    # Fetch startlists
    print(f"\nFetching startlists for {len(races)} races …")
    STARTLISTS_PATH.mkdir(parents=True, exist_ok=True)
    startlists_written = 0

    for race in races:
        pcs_slug = race.get("pcsSlug")
        if not pcs_slug:
            continue

        race_id = race["id"]
        print(f"  [{race_id}] {pcs_slug}")

        time.sleep(args.delay)
        teams = fetch_startlist(pcs_slug)
        if teams:
            startlist_path = STARTLISTS_PATH / f"{race_id}.json"
            with open(startlist_path, "w", encoding="utf-8") as f:
                json.dump(teams, f, indent=2, ensure_ascii=False)
            print(f"    Wrote {len(teams)} teams to {startlist_path.name}")
            startlists_written += 1

    print(f"\nWrote {startlists_written} startlists to {STARTLISTS_PATH}")


if __name__ == "__main__":
    main()
