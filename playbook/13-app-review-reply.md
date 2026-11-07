# App Review: Guideline 2.1 "Information Needed" (prepared before submitting)

Expect a 2.1 request for a physical-device screen recording plus six answers (Wisconsin's first submission drew one). Record the
screen recording **before** submitting and upload it in **App Review Information → Attachment**; the listing's review notes
(playbook/app-store/listing.json) already answer the questions. If Apple asks anyway, paste the reply below into **Reply to App
Review** with the recording. Keep it under 4,000 characters (now 3,971); recount after the final data build.

## Screen recording (Nick, on his iPhone, latest iOS)
Install through TestFlight first (internal group; the tester email must be the Apple ID under Settings › your name › Media &
Purchases). Record with Control Center → Screen Recording, 60–120 s, no sound:
1. Start on the Home Screen and tap **Mississippi Eats**. The recording must begin with the launch.
2. Home: scroll the guide cards a little.
3. Tap **Delta Hot Tamales**, then **Doe's Eat Place** (Greenville, a James Beard America's Classic).
4. Tap **Ratings, hours & photos**. Apple's place card opens. Close it.
5. Tap the **heart** (Save), then go back twice.
6. Tap the Home search box and type `comeback sauce`. Open **Mayflower Café**.
7. Tap the **Map** tab, then **Mississippi picks**. Tap a numbered circle to zoom in, then a pin, then the ⓘ in its bubble.
8. Tap **Saved**, where the saved place shows. Then **About**, and scroll to the sources.

## Reply text
```
Thank you. Here is the information requested. A screen recording from an iPhone running the latest iOS is attached. It starts at launch and shows the full flow.

1. Screen recording: attached. There is no account, login, user-generated content or paid content.

2. Purpose and audience: Mississippi Eats is a free guide to restaurants in Mississippi (the U.S. state). Its focus is the state's own food: Delta hot tamales, catfish houses, po'boys and Gulf oysters, plate lunches and fried chicken, and comeback sauce, 34 places checked by hand in fall 2026 against a 2025 or 2026 source, plus the MICHELIN Guide and James Beard honorees. It also lists 7,362 restaurants, cafés and bars in 293 towns from open map data and the state health department's food facility records. It is for residents and visitors deciding where to eat, with no ads, account or tracking.

3. How to use it (no login, no setup, no sample files needed):
- Home → Delta Hot Tamales (or Catfish Houses, Po'boys & Gulf Oysters, Plate Lunches & Fried Chicken, Comeback Sauce & Fried Pickles, MICHELIN & James Beard, Oldest Places, Official MSDH Grades, Near Me) → tap any place.
- On a place, tap "Ratings, hours & photos" to open Apple Maps' own place card through MapKit. Directions, Call and Website are below it; further down, the Health inspections section shows the state health department's latest grade, with a link to its search in Safari.
- Search from the Home search box by name, town, street or dish ("hot tamales", "catfish oxford", "comeback sauce").
- The Map tab shows each guide as pins. "My location" and the Nearest sort use location only if allowed, on the device.
- The heart saves a place on the device (Saved tab). The About tab lists the sources, licenses and the independence statement.
- On iPad, a sidebar replaces the tabs; a place opens in the right-hand column.
- Location: if you're outside Mississippi (as App Review usually is), the map says so and stays on Mississippi, and distance sorting still works from where you are.

4. External services and data:
- Apple MapKit: maps, local search to find a place's Apple Maps listing, and Apple's place card for live hours, photos and ratings.
- Core Location: optional, on-device only, for distance sorting.
- Data updates: at most once a day, the app checks the Mississippi Eats website (static files on GitHub Pages) for newer restaurant data and downloads it if there is some. The requests carry no identifiers or location.
- No backend, accounts, analytics, advertising, payments or AI services. The restaurant data is bundled in the app.
- Bundled data sources: Overture Maps Foundation open place data (CDLA Permissive 2.0 and others; license texts are in the app); the inspection grades the Mississippi State Department of Health posts in its public food facility search; MICHELIN Guide and James Beard Foundation honors (facts only); and our own research of public tourism pages and local news.
- The website with the privacy policy and support page is static and hosted on GitHub Pages: https://nickstrom5.github.io/mississippi-eats/

5. Regional differences: none. The content covers Mississippi; the app is offered in the United States and works the same everywhere.

6. Regulated or protected material: the app is not in a regulated industry and includes no protected third-party material. The data is open-licensed or public record, with attribution and licenses on the About tab. Inspection grades are shown only as the state health department posts them, dated and labeled official, with its disclaimer; the app computes no grade and never ranks by one. Ratings, hours and photos are shown only inside Apple's own place card through MapKit; the app stores no ratings or reviews. Every website link was checked before release, and adult venues are excluded. The app is independent and not affiliated with any restaurant, agency, the MICHELIN Guide or the James Beard Foundation.

Support: nick@eatsranked.com
```

## If Apple cites 4.3(a) (one app per state)
Mississippi Eats is built around Mississippi's own food and sources: Delta hot tamales from Greenville to Natchez, catfish houses,
po'boys and Gulf oysters on the Coast, comeback sauce from Jackson's Greek-run cafés, the MICHELIN Guide American South's Mississippi
selection, and the inspection grades the Mississippi State Department of Health posts. No place, guide or text is shared with another
app. (Never compare it with other state apps in the Notes.)
