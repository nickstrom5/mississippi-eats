# Mississippi Eats (ms-eats) — notes for Claude Code sessions

Built 2026-11-06 by a side session for Nick's "build the 17 states left" (group: Alabama, Mississippi, Arkansas, Oklahoma), ported from
`../al-eats/` (itself from `../wy-eats/`, the newest finished state of 2026-11-05: delivery-only brands hidden, the website blocklist
and `link_blocklist.py`, the Share link `Links.site + explore/#p=<id>`, over-the-air data, adult-venue filtering, the Denny's
delivery-brand rule, the `playbook/app-store/listing.json` format). Local only: git-ignored data, no repo, no remote, nothing published,
nothing in App Store Connect. Sources: `playbook/12-sources.md`. Brand: `playbook/05-naming.md` — **final** (Nick's decisions, 2026-11-07: "Mississippi Eats: Restaurants", Home Screen "Mississippi Eats"; a Gulf shrimp icon, concept C, on flag navy; the 2021 flag's
navy #00205B and red #BF0A30, deep navy #1B2F5E, flag gold #C9A84C as a fill only, cream #F6F1E4; a magnolia header band).

## Status (2026-11-07)
- See the end of this file (updated last).

## Mississippi is different
- **One statewide official source.** The Mississippi State Department of Health (MSDH) runs all food inspection. Its food facility
  search posts each inspection's official grade, **A, B or C**, with its date. `pipeline/fetch_official.py --go` reads the
  "FacilityListingDates" page for 65 overlapping 10-day windows (2025-08-01 to the records-through day, 7 days before the pull), one
  request at a time, 3 s apart, and stops on a database SHUTDOWN or a challenge. Nick approved this pull on 2026-11-06 (via the parent
  session); ask again before any new kind of request, and never email or request records from MSDH. `official.py` groups rows by
  PimsID and keeps restaurants, fast food, bakeries and bars; mobile units only match existing listings; schools, day cares, hospitals,
  caterers and processors are dropped.
- **How a grade shows**: only as MSDH posts it, on the place ("Latest grade (official) A · date", "Graded by Mississippi State
  Department of Health", MSDH's A/B/C definitions and its disclaimer word for word) and in a white "Official MSDH Grades" card sorted by
  date, distance or name — never by grade, never a computed grade. Nick (11-05): the app leads with the hand-checked guides; the grades
  card is one list among them, last before Near Me.
- **No Google data anywhere**, not even the private web build (`listings.py` makes an empty Google 2021 table). `calibrate.py`
  measures the keep rule against MSDH statewide (Meta ≥0.95 matched 60.9%).
- **Many places come from MSDH alone** (5,488 of 8,091 in the app): the listing data is thin in the Delta and the hill country.
  Their points come from Overture addresses or the Census geocoder.
- **Hand-checked matching is strict**: a statewide name match must be within 30 km of the checked town's centre, and the checked town
  overrides a listing's town only when the source's address matched (an early build moved Aunt B's to Redwood and Fratesi's to
  Ridgeland).
- **"CASINO" is out of the soft venue words** here: many Gulf Coast and river-town restaurants sit inside casinos.
- **Guides** (tags in `mississippi.py` TAGS; bits 1..32): tamales (Delta hot tamales), catfish, poboys (po'boys and Gulf oyster bars),
  plates (plate lunches, soul food, fried chicken), comeback (comeback sauce and fried pickles), oldest (≤1960 at this address; only the
  Mayflower Café, 1935, so far). Research is hand-written in `data/research/app/*.json` (Visit Mississippi, Magnolia Tribune, The Local
  Palate); `build_research.py` only checks it and writes `LEADS.md`.
- **Honors**: MICHELIN Guide American South 2026, 13 Mississippi places (3 Bib Gourmand: Elvie's, Sacred Ground Barbecue, Miscellanea
  Spirit House; no stars); James Beard (Doe's Eat Place 2007 and Bully's 2016 America's Classics; Vishwesh Bhatt of Snackbar, Best Chef:
  South 2019; 2025-26 semifinalists Elvie's, White Pillars, Vestige).

## Rebuild
```bash
cd pipeline
../.venv/bin/python check_sources.py URL...   # a new host first
../.venv/bin/python fetch_overture.py && ../.venv/bin/python fetch_extras.py
../.venv/bin/python fetch_official.py --go    # only with Nick's yes for a new pull
../.venv/bin/python geocode_official.py && ../.venv/bin/python geocode_census.py && ../.venv/bin/python listings.py
../.venv/bin/python calibrate.py && ../.venv/bin/python mississippi.py && ../.venv/bin/python build_research.py
MS_APP=1 ../.venv/bin/python mississippi.py && cd .. && cp data/app/places.json data/app/detail-*.json MississippiEats/Resources/
.venv/bin/python pipeline/check_websites.py && .venv/bin/python pipeline/check_websites.py --retry-transient   # then re-export
.venv/bin/python scripts/make-site.py && .venv/bin/python scripts/publish_app_data.py && .venv/bin/python scripts/publish_app_data.py --check
.venv/bin/python scripts/qa-site.py && .venv/bin/python scripts/write-listing.py
```
The `.venv` is on the python.org framework Python 3.12 with md-eats' versions. `data/chain_auv.json` is a copy of wy-eats'.

## App, site, screenshots
- App: `MississippiEats/` (XcodeGen `project.yml`, bundle `com.mississippieats.ios`, display "Mississippi Eats"), tests in
  `MississippiEatsTests/` (fixture with A/B/C grades, guides, the grades list, outline towns: Southaven, Vicksburg, Natchez in;
  Memphis, Vidalia, Mobile, Slidell out; data guards) and `MississippiEatsUITests/`. Tests: `xcodebuild test -scheme MississippiEats
  -destination id=<sim> -parallel-testing-enabled NO` with `DEVELOPER_DIR="/Applications/Xcode 1.app/Contents/Developer"` (no
  CODE_SIGNING_ALLOWED=NO: UI tests need a signed runner). Archive only with Xcode 1.app (27.2, 27B52). Run `xcodegen generate`
  whenever `Resources/*.json` changes.
- Site: `scripts/make-site.py` → `docs/`; `scripts/explore.js` the web app (an "Official MSDH Grades" list from core column `sd`, the
  grade itself only in the place panel); `scripts/qa-site.py`. URL for now: nickstrom5.github.io/mississippi-eats (no CNAME). City pages
  from CITY_WANTED where a town has at least 4 listed places.
- Screenshots: `scripts/capture-screenshots.sh <sim> home tamales catfish poboys plates comeback detail map honors oldest inspections
  saved about` (ScreenshotMode pins Jackson's Fondren; downtown Jackson to Belhaven for the map, at a 3 km span so picks are single pins; Biloxi for the po'boys; Greenville for the detail, Doe's Eat Place), then
  `scripts/site-images.sh`, make-site, qa-site; App Store frames `scripts/appstore-screenshots.py` (iPhone: home tamales detail catfish
  poboys map plates saved; iPad: home tamales catfish map poboys comeback). No grades screen in any App Store image.

## Rules
No commits, pushes, public repos, App Store Connect or DNS changes without Nick's yes each time; never submit for review or accept
agreements; never publish Google-derived data. Support email nick@eatsranked.com. Commit author "Nick Soderstrom"
<329204362+nickstrom5@users.noreply.github.com> via `-c user.name -c user.email`.

## Status (2026-11-07, final)
- DONE: pipeline (Overture 2026-10-21.0, 82 counties, border towns checked), MSDH's food facility list (Nick's yes, 2026-11-06),
  calibration, research (46 entries, 44 matched; Maringouin and Aunt B's are leads), app export **8,091 places / 7,362 restaurants**
  (5,347 with an MSDH grade as MSDH posts it; 15 honored), website link check, Swift app, icon concepts (all pass check.swift) +
  make-brand, site (14 pages incl. Jackson and Oxford) + web app, OTA local copy `--check` OK (2026-11-06.1), `listing.json`
  (lengths checked), 12-sources and 13-app-review-reply (3,971 characters) at the final counts.
- The street key reads "Hwy 45 North" as "Highway 45 N" (Columbus's Mugshots and Peking were listed twice); the data was rebuilt
  from a fresh address index after that fix.
- Tests (iOS 27.0 simulators, Xcode 1.app 27.2): iPad 13": all unit + UI tests pass. iPhone 17 Pro Max: all unit + UI tests pass
  except testLaunchIsQuick, which measured 7.2 s at load 16.4 (just under its skip line; limit 6 s) and was skipped at load 25
  (7.5 s). Rerun once more at 07:00 from a quiet start, it skipped again (5.9 s at load 26, under the limit): the shared Mac
  never stayed quiet through a build and test. On a quiet Mac (the parent session's run, 2026-11-07) it
  passed on iPhone at 4.54 s.
- Screenshots: 13 iPhone + 6 iPad captures (the map recaptured on downtown Jackson, pins not clusters), App Store frames in
  `playbook/app-store/{iphone,ipad}/`, site images; full `qa-site.py` (static + browser) passes.
- **Ready to publish**; nothing is public. Nick's decisions (2026-11-07): the name "Mississippi Eats: Restaurants", the subtitle
  "Hot Tamales, Catfish & Po'boys", icon C (the Gulf shrimp) and the 2021-flag palette are final; yes to scripting the Department of
  Revenue's alcohol permit search, but that search is in TAP, whose robots.txt disallows all robots, so it isn't scripted and
  "Serves alcohol" stays unknown (a records request would be Nick's call). The launch-time test passed on a quiet Mac (iPhone 4.54 s,
  the parent session's run of 2026-11-07).
