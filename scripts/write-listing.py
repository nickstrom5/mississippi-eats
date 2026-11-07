#!/usr/bin/env python3
"""Writes playbook/app-store/listing.json (the App Store listing, the family's format: wy-eats/playbook/app-store/listing.json) with
every count taken from data/app/places.json, so the copy can't drift from the data. Checks Apple's lengths, that no keyword repeats a
word of the name or subtitle, and that no keyword is "best", "top" or "#1".
Usage (from ms-eats/): .venv/bin/python scripts/write-listing.py   (re-run after every data rebuild)"""
import json, os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
d = json.load(open(f"{ROOT}/data/app/places.json"))
P = [p for p in d["places"] if not p.get("v")]
bit = {t: 1 << i for i, t in enumerate(d["tags"])}
n = {t: sum(1 for p in P if p.get("hc") and (p.get("g", 0) & bit[t])) for t in d["tags"]}
n_hc = sum(1 for p in P if p.get("hc") and (p.get("g", 0) & sum(bit.values())))
hon = sum(1 for p in P if p.get("mi") or p.get("jbf"))
bib = sum(1 for p in P if p.get("mi") == 2)
towns = len({p["c"] for p in P if p.get("c") is not None})
R = len(P)
scored = sum(1 for p in P if p.get("in"))
graded = scored
SITE = "https://nickstrom5.github.io/mississippi-eats/"
name = "Mississippi Eats: Restaurants"
sub = "Hot Tamales, Catfish & Po'boys"
desc = f"""Mississippi's restaurants, from Delta hot tamales in Greenville to po'boys on the Gulf Coast.

Mississippi Eats is a free guide to eating in Mississippi: {n['tamales']} Delta hot tamale places, {n['catfish']} catfish houses, {n['poboys']} po'boy shops and oyster bars, {n['plates']} plate-lunch and fried chicken places and {n['comeback']} comeback sauce and fried pickle spots we checked by hand, plus {R:,} restaurants, cafés, bars and bakeries in {towns} towns, from Jackson, Oxford and Hattiesburg to the Delta and the Coast. No account, no ads.

MISSISSIPPI GUIDES
• Delta Hot Tamales: Doe's Eat Place in Greenville to Clarksdale, Vicksburg and Natchez.
• Catfish Houses: Taylor Grocery to Jerry's on Highway 49.
• Po'boys & Gulf Oysters: Pascagoula to Pass Christian.
• Plate Lunches & Fried Chicken: blue plates and soul food.
• Comeback Sauce & Fried Pickles: where they began.
• MICHELIN & James Beard: {hon} honored Mississippi restaurants, {bib} of them Bib Gourmands.

FIND IT FAST
• Sort by distance, or browse the map by guide.
• Search by name, town, street or dish: "hot tamales", "catfish oxford", "comeback sauce".
• Filter by town or cuisine, show only Bib Gourmands, or hide chains.
• Save places, and find hand-checked places from iPhone search (Spotlight).

LIVE DETAILS FROM APPLE MAPS
Tap "Ratings, hours & photos" on any place to open Apple Maps' own place card, with current hours, photos, ratings and directions.

HOW THE LISTS ARE BUILT
Every guide place was checked by hand in fall 2026 against a 2025 or 2026 source: Visit Mississippi's own pages, the MICHELIN Guide or a dated local story. The rest come from Overture Maps open data and the Mississippi State Department of Health's food facility records. For {graded:,} restaurants, a place shows MSDH's latest inspection grade (A, B or C), dated and labeled as MSDH's own; the app computes no grade and never ranks by one. Website links are checked too. Newer restaurant data downloads from the Mississippi Eats website when there is some.

PRIVATE BY DESIGN
No account, no tracking, no ads. Your location, if you share it, only sorts lists on your device. Saved places stay on your device.

Places open and close, so check before you go. Spot a mistake? Email nick@eatsranked.com.

An independent app, not affiliated with any restaurant, chain or government agency (including the State of Mississippi, the Mississippi State Department of Health or Visit Mississippi), or with the MICHELIN Guide or the James Beard Foundation. MICHELIN is a trademark of Michelin. James Beard Foundation and James Beard Award are trademarks of the James Beard Foundation. Place data from Overture Maps Foundation (CDLA Permissive 2.0) and others; sources and licenses are on the About tab."""
kw = "jackson,oxford,biloxi,greenville,clarksdale,delta,hattiesburg,oysters,comeback,soul food,bbq"
promo = (f"Delta hot tamales, catfish houses, po'boys and plate lunches: {n_hc} places checked by hand, plus {R:,} Mississippi "
         "restaurants, nearest first.")
review = f"""1. Purpose and audience: Mississippi Eats is a free guide to restaurants in Mississippi (the U.S. state). Its focus is the state's own food: Delta hot tamales, catfish houses, po'boys and Gulf oysters, plate lunches and fried chicken, and comeback sauce, {n_hc} places checked by hand in fall 2026 against a 2025 or 2026 source, plus the MICHELIN Guide and James Beard honorees. It also lists {R:,} restaurants, cafés and bars in {towns} towns from open map data and the state health department's food facility records. It is for residents and visitors deciding where to eat, with no ads, account or tracking.

2. How to use it (no login, no setup, no sample files needed):
- Home → Delta Hot Tamales (or Catfish Houses, Po'boys & Gulf Oysters, Plate Lunches & Fried Chicken, Comeback Sauce & Fried Pickles, MICHELIN & James Beard, Oldest Places, Official MSDH Grades, Near Me) → tap any place.
- On a place, tap "Ratings, hours & photos" to open Apple Maps' own place card through MapKit. Directions, Call and Website are below it; further down, the Health inspections section shows the state health department's latest grade, with a link to its search in Safari.
- Search from the Home search box by name, town, street or dish ("hot tamales", "catfish oxford", "comeback sauce").
- The Map tab shows each guide as pins. "My location" and the Nearest sort use location only if allowed, on the device.
- The heart saves a place on the device (Saved tab). The About tab lists the sources, licenses and the independence statement.
- On iPad, a sidebar replaces the tabs; a place opens in the right-hand column.
- Location: if you're outside Mississippi (as App Review usually is), the map says so and stays on Mississippi, and distance sorting still works from where you are.

3. External services and data:
- Apple MapKit: maps, local search to find a place's Apple Maps listing, and Apple's place card for live hours, photos and ratings.
- Core Location: optional, on-device only, for distance sorting.
- Data updates: at most once a day, the app checks the Mississippi Eats website (static files on GitHub Pages) for newer restaurant data and downloads it if there is some. The requests carry no identifiers or location.
- No backend, accounts, analytics, advertising, payments or AI services. The restaurant data is bundled in the app.
- Bundled data sources: Overture Maps Foundation open place data (CDLA Permissive 2.0 and others; license texts are in the app); the inspection grades the Mississippi State Department of Health posts in its public food facility search; MICHELIN Guide and James Beard Foundation honors (facts only); and our own research of public tourism pages and local news.
- The website with the privacy policy and support page is static and hosted on GitHub Pages: {SITE}

4. Regional differences: none. The content covers Mississippi; the app is offered in the United States and works the same everywhere.

5. Regulated or protected material: the app is not in a regulated industry and includes no protected third-party material. The data is open-licensed or public record, with attribution and licenses on the About tab. Inspection grades are shown only as the state health department posts them, dated and labeled official, with its disclaimer; the app computes no grade and never ranks by one. Ratings, hours and photos are shown only inside Apple's own place card through MapKit; the app stores no ratings or reviews. Every website link was checked before release, and adult venues are excluded. The app is independent and not affiliated with any restaurant, agency, the MICHELIN Guide or the James Beard Foundation.

Support: nick@eatsranked.com"""
L = {"bundleId": "com.mississippieats.ios", "name": name, "subtitle": sub, "privacyPolicyUrl": SITE + "privacy.html",
     "primaryCategory": "FOOD_AND_DRINK", "secondaryCategory": "TRAVEL", "description": desc, "keywords": kw, "promotionalText": promo,
     "supportUrl": SITE, "marketingUrl": SITE, "reviewNotes": review}
for k, lim in [("name", 30), ("subtitle", 30), ("keywords", 100), ("promotionalText", 170), ("description", 4000), ("reviewNotes", 4000)]:
    assert len(L[k]) <= lim, (k, len(L[k]), lim)
    print(f"{k}: {len(L[k])}/{lim}")
words = {w.lower().strip(":,&") for w in (name + " " + sub).split()}
assert not ({w for w in kw.replace(",", " ").split()} & words), "a keyword repeats the name or subtitle"
assert not any(b in kw.split(",") for b in ("best", "top", "#1"))
os.makedirs(f"{ROOT}/playbook/app-store", exist_ok=True)
json.dump(L, open(f"{ROOT}/playbook/app-store/listing.json", "w"), indent=1, ensure_ascii=False)
print("wrote playbook/app-store/listing.json")
