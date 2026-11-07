"""Download the Overture Maps extracts that mississippi.py reads -> data/ms/

- overture_ms_bbox.parquet     every place in Mississippi's bounding box (name, category, address, point)
- overture_ms_sources.parquet  which datasets each Mississippi eating/drinking listing came from (Meta, Foursquare, ...)
- ms_shapes.json               simplified state and county outlines for the map
- ms_state_detail.geojson      the state outline at full detail, for the in-state test

Reads the public Overture bucket over S3 with DuckDB (no account needed). Ported from al-eats/pipeline/fetch_overture.py.
Mississippi: land division areas (so the Sound and the Gulf are out); the "counties" are its 82. The script checks the towns on and near
its lines (Southaven by Memphis, Vicksburg and Natchez across the river from Louisiana, Greenville, Pascagoula by Alabama, Picayune by
Slidell) so a Tennessee, Arkansas, Louisiana or Alabama listing stays out.
"""
import os, json, time
import duckdb
from shapely import wkb
from shapely.geometry import mapping, Polygon

RELEASE = "2026-10-21.0"
OUT = os.path.join(os.path.dirname(__file__), "..", "data", "ms")
# Mississippi (30.17°N–35.0°N, 88.1°W–91.66°W) plus a margin for the border towns
BBOX = "bbox.xmin BETWEEN -91.75 AND -87.95 AND bbox.ymin BETWEEN 29.95 AND 35.1"
EAT = "('restaurant','casual_eatery','bar','fast_food_restaurant','coffee_shop','cafe','smoothie_juice_bar','brewery','food_court')"
os.makedirs(OUT, exist_ok=True)

con = duckdb.connect()
con.execute("INSTALL httpfs; LOAD httpfs; INSTALL spatial; LOAD spatial; SET s3_region='us-west-2';")
places = f"s3://overturemaps-us-west-2/release/{RELEASE}/theme=places/type=place/*.parquet"

t = time.time()
if not os.path.exists(f"{OUT}/overture_ms_bbox.parquet"):
    con.execute(f"""
COPY (
  SELECT id, names.primary AS name, basic_category AS cat, taxonomy.primary AS tax, taxonomy.hierarchy AS hier, confidence,
         operating_status AS status, brand.names.primary AS brand, addresses[1].freeform AS street, addresses[1].locality AS city,
         addresses[1].postcode AS zip, addresses[1].region AS region, ST_Y(geometry) AS lat, ST_X(geometry) AS lon, websites[1] AS web,
         phones[1] AS phone
  FROM read_parquet('{places}', hive_partitioning=1) WHERE {BBOX}
) TO '{OUT}/overture_ms_bbox.parquet' (FORMAT PARQUET)""")
    print("places in bbox", round(time.time() - t), "s", flush=True)
if not os.path.exists(f"{OUT}/overture_ms_sources.parquet"):
    con.execute(f"""
COPY (
  SELECT id, list_transform(sources, lambda x: x.dataset) AS ds, list_transform(sources, lambda x: x.update_time) AS ut,
         list_transform(sources, lambda x: x.record_id) AS rid,
         len(socials) AS n_soc, len(websites) AS n_web, len(phones) AS n_ph
  FROM read_parquet('{places}', hive_partitioning=1)
  WHERE {BBOX} AND basic_category IN {EAT}
) TO '{OUT}/overture_ms_sources.parquet' (FORMAT PARQUET)""")
    print("sources", round(time.time() - t), "s", flush=True)

areas = f"s3://overturemaps-us-west-2/release/{RELEASE}/theme=divisions/type=division_area/*.parquet"
rows = con.execute(f"""
  SELECT subtype, names.primary AS name, ST_AsWKB(geometry) AS g
  FROM read_parquet('{areas}', hive_partitioning=1)
  WHERE country = 'US' AND region = 'US-MS' AND subtype IN ('region', 'county') AND class = 'land'
    AND bbox.xmin > -91.8 AND bbox.xmax < -87.9 AND bbox.ymin > 29.8 AND bbox.ymax < 35.2""").fetchall()


def rings(geom, tol, min_area):
    geom = geom.simplify(tol, preserve_topology=True)
    polys = [p for p in getattr(geom, "geoms", [geom]) if p.geom_type == "Polygon" and p.area >= min_area]
    return [[[round(x, 3), round(y, 3)] for x, y in p.exterior.coords] for p in polys]


out = {"state": None, "counties": []}
for sub, name, g in rows:
    geom = wkb.loads(bytes(g)).buffer(0)
    if sub == "region":
        json.dump(mapping(geom.simplify(0.0005, preserve_topology=True)), open(f"{OUT}/ms_state_detail.geojson", "w"))
        out["state"] = [[r] for r in rings(geom, 0.002, 0.000005)]
    else:
        out["counties"].append({"name": name, "c": rings(geom, 0.004, 0.00002)})
# full-detail county polygons for assigning each place to a county (not shipped)
json.dump({name: mapping(wkb.loads(bytes(g)).buffer(0).simplify(0.0003, preserve_topology=True))
           for sub, name, g in rows if sub == "county"}, open(f"{OUT}/ms_counties_detail.geojson", "w"))
json.dump(out, open(f"{OUT}/ms_shapes.json", "w"), separators=(",", ":"))
print("outlines: state", len(out["state"] or []), "rings +", len(out["counties"]), "counties;", round(time.time() - t), "s total")
# border towns: each must fall on the right side of the detailed state outline
from shapely.geometry import shape, Point
st = shape(json.load(open(f"{OUT}/ms_state_detail.geojson")))
for nm, lon, lat, want in [("Southaven", -90.0126, 34.9889, True), ("Vicksburg", -90.8779, 32.3526, True), ("Natchez", -91.4032, 31.5604, True),
                           ("Greenville", -91.0618, 33.4101, True), ("Pascagoula", -88.5561, 30.3658, True), ("Picayune", -89.6795, 30.5255, True),
                           ("Corinth", -88.5223, 34.9343, True), ("Tunica", -90.3829, 34.6845, True), ("Biloxi", -88.8853, 30.3960, True),
                           ("Memphis, TN", -90.0490, 35.1495, False), ("Delta, LA", -90.9300, 32.3260, False), ("Vidalia, LA", -91.4257, 31.5654, False),
                           ("Lake Village, AR", -91.2818, 33.3290, False), ("Mobile, AL", -88.0399, 30.6954, False), ("Grand Bay, AL", -88.3422, 30.4763, False),
                           ("Slidell, LA", -89.7812, 30.2752, False), ("West Memphis, AR", -90.1845, 35.1465, False)]:
    ok = st.contains(Point(lon, lat))
    print(f"  {nm}: {'inside' if ok else 'outside'}{'' if ok == want else '  <-- WRONG'}")
print("counties:", len(out["counties"]), sorted(c["name"] for c in out["counties"]))

# the neighbours' land (Louisiana, Arkansas, Tennessee, Alabama): listings.py widens Mississippi's outline ~300 m, but only where no
# neighbour's land is, so a Vidalia or Delta listing across the river stays out
nb = con.execute(f"""
  SELECT region, ST_AsWKB(geometry) FROM read_parquet('{areas}', hive_partitioning=1)
  WHERE country = 'US' AND region IN ('US-LA', 'US-AR', 'US-TN', 'US-AL') AND subtype = 'region' AND class = 'land'""").fetchall()
from shapely.ops import unary_union
from shapely.geometry import box
near = box(-91.8, 29.8, -87.9, 35.2)
nbg = unary_union([wkb.loads(bytes(g)).buffer(0).intersection(near) for _, g in nb])
json.dump(mapping(nbg.simplify(0.0002, preserve_topology=True)), open(f"{OUT}/ms_neighbors.geojson", "w"))
print("neighbours:", sorted(r for r, _ in nb))
