"""Mississippi's official food inspection records -> data/raw/official/ (git-ignored, never public).

The Mississippi State Department of Health (MSDH) "regulates all food service in Mississippi" (no city or county runs its own program).
Its food facility search, apps.msdh.ms.gov/food, posts each inspection's official result, **A, B or C** (MSDH's definitions,
msdh.ms.gov/page/43,0,231,333.html: A = no critical violations; B = critical violations corrected during the inspection; C = critical
violations not corrected, or repeated from the last inspection). Blank and "X" results aren't grades.

The pull plan (STATE prompt: "confirm the pull plan with Nick"; run only with his yes):
1. The permit list, "Find an Approved Food Facility by Type" (default.aspx), exported for the Full Service and Fast Food/Deli types:
   name, street, city, zip, phone, permit and expire dates.
2. Inspections by date: FacilityListingDates.aspx?Start_Date=…&End_Date=… lists every inspection in the window on one page (677 rows
   for 20-29 Oct 2026): PimsID (in the Details link), Name, District, City, Street, Inspection Date, Result, Type. That page holds
   everything the "Data Export" has but the ZIP, plus the PimsID, so the export isn't downloaded (half the requests). One-day windows
   return a fraction, so the pull uses overlapping 10-day windows (3 days overlap) from 2025-08-01 to the records-through day (7 days
   before the pull). Nick approved this plan on 2026-11-06 (through the parent session). The permit list (step 1) is not needed yet.
One request at a time, 3 s apart, an honest user agent; no CAPTCHA or robots.txt (checked 2026-11-06). Nothing is sent to MSDH but GETs.
Usage: ../.venv/bin/python fetch_official.py --go     (without --go it only prints the plan)
"""
import datetime, html, json, os, re, sys, time
import requests

OUT = os.path.join(os.path.dirname(__file__), "..", "data", "raw", "official", "msdh")
BASE = "https://apps.msdh.ms.gov/food/"
UA = "MississippiEatsDataCheck/1.0 (+https://nickstrom5.github.io/mississippi-eats/; nick@eatsranked.com)"
TODAY = datetime.date.today()
THROUGH = TODAY - datetime.timedelta(days=7)
START = datetime.date(2025, 8, 1)
WINDOW, OVERLAP, PAUSE = 10, 3, 3.0


def windows():
    d = START
    while d <= THROUGH:
        e = min(d + datetime.timedelta(days=WINDOW - 1), THROUGH)
        yield d, e
        d = e - datetime.timedelta(days=OVERLAP - 1) if e < THROUGH else e + datetime.timedelta(days=1)


def plan():
    w = list(windows())
    print(f"MSDH pull: {len(w)} windows of {WINDOW} days ({OVERLAP} overlap), {START} to {THROUGH}; one listing page each"
          f": {len(w)} requests, {PAUSE:.0f} s apart (~{len(w) * PAUSE / 60:.0f} min plus page time)")
    return w


S = requests.Session(); S.headers["User-Agent"] = UA


def get(url):
    for attempt in range(4):
        r = S.get(url, timeout=120)
        if r.status_code == 200:
            return r.text
        time.sleep(10 * (attempt + 1))
    r.raise_for_status()


def text(s):
    return html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", s or ""))).strip()


def table_rows(s):
    out = []
    for tr in re.findall(r"(?s)<tr[^>]*>(.*?)</tr>", s):
        cells = re.findall(r"(?s)<t[dh][^>]*>(.*?)</t[dh]>", tr)
        if cells:
            out.append(cells)
    return out


def main():
    w = plan()
    if "--go" not in sys.argv:
        return
    os.makedirs(OUT, exist_ok=True)
    listing, export = [], []
    for i, (a, b) in enumerate(w):
        q = f"Start_Date={a:%m/%d/%Y}&End_Date={b:%m/%d/%Y}"
        page = get(BASE + "FacilityListingDates.aspx?" + q)
        if re.search(r"(?i)captcha|access denied", page):
            sys.exit(f"MSDH answered {a}..{b} with a challenge: stopping (nothing more is requested)")
        for cells in table_rows(page):
            link = re.search(r"PimsID=(\d+)", " ".join(cells))
            if link:
                listing.append({"pims": link.group(1), "cells": [text(c) for c in cells], "window": [str(a), str(b)]})
        if "SHUTDOWN is in progress" in page or "OdbcException" in page:
            sys.exit(f"MSDH's database was down for {a}..{b}: stopping (rerun later; nothing saved)")
        time.sleep(PAUSE)
        if i % 10 == 0:
            print(f"  {a}..{b}: listing {len(listing)}, export {len(export)}", flush=True)
    json.dump(listing, open(os.path.join(OUT, "listing.json"), "w"))
    json.dump(export, open(os.path.join(OUT, "export.json"), "w"))
    json.dump({"fetched": str(TODAY), "through": str(THROUGH), "start": str(START), "windows": len(w), "listing_rows": len(listing),
               "export_rows": len(export), "source": BASE}, open(os.path.join(OUT, "meta.json"), "w"), indent=1)
    print("MSDH: listing rows", len(listing), "| export rows", len(export))


if __name__ == "__main__":
    main()
