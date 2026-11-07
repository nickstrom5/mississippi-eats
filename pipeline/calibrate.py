"""How often is a map listing a real food or drink business? -> data/ms/calibration*.json

Ported from al-eats/pipeline/calibrate.py. Mississippi has one statewide official list (official.py): MSDH's inspected food facilities.
This measures, per kind of listing, the share that matches an inspected business,
and the share of the inspected food businesses the open map listings find. Mississippi's build uses no Google data, so there is no
"open in 2021" check. The keep rule is the family's (Meta 0.95, or 0.90 with a website). This script also gives every listing and
record its county: a county list's record keeps its own county (Montgomery's and Jefferson's lists cover only their county).
"""
import json
import numpy as np, pandas as pd
from shapely.geometry import shape, Point
from shapely import STRtree
from common import MS
from listings_util import official_match
import official

o = pd.read_pickle(f"{MS}/stage1.pkl")
F = pd.read_pickle(f"{MS}/official.pkl")
_CN = json.load(open(f"{MS}/ms_counties_detail.geojson"))
_NAMES = list(_CN)
_RAW = [shape(_CN[n]) for n in _NAMES]
_GEOMS = [g.buffer(0.0003) for g in _RAW]
_TREE = STRtree(_GEOMS)


def county_of(la, lo):
    """The county the point is in, by its own outline first (the ~30 m buffers overlap along every county line; in Maryland a
    Takoma Park pin 20 m inside Montgomery came out as Prince George's); a pin just over a lake shore (Antelope Island, Bear Lake, Lake
    Powell's marinas) takes the nearest county within ~1 km."""
    if la != la:
        return None
    p = Point(lo, la)
    hits = [i for i in _TREE.query(p) if _GEOMS[i].contains(p)]
    exact = [i for i in hits if _RAW[i].contains(p)]
    if exact or hits:
        return _NAMES[(exact or hits)[0]]
    near = [(_GEOMS[i].distance(p), _NAMES[i]) for i in _TREE.query(p.buffer(0.01))]
    return min(near)[1] if near else None


o["county"] = [county_of(la, lo) for la, lo in zip(o.lat, o.lon)]
JUR_COUNTY = {}   # MSDH is statewide: each record's county comes from its point
F["county"] = [JUR_COUNTY.get(j) or county_of(la, lo) for j, la, lo in zip(F.jur, F.lat, F.lon)]
o.to_pickle(f"{MS}/stage1.pkl")
F.to_pickle(f"{MS}/official.pkl")

base = ~o.j_junk & ~o.j_outside
print("listings with a county:", int(o.county.notna().sum()), "of", len(o), "| licenses placed:", int(F.lat.notna().sum()), "of", len(F))


def groups(L, app=False):
    s = L.src.fillna("none")
    if app:
        conf = L.confidence.fillna(0)
        has_web = L.n_web.fillna(0).astype(int) > 0
        return np.select([L.ov_closed | L.j_closedname, (s == "meta") & (conf >= 0.95), (s == "meta") & (conf >= 0.9) & has_web,
                          (s == "meta") & (conf >= 0.9), s.isin(["AllThePlaces", "DAC"]), (s == "BrightQuery") & (conf >= 0.95), s == "meta"],
                         ["closed per Overture/name", "meta_high", "meta_mid_web", "meta_mid_noweb", "brand_feed", "bq_high", "meta_low"],
                         "other_sources")
    return np.select([L.closed21, L.ov_closed, (s == "meta") & L.in21, s == "meta", s.isin(["AllThePlaces", "DAC"]) & L.in21,
                      s.isin(["AllThePlaces", "DAC"]), L.in21, s == "Foursquare", s == "BrightQuery", s == "Microsoft"],
                     ["Google 2021 says closed", "Overture says closed", "Meta + open in Google 2021", "Meta only",
                      "brand feed + Google 2021", "brand feed only", "Foursquare/BrightQuery/Microsoft + Google 2021",
                      "Foursquare only", "BrightQuery only", "Microsoft only"], "other")


def measure(label, L, R, store_web, store_app, by_county=True):
    L = L.reset_index(drop=True)
    R = R.reset_index(drop=True)
    m = {}
    if by_county:   # "100 Main St" is in dozens of towns: match inside one county
        for cty, idx in L.groupby("county").groups.items():
            Rc = R[R.county == cty]
            if not len(Rc):
                continue
            Lc = L.loc[idx].reset_index()
            for i, j in official_match(Lc, Rc.reset_index(drop=True)).items():
                m[int(Lc.at[i, "index"])] = int(Rc.index[j])
    else:
        m = official_match(L, R)
    L["hit"] = L.index.map(lambda i: i in m)
    for mode, store in ((False, store_web), (True, store_app)):
        L["grp"] = groups(L, mode)
        t = L.groupby("grp").agg(n=("id", "size"), official=("hit", "mean"), open21=("in21", "mean")).sort_values("n", ascending=False)
        print(f"\n== {label} ({'app grouping' if mode else 'web grouping'}): {len(L)} listings, {len(R)} official records")
        print(t.assign(official=(t.official * 100).round(1), open21=(t.open21 * 100).round(1)).to_string())
        store[label] = {"listings": int(len(L)), "official_records": int(len(R)),
                        "groups": {g: {"n": int(r.n), "official": round(float(r.official), 3)} for g, r in t.iterrows()}}
    keepish = ~(L.ov_closed | L.j_closedname | L.closed21)
    got = set(R.biz.iloc[[m[i] for i in L.index[keepish] if i in m]])
    Rr = R[R.kind.eq("food")].drop_duplicates("biz")
    cover = float(np.mean([b in got for b in Rr.biz])) if len(Rr) else None
    print(f"{label}: official food businesses found among open map listings: {cover * 100:.1f}% of {len(Rr)}")
    store_web[label]["coverage"] = round(cover, 3)
    store_web[label]["official_food"] = int(len(Rr))


res, app = {}, {}
R = F[(F.jur == "msdh") & F.lat.notna()]
if len(R):   # statewide, matched county by county
    measure("Mississippi (MSDH)", o[base], R, res, app)

# (no Google data in Mississippi: the table below is empty, kept so the calibration file keeps its shape)
L = o[base].copy()
L["grp"] = groups(L, True)
L["open21"] = L.in21 & ~L.closed21
g21 = L.groupby("grp").open21.agg(["size", "mean"])
print("\n== open in Google 2021 (statewide, app grouping)\n" + (g21.assign(mean=(g21["mean"] * 100).round(1))).to_string())
# the app ships no Google-derived number, so calibration_app.json leaves the 2021 share out (calibration.json, read only by the
# private leaderboard, keeps it), as in sc-eats

per = o[base & o.county.notna() & ~o.ov_closed & ~o.j_closedname].groupby("county").size()
print("\n== open, cleaned listings per county (top 15)\n" + per.sort_values(ascending=False).head(15).to_string())
json.dump({"areas": res, "per_county_listings": {c: int(n) for c, n in per.items()},
           "open_google_2021": {g: {"n": int(r["size"]), "share": round(float(r["mean"]), 3)} for g, r in g21.iterrows()}},
          open(f"{MS}/calibration.json", "w"), indent=1)
json.dump(app, open(f"{MS}/calibration_app.json", "w"), indent=1)
