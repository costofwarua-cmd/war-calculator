"""Extract per-donor aid from Kiel Ukraine Support Tracker xlsx -> data/aid.json.
Usage: python scripts/build_aid.py data/raw/<kiel>.xlsx "Release 30" "2026-06-30"
"""
import json, sys, pathlib
import openpyxl

src, release, cutoff = sys.argv[1], sys.argv[2], sys.argv[3]
wb = openpyxl.load_workbook(src, read_only=True, data_only=True)
ws = next(w for w in wb.worksheets if w.title.startswith("Country Summary") and "$" not in w.title)
rows = list(ws.iter_rows(values_only=True))
hdr_i = next(i for i, r in enumerate(rows) if r and "Country" in r)
hdr, units = rows[hdr_i], rows[hdr_i + 1]

def col(name, unit=None, nth=0):
    hits = [i for i, h in enumerate(hdr) if h == name and (unit is None or units[i] == unit)]
    return hits[nth]

C = dict(
    fin=col("Financial allocations"), hum=col("Humanitarian allocations"),
    mil=col("Military allocations"), total=col("Total bilateral allocations", "€ billion"),
    total_gdp=col("Total bilateral allocations", "% 2021 GDP"),
    eu_share=col("Share in total EU allocations", "€ billion"),
    grand=col("Total bilateral and EU allocations", "€ billion"),
    grand_gdp=col("Total bilateral and EU allocations", "% 2021 GDP"),
    commit=col("Total bilateral commitments", "€ billion"),
)
ci = hdr.index("Country")
donors = []
for r in rows[hdr_i + 2:]:
    name = r[ci]
    if not name or name == "Total":
        if name == "Total": break
        continue
    g = lambda k: round(float(r[C[k]] or 0), 3)
    donors.append(dict(country=name, eu=bool(r[ci + 1]), financial=g("fin"), humanitarian=g("hum"),
        military=g("mil"), total=g("total"), total_pct_gdp=round(float(r[C["total_gdp"]] or 0), 3),
        eu_share=g("eu_share"), total_incl_eu=g("grand"),
        total_incl_eu_pct_gdp=round(float(r[C["grand_gdp"]] or 0), 3), committed=g("commit")))
donors.sort(key=lambda d: -d["total"])
out = dict(source="Kiel Institute, Ukraine Support Tracker", release=release, cutoff=cutoff,
    url="https://www.kielinstitut.de/topics/war-against-ukraine/ukraine-support-tracker",
    unit="EUR billion (allocations = specific, earmarked aid)", donors=donors)
p = pathlib.Path(__file__).resolve().parents[1] / "data" / "aid.json"
p.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
print(len(donors), "donors; top:", [(d["country"], d["total"]) for d in donors[:6]])
print("sum bilateral", round(sum(d["total"] for d in donors), 1))
