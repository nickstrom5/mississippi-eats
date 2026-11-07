# Mississippi sources and calibration (checked 2026-11-06)

## Official sources
| Source | What it has | Can a script read it? | Used |
|---|---|---|---|
| Mississippi State Department of Health (MSDH) food facility search (apps.msdh.ms.gov/food/) | every food facility in the state (MSDH runs all food inspection; no city or county program); each inspection's official result A, B or C with its date and type | yes: "FacilityListingDates.aspx" lists every inspection in a date window on one page, with the PimsID; no CAPTCHA or robots.txt | yes: 65 overlapping 10-day windows, 2025-08-01 to 2026-10-30 (Nick's yes, 2026-11-06, through the parent session; one request at a time, 3 s apart, GETs only) |
| MSDH "Data Export" (FacilityListingDatesExport.aspx) | the same rows plus ZIP, no PimsID | yes | no: the listing page has everything it has but the ZIP, so half the requests |
| MSDH permit list ("Find an Approved Food Facility by Type") | name, street, city, zip, phone, permit and expire dates | yes | no: not needed yet |
| MSDH facility pages (FacilityRecord.aspx?PimsID=…) | status, history, item reports | yes | no: one request per place; the listing has the latest grade |
| Mississippi Department of Revenue, alcohol licensing (ABC) | ABC permits | no public list or download; the only search, "Search ABC Permits" (tap.dor.ms.gov/?link=PermitSearch), is in TAP, whose robots.txt disallows all robots (`Disallow: /`, checked 2026-11-07), so it isn't scripted even with Nick's yes to script it; a written records request to DOR's Legal Division (DOR need not compile a list) would be Nick's call | no: "Serves alcohol" is unknown |

The pull: 29,582 listing rows, 15,178 facilities (grouped by PimsID). Latest grades A 12,577, B 1,098, C 358; the rest blank or "X"
(not grades). Kept as places to eat: Full Service Restaurant, Fast Food or Delicatessen, Bakery / Donuts / Coffeeshop, Full Service Bar,
Bar with prepackaged and Flavored Ice (9,679); mobile food units (1,428) only match existing listings; schools, day cares, hospitals,
nursing homes, caterers, warehouses and processors (4,071) are dropped. Records run through 2026-10-30 (7 days before the pull).
MSDH's grade definitions (msdh.ms.gov/page/43,0,231,333.html): A = no critical violations; B = critical violations corrected during the
inspection; C = critical violations not corrected, or repeated from the last inspection. A grade is shown as MSDH posts it, dated,
labeled MSDH's own, with MSDH's disclaimer word for word, only on the place and in an "Official MSDH Grades" list sorted by date,
distance or name, never by grade. No grade is computed. Nothing was emailed or requested from MSDH.

## Calibration (statewide, MSDH; pipeline/calibrate.py)
- 12,857 open listings vs 10,471 MSDH food records. High-confidence Meta listings matched an inspected business 60.9% of the time; Meta
  0.90 with a website 48%, without 36%, Meta below 0.90 19%, BrightQuery 21%, brand feeds 34%, other sources 11%; listings Overture or
  the name marks closed 3.6%. 51.4% of MSDH's food businesses are among the open listings (the rest come in from the list itself when
  the name and type say it's a place to eat). Keep rule as in the newest states: Meta 0.95, or 0.90 with a website.
- No Google data anywhere (not even the private web build): listings.py's Google 2021 table is empty.
- Overture 2026-10-21.0 in the Mississippi box; the App Store build ships **8,091 places, 7,362 restaurants** in 82 counties
  (5,488 from MSDH's list only, 1,308 on both, 566 from listings only). 5,347 places show an MSDH grade.
- 103 places matched to MSDH only by an address shared with another business were demoted and 39 dropped; 281 duplicates merged; one
  adult club removed (Babe's of Jackson, near an Overture adult venue).

## Research sources (each place cites its own; every host passed check_sources.py)
- Visit Mississippi: "8 Beloved Mississippi Bites and Where to Eat Them", "Tamale Tastin' in Mississippi", the Hicks' World Famous
  Tamales listing, and its news page on Style Blueprint's bucket-list restaurants.
- Magnolia Tribune, "Mississippians choose catfish on Fridays during Lent" (2026-02-26).
- The Local Palate, the Mayflower Café (founded 1935, the comeback sauce story).
- MICHELIN Guide American South, Mississippi (guide.michelin.com, 2026 second selection, read 2026-11-06): 13 places, 3 Bib Gourmands
  (Elvie's, Sacred Ground Barbecue, Miscellanea Spirit House), no stars.
- jamesbeard.org: America's Classics (Doe's Eat Place 2007, Bully's Restaurant 2016), the 2019 winner (Vishwesh Bhatt, Snackbar),
  2025 and 2026 semifinalists (Elvie's, White Pillars, Vestige).
- Blocked (robots): clarionledger.com (its robots.txt disallows Claude and most bots), so nothing is cited from it. The robots.txt of
  visitjackson.com, coastalmississippi.com, visitvicksburg.com, visitnatchez.org and others was checked; nothing from them is cited.
- Leads without a match (data/research/app/LEADS.md): Maringouin (Ocean Springs; no listing or MSDH row under that name), Aunt B's
  (Tupelo; no place of that name in Tupelo).
