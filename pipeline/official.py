"""Official records for Mississippi -> one table of inspected food facilities (playbook/12-sources.md).

The Mississippi State Department of Health (MSDH) "regulates all food service in Mississippi": no city or county runs its own program.
fetch_official.py reads its food facility search by date window (apps.msdh.ms.gov/food, FacilityListingDates.aspx): each inspection
with the facility's PimsID, name, district, city, street, date, result and facility type. The result is MSDH's own grade, A, B or C
(posted in every facility); blank and "X" (mostly processors) aren't grades. MSDH: "Data are for informational purposes, not
enforcement." One row per PimsID, with its graded inspections newest first. The grade is shown as MSDH posts it, dated and labeled
official; nothing here computes a grade.

load() returns: jur, lic (our id), name, keys (name keys), addr, city, zip, num, street, lat, lon, kind, active, ltype, insp, biz.
"""
import os, re, json, datetime
import numpy as np, pandas as pd
from common import norm_name, RAW, name_sim, _stems, GENERIC, canon_city, nice

OFF = os.path.join(RAW, "official")
DIRS = {"N": "N", "S": "S", "E": "E", "W": "W", "NORTH": "N", "SOUTH": "S", "EAST": "E", "WEST": "W"}
TYPES = set("ST STREET AVE AV AVENUE BLVD BOULEVARD RD ROAD DR DRIVE LN LANE CT COURT PL PLACE PKWY PARKWAY TER TRL TRAIL WAY HWY CIR "
            "CIRCLE PLZ SQ MALL BND PASS XING RUN ROW WALK RDG LOOP FWY FREEWAY EXPY EXPRESSWAY PIKE PK PKE".split())


def road(a):
    """One spelling for numbered roads. Mississippi writes one road as 'Route 100', 'US 7', 'Rt 2', 'MS 100' or 'MS Route 100', so every
    numbered US or state route is 'SH n' (as in ri-eats); 'N INTERSTATE 95' = 'I-95'; 'COUNTY ROAD 5' = 'CR 5'."""
    a = re.sub(r"(\d)\s*&\s*(\d)", r"\1-\2", a.upper())
    a = re.sub(r"\b(US|MS|SR|SH|CR|I|IH|RT|RTE)-(\w)", r"\1 \2", a)
    a = re.sub(r"\b(?:INTERSTATE(?: HIGHWAY| HWY)?|IH|I H)\s*(?=\d)", "I ", a)
    a = re.sub(r"\b(?:US|U S)\s+(?:HIGHWAY|HWY)\b", "US", a)
    a = re.sub(r"\b(?:FARM[- ]TO[- ]MARKET(?: ROAD| RD)?|FARM (?:ROAD|RD)|F M)\b", "FM", a)
    a = re.sub(r"\b(?:RANCH[- ]TO[- ]MARKET(?: ROAD| RD)?|RANCH (?:ROAD|RD)|RR|RM)\b(?=\s*\d)", "RM", a)
    a = re.sub(r"\b(?:STATE (?:HIGHWAY|HWY|ROAD|RD|ROUTE|RTE)|SR|SH|WEST VIRGINIA (?:ROUTE|RTE|HIGHWAY|HWY)|MS (?:ROUTE|RTE|RT|HIGHWAY|HWY)|MS|"
               r"US (?:ROUTE|RTE|RT)|US|ROUTE|RTE|RT|HWY|HIGHWAY)\b\.?(?=\s*\d)", "SH", a)
    a = re.sub(r"\b(?:COUNTY (?:HIGHWAY|HWY|ROAD|RD)|CO RD|CTY (?:HWY|RD)|CR)\b", "CR", a)
    a = re.sub(r"\bHIGHWAY\b", "HWY", a)
    return re.sub(r"\b(US|SH|CR|HWY|FM|RM|I) (\w+)\s*-\s*\w+", r"\1 \2", a)


ORD = {"FIRST": "1ST", "SECOND": "2ND", "THIRD": "3RD", "FOURTH": "4TH", "FIFTH": "5TH", "SIXTH": "6TH", "SEVENTH": "7TH",
       "EIGHTH": "8TH", "NINTH": "9TH", "TENTH": "10TH", "ELEVENTH": "11TH", "TWELFTH": "12TH"}


def street_key(a):
    """'2505 Monroe St' -> ('2505', 'MONROE'); '1000 OSAGE STREET' -> ('1000', 'OSAGE'); 'E Colfax Ave' keeps 'COLFAX'."""
    if not isinstance(a, str):
        return None, None
    a = re.sub(r"[.,#]", " ", road(a))
    # "20940-A North Frederick Ave": a hyphenated unit letter is part of the number (Maryland's Montgomery County wrote them so)
    m = re.match(r"^\s*(\d+)(?:-?[A-Z])?(?:\s*-\s*\d+[A-Z]?)?\s+(.*)$", a)
    if not m:
        return None, None
    words = [w for w in m.group(2).split() if w]
    if len(words) > 1 and words[0] in DIRS:
        words = words[1:]
    core = []
    for w in words:
        if w in TYPES and core:
            break
        core.append(w)
    # "Hwy 45 North" = "Highway 45 N": a direction word after the street is its letter (Columbus's Mugshots was listed twice)
    core = [ORD.get(w, DIRS.get(w, w)) for w in core]
    return m.group(1), " ".join(core[:3]) or None


def street_compat(a, b):
    """Same street, or one is a whole-word prefix of the other: Boulder's 2025 set sometimes truncates ("1206 CENTAUR" = Centaur Village Dr)."""
    if not isinstance(a, str) or not isinstance(b, str) or not a or not b:
        return False
    return a == b or a.startswith(b + " ") or b.startswith(a + " ")


def street_nums(a):
    """'157-159 W Main St' -> {'157', '159'}; '2505 Monroe St' -> {'2505'}."""
    if not isinstance(a, str):
        return set()
    a = road(a)
    m = re.match(r"^\s*(\d+)[A-Z]?(?:\s*-\s*(\d+)[A-Z]?)?\s", a.upper() + " ")
    if not m:
        return set()
    lo = int(m.group(1)); hi = int(m.group(2)) if m.group(2) else lo
    if hi < lo:   # "1500-02"
        hi = int(str(lo)[: len(str(lo)) - len(m.group(2))] + m.group(2)) if m.group(2) else lo
    return {str(x) for x in range(lo, hi + 1, 2 if (hi - lo) % 2 == 0 else 1)} if 0 <= hi - lo <= 12 else {str(lo)}


def _names(*vals):
    out = []
    for v in vals:
        if not isinstance(v, str):
            continue
        v = re.sub(r"\s*\((?:MOBILE|MOBILE UNIT|COMMISSARY|CATERING|SPECIAL EVENT|SPEC EVENT|TEMP(?:ORARY)? EVENT|CP|INSIDE [^)]*)\)\s*$", "", v, flags=re.I)
        for part in re.split(r"\s*/\s*|\s+\bdba\b\s+|\s+&\s+(?=[A-Z][a-z])", v, flags=re.I):
            k = norm_name(re.sub(r"\b(?:LLC|INC|CORP|CORPORATION|LTD|CO)\b\.?", "", part, flags=re.I))
            if k and k not in out:
                out.append(k)
    return out


MSDH_DIR = os.path.join(OFF, "msdh")
META = json.load(open(os.path.join(MSDH_DIR, "meta.json"))) if os.path.exists(os.path.join(MSDH_DIR, "meta.json")) else {}
LIST_DATE = META.get("through")   # the records-through day (7 days before the pull)
MONT_PAGE = "https://apps.msdh.ms.gov/food/"   # MSDH's food facility search
INSPECTIONS_URL = "https://apps.msdh.ms.gov/food/"
DISCLAIMER = "Data are for informational purposes, not enforcement."
RESULTS = ("A", "B", "C")    # MSDH's grades, as posted
ONPREM_T = ()      # no alcohol license list (DOR's permits are search-only, in TAP, which disallows robots)
# MSDH facility types that are places to go out to eat; the rest (schools, day cares, hospitals, processors, warehouses, retail
# markets, temporary events) stay out
FOOD_TYPES = re.compile(r"(?i)^(?:full service restaurant|fast food|bakery|full service bar|bar with prepackaged|flavored ice)")


def liq_kind(t):
    """A license type as shown -> on-premises or retail (none in Mississippi's data)."""
    if not isinstance(t, str):
        return None
    return "onprem" if t in ONPREM_T else "retail" if "package" in t or "off-premises" in t else None


COLUMNS = ["jur", "lic", "name", "dba", "holder", "keys", "addr", "city", "zip", "num", "street", "lat", "lon", "kind", "active", "ltype",
           "insp", "issued", "biz", "drinks", "county"]


def _zip(z):
    z = re.sub(r"\D", "", str(z or ""))
    return z[:5] if len(z) >= 5 else ""


def _title(a):
    """'500 MINERAL TRCE' -> '500 Mineral Trce'; Montgomery's mixed case stays."""
    a = re.sub(r"\s+", " ", a or "").strip()
    return re.sub(r"\b([A-Z][A-Z']+)\b", lambda m: m.group(1).title() if len(m.group(1)) > 2 or m.group(1) not in DIRS else m.group(1), a) if a.isupper() else a


def _date(md):
    m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{2,4})$", (md or "").strip())
    if not m:
        return None
    mo, d, y = (int(x) for x in m.groups())
    try:
        return datetime.date(2000 + y if y < 100 else y, mo, d).isoformat()
    except ValueError:
        return None


# Who isn't a place to go out to eat, by the record's name: care homes, schools, day cares, hospitals, jails, stores and gas
# stations, pharmacies, gyms, churches, caterers and commissaries. They still match their own listings (which are hidden as
# non-restaurants), but never come in as places of their own. A truck or mobile unit is a truck.
NOT_PUBLIC = re.compile(r"\b(?:NURSING|REHAB\w*|ASSISTED LIVING|SENIOR|RETIREMENT|HOSPICE|HOSPITAL|MEDICAL|HEALTH CARE|HEALTHCARE|"
                        r"SCHOOL|ELEMENTARY|ACADEMY|HEAD START|CHILD ?CARE|DAY ?CARE|DAYCARE|PRESCHOOL|LEARNING|KIDS|KINDER\w*|"
                        r"JAIL|DETENTION|CORRECTION\w*|CHURCH|MINISTR\w*|TABERNACLE|"
                        r"PHARMACY|DRUGS?|WALGREENS|CVS|FITNESS|GYM|YMCA|SPA|"
                        r"SUPERMARKET|SUPER MARKET|GROCERY|FOOD ?MART|FOODMART|MARKET ?PLACE|DOLLAR|CITGO|SHELL|CHEVRON|EXXON|TEXACO|"
                        r"MARATHON|SUNOCO|MOBIL|BP|VALERO|CIRCLE K|RACETRAC|QUIKTRIP|QT|MURPHY USA|FUEL|GAS|PETRO\w*|TRAVEL CENTER|"
                        r"KROGER|PUBLIX|WINN ?DIXIE|WAL ?MART|WALMART|SAMS CLUB|COSTCO|TARGET|ALDI|PIGGLY WIGGLY|FOOD GIANT|"
                        r"CATER\w*|COMMISSARY|VENDING|CONCESSIONS?|CONCESSION STAND|BANQUET|"
                        r"CORPORATION|PLANT|WAREHOUSE|DISTRIBUT\w*|HS|JCBE|BOE|"
                        r"INN (?:AND|&) SUITES|HAMPTON INN|HOLIDAY INN|MICROTEL|COMFORT INN|QUALITY INN|SLEEP INN|DAYS INN|BEST WESTERN|"
                        r"MARRIOTT|HILTON|HOMEWOOD SUITES|SPRINGHILL|FAIRFIELD INN|COURTYARD BY|EXTENDED STAY|LA QUINTA|MOTEL|"
                        r"ELKS|MOOSE LODGE|VFW|AMERICAN LEGION|MASONIC|COUNTRY CLUB)\b")
TRUCK = re.compile(r"\b(?:FOOD TRUCK|TRUCK|MOBILE|TRAILER|CART|PUSH ?CART|KIOSK)\b")
JEF_TOWNS = ["VESTAVIA HILLS", "MOUNTAIN BROOK", "CENTER POINT", "PLEASANT GROVE", "MOUNT OLIVE", "SYLVAN SPRINGS", "NORTH JOHNS",
             "WEST JEFFERSON"]


def _kind(name):
    k = (name or "").upper()
    if TRUCK.search(k):
        return "truck"
    return "other" if NOT_PUBLIC.search(norm_name(k) + " " + re.sub(r"[^A-Z ]", " ", k)) else "food"


def _jef_split(a):
    """'500 MINERAL TRCE HOOVER 35244' -> ('500 Mineral Trce', 'Hoover', '35244')."""
    m = re.match(r"^(.*?)\s+(\d{5})(?:-\d{4})?$", (a or "").strip())
    if not m:
        return _title(a), None, ""
    body, z = m.group(1), m.group(2)
    for t in JEF_TOWNS:
        if body.endswith(" " + t):
            return _title(body[: -len(t) - 1]), canon_city(t.title()), z
    words = body.split()
    return _title(" ".join(words[:-1])), canon_city(words[-1].title()), z


def load_msdh():
    by = {}
    for r in json.load(open(os.path.join(MSDH_DIR, "listing.json"))):
        c = r.get("cells") or []
        if len(c) < 8:
            continue
        _, name, district, city, street, date, result, ftype = (x.strip() for x in c[:8])
        d = _date(date)
        if not d or (LIST_DATE and d > LIST_DATE):
            continue
        f = by.setdefault(r["pims"], {"names": [], "insp": {}, "street": street, "city": city, "type": ftype, "last": d, "district": district})
        if d >= f["last"]:
            f.update(street=street, city=city, type=ftype, last=d)
        if name and name not in f["names"]:
            f["names"].insert(0, name) if d >= f["last"] else f["names"].append(name)
        res = result.strip().upper()
        if res in RESULTS:
            f["insp"][d] = res
    rows = []
    for pims, f in by.items():
        name = re.sub(r"\s+", " ", f["names"][0] if f["names"] else "").strip()
        if not name:
            continue
        addr = _title(re.sub(r"\s*[.,]+$", "", f["street"]))
        num, st = street_key(addr)
        city = canon_city(nice(re.sub(r"[.,]+$", "", f["city"])) if (f["city"].isupper() or f["city"].islower()) else re.sub(r"[.,]+$", "", f["city"]))
        typ = f["type"] or ""
        kind = "truck" if re.search(r"(?i)^mobile food", typ) else ("food" if FOOD_TYPES.search(typ) and _kind(name) != "other" else "other")
        insp = [[d, g, typ, f"{pims}-{d}"] for d, g in sorted(f["insp"].items(), reverse=True)]
        rows.append({"jur": "msdh", "lic": "msdh-" + pims, "name": name, "dba": name, "holder": None, "keys": _names(*f["names"][:2]),
                     "addr": addr, "city": city, "zip": "", "num": num, "street": st, "lat": None, "lon": None, "kind": kind,
                     "active": True, "ltype": f"MSDH food facility ({typ})" if typ else "MSDH food facility", "insp": insp,
                     "issued": None, "drinks": None, "county": None})
    return rows


def load():
    """MSDH's inspected food facilities, one row each, with their graded inspections."""
    rows = load_msdh() if os.path.exists(os.path.join(MSDH_DIR, "listing.json")) else []
    df = pd.DataFrame(rows) if rows else pd.DataFrame({c: pd.Series(dtype=object) for c in COLUMNS})
    for c_ in COLUMNS:
        if c_ not in df.columns:
            df[c_] = None
    df["lat"] = df["lat"].astype(float); df["lon"] = df["lon"].astype(float); df["active"] = df["active"].astype(bool)
    df["biz"] = np.arange(len(df))
    return df
