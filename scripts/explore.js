// Mississippi Eats web app: the iPhone app's guides, search, filters, map and place details, in the browser.
// Keep its guide rules in step with MississippiEats/Models/Guide.swift and its search with MississippiEats/Models/Search.swift.
// Same data as the app, split by scripts/make-site.py into data/core.json (list, search and map columns), data/ids.json (each place's
// stable id, fetched at the first tap, key, scroll or hover, so a visit that only looks doesn't download it; saved places and #p= links
// wait for it) and data/detail-<county>.json (phones, websites, notes, and county records or inspection results where a state has them), fetched per
// county when a place there is opened. Every data file carries the version of the core.json it was built with (core.json "ver",
// detail "_v", ids "v"): files from another build are fetched again, and never mixed in, because ids and details are keyed by row. No cookies, no trackers; saved places and the last guide live in this browser's localStorage only
// (keys start with mseats-: other state sites share the nickstrom5.github.io origin).
// The page runs under a strict Content-Security-Policy (hash-pinned inline script and style): never add inline event handlers or
// inline style attributes to the HTML built here; set properties from code instead.
(() => {
  "use strict";
  const BASE = document.documentElement.dataset.base || "";
  const $ = (s) => document.querySelector(s);
  // every value that goes into innerHTML passes through esc(), numbers included (the data file is trusted, but not that much)
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const own = (o, k) => typeof k === "string" && Object.prototype.hasOwnProperty.call(o, k);   // Object.hasOwn, for older Safari too
  const PREFIX = "mseats-";
  const store = {
    get(k, d) { try { const v = localStorage.getItem(PREFIX + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(PREFIX + k, JSON.stringify(v)); } catch { /* private mode */ } },
  };
  // only http(s) links leave the page; bare hosts ("example.com/menu") get https://
  const safeUrl = (u) => {
    u = String(u ?? "").trim();
    if (/^https?:\/\/[^\s"'<>\\]+$/i.test(u)) return u;
    if (/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}(?:[/?#][^\s"'<>\\]*)?$/i.test(u)) return "https://" + u;
    return null;
  };
  const num = (x) => (x == null || x === "" || !Number.isFinite(Number(x)) ? null : Number(x));
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const fmtDate = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s ?? "")); return m ? `${MONTHS[+m[2] - 1]} ${+m[3]}, ${m[1]}` : String(s ?? ""); };
  // MSDH's food facility search (every inspection and its grade): linked from each place
  const DPH_URL = "https://apps.msdh.ms.gov/food/";
  const SCORE_LIST = { msdh: ["Mississippi State Department of Health", "https://apps.msdh.ms.gov/food/"] };

  // ---------------------------------------------------------------- search (a port of MississippiEats/Models/Search.swift)
  // pikes are street types too, and "state st" is a street, not the state
  const typeSyn = { avenue: "ave", av: "ave", street: "st", boulevard: "blvd", road: "rd", drive: "dr", place: "pl", court: "ct",
    parkway: "pkwy", highway: "hwy", lane: "ln", trail: "trl", circle: "cir", terrace: "ter", pike: "pike", pk: "pike", pke: "pike" };
  // directions and road names: "north main" finds "N Main St", "interstate 40" finds "I-40"
  const syn = { ...typeSyn, north: "n", south: "s", east: "e", west: "w", northwest: "nw", northeast: "ne", southwest: "sw", southeast: "se",
    saint: "st", mount: "mt", fort: "ft", interstate: "i", ih: "i", freeway: "fwy", expressway: "expy" };
  const abbrs = new Set(Object.values(syn)), typeAbbrs = new Set(Object.values(typeSyn));
  const DIRS = new Set(["n", "s", "e", "w", "ne", "nw", "se", "sw"]);
  // the bit order is pipeline/mississippi.py's TAGS
  const TAMALES = 1, CATFISH = 2, POBOYS = 4, PLATES = 8, COMEBACK = 16, OLDEST = 32;
  // a dish ("gumbo", "pig ear sandwich") is not a tag: it's in each hand-checked place's search text, so it finds the places serving it
  const tagPhrases = [["hot tamales", TAMALES], ["tamales", TAMALES], ["tamale", TAMALES], ["catfish houses", CATFISH], ["catfish house", CATFISH],
    ["catfish", CATFISH], ["po boys", POBOYS], ["poboys", POBOYS], ["po boy", POBOYS], ["poboy", POBOYS], ["oyster bars", POBOYS], ["oysters", POBOYS],
    ["plate lunch", PLATES], ["blue plate", PLATES], ["fried chicken", PLATES], ["soul food", PLATES], ["comeback sauce", COMEBACK],
    ["comeback", COMEBACK], ["fried pickles", COMEBACK]];
  // letters with no accent to strip (NFD keeps them): "pho tay do" must find Phở Tây Đô (Ohio's 2026-10-24 fix)
  const UNACCENTED = { "ø": "o", "æ": "ae", "œ": "oe", "đ": "d", "ł": "l", "ß": "ss", "þ": "th", "ı": "i" };
  function normalize(s) {
    let t = String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[øæœđłßþı]/g, (c) => UNACCENTED[c]);
    // initials keep together, so "jr crickets" finds J.R. Crickets (St. and E. Main St stay as they are)
    t = t.replace(/\b([a-z])\.(?=[a-z]\b)/g, "$1");
    t = t.replace(/\b([a-z0-9])\s*&\s*([a-z0-9])\b/g, "$1$2").replace(/&/g, " and ").replace(/['’`]/g, "");
    return t.replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  }
  const normAddr = (s) => normalize(s).split(" ").map((w) => (own(syn, w) ? syn[w] : w)).join(" ");

  function parse(text) {
    const q = { tokens: [], town: null, townPhrase: null, tag: 0, tagPhrase: null, tagStem: null, townNeedle: null, streetNeedle: null };
    let raw = normalize(text).split(" ").filter(Boolean);
    if (!raw.length) return q;
    let mapped = raw.map((w) => (own(syn, w) ? syn[w] : w));
    const find = (phrase) => {
      const p = phrase.split(" ");
      for (let i = 0; i + p.length <= mapped.length; i++) if (p.every((w, k) => mapped[i + k] === w)) return [i, i + p.length];
      return null;
    };
    const cut = ([a, b]) => { const words = raw.slice(a, b).join(" "); raw.splice(a, b - a); mapped.splice(a, b - a); return words; };
    for (const [phrase, tag] of tagPhrases) { const r = find(normalize(phrase)); if (r) { q.tag = tag; q.tagPhrase = cut(r); break; } }
    if (q.tagPhrase) { const stem = normalize(q.tagPhrase).replace(/s$/, ""); q.tagStem = stem ? " " + stem : null; }
    // the longest town named in the query wins, unless a street type follows it ("houston st" is a street)
    for (const key of TOWN_KEYS_BY_LENGTH) {
      const r = find(key);
      if (r && !(r[1] < mapped.length && typeAbbrs.has(mapped[r[1]]))) {
        // a direction word right before the town ("north shreveport") may mean the street as well as the town
        if (r[0] > 0 && DIRS.has(mapped[r[0] - 1])) q.streetNeedle = " " + mapped.slice(r[0] - 1, r[1]).join(" ") + " ";
        q.town = TOWN_KEYS[key]; q.townPhrase = cut(r); q.townNeedle = " " + normalize(q.townPhrase); break;
      }
    }
    const stop = new Set(["the", "and", "of", "a", "in", "near", "me"]);   // "barbecue near me" isn't a place named "Me"
    let idx = raw.map((_, i) => i);
    // stop words stay only when they're all there is ("the"); next to a guide or a town ("lemon pepper near me") they go
    if (q.tag || q.town || idx.some((i) => !stop.has(mapped[i]))) idx = idx.filter((i) => !stop.has(mapped[i]));
    idx.forEach((i, n) => {
      const token = raw[i], isLast = n === idx.length - 1;
      if (own(syn, token)) { q.tokens.push([` ${syn[token]} `, ` ${token}`]); return; }
      const whole = (abbrs.has(token) && (!isLast || token.length > 1)) || (token.length <= 2 && !isLast);
      const needles = [" " + token + (whole ? " " : "")];
      if (isLast && token.length >= 3) for (const [word, abbr] of Object.entries(typeSyn)) if (word !== token && word.startsWith(token)) needles.push(` ${abbr} `);
      q.tokens.push(needles);
    });
    // "brady st": a finished street type sticks to the word before it
    if (q.tokens.length >= 2 && idx.length && typeAbbrs.has(mapped[idx[idx.length - 1]])) {
      const last = idx[idx.length - 1], prev = idx[idx.length - 2];
      q.tokens.splice(-2, 2, [` ${mapped[prev]} ${mapped[last]} `, ` ${raw[prev]} ${raw[last]}`]);
    }
    return q;
  }
  const qEmpty = (q) => !q.tokens.length && !q.town && !q.tag;
  function matches(p, q) {
    if (q.tag && !(p.g & q.tag)) { if (!q.tagStem || !p.nameText.includes(q.tagStem)) return false; }
    if (q.town && p.c !== q.town) {
      if (!(q.townNeedle && p.nameText.includes(q.townNeedle)) && !(q.streetNeedle && p.search.includes(q.streetNeedle))) return false;
    }
    return q.tokens.every((needles) => needles.some((n) => p.search.includes(n)));
  }
  const nameMatches = (p, q) => q.tokens.length && q.tokens.every((needles) => needles.some((n) => p.nameText.includes(n)));

  // ---------------------------------------------------------------- guides (MississippiEats/Models/Guide.swift)
  const hcTag = (t) => (p) => p.hc && Boolean(p.g & t);
  const HC_SORTS = ["featured", "nearest", "name"];
  const GUIDES = {
    tamales: { title: "Delta Hot Tamales", sub: "Hand-checked Delta hot tamales, from Doe's in Greenville to Clarksdale and Vicksburg", inc: hcTag(TAMALES), sorts: HC_SORTS },
    catfish: { title: "Catfish Houses", sub: "Hand-checked catfish houses, from Taylor Grocery to Jerry's on Highway 49", inc: hcTag(CATFISH), sorts: HC_SORTS },
    poboys: { title: "Po'boys & Gulf Oysters", sub: "Hand-checked po'boys and oyster bars, from Pascagoula to Pass Christian", inc: hcTag(POBOYS), sorts: HC_SORTS },
    plates: { title: "Plate Lunches & Fried Chicken", sub: "Hand-checked blue-plate lunches, soul food and fried chicken", inc: hcTag(PLATES), sorts: HC_SORTS },
    comeback: { title: "Comeback Sauce & Fried Pickles", sub: "Hand-checked comeback sauce and fried dill pickles where they began", inc: hcTag(COMEBACK), sorts: HC_SORTS },
    honors: { title: "MICHELIN & James Beard", sub: "MICHELIN Guide and James Beard honorees", inc: (p) => p.mi > 0 || p.jb, sorts: ["iconic", "nearest"] },
    oldest: { title: "Oldest Places", sub: "Founding years checked at the same address, oldest first", inc: (p) => p.f != null && p.hc && Boolean(p.g & OLDEST), sorts: ["oldest"], ranked: true },
    scores: { title: "Official MSDH Grades", sub: "The Mississippi State Department of Health's latest A, B or C, shown on each place as posted", inc: (p) => p.sd != null, sorts: ["recent", "nearest", "name"] },
    all: { title: "All Restaurants", sub: "Restaurants, cafés, bars and bakeries statewide", inc: () => true, sorts: ["name", "nearest"] },
    saved: { title: "Saved", sub: "Places you saved in this browser", inc: (p) => saved.has(p.id), sorts: ["name", "nearest"] },
  };
  const HC_GUIDES = ["tamales", "catfish", "poboys", "plates", "comeback"];
  const SORT_LABEL = { featured: "Featured first", nearest: "Nearest", oldest: "Oldest first", name: "A to Z", iconic: "MICHELIN, then James Beard",
    recent: "Latest inspection first" };
  const MI = ["", "MICHELIN Recommended", "Bib Gourmand", "1 MICHELIN Star", "2 MICHELIN Stars", "3 MICHELIN Stars"];
  const CHIP = [[TAMALES, "Delta hot tamales"], [CATFISH, "Catfish house"], [POBOYS, "Po'boys & oysters"], [PLATES, "Plate lunch"],
    [COMEBACK, "Comeback sauce & pickles"]];

  // ---------------------------------------------------------------- state
  let P = [], CAL = {}, TOWN_KEYS = {}, TOWN_KEYS_BY_LENGTH = [], GENERATED = "", META = {};
  let here = null, shown = 100, current = [], view = "list";
  const savedRaw = store.get("saved", []);
  const saved = new Set(Array.isArray(savedRaw) ? savedRaw.filter((x) => typeof x === "string" && x.length < 64) : []);
  const st = { g: "tamales", q: "", sort: "", town: "", cuisine: "", chains: false, bib: false, p: "" };
  let bibCount = 0;   // Bib Gourmand places (non-restaurants left out): the box shows only when there are some

  const miles = (a, b) => {
    const r = Math.PI / 180, dLa = (b.la - a.la) * r, dLo = (b.lo - a.lo) * r;
    const h = Math.sin(dLa / 2) ** 2 + Math.cos(a.la * r) * Math.cos(b.la * r) * Math.sin(dLo / 2) ** 2;
    return 3958.8 * 2 * Math.asin(Math.sqrt(h));
  };
  const milesText = (m) => (m < 10 ? m.toFixed(1) : Math.round(m)) + " mi";

  function order() {
    const g = GUIDES[st.g];
    let o = st.sort && g.sorts.includes(st.sort) ? st.sort : HC_GUIDES.includes(st.g) && here ? "nearest" : g.sorts[0];
    if (o === "nearest" && !here) o = g.sorts.find((s) => s !== "nearest") || o;   // no location yet: say what the list is really sorted by
    return o;
  }

  function allows(p) {
    if (st.town && p.c !== st.town) return false;
    if (st.cuisine && p.cu !== st.cuisine) return false;
    if (st.chains && p.ch >= 5) return false;
    if (st.bib && p.mi !== 2) return false;      // MICHELIN Bib Gourmand only, as the app's Filters switch
    return true;
  }

  function list() {
    const g = GUIDES[st.g], q = parse(st.q), o = order();
    if (qEmpty(q) && st.q.trim()) return [];   // typed something, but nothing searchable ("🍕", "!!!")
    let out = P.filter((p) => g.inc(p) && allows(p) && (qEmpty(q) || matches(p, q)));
    const byName = (a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : a.i - b.i);
    if (o === "nearest" && here) {
      const dist = new Map(out.map((p) => [p, p.la != null ? miles(here, p) : Infinity]));
      out.sort((a, b) => dist.get(a) - dist.get(b) || byName(a, b));
    }
    else if (o === "featured") out.sort((a, b) => (b.ip ?? -1) - (a.ip ?? -1) || (a.f ?? 9999) - (b.f ?? 9999) || byName(a, b));
    else if (o === "oldest") out.sort((a, b) => (a.f ?? 9999) - (b.f ?? 9999) || byName(a, b));
    else if (o === "recent") out.sort((a, b) => (b.sd ?? -1) - (a.sd ?? -1) || byName(a, b));   // the inspection date; the score never orders a list
    else if (o === "iconic") {   // MICHELIN distinction, then the James Beard honor, then name (the app's order)
      const jb = (p) => (p.h & 1 ? 4 : p.h & 2 ? 3 : p.h & 4 ? 2 : p.h & 8 ? 1 : 0);
      out.sort((a, b) => (b.mi || 0) - (a.mi || 0) || jb(b) - jb(a) || byName(a, b));
    }
    else out.sort(byName);
    if (q.tokens.length && !g.ranked) {       // name matches first when searching
      const named = out.filter((p) => nameMatches(p, q));
      if (named.length && named.length < out.length) { const ids = new Set(named); out = named.concat(out.filter((p) => !ids.has(p))); }
    }
    return out;
  }

  // ---------------------------------------------------------------- rendering
  const jbLabel = (p) => (p.h & 1 ? "America's Classic" : p.h & 2 ? "James Beard winner" : p.h & 4 ? "James Beard finalist" : p.h & 8 ? "James Beard semifinalist" : p.jb ? "James Beard (restaurateur)" : null);
  function chips(p, max) {
    const c = [];
    if (p.mi && MI[p.mi]) c.push(`<span class="tag tag-mi">${esc(MI[p.mi])}</span>`);
    const jb = jbLabel(p);
    if (jb) c.push(`<span class="tag tag-jb">${esc(jb)}</span>`);
    if (p.hc) for (const [t, label] of CHIP) if (p.g & t) c.push(`<span class="tag">${label}</span>`);
    if (p.hc && p.g & OLDEST && p.f) c.push(`<span class="tag tag-plain">Since ${esc(p.f)}</span>`);
    if (p.ch >= 5) c.push(`<span class="tag tag-plain">Chain · ${esc(p.ch)}</span>`);
    if (p.t === 0 && !p.h && !p.mi && !p.hc) c.push('<span class="tag tag-dash">Listing only</span>');
    return (max ? c.slice(0, max) : c).join("");
  }

  function metric(p, o) {
    if (o === "nearest" && here && p.la != null) return [milesText(miles(here, p)), "away"];
    if (p.f && st.g !== "all") return [String(p.f), "since"];
    return null;
  }

  function render() {
    const g = GUIDES[st.g], o = order();
    if (st.g === "saved" && !idsReady) loadIds().then(() => { if (st.g === "saved") render(); });
    current = list();
    document.querySelectorAll(".ex-guides button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.g === st.g)));
    $("#ex-sub").textContent = g.sub;
    const sortSel = $("#ex-sort");
    sortSel.innerHTML = g.sorts.map((s) => `<option value="${esc(s)}"${s === o ? " selected" : ""}>${esc(SORT_LABEL[s])}</option>`).join("");
    sortSel.disabled = g.sorts.length < 2;
    const filters = [st.town && `in ${st.town}`, st.cuisine && st.cuisine, st.chains && "no chains", st.bib && "Bib Gourmand"].filter(Boolean);
    $("#ex-count").textContent = `${current.length.toLocaleString()} ${current.length === 1 ? "place" : "places"} · ${SORT_LABEL[o]}` + (filters.length ? ` · ${filters.join(", ")}` : "");
    $("#ex-clear").hidden = !filters.length;
    // Near me stays: each tap asks for a fresh fix (people move), and it's how to retry after a timeout
    if (view === "list") renderList(o); else drawMap();
    saveHash();
  }

  // typing searches only the open guide (the page opens on Lemon Pepper Wings): when that finds little, the same words across every
  // restaurant, with the same filters, so a famous place outside the guide isn't a dead end
  const FEW = 5;
  function elsewhereCount() {
    const q = parse(st.q);
    if (st.g === "all" || qEmpty(q) || current.length >= FEW) return 0;
    let n = 0;
    for (const p of P) if (allows(p) && matches(p, q)) n++;
    return n > current.length ? n : 0;
  }
  const allButton = (n) => `<button type="button" class="ex-small" id="ex-all">Search all restaurants (${esc(n.toLocaleString())} ${n === 1 ? "match" : "matches"})</button>`;
  function wireAll() {
    const b = $("#ex-all");
    if (b) b.onclick = () => { st.g = "all"; st.sort = ""; shown = 100; render(); const r = $(".ex-row"); if (r) r.focus(); };
  }

  function renderList(o) {
    const ol = $("#ex-list");
    const g = GUIDES[st.g];
    const elsewhere = elsewhereCount();
    if (!current.length) {
      ol.innerHTML = `<li class="ex-empty">${st.g === "saved" && !idsReady ? "Loading your saved places…" : st.g === "saved" && idsFailed && saved.size ? "Your saved places couldn't load: you may be offline, or the site was just updated. Reload the page to try again." : elsewhere ? `Nothing in ${esc(g.title)} matches that. ${allButton(elsewhere)}` : st.g === "saved" ? "Nothing saved yet. Open a place and tap Save to keep it here, in this browser." : "No places match. Try fewer words or clear the filters."}</li>`;
      wireAll();
      $("#ex-more").hidden = true;
      return;
    }
    ol.innerHTML = current.slice(0, shown).map((p, i) => {
      const m = metric(p, o);
      const rank = g.ranked ? `<span class="ex-rank${i < 3 ? " top" : ""}" aria-label="Rank ${i + 1}">${i + 1}</span>` : "";
      const where = [p.c, p.cu].filter(Boolean).join(" · ");
      const big = m ? `<b>${esc(m[0])}</b>` : "";
      return `<li><button class="ex-row" data-i="${esc(p.i)}">${rank}<span class="ex-main"><b>${esc(p.n)}</b><span class="ex-town">${esc(where)}</span><span class="ex-chips">${chips(p, 4)}</span></span>${m ? `<span class="ex-metric">${big}<small>${esc(m[1])}</small></span>` : ""}</button></li>`;
    }).join("") + (elsewhere ? `<li class="ex-empty">Only ${esc(current.length)} in ${esc(g.title)}. ${allButton(elsewhere)}</li>` : "");
    wireAll();
    const left = current.length - shown;
    $("#ex-more").hidden = left <= 0;
    $("#ex-more").textContent = `Show more (${left.toLocaleString()} left)`;
  }

  // ---------------------------------------------------------------- place panel
  const TIER = { 2: "On an official list", 1: "High-confidence listing", 0: "Listing only" };   // "High-confidence", not "confirmed" (Nick, 2026-10-13)

  // the state's alcohol licenses are the only statewide official list, and only places serving alcohol hold one, so its match rates are a
  // floor for comparing kinds of listings, not a rate to quote per place (the app shows none either)
  function howWeKnow(p) {
    const src = SOURCES[p.s] || "meta";
    if (src === "research") return "On our hand-checked list (checked against a 2025 or 2026 source). The open map data didn't list it as a place to eat, so it's placed from its own map listing or street address.";
    if (p.t === 2) return src === "official"
      ? "From the state's alcohol license list. The open map data didn't have it, so it's placed on its licensed street address."
      : "Matched to an active state alcohol license.";
    return (p.t === 1 ? "A high-confidence listing in Overture's open map data." : "A single listing in Overture's open map data, so it may be closed or misfiled.")
      + (p.hc ? " It's also on our hand-checked list, checked against a 2025 or 2026 source." : "");
  }

  const kv = (k, v) => (v == null || v === "" ? "" : `<div class="ex-kv"><span>${esc(k)}</span><b>${esc(v)}</b></div>`);
  const section = (t, body) => `<section class="ex-sec"><h3>${esc(t)}</h3>${body}</section>`;
  let listAtPush = null;   // the list's URL state when a place was opened with pushState (Back then closes the panel)

  // the open place is a modal dialog at every width (a bottom sheet on phones, a side sheet on wider screens, which would otherwise
  // cover Near me and the List/Map buttons): everything behind it is inert, and a click on the dimmed backdrop closes it
  function panelMode() {
    const panel = $("#ex-panel"), modal = !panel.hidden;
    if (modal) { panel.setAttribute("role", "dialog"); panel.setAttribute("aria-modal", "true"); }
    else { panel.removeAttribute("role"); panel.removeAttribute("aria-modal"); }
    $("#ex-backdrop").hidden = !modal;
    const behind = [...document.querySelectorAll("body > .skip, .wrap > header, .wrap > nav, .wrap > footer, #main > *")].filter((el) => el !== panel && el.id !== "ex-backdrop");
    behind.forEach((el) => { el.inert = modal; });
  }

  // MSDH posts each inspection's grade (A, B or C): shown as posted, dated, labeled official, with MSDH's disclaimer; never one of ours
  const GRADE_MEANING = { A: "A: no critical violations.", B: "B: critical violations corrected during the inspection.",
    C: "C: critical violations not corrected during the inspection, or repeated from the last one; fixes are due within 10 days, then a re-inspection." };
  const inspectionSection = (d, p) => {
    const ins = Array.isArray(d.ins) && d.ins.length >= 3 ? d.ins : null;
    const list = ins ? SCORE_LIST[ins[2]] : null;
    if (ins && list) {
      return section("Health inspections", kv("Latest grade (official)", `${ins[0]} · ${fmtDate(ins[1])}`) + kv("Graded by", list[0])
        + `<p class="ex-fine">MSDH's own grade for its latest inspection, as posted in the restaurant. ${GRADE_MEANING[ins[0]] || ""} MSDH: "Data are for informational purposes, not enforcement." An older grade may not reflect the place today.</p>`
        + `<p><a href="${list[1]}" rel="noopener" target="_blank">MSDH's food facility search</a></p>`);
    }
    return section("Health inspections", `<p class="ex-fine">The Mississippi State Department of Health inspects all food service in the state, but this place isn't matched to a grade in its records, so no grade is shown. This site computes no grade.</p>`
      + `<p><a href="${DPH_URL}" rel="noopener" target="_blank">Search MSDH's food facilities</a></p>`);
  };

  function openPlace(p, push = true) {
    const panel = $("#ex-panel");
    const wasOpen = !panel.hidden;
    // the place opens at once; its id (for Save, the #p= link and the Back step) follows when ids.json arrives, which the first tap
    // only starts, so a tap never waits on it. If ids.json can't load (offline, or a build changed under us), the place stays open
    // without Save and without a link.
    const waiting = p.id == null && !idsReady;
    if (waiting && (push || !wasOpen)) loadIds().then(() => { if (!panel.hidden && panel.dataset.i === String(p.i)) openPlace(p, push); });
    const noId = p.id == null, pid = p.id ?? "";
    // a re-render (the county's details just arrived) replaces the panel's buttons: remember where keyboard focus was, to put it back
    const focused = wasOpen && panel.contains(document.activeElement) ? document.activeElement : null;
    const refocus = focused && (focused.id ? `#${focused.id}` : focused.textContent.trim());
    st.p = pid;
    const loaded = DETAIL_LOADED.has(p.co), failed = DETAIL_FAILED.has(p.co);
    const d = DETAIL.get(p.i) || {};
    const la = num(p.la), lo = num(p.lo);
    const addr = [p.a, [p.c, p.z].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    const apple = la != null && lo != null
      ? `https://maps.apple.com/?q=${encodeURIComponent(p.n)}&ll=${la},${lo}`
      : `https://maps.apple.com/?q=${encodeURIComponent(p.n + ", " + addr)}`;
    const dirs = la != null && lo != null ? `https://maps.apple.com/?daddr=${la},${lo}&dirflg=d` : apple;
    const site = safeUrl(d.w);
    const tel = d.ph ? String(d.ph).replace(/[^\d+]/g, "") : "";
    let html = `<button class="ex-close" id="ex-close" aria-label="Close">×</button>
      <p class="ex-kicker">${esc([p.c || "Mississippi", p.county && p.county !== "Mississippi" ? p.county : ""].filter(Boolean).join(" · ").toUpperCase())}</p>
      <h2 id="ex-pname">${esc(p.n)}</h2>
      <p class="ex-addr">${esc([addr, p.cu].filter(Boolean).join(" · "))}</p>
      ${here && la != null ? `<p class="ex-dist">${esc(milesText(miles(here, p)))} away</p>` : ""}
      <p class="ex-chips">${chips(p)}</p>
      <div class="ex-actions">
        <a class="btn ex-apple" href="${esc(apple)}" rel="noopener" target="_blank">Ratings, hours &amp; photos · Apple Maps</a>
        <div class="ex-act-row">
          <a href="${esc(dirs)}" rel="noopener" target="_blank">Directions</a>
          ${tel ? `<a href="tel:${esc(tel)}">Call</a>` : ""}
          ${site ? `<a href="${esc(site)}" rel="noopener nofollow" target="_blank">Website</a>` : ""}
          ${waiting ? '<button id="ex-save" aria-pressed="false" disabled>Save</button>' : noId ? "" : `<button id="ex-save" aria-pressed="${saved.has(pid)}">${saved.has(pid) ? "Saved" : "Save"}</button>`}
        </div>
      </div>`;
    if (!loaded) html += `<p class="ex-fine">Loading details…</p>`;
    if (p.hc && (d.note || p.dish || p.f || d.seas)) {
      html += section("Hand-checked", (d.note ? `<p>${esc(d.note)}</p>` : "") + kv("On the menu", p.dish ? String(p.dish).split("; ").join(", ") : "")
        + kv("Open here since", p.f) + (d.fn ? `<p class="ex-fine">${esc(d.fn)}</p>` : "") + kv("Season", d.seas)
        + `<p class="ex-fine">Checked against a 2025 or 2026 source: Visit Mississippi's own pages, the MICHELIN Guide, or a dated local story. Menus and hours change, so check before you go.</p>`);
    }
    if (p.mi || d.jbf) {
      const lines = [...(p.mi && MI[p.mi] ? [MI[p.mi]] : []),
        ...(d.jbf ? String(d.jbf).split("; ").map((x) => "James Beard: " + x) : [])];
      html += section("Honors", `<ul>${lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul><p class="ex-fine">Honors are facts, not ratings. MICHELIN is a trademark of Michelin. James Beard Foundation and James Beard Award are trademarks of the James Beard Foundation.</p>`);
    }
    if (failed) html += `<p class="ex-fine">This place's details (county records, phone, website) didn't load: you may be offline, or the site was just updated. Reload the page to try again.</p>`;
    else if (loaded) {
      const lic = Array.isArray(d.lic) ? d.lic.filter(Array.isArray) : [];
      html += section("Official records", (lic.length ? lic.map((l) => kv(String(l[0] || "Record"), [l[2], l[1] ? "No. " + l[1] : ""].filter(Boolean).join(" · ") || "On the list")).join("")
          : kv("License record", "—"))
        + kv("Serves alcohol", p.lq ? "Licensed to serve on the premises" : "—")
        + `<p class="ex-fine">The Department of Revenue's alcohol permits are only searchable, and many counties are dry or partly dry, so this site shows no alcohol status: — means unknown, never "no".</p>`);
    }
    html += loaded ? inspectionSection(d, p) : "";
    html += section("How we know it's here", kv("Listed as", TIER[p.t])
      + (p.ch >= 2 ? kv("Locations in Mississippi", p.ch.toLocaleString()) : "") + `<p class="ex-fine">${esc(howWeKnow(p))}</p>`);
    const store_url = safeUrl(window.APP_STORE_URL);   // set in the page footer script once the App Store listing exists
    html += store_url
      ? `<p class="ex-app">Save it on your phone: <a href="${esc(store_url)}" rel="noopener">get the free iPhone app</a></p>`
      : `<p class="ex-app">The iPhone app is coming soon. <a href="${BASE}/#download">Ask for early access</a></p>`;
    panel.innerHTML = html;
    panel.dataset.id = pid;
    panel.dataset.i = String(p.i);
    panel.hidden = false;
    document.body.classList.add("ex-open");
    panelMode();
    $("#ex-close").onclick = () => closePlace();
    if (!noId) $("#ex-save").onclick = (e) => {
      if (saved.has(p.id)) saved.delete(p.id); else saved.add(p.id);
      store.set("saved", [...saved]);
      e.target.textContent = saved.has(p.id) ? "Saved" : "Save";
      e.target.setAttribute("aria-pressed", String(saved.has(p.id)));
      if (st.g === "saved") render();
    };
    const samePlace = wasOpen && panel.dataset.shown === String(p.i);   // a re-render: details or the id just arrived
    if (!samePlace) panel.scrollTop = 0;
    panel.dataset.shown = String(p.i);
    if (!samePlace) $("#ex-close").focus();
    else if (refocus) {
      const same = refocus.startsWith("#") ? panel.querySelector(refocus)
        : [...panel.querySelectorAll("a, button")].find((el) => el.textContent.trim() === refocus);
      (same || $("#ex-close")).focus();
    }
    if (push && !noId) {
      if (panel.dataset.pushed) saveHash();   // one Back step per panel, not per place looked at
      else { listAtPush = listHash(); saveHash(true); panel.dataset.pushed = "1"; }
    }
    if (!loaded) loadDetail(p.co).then(() => { if (panel.dataset.i === String(p.i) && !panel.hidden) openPlace(p, false); });
  }

  // fromHistory: the Back button (or a hash link) already moved the URL, so don't touch history again
  function closePlace(fromHistory = false) {
    st.p = "";
    const panel = $("#ex-panel");
    const wasI = panel.dataset.i;   // the row the panel belonged to: focus goes back there
    panel.hidden = true;
    delete panel.dataset.id;
    delete panel.dataset.i;
    delete panel.dataset.shown;
    delete panel.dataset.pushed;
    document.body.classList.remove("ex-open");
    panelMode();
    if (!fromHistory) {
      // the list hasn't changed since the panel opened: step back over the entry openPlace pushed, so Back isn't a dead click
      if (history.state && history.state.mseats === "place" && listHash() === listAtPush) history.back();
      else saveHash();
    }
    listAtPush = null;
    const row = wasI && document.querySelector(`.ex-row[data-i="${Number(wasI)}"]`);
    if (row) row.focus();
  }

  // ---------------------------------------------------------------- map (canvas: county outlines + a dot per place)
  let SHAPES = null, cam = null;
  // Mississippi's own frame (set per state: a port's leftover numbers once framed the wrong state, QA 2026-11-03)
  const LAT0 = 32.6, KX = Math.cos(LAT0 * Math.PI / 180);
  const proj = (lo, la) => [(lo - (-89.7)) * KX, -(la - LAT0)];

  function fitCam(w, h) {
    const [x0, y0] = proj(-91.66, 35.01), [x1, y1] = proj(-88.09, 30.15);   // the state's west/north and east/south edges
    const k = Math.min(w / (x1 - x0), h / (y1 - y0)) * 0.95;
    return { k, x: (w - (x1 - x0) * k) / 2 - x0 * k, y: (h - (y1 - y0) * k) / 2 - y0 * k };
  }

  // calls f on every ring, however deeply it's nested (the state is [polygon[ring[point]]], each county [ring[point]])
  const eachRing = (g, f) => {
    if (!Array.isArray(g) || !g.length) return;
    if (Array.isArray(g[0]) && typeof g[0][0] === "number") f(g); else g.forEach((x) => eachRing(x, f));
  };

  const classic = (p) => Boolean((p.hc && p.g) || p.mi);
  async function drawMap() {
    const cv = $("#ex-map"), wrap = $("#ex-mapwrap");
    const w = wrap.clientWidth, h = wrap.clientHeight, dpr = window.devicePixelRatio || 1;
    if (!w || !h) return;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    if (!cam) cam = fitCam(w, h);
    if (!SHAPES) SHAPES = await fetchJSON(`${BASE}/data/ms_shapes.json`).catch(() => ({ state: [], counties: [] }));
    const c = cv.getContext("2d");
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, h);
    const X = (lo, la) => { const [x, y] = proj(lo, la); return [x * cam.k + cam.x, y * cam.k + cam.y]; };
    const ring = (r) => { r.forEach(([lo, la], i) => { const [x, y] = X(lo, la); i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.closePath(); };
    c.fillStyle = "#f6f1e4";   // the map stays light in dark mode (its frame is light too), so the dots keep their contrast
    c.beginPath(); eachRing(SHAPES.state, ring); c.fill("evenodd");
    c.strokeStyle = "rgba(14,26,48,.22)"; c.lineWidth = 0.8;
    for (const co of SHAPES.counties || []) { c.beginPath(); eachRing(co.c, ring); c.stroke(); }
    const pts = current.filter((p) => p.la != null);
    const r = Math.max(2.2, Math.min(5, 1.6 + cam.k / 120));
    // plain places: one batch of small squares (tens of thousands draw fast that way); hand-checked and honored places: dots on top
    c.fillStyle = "#00205b";   // flag navy
    const sq = pts.length > 3000 ? Math.max(1.6, r - 0.6) : r * 1.6;
    for (const p of pts) {
      if (classic(p)) continue;
      const [x, y] = X(p.lo, p.la);
      if (x < -5 || y < -5 || x > w + 5 || y > h + 5) continue;
      if (pts.length > 3000) c.fillRect(x - sq / 2, y - sq / 2, sq, sq);
      else { c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill(); }
    }
    c.fillStyle = "#bf0a30"; c.strokeStyle = "#ffffff"; c.lineWidth = 1;   // the guide picks in flag red
    for (const p of pts) {
      if (!classic(p)) continue;
      const [x, y] = X(p.lo, p.la);
      if (x < -5 || y < -5 || x > w + 5 || y > h + 5) continue;
      c.beginPath(); c.arc(x, y, r + 1, 0, 6.2832); c.fill(); c.stroke();
    }
    $("#ex-maphint").textContent = pts.length ? `${pts.length.toLocaleString()} ${pts.length === 1 ? "place" : "places"} · tap a dot` : "No places to show";
  }

  function nearestDot(px, py) {
    let best = null, bd = 14 * 14;
    for (const p of current) {
      if (p.la == null) continue;
      const [x0, y0] = proj(p.lo, p.la), x = x0 * cam.k + cam.x, y = y0 * cam.k + cam.y;
      const d = (x - px) ** 2 + (y - py) ** 2;
      if (d < bd || (d === bd && classic(p))) { bd = d; best = p; }
    }
    return best;
  }

  function zoomAt(f, px, py) {
    const k = Math.min(Math.max(cam.k * f, 40), 60000);
    const s = k / cam.k;
    cam = { k, x: px - (px - cam.x) * s, y: py - (py - cam.y) * s };
    drawMap();
  }

  function mapEvents() {
    const cv = $("#ex-map");
    const ptrs = new Map();
    let moved = false, pinch0 = null;
    cv.addEventListener("wheel", (e) => { e.preventDefault(); const b = cv.getBoundingClientRect(); zoomAt(e.deltaY < 0 ? 1.25 : 0.8, e.clientX - b.left, e.clientY - b.top); }, { passive: false });
    cv.addEventListener("pointerdown", (e) => { cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]); moved = false; pinch0 = null; });
    cv.addEventListener("pointermove", (e) => {
      if (!ptrs.has(e.pointerId)) return;
      const prev = ptrs.get(e.pointerId);
      ptrs.set(e.pointerId, [e.clientX, e.clientY]);
      if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        const r = cv.getBoundingClientRect();
        if (pinch0) zoomAt(d / pinch0, (a[0] + b[0]) / 2 - r.left, (a[1] + b[1]) / 2 - r.top);
        pinch0 = d; moved = true; return;
      }
      const dx = e.clientX - prev[0], dy = e.clientY - prev[1];
      if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
      cam.x += dx; cam.y += dy; drawMap();
    });
    const up = (e) => {
      ptrs.delete(e.pointerId);
      if (!moved && ptrs.size === 0) {
        const b = cv.getBoundingClientRect(), p = nearestDot(e.clientX - b.left, e.clientY - b.top);
        if (p) openPlace(p);
      }
      if (ptrs.size < 2) pinch0 = null;
    };
    cv.addEventListener("pointerup", up);
    cv.addEventListener("pointercancel", (e) => ptrs.delete(e.pointerId));
    $("#ex-zin").onclick = () => zoomAt(1.6, cv.clientWidth / 2, cv.clientHeight / 2);
    $("#ex-zout").onclick = () => zoomAt(0.625, cv.clientWidth / 2, cv.clientHeight / 2);
    window.addEventListener("resize", () => { if (view === "map") drawMap(); });
  }

  function centerOn(pt) {
    const cv = $("#ex-map"), w = cv.clientWidth, h = cv.clientHeight;
    const k = 4000, [x, y] = proj(pt.lo, pt.la);
    cam = { k, x: w / 2 - x * k, y: h / 2 - y * k };
  }

  // ---------------------------------------------------------------- data, URL state, controls
  let SOURCES = [], DETAIL_FILES = [];
  async function fetchJSON(url, opts) { const r = await fetch(url, opts); if (!r.ok) throw new Error(r.status + " " + url); return r.json(); }
  // the build this page's data comes from: the page names it (so a cached core.json from an older build isn't used), core.json confirms it
  const PAGE_VER = ($("#ex-app") && $("#ex-app").dataset.ver) || "";
  let DV = "";
  const vq = (v) => (v ? "?v=" + encodeURIComponent(v) : "");
  // a data file from another build (a cache that outlived a deploy) is fetched once more, then refused: its rows wouldn't line up
  async function fetchCurrent(url, verOf) {
    let d = await fetchJSON(url + vq(DV));
    if (DV && verOf(d) !== DV) d = await fetchJSON(url + vq(DV), { cache: "reload" });
    if (DV && verOf(d) !== DV) throw new Error("another build: " + url);
    return d;
  }
  const DETAIL = new Map(), DETAIL_LOADED = new Set(), DETAIL_FAILED = new Set(), detailPromises = new Map();
  // a county's detail file (phones, websites, notes, alcohol licenses) is fetched only once someone reaches for a place there
  function loadDetail(co) {
    // a county with no extras has no file (null in dfiles): nothing to fetch
    if (!Number.isInteger(co) || co < 0 || co >= DETAIL_FILES.length || !DETAIL_FILES[co]) { DETAIL_LOADED.add(co); return Promise.resolve(); }
    if (!detailPromises.has(co)) {
      detailPromises.set(co, fetchCurrent(`${BASE}/data/detail-${encodeURIComponent(DETAIL_FILES[co])}.json`, (d) => d && d._v).then((d) => {
        if (d && typeof d === "object") for (const k of Object.keys(d)) { const i = Number(k); if (Number.isInteger(i) && d[k] && typeof d[k] === "object") DETAIL.set(i, d[k]); }
      }).catch(() => { DETAIL_FAILED.add(co); /* offline or another build: the panel says so, and asks for a reload */ })
        .finally(() => DETAIL_LOADED.add(co)));
    }
    return detailPromises.get(co);
  }

  // ids.json: one stable id per place, in core order (saved places, #p= links and the panel's history entry use them)
  let idsPromise = null, idsReady = false, idsFailed = false;
  function loadIds() {
    idsPromise ||= fetchCurrent(`${BASE}/data/ids.json`, (d) => d && d.v).then((d) => {
      const ids = d && typeof d.ids === "string" ? d.ids.split(",") : [];   // one comma-separated string: smaller than a JSON array
      if (ids.length !== P.length) throw new Error("ids.json doesn't match core.json");
      ids.forEach((x, i) => { P[i].id = x; });
    }).catch(() => { idsFailed = true; /* offline or another build: saving and links wait for a reload, and the page says so */ })
      .finally(() => { idsReady = true; });
    return idsPromise;
  }

  async function load() {
    let d = await fetchJSON(`${BASE}/data/core.json${vq(PAGE_VER)}`);
    // a core.json with no version predates versioning (a cache that ignored ?v=): its rows would meet this build's ids and county
    // files unchecked, so fetch it once more past the cache, then stop with the reload message rather than mix two builds
    if (PAGE_VER && typeof d.ver !== "string") d = await fetchJSON(`${BASE}/data/core.json${vq(PAGE_VER)}`, { cache: "reload" });
    if (PAGE_VER && typeof d.ver !== "string") throw new Error("core.json from before versioning");
    DV = typeof d.ver === "string" ? d.ver : "";
    GENERATED = d.generated; CAL = d.calibration || {}; SOURCES = d.srcs || []; DETAIL_FILES = d.dfiles || [];
    META = { permits: d.permits_updated };
    const n = d.n, towns = new Map(), C = { ...d.cols };
    for (const [k, pairs] of Object.entries(d.sparse || {})) {   // mostly-empty columns arrive as [[index, value], ...]
      const col = new Array(n).fill(null);
      if (Array.isArray(pairs)) for (const pr of pairs) if (Array.isArray(pr) && Number.isInteger(pr[0]) && pr[0] >= 0 && pr[0] < n) col[pr[0]] = pr[1];
      C[k] = col;
    }
    for (const k of ["n", "c", "co", "cu", "t", "s", "a", "z", "b", "ch", "g", "hc", "ip", "f", "h", "mi", "dish", "lq", "dla", "dlo", "jb", "sd"])
      if (!Array.isArray(C[k]) || C[k].length !== n) C[k] = new Array(n).fill(null);
    P = new Array(n);
    let la = 0, lo = 0;   // coordinates come as steps of 0.0001° from the previous place
    for (let i = 0; i < n; i++) {
      let pla = null, plo = null;
      if (C.dla[i] != null && C.dlo[i] != null) { la += C.dla[i]; lo += C.dlo[i]; pla = la / 10000; plo = lo / 10000; }
      const city = C.c[i] == null ? null : d.cities[C.c[i]], cu = d.cuisines[C.cu[i]], brand = C.b[i] == null ? null : d.brands[C.b[i]];
      const county = C.co[i] == null ? null : d.counties[C.co[i]];
      const p = { i, id: null, n: String(C.n[i] ?? ""), c: city, cu, t: C.t[i], s: C.s[i], a: C.a[i], z: C.z[i], la: pla, lo: plo,
        ch: num(C.ch[i]) || 1, g: C.g[i] || 0, hc: C.hc[i] === 1, ip: C.ip[i], f: num(C.f[i]), h: C.h[i] || 0,
        mi: num(C.mi[i]) || 0, jb: C.jb[i] === 1, dish: C.dish[i], co: C.co[i], county, lq: C.lq[i] === 1, sd: num(C.sd[i]) };
      p.search = " " + normalize([p.n, city, county, p.z, cu, brand, p.dish].filter(Boolean).join(" ")) + " " + normAddr(p.a || "") + " ";
      p.nameText = " " + normalize([p.n, brand].filter(Boolean).join(" ")) + " ";
      p.key = normalize(p.n);
      P[i] = p;
      if (city) towns.set(city, (towns.get(city) || 0) + 1);
    }
    const byCount = [...towns.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    for (const [name] of byCount) { const k = normAddr(name); if (!own(TOWN_KEYS, k)) TOWN_KEYS[k] = name; }   // biggest town wins a shared spelling
    TOWN_KEYS_BY_LENGTH = Object.keys(TOWN_KEYS).sort((a, b) => b.length - a.length);
    $("#ex-town").innerHTML = '<option value="">All towns</option>' + [...towns.keys()].sort((a, b) => a.localeCompare(b)).map((t) => `<option>${esc(t)}</option>`).join("");
    const cuis = new Map();
    for (const p of P) cuis.set(p.cu, (cuis.get(p.cu) || 0) + 1);
    $("#ex-cuisine").innerHTML = '<option value="">All kinds</option>' + [...cuis.entries()].sort((a, b) => b[1] - a[1]).map(([c, k]) => `<option value="${esc(c)}">${esc(c)} (${esc(k.toLocaleString())})</option>`).join("");
    bibCount = P.filter((p) => !p.v && p.mi === 2).length;
    $("#ex-bibwrap").hidden = !bibCount;
    $("#ex-bibn").textContent = `(${bibCount.toLocaleString()})`;
    if (!bibCount) st.bib = false;
  }

  const guideOk = (g) => own(GUIDES, g);
  function readHash() {
    const h = new URLSearchParams(location.hash.slice(1));
    const last = store.get("guide", "tamales");
    // a returning visitor gets the guide they used last, unless it's an empty Saved list
    st.g = guideOk(h.get("g")) ? h.get("g") : guideOk(last) && !(last === "saved" && !saved.size) ? last : "tamales";
    st.q = h.get("q") || ""; st.town = h.get("town") || ""; st.cuisine = h.get("kind") || ""; st.chains = h.get("chains") === "1"; st.bib = h.get("bib") === "1";
    st.sort = h.get("sort") || ""; st.p = h.get("p") || "";
  }
  function hashOf(withPlace) {
    const h = new URLSearchParams();
    h.set("g", st.g);
    if (st.q) h.set("q", st.q); if (st.town) h.set("town", st.town); if (st.cuisine) h.set("kind", st.cuisine);
    if (st.chains) h.set("chains", "1"); if (st.bib) h.set("bib", "1"); if (st.sort) h.set("sort", st.sort); if (withPlace && st.p) h.set("p", st.p);
    return "#" + h.toString();
  }
  const listHash = () => hashOf(false);
  // filter changes replace the current history entry; opening a place pushes one, so Back closes the panel
  function saveHash(push = false) {
    const url = hashOf(true);
    if (push) history.pushState({ mseats: "place" }, "", url);
    else history.replaceState(st.p ? { mseats: "place" } : null, "", url);
    store.set("guide", st.g);
  }

  // a coarse Mississippi outline (MississippiEats/Services/LocationService.swift's MississippiOutline): a bounding box would count the neighbours' border towns
  const MS_RINGS = [[[-88.395,30.393],[-88.396,30.38],[-88.413,30.383],[-88.4,30.369],[-88.399,30.373],[-88.396,30.373],[-88.393,30.349],[-88.405,30.343],[-88.406,30.348],[-88.412,30.35],[-88.412,30.357],[-88.42,30.357],[-88.427,30.353],[-88.435,30.361],[-88.447,30.352],[-88.451,30.331],[-88.48,30.317],[-88.504,30.317],[-88.512,30.332],[-88.507,30.354],[-88.516,30.332],[-88.521,30.333],[-88.528,30.34],[-88.569,30.342],[-88.566,30.328],[-88.582,30.329],[-88.586,30.338],[-88.573,30.343],[-88.583,30.344],[-88.584,30.362],[-88.588,30.366],[-88.595,30.363],[-88.591,30.37],[-88.596,30.37],[-88.598,30.364],[-88.594,30.359],[-88.603,30.359],[-88.603,30.374],[-88.61,30.375],[-88.637,30.359],[-88.663,30.361],[-88.7,30.342],[-88.73,30.341],[-88.813,30.384],[-88.811,30.393],[-88.843,30.408],[-88.855,30.425],[-88.878,30.42],[-88.904,30.429],[-88.922,30.424],[-88.927,30.43],[-88.935,30.421],[-88.972,30.422],[-88.972,30.416],[-88.957,30.419],[-88.957,30.411],[-88.955,30.411],[-88.954,30.416],[-88.929,30.415],[-88.907,30.425],[-88.898,30.423],[-88.898,30.42],[-88.909,30.421],[-88.897,30.409],[-88.899,30.414],[-88.893,30.416],[-88.859,30.409],[-88.862,30.4],[-88.855,30.39],[-88.87,30.388],[-88.829,30.375],[-88.817,30.36],[-88.89,30.388],[-89.003,30.385],[-89.08,30.367],[-89.085,30.357],[-89.083,30.353],[-89.089,30.353],[-89.087,30.346],[-89.101,30.353],[-89.101,30.36],[-89.142,30.34],[-89.284,30.301],[-89.297,30.307],[-89.29,30.334],[-89.273,30.334],[-89.267,30.342],[-89.29,30.357],[-89.28,30.363],[-89.299,30.365],[-89.313,30.359],[-89.31,30.372],[-89.322,30.374],[-89.349,30.369],[-89.374,30.349],[-89.376,30.339],[-89.362,30.347],[-89.356,30.338],[-89.346,30.345],[-89.331,30.341],[-89.32,30.319],[-89.325,30.301],[-89.418,30.253],[-89.419,30.229],[-89.446,30.204],[-89.442,30.186],[-89.464,30.172],[-89.469,30.177],[-89.459,30.185],[-89.467,30.191],[-89.479,30.193],[-89.501,30.182],[-89.516,30.185],[-89.523,30.181],[-89.531,30.193],[-89.538,30.196],[-89.548,30.193],[-89.557,30.185],[-89.573,30.181],[-89.583,30.189],[-89.598,30.213],[-89.615,30.223],[-89.614,30.245],[-89.632,30.257],[-89.631,30.261],[-89.625,30.264],[-89.632,30.269],[-89.631,30.28],[-89.638,30.288],[-89.647,30.29],[-89.64,30.295],[-89.64,30.307],[-89.634,30.307],[-89.626,30.314],[-89.634,30.321],[-89.629,30.321],[-89.629,30.327],[-89.633,30.328],[-89.629,30.339],[-89.637,30.348],[-89.641,30.346],[-89.651,30.356],[-89.657,30.357],[-89.661,30.364],[-89.658,30.367],[-89.662,30.371],[-89.66,30.373],[-89.67,30.382],[-89.679,30.402],[-89.684,30.406],[-89.684,30.412],[-89.68,30.411],[-89.677,30.418],[-89.681,30.423],[-89.68,30.433],[-89.684,30.434],[-89.685,30.44],[-89.683,30.452],[-89.686,30.455],[-89.69,30.453],[-89.69,30.46],[-89.695,30.463],[-89.706,30.465],[-89.705,30.472],[-89.71,30.478],[-89.723,30.483],[-89.721,30.487],[-89.725,30.492],[-89.73,30.491],[-89.733,30.496],[-89.747,30.493],[-89.742,30.497],[-89.745,30.498],[-89.747,30.503],[-89.757,30.5],[-89.753,30.502],[-89.753,30.508],[-89.758,30.506],[-89.754,30.511],[-89.757,30.509],[-89.76,30.512],[-89.757,30.518],[-89.768,30.513],[-89.773,30.521],[-89.77,30.521],[-89.771,30.527],[-89.769,30.529],[-89.777,30.533],[-89.774,30.538],[-89.779,30.544],[-89.789,30.545],[-89.8,30.547],[-89.804,30.55],[-89.792,30.548],[-89.794,30.557],[-89.804,30.56],[-89.801,30.564],[-89.792,30.562],[-89.787,30.569],[-89.791,30.57],[-89.793,30.564],[-89.795,30.57],[-89.808,30.568],[-89.809,30.58],[-89.815,30.586],[-89.81,30.584],[-89.807,30.587],[-89.811,30.587],[-89.812,30.592],[-89.818,30.593],[-89.82,30.597],[-89.814,30.598],[-89.822,30.605],[-89.814,30.608],[-89.823,30.608],[-89.821,30.62],[-89.831,30.617],[-89.83,30.622],[-89.823,30.623],[-89.82,30.632],[-89.814,30.638],[-89.823,30.639],[-89.82,30.646],[-89.825,30.645],[-89.825,30.649],[-89.83,30.651],[-89.833,30.657],[-89.84,30.652],[-89.84,30.661],[-89.852,30.662],[-89.849,30.665],[-89.843,30.663],[-89.838,30.672],[-89.839,30.674],[-89.844,30.669],[-89.847,30.67],[-89.835,30.692],[-89.838,30.695],[-89.835,30.699],[-89.838,30.704],[-89.843,30.703],[-89.847,30.705],[-89.84,30.711],[-89.842,30.72],[-89.831,30.715],[-89.831,30.722],[-89.825,30.727],[-89.836,30.727],[-89.827,30.732],[-89.837,30.735],[-89.816,30.738],[-89.82,30.741],[-89.829,30.738],[-89.825,30.742],[-89.822,30.754],[-89.83,30.751],[-89.833,30.754],[-89.825,30.758],[-89.835,30.771],[-89.829,30.768],[-89.827,30.775],[-89.83,30.782],[-89.827,30.783],[-89.824,30.779],[-89.819,30.783],[-89.821,30.791],[-89.818,30.796],[-89.813,30.793],[-89.812,30.787],[-89.803,30.791],[-89.803,30.795],[-89.808,30.792],[-89.808,30.797],[-89.815,30.803],[-89.81,30.8],[-89.804,30.802],[-89.804,30.808],[-89.797,30.812],[-89.799,30.821],[-89.796,30.821],[-89.796,30.817],[-89.792,30.82],[-89.786,30.816],[-89.781,30.819],[-89.787,30.824],[-89.782,30.833],[-89.791,30.832],[-89.787,30.843],[-89.792,30.85],[-89.781,30.845],[-89.783,30.856],[-89.772,30.854],[-89.772,30.86],[-89.768,30.866],[-89.779,30.875],[-89.777,30.881],[-89.772,30.879],[-89.769,30.881],[-89.773,30.886],[-89.773,30.898],[-89.759,30.897],[-89.757,30.901],[-89.764,30.912],[-89.759,30.915],[-89.75,30.913],[-89.744,30.919],[-89.745,30.922],[-89.753,30.925],[-89.748,30.934],[-89.756,30.943],[-89.737,30.966],[-89.727,30.967],[-89.727,30.971],[-89.737,30.976],[-89.73,30.98],[-89.727,30.993],[-89.733,30.995],[-89.734,30.999],[-89.729,31.0],[-89.729,31.004],[-89.736,31.002],[-89.742,31.004],[-89.75,30.999],[-89.753,31.002],[-89.816,31.002],[-91.637,30.999],[-91.578,31.024],[-91.564,31.039],[-91.56,31.054],[-91.568,31.07],[-91.618,31.107],[-91.626,31.117],[-91.624,31.134],[-91.6,31.159],[-91.591,31.173],[-91.589,31.191],[-91.601,31.209],[-91.625,31.226],[-91.644,31.235],[-91.652,31.243],[-91.654,31.256],[-91.649,31.262],[-91.638,31.267],[-91.564,31.261],[-91.538,31.267],[-91.515,31.278],[-91.509,31.292],[-91.508,31.315],[-91.549,31.347],[-91.551,31.364],[-91.55,31.376],[-91.546,31.383],[-91.556,31.387],[-91.569,31.378],[-91.578,31.399],[-91.576,31.41],[-91.565,31.423],[-91.548,31.432],[-91.542,31.431],[-91.537,31.423],[-91.54,31.414],[-91.527,31.381],[-91.509,31.366],[-91.493,31.363],[-91.497,31.352],[-91.492,31.352],[-91.479,31.36],[-91.468,31.374],[-91.467,31.391],[-91.472,31.402],[-91.501,31.429],[-91.513,31.444],[-91.518,31.483],[-91.515,31.509],[-91.521,31.514],[-91.522,31.522],[-91.514,31.531],[-91.49,31.534],[-91.48,31.53],[-91.444,31.542],[-91.415,31.562],[-91.405,31.576],[-91.404,31.59],[-91.423,31.597],[-91.466,31.586],[-91.489,31.588],[-91.503,31.596],[-91.516,31.612],[-91.515,31.63],[-91.498,31.645],[-91.493,31.644],[-91.474,31.625],[-91.437,31.612],[-91.421,31.611],[-91.401,31.62],[-91.396,31.644],[-91.4,31.688],[-91.398,31.709],[-91.369,31.746],[-91.323,31.75],[-91.278,31.745],[-91.27,31.748],[-91.259,31.76],[-91.266,31.769],[-91.279,31.772],[-91.347,31.758],[-91.365,31.761],[-91.359,31.799],[-91.343,31.847],[-91.334,31.853],[-91.294,31.86],[-91.29,31.847],[-91.29,31.829],[-91.283,31.815],[-91.27,31.809],[-91.257,31.812],[-91.247,31.821],[-91.245,31.831],[-91.268,31.853],[-91.267,31.862],[-91.236,31.875],[-91.201,31.909],[-91.194,31.909],[-91.181,31.917],[-91.185,31.924],[-91.184,31.934],[-91.193,31.936],[-91.185,31.964],[-91.165,31.982],[-91.11,31.988],[-91.097,31.994],[-91.082,32.006],[-91.079,32.018],[-91.084,32.032],[-91.095,32.038],[-91.151,32.049],[-91.161,32.06],[-91.16,32.07],[-91.149,32.08],[-91.139,32.082],[-91.129,32.076],[-91.114,32.058],[-91.104,32.05],[-91.08,32.048],[-91.081,32.077],[-91.034,32.101],[-91.03,32.108],[-91.03,32.12],[-91.019,32.123],[-91.007,32.137],[-91.003,32.162],[-91.025,32.162],[-91.042,32.175],[-91.058,32.181],[-91.059,32.171],[-91.05,32.157],[-91.049,32.149],[-91.053,32.124],[-91.076,32.139],[-91.092,32.145],[-91.104,32.141],[-91.109,32.126],[-91.131,32.126],[-91.163,32.133],[-91.172,32.144],[-91.174,32.155],[-91.164,32.197],[-91.134,32.213],[-91.113,32.206],[-91.092,32.224],[-91.084,32.226],[-91.071,32.226],[-91.061,32.218],[-91.053,32.228],[-91.05,32.238],[-91.039,32.242],[-91.022,32.236],[-91.003,32.223],[-91.003,32.198],[-91.0,32.191],[-90.995,32.193],[-90.983,32.21],[-90.98,32.243],[-90.969,32.252],[-90.983,32.27],[-90.984,32.28],[-90.979,32.294],[-90.975,32.297],[-90.964,32.297],[-90.953,32.284],[-90.948,32.283],[-90.916,32.303],[-90.909,32.31],[-90.901,32.325],[-90.904,32.337],[-90.912,32.34],[-90.987,32.352],[-91.003,32.362],[-91.004,32.368],[-90.994,32.392],[-90.994,32.404],[-90.974,32.412],[-90.966,32.421],[-90.967,32.436],[-90.978,32.447],[-90.999,32.45],[-91.03,32.434],[-91.053,32.439],[-91.095,32.459],[-91.116,32.483],[-91.117,32.5],[-91.101,32.525],[-91.098,32.545],[-91.094,32.549],[-91.075,32.533],[-91.051,32.5],[-91.038,32.49],[-91.004,32.482],[-90.996,32.484],[-90.988,32.491],[-90.988,32.497],[-90.994,32.506],[-91.011,32.517],[-91.062,32.537],[-91.075,32.547],[-91.08,32.556],[-91.036,32.579],[-91.01,32.602],[-91.004,32.61],[-91.003,32.623],[-91.014,32.641],[-91.026,32.647],[-91.038,32.638],[-91.05,32.607],[-91.113,32.59],[-91.12,32.585],[-91.128,32.587],[-91.141,32.597],[-91.151,32.616],[-91.154,32.635],[-91.15,32.644],[-91.137,32.65],[-91.125,32.668],[-91.089,32.676],[-91.072,32.684],[-91.053,32.714],[-91.057,32.725],[-91.077,32.733],[-91.099,32.735],[-91.122,32.732],[-91.135,32.734],[-91.139,32.738],[-91.144,32.754],[-91.159,32.768],[-91.164,32.786],[-91.158,32.822],[-91.152,32.826],[-91.145,32.843],[-91.128,32.855],[-91.106,32.858],[-91.07,32.888],[-91.064,32.904],[-91.064,32.923],[-91.07,32.936],[-91.082,32.945],[-91.083,32.948],[-91.079,32.952],[-91.08,32.963],[-91.087,32.976],[-91.097,32.987],[-91.107,32.989],[-91.136,32.98],[-91.139,32.971],[-91.131,32.962],[-91.138,32.953],[-91.132,32.927],[-91.134,32.918],[-91.145,32.906],[-91.16,32.9],[-91.175,32.9],[-91.197,32.907],[-91.211,32.92],[-91.213,32.936],[-91.199,32.952],[-91.202,32.961],[-91.169,32.992],[-91.162,33.019],[-91.129,33.033],[-91.12,33.054],[-91.125,33.065],[-91.15,33.082],[-91.173,33.089],[-91.181,33.099],[-91.199,33.106],[-91.202,33.122],[-91.192,33.137],[-91.184,33.141],[-91.164,33.142],[-91.15,33.131],[-91.128,33.129],[-91.11,33.13],[-91.091,33.138],[-91.085,33.156],[-91.084,33.181],[-91.091,33.221],[-91.083,33.221],[-91.078,33.227],[-91.071,33.227],[-91.069,33.233],[-91.065,33.233],[-91.05,33.251],[-91.043,33.275],[-91.052,33.286],[-91.067,33.287],[-91.079,33.283],[-91.086,33.274],[-91.1,33.238],[-91.11,33.246],[-91.118,33.262],[-91.128,33.269],[-91.125,33.28],[-91.141,33.3],[-91.142,33.35],[-91.12,33.364],[-91.062,33.421],[-91.058,33.429],[-91.06,33.45],[-91.075,33.456],[-91.087,33.452],[-91.097,33.438],[-91.102,33.411],[-91.111,33.402],[-91.143,33.382],[-91.166,33.38],[-91.191,33.39],[-91.205,33.399],[-91.209,33.404],[-91.209,33.409],[-91.199,33.418],[-91.184,33.419],[-91.176,33.417],[-91.132,33.43],[-91.118,33.449],[-91.125,33.473],[-91.157,33.493],[-91.171,33.493],[-91.176,33.472],[-91.17,33.453],[-91.177,33.444],[-91.207,33.434],[-91.236,33.441],[-91.231,33.457],[-91.208,33.468],[-91.195,33.488],[-91.185,33.496],[-91.185,33.501],[-91.187,33.511],[-91.219,33.532],[-91.226,33.541],[-91.232,33.553],[-91.231,33.56],[-91.224,33.567],[-91.198,33.572],[-91.178,33.582],[-91.152,33.583],[-91.134,33.594],[-91.13,33.606],[-91.139,33.626],[-91.171,33.648],[-91.219,33.662],[-91.228,33.671],[-91.228,33.683],[-91.22,33.693],[-91.205,33.701],[-91.161,33.707],[-91.131,33.674],[-91.094,33.658],[-91.078,33.658],[-91.034,33.673],[-91.03,33.688],[-91.036,33.689],[-91.047,33.706],[-91.06,33.715],[-91.068,33.717],[-91.09,33.708],[-91.118,33.706],[-91.132,33.714],[-91.146,33.732],[-91.144,33.752],[-91.141,33.76],[-91.145,33.767],[-91.14,33.777],[-91.132,33.783],[-91.124,33.782],[-91.107,33.77],[-91.085,33.776],[-91.054,33.778],[-91.023,33.763],[-91.0,33.769],[-90.991,33.777],[-90.988,33.784],[-90.992,33.793],[-91.0,33.8],[-91.047,33.815],[-91.067,33.841],[-91.073,33.857],[-91.071,33.867],[-91.026,33.908],[-91.01,33.929],[-91.02,33.937],[-91.036,33.944],[-91.084,33.956],[-91.09,33.966],[-91.088,33.975],[-91.075,33.983],[-91.048,33.985],[-91.046,33.992],[-91.037,33.994],[-91.019,34.003],[-91.0,33.966],[-90.983,33.96],[-90.968,33.963],[-90.961,33.979],[-90.971,33.992],[-90.98,33.998],[-90.988,34.019],[-90.973,34.022],[-90.945,34.017],[-90.892,34.027],[-90.887,34.032],[-90.888,34.055],[-90.87,34.08],[-90.876,34.093],[-90.883,34.097],[-90.894,34.098],[-90.918,34.093],[-90.946,34.11],[-90.958,34.125],[-90.959,34.13],[-90.954,34.138],[-90.91,34.165],[-90.894,34.161],[-90.865,34.14],[-90.847,34.137],[-90.826,34.142],[-90.811,34.156],[-90.808,34.161],[-90.808,34.176],[-90.816,34.183],[-90.856,34.187],[-90.87,34.183],[-90.878,34.186],[-90.888,34.182],[-90.916,34.197],[-90.935,34.219],[-90.937,34.234],[-90.929,34.244],[-90.907,34.244],[-90.895,34.224],[-90.879,34.215],[-90.857,34.211],[-90.848,34.206],[-90.84,34.223],[-90.837,34.25],[-90.828,34.273],[-90.803,34.282],[-90.765,34.28],[-90.753,34.289],[-90.743,34.302],[-90.74,34.313],[-90.745,34.325],[-90.768,34.347],[-90.766,34.362],[-90.75,34.368],[-90.712,34.364],[-90.683,34.369],[-90.681,34.362],[-90.682,34.353],[-90.692,34.339],[-90.693,34.322],[-90.686,34.316],[-90.669,34.313],[-90.661,34.315],[-90.657,34.322],[-90.667,34.349],[-90.667,34.356],[-90.655,34.372],[-90.658,34.376],[-90.635,34.386],[-90.614,34.391],[-90.581,34.41],[-90.571,34.42],[-90.566,34.429],[-90.567,34.44],[-90.574,34.452],[-90.585,34.461],[-90.589,34.491],[-90.578,34.516],[-90.567,34.526],[-90.546,34.538],[-90.541,34.548],[-90.546,34.563],[-90.57,34.588],[-90.587,34.616],[-90.588,34.627],[-90.583,34.643],[-90.588,34.671],[-90.567,34.693],[-90.556,34.698],[-90.55,34.695],[-90.54,34.685],[-90.538,34.673],[-90.553,34.66],[-90.554,34.641],[-90.544,34.629],[-90.524,34.628],[-90.508,34.636],[-90.48,34.66],[-90.466,34.674],[-90.462,34.688],[-90.467,34.696],[-90.475,34.701],[-90.522,34.697],[-90.539,34.699],[-90.565,34.721],[-90.568,34.727],[-90.565,34.736],[-90.547,34.744],[-90.543,34.753],[-90.547,34.784],[-90.536,34.798],[-90.515,34.802],[-90.501,34.771],[-90.521,34.753],[-90.521,34.739],[-90.515,34.729],[-90.502,34.724],[-90.489,34.723],[-90.47,34.727],[-90.455,34.735],[-90.451,34.744],[-90.453,34.753],[-90.47,34.781],[-90.474,34.793],[-90.47,34.805],[-90.459,34.814],[-90.457,34.823],[-90.482,34.858],[-90.485,34.869],[-90.48,34.883],[-90.466,34.891],[-90.454,34.891],[-90.437,34.883],[-90.429,34.867],[-90.432,34.855],[-90.429,34.841],[-90.422,34.833],[-90.411,34.832],[-90.38,34.846],[-90.352,34.853],[-90.34,34.86],[-90.323,34.846],[-90.311,34.844],[-90.307,34.846],[-90.302,34.854],[-90.303,34.859],[-90.315,34.864],[-90.318,34.871],[-90.25,34.907],[-90.245,34.921],[-90.244,34.938],[-90.248,34.948],[-90.254,34.955],[-90.296,34.976],[-90.309,34.995],[-88.2,34.995],[-88.176,34.962],[-88.155,34.923],[-88.132,34.905],[-88.098,34.892],[-88.243,33.796],[-88.404,32.45],[-88.473,31.894],[-88.396,30.387],[-88.395,30.393]],[[-88.408,30.214],[-88.407,30.21],[-88.421,30.202],[-88.458,30.196],[-88.491,30.203],[-88.509,30.215],[-88.507,30.217],[-88.454,30.203],[-88.408,30.214]],[[-88.58,30.229],[-88.58,30.225],[-88.601,30.22],[-88.716,30.24],[-88.778,30.24],[-88.78,30.242],[-88.711,30.253],[-88.657,30.237],[-88.58,30.229]],[[-89.109,30.212],[-89.11,30.216],[-89.092,30.22],[-89.152,30.228],[-89.153,30.231],[-89.079,30.23],[-89.069,30.25],[-89.065,30.25],[-89.066,30.234],[-89.086,30.207],[-89.096,30.203],[-89.097,30.206],[-89.093,30.213],[-89.109,30.212]]];
  function inRing(ring, la, lo) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((yi > la) !== (yj > la) && lo < (xj - xi) * (la - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  const inMississippi = (la, lo) => MS_RINGS.some((r) => inRing(r, la, lo));

  function locate() {
    if (!navigator.geolocation) { $("#ex-locmsg").textContent = "This browser can't share its location."; return; }
    $("#ex-locmsg").textContent = "Finding you…";
    navigator.geolocation.getCurrentPosition((pos) => {
      here = { la: pos.coords.latitude, lo: pos.coords.longitude };
      const inGA = inMississippi(here.la, here.lo);
      $("#ex-locmsg").textContent = inGA ? "Sorted by distance from you. Your location stays in this browser." : "You're outside Mississippi: distances are from where you are. Your location stays in this browser.";
      st.sort = GUIDES[st.g].sorts.includes("nearest") ? "nearest" : st.sort;
      if (view === "map" && inGA) centerOn(here);
      shown = 100; render();
    }, (err) => {
      $("#ex-locmsg").textContent = err && err.code === 1 ? "Location is off for this site. Allow it in your browser settings to sort by distance."
        : "Couldn't get a location fix just now. Tap Near me to try again.";
    },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 });   // a fresh fix on every tap, never one from minutes ago
  }

  function setView(v) {
    view = v;
    document.querySelectorAll(".ex-view button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === v)));
    $("#ex-listwrap").hidden = v !== "list";
    $("#ex-mapwrap").hidden = v !== "map";
    render();
    // the map often starts below the fold (on phones, and on laptop-height screens): bring it into view
    if (v === "map" && $("#ex-mapwrap").getBoundingClientRect().top > innerHeight * 0.5) $("#ex-mapwrap").scrollIntoView({ block: "nearest" });
  }

  // the URL moved under us: Back/Forward (popstate) or a link to another #hash (hashchange). Both can fire for one step.
  function fromURL() {
    const before = listHash();
    readHash();
    if (listHash() !== before) { syncInputs(); shown = 100; render(); }
    if (st.p && !idsReady) { loadIds().then(fromURL); return; }
    const p = st.p && P.find((x) => x.id === st.p);
    const panel = $("#ex-panel");
    if (p) {
      if (panel.hidden || panel.dataset.id !== p.id) {
        openPlace(p, false);
        // Forward to a place opened earlier: its entry was pushed after the list's, so closing it steps back, as after a tap
        if (history.state && history.state.mseats === "place") { listAtPush = listHash(); panel.dataset.pushed = "1"; }
      }
    }
    else { if (!panel.hidden) closePlace(true); linkMissing(); }
  }

  // a #p= link whose place isn't here: ids.json didn't load, or the place has left the list since the link was made
  function linkMissing() {
    if (!st.p) return;
    $("#ex-locmsg").textContent = idsFailed ? "The place in this link couldn't load: you may be offline, or the site was just updated. Reload the page to try again."
      : "The place in this link isn't on the list anymore (it may have closed or moved).";
  }

  function controls() {
    document.querySelectorAll(".ex-guides button").forEach((b) => b.onclick = () => { if (guideOk(b.dataset.g)) st.g = b.dataset.g; st.sort = ""; shown = 100; render(); });
    let t = null;
    $("#ex-q").addEventListener("input", (e) => { clearTimeout(t); t = setTimeout(() => { st.q = e.target.value; shown = 100; render(); }, 120); });
    $("#ex-sort").onchange = (e) => { st.sort = e.target.value; if (st.sort === "nearest" && !here) locate(); shown = 100; render(); };
    $("#ex-town").onchange = (e) => { st.town = e.target.value; shown = 100; render(); };
    $("#ex-cuisine").onchange = (e) => { st.cuisine = e.target.value; shown = 100; render(); };
    $("#ex-chains").onchange = (e) => { st.chains = e.target.checked; shown = 100; render(); };
    $("#ex-bib").onchange = (e) => { st.bib = e.target.checked; shown = 100; render(); };
    $("#ex-clear").onclick = () => { st.town = st.cuisine = ""; st.chains = st.bib = false; syncInputs(); shown = 100; render(); };
    $("#ex-locate").onclick = locate;
    $("#ex-more").onclick = () => { shown += 200; renderList(order()); };
    document.querySelectorAll(".ex-view button").forEach((b) => b.onclick = () => setView(b.dataset.v));
    $("#ex-list").addEventListener("click", (e) => { const b = e.target.closest(".ex-row"); if (b && P[+b.dataset.i]) openPlace(P[+b.dataset.i]); });
    // warm the region file of the row under the pointer (or keyboard focus), so the panel opens with its details
    for (const ev of ["pointerover", "focusin"]) $("#ex-list").addEventListener(ev, (e) => { const b = e.target.closest && e.target.closest(".ex-row"); if (b && P[+b.dataset.i]) { loadIds(); loadDetail(P[+b.dataset.i].co); } });
    // the ids (a few hundred KB) wait for the first sign of use, so a visit that only looks doesn't download them
    const WARM = ["pointerdown", "keydown", "wheel", "scroll", "touchstart"];
    const warmIds = () => { WARM.forEach((ev) => removeEventListener(ev, warmIds, true)); loadIds(); };
    WARM.forEach((ev) => addEventListener(ev, warmIds, { capture: true, passive: true }));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#ex-panel").hidden) closePlace(); });
    window.addEventListener("popstate", fromURL);
    window.addEventListener("hashchange", fromURL);
    $("#ex-backdrop").addEventListener("click", () => { if (st.p || !$("#ex-panel").hidden) closePlace(); });
    mapEvents();
  }
  function syncInputs() {
    $("#ex-q").value = st.q; $("#ex-town").value = st.town; $("#ex-cuisine").value = st.cuisine; $("#ex-chains").checked = st.chains; $("#ex-bib").checked = st.bib;
  }

  (async () => {
    $("#ex-loading").hidden = false;   // hidden in the HTML, so a browser without JavaScript shows only the <noscript> note
    readHash();
    try { await load(); } catch (e) { $("#ex-loading").textContent = "The restaurant list couldn't load. Refresh to try again."; return; }
    syncInputs(); controls();
    $("#ex-app").hidden = false;
    $("#ex-loading").hidden = true;
    render();
    if (st.p) {
      await loadIds();
      const open = P.find((p) => p.id === st.p);
      if (open) { await loadDetail(open.co); openPlace(open, false); }
      else linkMissing();
    }
  })();
})();
