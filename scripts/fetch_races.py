#!/usr/bin/env python3
"""
Scrape ProCyclingStats and generate a local runtime data file for the app.

Requirements:
    pip install procyclingstats cloudscraper beautifulsoup4

Usage:
    python3 scripts/fetch_races.py [--year 2026]
"""

import json
import time
import argparse
import warnings
from typing import Optional
from pathlib import Path

# Suppress urllib3 NotOpenSSLWarning on older macOS (LibreSSL)
try:
    from urllib3.exceptions import NotOpenSSLWarning
    warnings.filterwarnings("ignore", category=NotOpenSSLWarning)
except ImportError:
    pass

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
    "WC":    "WorldChampionship",
    "1.Pro": "ProSeries",    # Men's ProSeries one-day
    "2.Pro": "ProSeries",    # Men's ProSeries stage
    "1.PRO": "ProSeries",    # alternate capitalisation seen on PCS
    "2.PRO": "ProSeries",
    "NC":    "NationalChampionship",
    "1.1":   "Continental",  # UCI Continental one-day
    "2.1":   "Continental",  # UCI Continental stage race
}

# Gender override for WWT races (PCS category() sometimes says "Men Elite" for
# WWT because it refers to the race format, not the rider gender).
WWT_CATEGORIES = {"1.WWT", "2.WWT"}

GENERATED_PATH = Path(__file__).parent.parent / "src" / "generated" / "pcsData.ts"


def create_scraper():
    return cloudscraper.create_scraper(
        browser={"browser": "chrome", "platform": "darwin", "mobile": False}
    )


# For NC and WC, exclude non-senior and non-road-race events based on slug keywords
NC_WC_EXCLUDE_KEYWORDS = ["-itt", "-tt-", "u23", "-mj", "-wj", "-jr", "junior", "-crit"]


def parse_pcs_date(raw: str, year: int) -> str:
    """
    Parse a PCS date cell (e.g. "14.06", "14.06 - 20.06") into "YYYY-MM-DD".
    Returns "" on failure.
    """
    try:
        start = raw.strip().split(" ")[0]  # take first part before any space
        day, month = start.split(".")[:2]
        return f"{year}-{int(month):02d}-{int(day):02d}"
    except Exception:
        return ""


def fetch_race_slugs(
    year: int,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
) -> list[dict]:
    """
    Scrape races.php for the given year (all circuits) and return a list of
    dicts with {slug, uci_tour} for each race we care about.
    Date filtering is applied here to avoid fetching details for out-of-range races.
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
            continue

        link = row.find("a", href=True)
        if not link:
            continue

        href = link["href"]  # e.g. "race/tour-de-france/2026/gc"
        # Strip the last segment if it's a result/gc/startlist page
        parts = href.rstrip("/").split("/")
        if parts and parts[-1] in ("gc", "result", "startlist", "overview"):
            parts = parts[:-1]
        slug = "/".join(parts)  # e.g. "race/tour-de-france/2026"

        # For NC and WC, skip non-senior and non-road-race events
        if uci_tour in {"NC", "WC"}:
            slug_lower = slug.lower()
            if any(kw in slug_lower for kw in NC_WC_EXCLUDE_KEYWORDS):
                continue

        # Pre-filter by date range using the date from the table (avoids
        # fetching details for out-of-range races)
        if date_from or date_to:
            raw_date = cols[0].get_text(strip=True)
            start_date = parse_pcs_date(raw_date, year)
            if start_date:
                if date_from and start_date < date_from:
                    continue
                if date_to and start_date > date_to:
                    continue

        results.append({"slug": slug, "uci_tour": uci_tour})

    print(f"Found {len(results)} races to fetch details for.")
    return results


def pcs_to_stage_type(stage_type_str: str, profile_icon_str: str) -> Optional[str]:
    """Map PCS stage_type / profile_icon fields to app stageType values."""
    if stage_type_str in ("ITT", "TTT"):
        return "tt"
    icon = profile_icon_str or ""
    if icon in ("p0", "p1"):
        return "flat"
    elif icon in ("p2", "p3"):
        return "hilly"
    elif icon in ("p4", "p5"):
        return "mountain"
    return None


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
        # Promote to the corresponding women's category
        if app_category == "ProSeries":
            app_category = "WomenProSeries"
        elif app_category == "WorldChampionship":
            app_category = "WomenWorldChampionship"
        elif app_category == "NationalChampionship":
            app_category = "WomenNationalChampionship"
    else:
        gender = "Men"

    result: dict = {
        "id": slug.replace("/", "-"),   # stable, unique string id
        "pcsSlug": slug,
        "name": name,
        "startDate": start_date,
        "endDate": end_date,
        "country": country,
        "category": app_category,
        "gender": gender,
    }

    # For one-day races, fetch distance/stageType/elevation from the /result sub-page
    # (Race.stages() returns empty for one-day races; the stage info block
    # is only present on the result page, not the race overview page)
    if start_date == end_date:
        try:
            from procyclingstats import Stage as PCSStage
            detail = PCSStage(f"{slug}/result")
            distance = detail.distance() or 0
            if distance:
                result["distance"] = distance
            start_time = (detail.start_time() or "").strip()
            if start_time and start_time != "-":
                result["startTime"] = start_time
            stage_type = pcs_to_stage_type(
                detail.stage_type() or "",
                detail.profile_icon() or "",
            )
            if stage_type:
                result["stageType"] = stage_type
            elevation = detail.vertical_meters() or 0
            if elevation:
                result["elevation"] = elevation
        except Exception:
            pass  # fields stay absent if page not available yet

    return result


def fetch_startlist(pcs_slug: str) -> Optional[list]:
    """
    Fetch startlist for a race using procyclingstats.
    Returns a list of { teamName, riders } dicts, or None if not available.

    procyclingstats.RaceStartlist.startlist() returns a flat list of rider dicts:
      [{ rider_name, rider_url, nationality, rider_number, team_name, team_url }, ...]
    We group by team_name to produce the nested structure and keep rider nationality.
    Team licence country is fetched from the team page when team_url is available.
    """
    from procyclingstats import RaceStartlist, Team
    from collections import OrderedDict

    try:
        startlist_obj = RaceStartlist(f"{pcs_slug}/startlist")
        raw = startlist_obj.startlist()

        # Group flat rider list by team_name, preserving first-seen order
        teams: dict = OrderedDict()
        team_country_cache: dict[str, Optional[str]] = {}
        for rider in raw:
            team_name = rider.get("team_name", "")
            team_url = rider.get("team_url", "")
            if team_name not in teams:
                country_code = None
                if team_url:
                    if team_url not in team_country_cache:
                        try:
                            team = Team(team_url)
                            raw_country = (team.license_country() or team.nationality() or "").strip().upper()
                            team_country_cache[team_url] = raw_country if len(raw_country) == 2 else None
                        except Exception:
                            team_country_cache[team_url] = None
                    country_code = team_country_cache[team_url]

                team_entry = {"teamName": team_name, "riders": []}
                if country_code:
                    team_entry["countryCode"] = country_code
                teams[team_name] = team_entry

            rider_name = rider.get("rider_name", "")
            if rider_name:
                rider_entry = {"name": rider_name}

                rider_url = rider.get("rider_url", "")
                if rider_url:
                    rider_entry["pcsSlug"] = rider_url

                nationality = (rider.get("nationality") or "").strip().upper()
                if len(nationality) == 2:
                    rider_entry["nationality"] = nationality

                teams[team_name]["riders"].append(rider_entry)

        result = list(teams.values())
        return result if result else None
    except Exception as exc:
        print(f"  ! No startlist for {pcs_slug}: {exc}")
        return None


def fetch_stages(pcs_slug: str, start_date: str, end_date: str) -> Optional[list]:
    """
    Fetch stage list for a multi-day race using procyclingstats.
    Returns None for one-day races (start_date == end_date) or on error.

    Uses Race.stages() to get all stage URLs + dates, then fetches each
    Stage individually for departure, arrival, distance, and start_time.
    stage_url last segment: "stage-1" → stageNumber 1, "prologue" → 0.
    """
    from procyclingstats import Stage as PCSStage

    if start_date == end_date:
        return None  # one-day race, no stages

    try:
        race = Race(pcs_slug)
        raw_stages = race.stages()
    except Exception as exc:
        print(f"  ! No stages for {pcs_slug}: {exc}")
        return None

    if not raw_stages:
        return None

    # PCS returns dates as "MM-DD"; we need "YYYY-MM-DD".
    # Extract year from start_date (format "YYYY-MM-DD").
    year = start_date.split("-")[0] if start_date else ""

    result = []
    for s in raw_stages:
        stage_url = s.get("stage_url", "")
        last_segment = stage_url.rstrip("/").split("/")[-1]  # e.g. "stage-1" or "prologue"

        if last_segment == "prologue":
            stage_number = 0
        else:
            # "stage-3" → 3
            parts = last_segment.split("-")
            try:
                stage_number = int(parts[-1])
            except (ValueError, IndexError):
                continue  # skip unparseable entries

        raw_date = s.get("date", "")
        # Normalize "MM-DD" → "YYYY-MM-DD"; leave "YYYY-MM-DD" untouched
        if raw_date and len(raw_date) == 5 and year:
            raw_date = f"{year}-{raw_date}"

        # Fetch full stage details (departure, arrival, distance, start_time, stageType, elevation)
        departure = ""
        arrival = ""
        distance = 0
        start_time = ""
        stage_type = None
        elevation = 0
        if stage_url:
            try:
                detail = PCSStage(stage_url)
                departure = detail.departure() or ""
                arrival = detail.arrival() or ""
                distance = detail.distance() or 0
                start_time = (detail.start_time() or "").strip()
                stage_type = pcs_to_stage_type(
                    detail.stage_type() or "",
                    detail.profile_icon() or "",
                )
                elevation = detail.vertical_meters() or 0
            except Exception:
                pass  # leave fields empty if stage page not yet available

        stage_dict: dict = {
            "stageNumber": stage_number,
            "date": raw_date,
            "departure": departure,
            "arrival": arrival,
            "distance": distance,
            "startTime": start_time,
        }
        if stage_type:
            stage_dict["stageType"] = stage_type
        if elevation:
            stage_dict["elevation"] = elevation
        result.append(stage_dict)

    return result if result else None


def write_generated_data(races: list[dict], startlists: dict, stages: dict) -> None:
    payload = {
        "races": races,
        "startlists": startlists,
        "stages": stages,
    }

    GENERATED_PATH.parent.mkdir(parents=True, exist_ok=True)
    content = (
        "// Auto-generated by fetch_races.py. Do not commit.\n"
        f"export default {json.dumps(payload, indent=2, ensure_ascii=False)};\n"
    )
    GENERATED_PATH.write_text(content, encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description="Fetch UCI race data from ProCyclingStats")
    parser.add_argument("--year", type=int, default=2026, help="Season year (default: 2026)")
    parser.add_argument(
        "--delay", type=float, default=1.0, help="Delay between requests in seconds (default: 1)"
    )
    parser.add_argument(
        "--date-from", type=str, default=None,
        help="Only include races starting on or after this date (YYYY-MM-DD)"
    )
    parser.add_argument(
        "--date-to", type=str, default=None,
        help="Only include races starting on or before this date (YYYY-MM-DD)"
    )
    args = parser.parse_args()

    slugs = fetch_race_slugs(args.year, date_from=args.date_from, date_to=args.date_to)
    races = []

    for i, item in enumerate(slugs, 1):
        slug = item["slug"]
        uci_tour = item["uci_tour"]
        print(f"[{i}/{len(slugs)}] {slug} ({uci_tour})")

        details = fetch_race_details(slug, uci_tour)
        if not details:
            continue

        # Safety net in case the table date differed from the actual race date
        start_date = details.get("startDate", "")
        if args.date_from and start_date < args.date_from:
            continue
        if args.date_to and start_date > args.date_to:
            continue

        races.append(details)

        if i < len(slugs):
            time.sleep(args.delay)

    print(f"\nFetched {len(races)} races.")

    # Summary by category
    from collections import Counter
    by_cat = Counter(r["category"] for r in races)
    for cat, count in sorted(by_cat.items()):
        print(f"  {cat}: {count}")

    startlists: dict[str, list] = {}
    stages_map: dict[str, list] = {}

    if races:
        print(f"\nFetching startlists for {len(races)} races …")

    for race in races:
        pcs_slug = race.get("pcsSlug")
        if not pcs_slug:
            continue

        race_id = race["id"]
        print(f"  [startlist:{race_id}] {pcs_slug}")

        time.sleep(args.delay)
        teams = fetch_startlist(pcs_slug)
        if teams:
            startlists[race_id] = teams
            print(f"    Added {len(teams)} teams")

    print(f"\nCollected {len(startlists)} startlists.")

    multi_day_races = [race for race in races if race.get("startDate") != race.get("endDate")]
    if multi_day_races:
        print(f"\nFetching stages for {len(multi_day_races)} races …")

    for race in multi_day_races:
        pcs_slug = race.get("pcsSlug")
        if not pcs_slug:
            continue

        race_id = race["id"]
        start_date = race.get("startDate", "")
        end_date = race.get("endDate", "")

        print(f"  [stages:{race_id}] {pcs_slug}")

        time.sleep(args.delay)
        stages = fetch_stages(pcs_slug, start_date, end_date)
        if stages:
            stages_map[race_id] = stages
            print(f"    Added {len(stages)} stages")

    print(f"\nCollected {len(stages_map)} stage files.")

    write_generated_data(races, startlists, stages_map)
    print(f"\nWrote local runtime data to {GENERATED_PATH}")


if __name__ == "__main__":
    main()
