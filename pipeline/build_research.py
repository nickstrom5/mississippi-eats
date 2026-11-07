"""Checks Mississippi's hand-checked guide files (data/research/app/*.json) against the web build's places (site/mississippi.json).

Mississippi's research is written directly in data/research/app/*.json (one file per guide), each entry citing the 2025-26 page that names
it, read 2026-11-06: the Mississippi Tourism Department's Mississippi Catfish Trail brochure (June 2026), the Gulf Shores & Orange Beach
tourism board's Oyster Trail, Visit Mobile's "What to Eat in Mobile" (February 2026), Bham Now's dated lists, Mississippi Living, Yellowhammer
News, Tasting Table's oldest-restaurant and oldest-bar lists (2025), the MICHELIN Guide and historical markers. Every cited host passed
check_sources.py. This script changes nothing: it reports each entry's kinds and whether a place of that name exists in its town in the
web build, and writes the names it can't find to data/research/app/LEADS.md (they stay out of the guides until they match).
Usage: ../.venv/bin/python build_research.py   (after mississippi.py, before the app build)"""
import glob, json, os, re
from common import norm_name, canon_city

ROOT = os.path.join(os.path.dirname(__file__), "..")
R = os.path.join(ROOT, "data", "research")
KINDS = {"catfish house", "gulf seafood", "oyster bar", "white sauce bbq", "pit barbecue", "meat and three", "greek birmingham",
         "hot dog stand", "oldest"}
d = json.load(open(os.path.join(ROOT, "site", "mississippi.json")))
C, M = d["cols"], d["meta"]
towns = M["cities"]
have = {}
for n, c in zip(C["name"], C["city"]):
    if c is not None:
        have.setdefault((canon_city(towns[c]) or "").lower(), set()).add(norm_name(n))
missing, bad = [], []
for f in sorted(glob.glob(os.path.join(R, "app", "*.json"))):
    for e in json.load(open(f)):
        ks = set(e.get("kinds") or [])
        if not e.get("sources") or not ks <= KINDS:
            bad.append(f"{os.path.basename(f)}: {e['name']} kinds={sorted(ks)} sources={len(e.get('sources') or [])}")
        town = (canon_city(e.get("city") or "") or "").lower()
        keys = {norm_name(e["name"])} | {norm_name(m) for m in e.get("match_names") or []}
        if not keys & have.get(town, set()):
            missing.append(f"- {e['name']} ({e.get('city')}), {os.path.basename(f)}: no place of that name in its town in the web build "
                           f"(the app build may still match it by address)")
open(os.path.join(R, "app", "LEADS.md"), "w").write("# Leads: guide entries without an exact name match in their town\n\n" + "\n".join(missing) + "\n")
print("entries with a bad kind or no source:", len(bad), bad[:10])
print("names not found exactly in their town:", len(missing))
for m in missing:
    print(" ", m)
