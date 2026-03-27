#!/usr/bin/env python3
"""
Scrape ProCyclingStats and generate a local runtime data file for the app.

Requirements:
    pip install procyclingstats cloudscraper beautifulsoup4

Usage:
    python3 scripts/fetch_races.py
    python3 scripts/fetch_races.py --full-season
"""

import json
import time
import argparse
import calendar
import threading
import re
import warnings
from datetime import date, timedelta
from concurrent.futures import ThreadPoolExecutor
from typing import Optional
from pathlib import Path

# Suppress urllib3 LibreSSL warning on older macOS.
# The first filter must be registered before importing urllib3 at all.
warnings.filterwarnings(
    "ignore",
    message=r"urllib3 v2 only supports OpenSSL 1\.1\.1\+.*LibreSSL.*",
    category=Warning,
)
try:
    from urllib3.exceptions import NotOpenSSLWarning
except ImportError:
    pass
else:
    warnings.filterwarnings("ignore", category=NotOpenSSLWarning)

import cloudscraper
from bs4 import BeautifulSoup
from procyclingstats import Race

# ---------------------------------------------------------------------------
# Race-level mapping
# ---------------------------------------------------------------------------
# UCI tour codes returned by the PCS race calendar table.
# Codes not listed here are excluded from the generated app data.
UCI_TOUR_TO_FILTER_GROUP = {
    "1.UWT": "worldtour",
    "2.UWT": "worldtour",
    "1.WWT": "worldtour",
    "2.WWT": "worldtour",
    "WC":    "special_event",
    "OG":    "special_event",
    "CC":    "special_event",
    "1.Pro": "proseries",
    "2.Pro": "proseries",
    "1.PRO": "proseries",  # alternate capitalisation seen on PCS
    "2.PRO": "proseries",
    "NC":    "national_championship",
    "1.1":   "continental_class1",
    "2.1":   "continental_class1",
    "1.2":   "continental_class2",
    "2.2":   "continental_class2",
}

# Gender override for WWT races (PCS category() sometimes says "Men Elite" for
# WWT because it refers to the race format, not the rider gender).
WWT_CATEGORIES = {"1.WWT", "2.WWT"}

GENERATED_PATH = Path(__file__).parent.parent / "src" / "generated" / "pcsData.ts"
TEAM_COUNTRY_CACHE_PATH = Path(__file__).parent / ".cache" / "team_country_cache.json"
MAX_RESULT_ROWS = 10
_thread_local = threading.local()
_CACHE_MISS = object()


def create_scraper():
    return cloudscraper.create_scraper(
        browser={"browser": "chrome", "platform": "darwin", "mobile": False}
    )


def get_thread_scraper():
    scraper = getattr(_thread_local, "scraper", None)
    if scraper is None:
        scraper = create_scraper()
        _thread_local.scraper = scraper
    return scraper


def shift_months(base_date: date, delta_months: int) -> date:
    absolute_month = (base_date.month - 1) + delta_months
    target_year = base_date.year + absolute_month // 12
    target_month = (absolute_month % 12) + 1
    target_day = min(base_date.day, calendar.monthrange(target_year, target_month)[1])
    return base_date.replace(year=target_year, month=target_month, day=target_day)


def compute_default_window(today: Optional[date] = None) -> tuple[str, str]:
    current_date = today or date.today()
    return (
        shift_months(current_date, -1).isoformat(),
        shift_months(current_date, 1).isoformat(),
    )


TeamCacheEntry = dict  # {"countryCode": str|None, "uciClass": str|None}


def _valid_country_code(value: object) -> Optional[str]:
    if not isinstance(value, str):
        return None
    normalized = value.strip().upper()
    return normalized if len(normalized) == 2 and normalized.isalpha() else None


def load_team_country_cache() -> dict[str, TeamCacheEntry]:
    if not TEAM_COUNTRY_CACHE_PATH.exists():
        return {}

    try:
        raw = json.loads(TEAM_COUNTRY_CACHE_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {}

    if not isinstance(raw, dict):
        return {}

    cache: dict[str, TeamCacheEntry] = {}
    for key, value in raw.items():
        if not isinstance(key, str):
            continue
        if value is None:
            # Old format: None means country fetch failed
            cache[key] = {"countryCode": None, "uciClass": None}
        elif isinstance(value, str):
            # Old format: bare country code string
            cache[key] = {"countryCode": _valid_country_code(value), "uciClass": None}
        elif isinstance(value, dict):
            cache[key] = {
                "countryCode": _valid_country_code(value.get("countryCode")),
                "uciClass": value.get("uciClass") if isinstance(value.get("uciClass"), str) else None,
            }
    return cache


def write_team_country_cache(cache: dict[str, TeamCacheEntry]) -> None:
    TEAM_COUNTRY_CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    TEAM_COUNTRY_CACHE_PATH.write_text(
        json.dumps(cache, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


# Ordered from most to least specific to avoid false positives
_UCI_CLASS_PATTERNS: list[tuple[str, str]] = [
    ("women's world team", "WWT"),
    ("women's pro team", "WPT"),
    ("women's continental team", "WCT"),
    ("uci worldteam", "WT"),
    ("uci world team", "WT"),
    ("uci proteam", "PT"),
    ("uci pro team", "PT"),
    ("uci continental team", "CT"),
    ("uci continental", "CT"),
]


def extract_team_uci_class(soup: "BeautifulSoup") -> Optional[str]:
    """Extract UCI team classification label (e.g. 'WT', 'PT', 'CT') from a PCS team page."""
    # Check short text elements first to avoid matching unrelated long blocks
    for el in soup.find_all(["li", "span", "td", "div", "p"]):
        text = el.get_text(" ", strip=True).lower()
        if len(text) > 80:
            continue
        for pattern, code in _UCI_CLASS_PATTERNS:
            if pattern in text:
                return code
    # Fallback: full page text
    page_text = soup.get_text(" ").lower()
    for pattern, code in _UCI_CLASS_PATTERNS:
        if pattern in page_text:
            return code
    return None


def parse_jersey_map_from_html(html: str) -> dict[str, str]:
    """
    Parse {team_url_path: jersey_image_url} from a PCS startlist page HTML.
    Each jersey <img> is wrapped in <a href="team/..."> — use that href as the key.
    """
    soup = BeautifulSoup(html, "html.parser")
    jersey_map: dict[str, str] = {}
    for img in soup.find_all("img"):
        src = img.get("src") or img.get("data-src") or ""
        if "images/shirts/" not in src:
            continue
        jersey_url = src if src.startswith("http") else f"https://www.procyclingstats.com/{src}"
        parent_a = img.find_parent("a")
        if parent_a:
            team_href = parent_a.get("href", "")
            if team_href.startswith("team/"):
                jersey_map[team_href] = jersey_url
    return jersey_map


# For NC / WC / CC / OG, exclude non-road-race and U23 events based on slug keywords.
# Junior races are excluded later in fetch_race_details via the pcs_category string.
SPECIAL_EVENT_EXCLUDE_KEYWORDS = ["-itt", "-tt-", "u23", "-crit"]
JUNIOR_NAME_TOKEN_RE = re.compile(r"(^|[\s/-])(MJ|WJ)([\s/-]|$)", re.IGNORECASE)


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


def is_junior_race(slug: str, name: str = "", pcs_category: str = "") -> bool:
    slug_lower = (slug or "").lower()
    name_lower = (name or "").lower()
    pcs_category_lower = (pcs_category or "").lower()

    if "junior" in slug_lower or "junior" in name_lower or "junior" in pcs_category_lower:
        return True

    if "-mj" in slug_lower or "-wj" in slug_lower:
        return True

    return bool(JUNIOR_NAME_TOKEN_RE.search(name or ""))


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
    scraper = get_thread_scraper()
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
        if uci_tour not in UCI_TOUR_TO_FILTER_GROUP:
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
        race_name = link.get_text(" ", strip=True)

        if is_junior_race(slug, race_name):
            continue

        # For special-event style classifications, skip non-senior road races.
        if uci_tour in {"NC", "WC", "CC", "OG"}:
            slug_lower = slug.lower()
            if any(kw in slug_lower for kw in SPECIAL_EVENT_EXCLUDE_KEYWORDS):
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


def _fetch_teams_today(stage_url: str, scraper_session) -> Optional[list]:
    """Fetch today's team stage results from the PCS teams-gc page.

    The teams-gc page (e.g. race/paris-nice/2026/stage-2-teams-gc) has two
    tables: general team GC (Prev column present) and today's stage result
    (no Prev column).  We target the today table.

    PCS table structure quirk: the <th> header elements in the today table
    are placed directly inside <table> without a wrapping <tr>, so
    find_all("tr") returns only data rows.  We derive column positions from
    the <th> elements and start iterating from all_rows[0].

    Time cells contain a <span class="hide"> with the machine value:
      rank 1  → absolute stage time, e.g. "13:15:21"
      others  → gap from leader, e.g. "0:00" (same time) or "0:18"
    We always use this hidden value instead of the visible text so that
    same-time teams get "0:00" rather than the ",," marker.
    """
    try:
        url = f"https://www.procyclingstats.com/{stage_url}-teams-gc"
        resp = scraper_session.get(url, timeout=15)
        if resp.status_code != 200:
            return None
        soup = BeautifulSoup(resp.text, "html.parser")
        # Find the today table: <th> texts start with Rnk, Team, Class, Time.
        # The general table has Prev as the 4th header so it won't match.
        # Take the LAST matching table — today comes after general in the HTML.
        today_table = None
        for table in soup.find_all("table"):
            th_texts = [th.get_text(strip=True) for th in table.find_all("th")]
            if len(th_texts) >= 4 and th_texts[:4] == ["Rnk", "Team", "Class", "Time"]:
                today_table = table  # keep going — last match wins
        if not today_table:
            return None
        # Derive column positions from <th> elements (they may not be in a <tr>)
        th_texts = [th.get_text(strip=True) for th in today_table.find_all("th")]
        col_team = next((i for i, t in enumerate(th_texts) if t == "Team"), 1)
        col_time = next((i for i, t in enumerate(th_texts) if t == "Time"), 3)
        # Because the <th>s are not in a <tr>, all find_all("tr") rows are data rows
        all_rows = today_table.find_all("tr")
        # Determine data start: skip any leading <tr> that IS a header row
        # (contains cells whose texts match column labels)
        data_start = 0
        if all_rows:
            first_cell_texts = [c.get_text(strip=True) for c in all_rows[0].find_all(["th", "td"])]
            if "Team" in first_cell_texts and "Rnk" in first_cell_texts:
                data_start = 1
        rows = []
        for i, row in enumerate(all_rows[data_start:], 1):
            cells = row.find_all(["td", "th"])
            if len(cells) <= max(col_team, col_time):
                continue
            # PCS may leave the rank cell empty for rank 1 (icon only)
            rank = cells[0].get_text(strip=True) or str(i)
            team = cells[col_team].get_text(strip=True).strip()
            if not team:
                continue
            # Always use the hidden span's machine value: absolute time for
            # rank 1, gap seconds for others ("0:00" = same time as leader).
            time_cell = cells[col_time]
            span = time_cell.find("span", class_="hide")
            time_val = span.get_text(strip=True) if span else time_cell.get_text(strip=True)
            entry: dict = {"rankLabel": rank, "riderName": team}
            if time_val:
                entry["time"] = time_val
            rows.append(entry)
        # Convert rank 2+ gap times to absolute times so the app can display
        # them consistently with GC/Youth (absolute time + gap from leader).
        if rows:
            leader = next((r for r in rows if r.get("rankLabel") == "1"), None)
            if leader and "time" in leader:
                def _parse_secs(t: str) -> Optional[int]:
                    parts = t.split(":")
                    try:
                        if len(parts) == 3:
                            return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
                        if len(parts) == 2:
                            return int(parts[0]) * 60 + int(parts[1])
                    except ValueError:
                        pass
                    return None

                def _fmt_secs(s: int) -> str:
                    h, rem = divmod(s, 3600)
                    m, sec = divmod(rem, 60)
                    return f"{h}:{m:02d}:{sec:02d}"

                leader_secs = _parse_secs(leader["time"])
                if leader_secs is not None:
                    for r in rows:
                        if r is leader or "time" not in r:
                            continue
                        gap_secs = _parse_secs(r["time"])
                        if gap_secs is not None:
                            r["time"] = _fmt_secs(leader_secs + gap_secs)
        return rows if rows else None
    except Exception:
        return None


def _parse_profile_img_url(parser) -> Optional[str]:
    """Extract the stage elevation profile image URL from a PCS stage page.

    PCS profile image URLs look like:
    images/profiles/ap/ba/paris-nice-2026-stage-3-profile-<hash>.jpg

    Accepts a selectolax HTMLParser (detail.html from procyclingstats Stage).
    """
    try:
        node = parser.css_first('img[src*="images/profiles/"]')
        if node:
            src = node.attributes.get("src", "")
            if src:
                if src.startswith("http"):
                    return src
                if src.startswith("/"):
                    return f"https://www.procyclingstats.com{src}"
                return f"https://www.procyclingstats.com/{src}"
    except Exception:
        pass
    return None


def _fetch_hires_profile_img_url(stage_url: str, scraper) -> Optional[str]:
    """Fetch the hi-res profile image URL from the PCS /info/profiles sub-page.

    The main stage page only embeds a thumbnail (~600px wide). The /info/profiles
    sub-page carries the full-resolution image (typically ~830px wide with a
    content-hash in the filename). Falls back to None on any error.
    """
    try:
        # stage_url may be a full URL or a PCS-relative path
        if stage_url.startswith("http"):
            base = stage_url.rstrip("/")
        else:
            base = f"https://www.procyclingstats.com/{stage_url.lstrip('/')}"
        # For one-day races the stage_url ends in /result — keep it.
        # Hi-res images are at {stage_url}/info/profiles, not the race root.
        profiles_url = f"{base}/info/profiles"
        resp = scraper.get(profiles_url, timeout=10)
        if resp.status_code != 200:
            return None
        from selectolax.parser import HTMLParser
        doc = HTMLParser(resp.text)
        # PCS uses "-profile-" for mountain/hilly stages and "-sprint-" for flat stages
        node = (
            doc.css_first('img[src*="images/profiles/"][src*="-profile-"]')
            or doc.css_first('img[src*="images/profiles/"][src*="-sprint-"]')
        )
        if node:
            src = node.attributes.get("src", "")
            if src:
                if src.startswith("http"):
                    return src
                if src.startswith("/"):
                    return f"https://www.procyclingstats.com{src}"
                return f"https://www.procyclingstats.com/{src}"
    except Exception:
        pass
    return None


def pcs_to_stage_type(stage_type_str: str, profile_icon_str: str) -> Optional[str]:
    """Map PCS stage_type / profile_icon fields to app stageType values."""
    if stage_type_str == "ITT":
        return "itt"
    if stage_type_str == "TTT":
        return "ttt"
    icon = profile_icon_str or ""
    if icon in ("p0", "p1"):
        return "flat"
    elif icon in ("p2", "p3"):
        return "hilly"
    elif icon in ("p4", "p5"):
        return "mountain"
    return None


def parse_stage_number(stage_url: str) -> Optional[int]:
    """
    Parse stage number from a stage URL path.
    "stage-3" -> 3, "prologue" -> 0.
    """
    last_segment = stage_url.rstrip("/").split("/")[-1]
    if last_segment == "prologue":
        return 0

    parts = last_segment.split("-")
    try:
        return int(parts[-1])
    except (ValueError, IndexError):
        return None


def fetch_race_details(slug: str, uci_tour: str, delay: float = 0.0) -> Optional[dict]:
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
        pcs_category = race.category()  # e.g. "Men Elite", "Woman Elite" (singular)
    except Exception as exc:
        print(f"  ! Skipping {slug}: {exc}")
        return None

    filter_group = UCI_TOUR_TO_FILTER_GROUP[uci_tour]

    # Determine gender:
    # - WWT races are always Women
    # - Otherwise use the PCS category string
    if uci_tour in WWT_CATEGORIES:
        gender = "Women"
    elif "woman" in pcs_category.lower():
        gender = "Women"
    else:
        gender = "Men"

    # Skip juniors entirely: the race-level UI only exposes elite UCI classes.
    if is_junior_race(slug, name, pcs_category):
        return None

    if filter_group == "worldtour":
        app_category = "WomenWorldTour" if gender == "Women" else "WorldTour"
    elif filter_group == "special_event":
        app_category = "WomenSpecialEvent" if gender == "Women" else "SpecialEvent"
    elif filter_group == "proseries":
        app_category = "WomenProSeries" if gender == "Women" else "ProSeries"
    elif filter_group == "national_championship":
        app_category = "WomenNationalChampionship" if gender == "Women" else "NationalChampionship"
    elif filter_group == "continental_class1":
        app_category = "ContinentalClass1"
    elif filter_group == "continental_class2":
        app_category = "ContinentalClass2"
    else:
        return None

    result: dict = {
        "id": slug.replace("/", "-"),   # stable, unique string id
        "pcsSlug": slug,
        "name": name,
        "startDate": start_date,
        "endDate": end_date,
        "uciClass": uci_tour,
        "filterGroup": filter_group,
        "country": country,
        "category": app_category,
        "gender": gender,
    }

    # For one-day races, fetch route + metadata from the /result sub-page
    # (Race.stages() returns empty for one-day races; the stage info block
    # is only present on the result page, not the race overview page)
    if start_date == end_date:
        try:
            from procyclingstats import Stage as PCSStage
            if delay > 0:
                time.sleep(delay)
            detail = PCSStage(f"{slug}/result")
            departure = (detail.departure() or "").strip()
            if departure:
                result["departure"] = departure
            arrival = (detail.arrival() or "").strip()
            if arrival:
                result["arrival"] = arrival
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
            profile_img_url = _parse_profile_img_url(detail.html)
            # Try to upgrade to the hi-res version from /info/profiles
            try:
                import cloudscraper as _cs
                _scraper = _cs.create_scraper()
                hires = _fetch_hires_profile_img_url(f"{slug}/result", _scraper)
                if hires:
                    profile_img_url = hires
            except Exception:
                pass
            if profile_img_url:
                result["profileImageUrl"] = profile_img_url
        except Exception:
            pass  # fields stay absent if page not available yet

    return result


def fetch_startlist(
    pcs_slug: str,
    team_country_cache: Optional[dict] = None,
    cache_lock: Optional[threading.Lock] = None,
    delay: float = 0.0,
) -> Optional[list]:
    """
    Fetch startlist for a race using procyclingstats.
    Returns a list of { teamName, riders } dicts, or None if not available.

    Fetches the startlist HTML once with cloudscraper (passing it to RaceStartlist
    to avoid a double request). Team country codes are resolved by fetching each
    team page with cloudscraper and parsing the `.page-title span.flag` element.
    team_country_cache is shared across races to avoid re-fetching the same team page.
    """
    from procyclingstats import RaceStartlist
    from collections import OrderedDict

    if team_country_cache is None:
        team_country_cache = {}

    relative_url = f"{pcs_slug}/startlist"
    full_url = f"https://www.procyclingstats.com/{relative_url}"

    try:
        cs = get_thread_scraper()
        if delay > 0:
            time.sleep(delay)
        resp = cs.get(full_url, timeout=30)
        resp.raise_for_status()
        html = resp.text

        # Parse rider data using procyclingstats with pre-fetched HTML (no extra request)
        startlist_obj = RaceStartlist(relative_url, html=html, update_html=False)
        raw = startlist_obj.startlist()

        # Extract jersey image URLs from the already-fetched startlist HTML
        startlist_jersey_map = parse_jersey_map_from_html(html)

        # Group flat rider list by team_name, preserving first-seen order
        teams: dict = OrderedDict()
        for rider in raw:
            team_name = rider.get("team_name", "")
            team_url = rider.get("team_url", "")
            if team_name not in teams:
                country_code = None
                jersey_image_url = None
                uci_class = None
                if team_url:
                    jersey_image_url = startlist_jersey_map.get(team_url)
                    lock = cache_lock or threading.Lock()
                    with lock:
                        cached_entry = team_country_cache.get(team_url, _CACHE_MISS)
                    if cached_entry is _CACHE_MISS:
                        fetched_code = None
                        fetched_uci_class = None
                        try:
                            if delay > 0:
                                time.sleep(delay)
                            team_resp = cs.get(
                                f"https://www.procyclingstats.com/{team_url}", timeout=30
                            )
                            team_resp.raise_for_status()
                            team_soup = BeautifulSoup(team_resp.text, "html.parser")
                            flag_span = team_soup.select_one(".page-title span.flag")
                            if flag_span:
                                classes = flag_span.get("class") or []
                                fetched_code = next(
                                    (c.upper() for c in classes if len(c) == 2 and c.isalpha()),
                                    None,
                                )
                            fetched_uci_class = extract_team_uci_class(team_soup)
                        except Exception:
                            pass

                        new_entry: TeamCacheEntry = {
                            "countryCode": fetched_code,
                            "uciClass": fetched_uci_class,
                        }
                        with lock:
                            stored = team_country_cache.setdefault(team_url, new_entry)
                        country_code = stored["countryCode"]
                        uci_class = stored["uciClass"]
                    else:
                        country_code = cached_entry["countryCode"]
                        uci_class = cached_entry["uciClass"]

                team_entry: dict = {"teamName": team_name, "riders": []}
                if country_code:
                    team_entry["countryCode"] = country_code
                if uci_class:
                    team_entry["uciClass"] = uci_class
                if jersey_image_url:
                    team_entry["jerseyImageUrl"] = jersey_image_url
                teams[team_name] = team_entry

            rider_name = rider.get("rider_name", "")
            if rider_name:
                rider_entry: dict = {"name": rider_name}

                rider_number = rider.get("rider_number")
                if isinstance(rider_number, int):
                    rider_entry["bibNumber"] = rider_number

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


def fetch_stages(
    pcs_slug: str,
    start_date: str,
    end_date: str,
    delay: float = 0.0,
) -> tuple[
    Optional[list],
    Optional[dict],
    Optional[dict],
    Optional[dict],
    Optional[dict],
    Optional[dict],
    Optional[dict],
    Optional[dict],
]:
    """
    Fetch stage list for a multi-day race using procyclingstats.
    Returns (None, ..., None) for one-day races (start_date == end_date) or on error.

    Uses Race.stages() to get all stage URLs + dates, then fetches each
    Stage individually for departure, arrival, distance, and start_time.
    Also captures per-stage top 10 snapshots for:
      - stage results
      - GC
      - points
      - KOM
      - youth
      - teams
    stage_url last segment: "stage-1" → stageNumber 1, "prologue" → 0.
    """
    from procyclingstats import Stage as PCSStage
    import cloudscraper as _cs
    _scraper = _cs.create_scraper()

    if start_date == end_date:
        return None, None, None, None, None, None, None, None  # one-day race, no stages

    try:
        race = Race(pcs_slug)
        raw_stages = race.stages()
    except Exception as exc:
        print(f"  ! No stages for {pcs_slug}: {exc}")
        return None, None, None, None, None, None, None, None

    if not raw_stages:
        return None, None, None, None, None, None, None, None

    # PCS returns dates as "MM-DD"; we need "YYYY-MM-DD".
    # Extract year from start_date (format "YYYY-MM-DD").
    year = start_date.split("-")[0] if start_date else ""

    result = []
    gc_snapshots: dict[str, list] = {}
    stage_result_snapshots: dict[str, list] = {}
    points_snapshots: dict[str, list] = {}
    kom_snapshots: dict[str, list] = {}
    youth_snapshots: dict[str, list] = {}
    teams_snapshots: dict[str, list] = {}
    teams_stage_result_snapshots: dict[str, list] = {}
    for s in raw_stages:
        stage_url = s.get("stage_url", "")
        stage_number = parse_stage_number(stage_url)
        if stage_number is None:
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
        profile_img_url = None
        if stage_url:
            try:
                if delay > 0:
                    time.sleep(delay)
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
                profile_img_url = (
                    _fetch_hires_profile_img_url(stage_url, _scraper)
                    or _parse_profile_img_url(detail.html)
                )

                try:
                    stage_rows = detail.results(
                        "rank",
                        "rider_name",
                        "rider_url",
                        "team_name",
                        "nationality",
                        "time",
                        "bonus",
                        "status",
                    )
                except Exception:
                    stage_rows = []
                normalized_stage_results = normalize_result_rows(stage_rows, limit=len(stage_rows))
                if normalized_stage_results:
                    stage_result_snapshots[str(stage_number)] = normalized_stage_results

                try:
                    gc_rows = detail.gc(
                        "rank",
                        "rider_name",
                        "rider_url",
                        "team_name",
                        "nationality",
                        "time",
                    )
                except Exception:
                    gc_rows = []
                normalized_gc = normalize_result_rows(gc_rows, limit=len(gc_rows))
                if normalized_gc:
                    gc_snapshots[str(stage_number)] = normalized_gc

                try:
                    points_rows = detail.points(
                        "rank",
                        "rider_name",
                        "rider_url",
                        "team_name",
                        "nationality",
                        "points",
                    )
                except Exception:
                    points_rows = []
                normalized_points = normalize_result_rows(
                    points_rows,
                    limit=len(points_rows),
                    value_field="points",
                    include_status=False,
                )
                if normalized_points:
                    points_snapshots[str(stage_number)] = normalized_points

                try:
                    kom_rows = detail.kom(
                        "rank",
                        "rider_name",
                        "rider_url",
                        "team_name",
                        "nationality",
                        "points",
                    )
                except Exception:
                    kom_rows = []
                normalized_kom = normalize_result_rows(
                    kom_rows,
                    limit=len(kom_rows),
                    value_field="points",
                    include_status=False,
                )
                if normalized_kom:
                    kom_snapshots[str(stage_number)] = normalized_kom

                try:
                    youth_rows = detail.youth(
                        "rank",
                        "rider_name",
                        "rider_url",
                        "team_name",
                        "nationality",
                        "time",
                    )
                except Exception:
                    youth_rows = []
                normalized_youth = normalize_result_rows(
                    youth_rows,
                    limit=len(youth_rows),
                    include_status=False,
                )
                if normalized_youth:
                    youth_snapshots[str(stage_number)] = normalized_youth

                try:
                    teams_rows = detail.teams(
                        "rank",
                        "team_name",
                        "nationality",
                        "time",
                    )
                except Exception:
                    teams_rows = []
                normalized_teams = normalize_result_rows(
                    teams_rows,
                    limit=len(teams_rows),
                    name_field="team_name",
                    include_team_name=False,
                    include_status=False,
                )
                if normalized_teams:
                    teams_snapshots[str(stage_number)] = normalized_teams

                teams_today = _fetch_teams_today(stage_url, get_thread_scraper())
                if teams_today:
                    teams_stage_result_snapshots[str(stage_number)] = teams_today
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
        if profile_img_url:
            stage_dict["profileImageUrl"] = profile_img_url
        result.append(stage_dict)

    return (
        result if result else None,
        gc_snapshots if gc_snapshots else None,
        stage_result_snapshots if stage_result_snapshots else None,
        points_snapshots if points_snapshots else None,
        kom_snapshots if kom_snapshots else None,
        youth_snapshots if youth_snapshots else None,
        teams_snapshots if teams_snapshots else None,
        teams_stage_result_snapshots if teams_stage_result_snapshots else None,
    )


def normalize_result_rows(
    raw_rows: list[dict],
    limit: int = MAX_RESULT_ROWS,
    *,
    name_field: str = "rider_name",
    value_field: Optional[str] = "time",
    include_team_name: bool = True,
    include_status: bool = True,
) -> Optional[list]:
    normalized: list[dict] = []

    non_finisher_statuses = {"DNF", "DNS", "OTL", "DSQ"}

    for row in raw_rows:
        if len(normalized) >= limit:
            break

        rider_name = str(row.get(name_field) or "").strip()
        rank_value = row.get("rank")
        status_str = str(row.get("status") or "").strip() if include_status else ""

        if not rider_name:
            continue
        # Include non-finisher rows (rank=None) only when their status is explicitly DNS/DNF/OTL/DSQ
        is_non_finisher = rank_value is None and status_str in non_finisher_statuses
        if rank_value in (None, "") and not is_non_finisher:
            continue

        entry: dict = {
            "rankLabel": str(rank_value).strip() if rank_value is not None else status_str,
            "riderName": rider_name,
        }

        rider_url = str(row.get("rider_url") or "").strip()
        if rider_url:
            entry["pcsSlug"] = rider_url

        nationality = str(row.get("nationality") or "").strip().upper()
        if len(nationality) == 2:
            entry["nationality"] = nationality

        team_name = str(row.get("team_name") or "").strip()
        if include_team_name and team_name:
            entry["teamName"] = team_name

        if value_field:
            time_value = str(row.get(value_field) or "").strip()
            if time_value:
                entry["time"] = time_value

        if include_status:
            status_value = str(row.get("status") or "").strip()
            if status_value:
                entry["status"] = status_value

        bonus_value = str(row.get("bonus") or "").strip()
        if bonus_value and bonus_value not in ("0:00:00", "0:00", "0"):
            entry["bonus"] = bonus_value

        normalized.append(entry)

    return normalized if normalized else None


def fetch_results(
    pcs_slug: str,
    is_one_day_race: bool,
    delay: float = 0.0,
    limit: int = MAX_RESULT_ROWS,
) -> Optional[list]:
    """
    Fetch the top rows of the final result table for a completed race.
    Returns a list of normalized result rows, or None if unavailable.
    """
    from procyclingstats import Stage as PCSStage

    relative_url = f"{pcs_slug}/result" if is_one_day_race else f"{pcs_slug}/gc"

    try:
        if delay > 0:
            time.sleep(delay)
        stage = PCSStage(relative_url)
        if is_one_day_race:
            raw_rows = stage.results(
                "rank",
                "rider_name",
                "rider_url",
                "team_name",
                "nationality",
                "time",
                "status",
            )
        else:
            raw_rows = stage.gc(
                "rank",
                "rider_name",
                "rider_url",
                "team_name",
                "nationality",
                "time",
            )
        return normalize_result_rows(raw_rows, limit=len(raw_rows))
    except Exception as exc:
        print(f"  ! No results for {pcs_slug}: {exc}")
        return None


def write_generated_data(
    races: list[dict],
    startlists: dict,
    stages: dict,
    results: dict,
    gc_standings: dict,
    stage_results: dict,
    points_standings: dict,
    kom_standings: dict,
    youth_standings: dict,
    teams_standings: dict,
    teams_stage_results: dict,
) -> None:
    payload = {
        "races": races,
        "startlists": startlists,
        "stages": stages,
        "results": results,
        "gcStandings": gc_standings,
        "stageResults": stage_results,
        "pointsStandings": points_standings,
        "komStandings": kom_standings,
        "youthStandings": youth_standings,
        "teamsStandings": teams_standings,
        "teamsStageResults": teams_stage_results,
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
        "--delay", type=float, default=0.1,
        help="Light per-request delay in seconds for direct detail fetches (default: 0.1)"
    )
    parser.add_argument(
        "--workers", type=int, default=4,
        help="Maximum parallel worker threads for race fetching (default: 4)"
    )
    parser.add_argument(
        "--full-season", action="store_true",
        help="Fetch the full season instead of the default rolling 2-month window"
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

    if args.full_season and (args.date_from or args.date_to):
        parser.error("--full-season cannot be combined with --date-from or --date-to")

    args.delay = max(0.0, args.delay)
    args.workers = max(1, args.workers)

    today = date.today()
    auto_window = False
    if not args.full_season and not args.date_from and not args.date_to:
        args.date_from, args.date_to = compute_default_window(today)
        auto_window = True

    if args.full_season:
        print("Fetching full season (no date window).")
    elif args.date_from or args.date_to:
        window_label = "Resolved rolling window" if auto_window else "Using date window"
        print(f"{window_label}: {args.date_from or '…'} -> {args.date_to or '…'}")

    slugs = fetch_race_slugs(args.year, date_from=args.date_from, date_to=args.date_to)

    def _fetch_details(indexed_item):
        index, item = indexed_item
        slug = item["slug"]
        uci_tour = item["uci_tour"]
        print(f"[{index}/{len(slugs)}] {slug} ({uci_tour})")

        details = fetch_race_details(slug, uci_tour, delay=args.delay)
        if not details:
            return None

        # Safety net in case the table date differed from the actual race date
        start_date = details.get("startDate", "")
        if args.date_from and start_date < args.date_from:
            return None
        if args.date_to and start_date > args.date_to:
            return None
        return details

    if slugs:
        detail_workers = min(args.workers, len(slugs))
        with ThreadPoolExecutor(max_workers=detail_workers) as executor:
            races = [race for race in executor.map(_fetch_details, enumerate(slugs, 1)) if race]
    else:
        races = []

    print(f"\nFetched {len(races)} races.")

    # Summary by filter group
    from collections import Counter
    by_filter_group = Counter(r["filterGroup"] for r in races)
    for filter_group, count in sorted(by_filter_group.items()):
        print(f"  {filter_group}: {count}")

    startlists: dict[str, list] = {}
    stages_map: dict[str, list] = {}
    results_map: dict[str, list] = {}
    gc_standings_map: dict[str, dict] = {}
    stage_results_map: dict[str, dict] = {}
    points_standings_map: dict[str, dict] = {}
    kom_standings_map: dict[str, dict] = {}
    youth_standings_map: dict[str, dict] = {}
    teams_standings_map: dict[str, dict] = {}
    teams_stage_results_map: dict[str, dict] = {}
    team_country_cache = load_team_country_cache()
    cache_lock = threading.Lock()
    initial_team_country_cache = json.dumps(team_country_cache, sort_keys=True)


    today_iso = today.isoformat()
    startlist_cutoff = (today + timedelta(days=7)).isoformat()
    races_with_slug = [race for race in races if race.get("pcsSlug")]

    def is_startlist_eligible(race: dict) -> bool:
        start_date = race.get("startDate", "")
        end_date = race.get("endDate", "")
        if end_date and end_date <= today_iso:
            return True
        return bool(start_date and start_date <= startlist_cutoff)

    eligible_startlist_races = [
        race
        for race in races_with_slug
        if is_startlist_eligible(race)
    ]
    skipped_future_startlists = len(races_with_slug) - len(eligible_startlist_races)

    def _fetch_startlist(race):
        pcs_slug = race.get("pcsSlug")
        if not pcs_slug:
            return race["id"], None

        race_id = race["id"]
        print(f"  [startlist:{race_id}] {pcs_slug}")
        teams = fetch_startlist(
            pcs_slug,
            team_country_cache=team_country_cache,
            cache_lock=cache_lock,
            delay=args.delay,
        )
        if teams:
            print(f"    Added {len(teams)} teams")
        return race_id, teams

    if races_with_slug:
        print(
            f"\nFetching startlists for {len(eligible_startlist_races)} races "
            f"(skipping {skipped_future_startlists} races more than 7 days away) …"
        )

    if eligible_startlist_races:
        startlist_workers = min(3, args.workers, len(eligible_startlist_races))
        with ThreadPoolExecutor(max_workers=startlist_workers) as executor:
            for race_id, teams in executor.map(_fetch_startlist, eligible_startlist_races):
                if teams:
                    startlists[race_id] = teams

    print(f"\nCollected {len(startlists)} startlists.")

    eligible_results_races = [
        race
        for race in races_with_slug
        if race.get("startDate") == race.get("endDate") and race.get("endDate", "") <= today_iso
    ]

    def _fetch_results(race):
        pcs_slug = race.get("pcsSlug")
        if not pcs_slug:
            return race["id"], None

        race_id = race["id"]
        is_one_day_race = race.get("startDate") == race.get("endDate")
        print(f"  [results:{race_id}] {pcs_slug}")
        rows = fetch_results(
            pcs_slug,
            is_one_day_race=is_one_day_race,
            delay=args.delay,
        )
        if rows:
            print(f"    Added top {len(rows)} results")
        return race_id, rows

    if eligible_results_races:
        print(
            f"\nFetching final one-day results for {len(eligible_results_races)} races "
            "(ending today or earlier) …"
        )
        result_workers = min(2, args.workers, len(eligible_results_races))
        with ThreadPoolExecutor(max_workers=result_workers) as executor:
            for race_id, rows in executor.map(_fetch_results, eligible_results_races):
                if rows:
                    results_map[race_id] = rows

    print(f"\nCollected {len(results_map)} result files.")

    multi_day_races = [race for race in races if race.get("startDate") != race.get("endDate")]
    eligible_stage_races = [race for race in multi_day_races if race.get("pcsSlug")]

    def _fetch_stages(race):
        pcs_slug = race.get("pcsSlug")
        if not pcs_slug:
            return race["id"], None, None, None, None, None, None, None, None

        race_id = race["id"]
        start_date = race.get("startDate", "")
        end_date = race.get("endDate", "")
        print(f"  [stages:{race_id}] {pcs_slug}")
        (
            stages,
            gc_standings,
            stage_results,
            points_standings,
            kom_standings,
            youth_standings,
            teams_standings,
            teams_stage_results,
        ) = fetch_stages(
            pcs_slug,
            start_date,
            end_date,
            delay=args.delay,
        )
        if stages:
            print(f"    Added {len(stages)} stages")
        if gc_standings:
            print(f"    Added {len(gc_standings)} GC snapshots")
        if stage_results:
            print(f"    Added {len(stage_results)} stage result snapshots")
        if points_standings:
            print(f"    Added {len(points_standings)} points snapshots")
        if kom_standings:
            print(f"    Added {len(kom_standings)} KOM snapshots")
        if youth_standings:
            print(f"    Added {len(youth_standings)} youth snapshots")
        if teams_standings:
            print(f"    Added {len(teams_standings)} team snapshots")
        if teams_stage_results:
            print(f"    Added {len(teams_stage_results)} team stage result snapshots")
        return (
            race_id,
            stages,
            gc_standings,
            stage_results,
            points_standings,
            kom_standings,
            youth_standings,
            teams_standings,
            teams_stage_results,
        )

    if eligible_stage_races:
        print(f"\nFetching stages for {len(eligible_stage_races)} races …")
        stage_workers = min(2, args.workers, len(eligible_stage_races))
        with ThreadPoolExecutor(max_workers=stage_workers) as executor:
            for (
                race_id,
                stages,
                gc_standings,
                stage_results,
                points_standings,
                kom_standings,
                youth_standings,
                teams_standings,
                teams_stage_results,
            ) in executor.map(
                _fetch_stages,
                eligible_stage_races,
            ):
                if stages:
                    stages_map[race_id] = stages
                if gc_standings:
                    gc_standings_map[race_id] = gc_standings
                if stage_results:
                    stage_results_map[race_id] = stage_results
                if points_standings:
                    points_standings_map[race_id] = points_standings
                if kom_standings:
                    kom_standings_map[race_id] = kom_standings
                if youth_standings:
                    youth_standings_map[race_id] = youth_standings
                if teams_standings:
                    teams_standings_map[race_id] = teams_standings
                if teams_stage_results:
                    teams_stage_results_map[race_id] = teams_stage_results

    print(f"\nCollected {len(stages_map)} stage files.")
    print(f"Collected {len(gc_standings_map)} GC standing files.")
    print(f"Collected {len(stage_results_map)} stage result files.")
    print(f"Collected {len(points_standings_map)} points standing files.")
    print(f"Collected {len(kom_standings_map)} KOM standing files.")
    print(f"Collected {len(youth_standings_map)} youth standing files.")
    print(f"Collected {len(teams_standings_map)} team standing files.")
    print(f"Collected {len(teams_stage_results_map)} team stage result files.")

    if json.dumps(team_country_cache, sort_keys=True) != initial_team_country_cache:
        write_team_country_cache(team_country_cache)

    write_generated_data(
        races,
        startlists,
        stages_map,
        results_map,
        gc_standings_map,
        stage_results_map,
        points_standings_map,
        kom_standings_map,
        youth_standings_map,
        teams_standings_map,
        teams_stage_results_map,
    )
    print(f"\nWrote local runtime data to {GENERATED_PATH}")
    print("\nSummary")
    print(f"  Slugs in date window: {len(slugs)}")
    print(f"  Races fetched: {len(races)}")
    print(f"  Startlists eligible: {len(eligible_startlist_races)}")
    print(f"  Startlists skipped (>7 days away): {skipped_future_startlists}")
    print(f"  Startlists collected: {len(startlists)}")
    print(f"  One-day results eligible (ending today or earlier): {len(eligible_results_races)}")
    print(f"  Result sets collected: {len(results_map)}")
    print(f"  Multi-day races eligible for stages: {len(eligible_stage_races)}")
    print(f"  Stage sets collected: {len(stages_map)}")
    print(f"  GC standing sets collected: {len(gc_standings_map)}")
    print(f"  Stage result sets collected: {len(stage_results_map)}")
    print(f"  Points standing sets collected: {len(points_standings_map)}")
    print(f"  KOM standing sets collected: {len(kom_standings_map)}")
    print(f"  Youth standing sets collected: {len(youth_standings_map)}")
    print(f"  Team standing sets collected: {len(teams_standings_map)}")


if __name__ == "__main__":
    main()
