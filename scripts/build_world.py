"""Build data/world.json for the aid globe.

Source: world-atlas 2.0.2 countries-110m (Natural Earth). Natural Earth draws Crimea as part of russia,
so we move that polygon back into Ukraine's geometry. Shared Perekop border then belongs to one country
and disappears from the border mesh.
"""
import json
import pathlib
import urllib.request

SRC = "https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json"
OUT = pathlib.Path(__file__).resolve().parents[1] / "data" / "world.json"
SIMFEROPOL = (34.1, 44.95)

d = json.load(urllib.request.urlopen(SRC, timeout=60))
sc, tr = d["transform"]["scale"], d["transform"]["translate"]
arcs = []
for a in d["arcs"]:
    x = y = 0
    pts = []
    for dx, dy in a:
        x += dx
        y += dy
        pts.append((x * sc[0] + tr[0], y * sc[1] + tr[1]))
    arcs.append(pts)


def ring(idx):
    return [pt for i in idx for pt in (arcs[i] if i >= 0 else arcs[~i][::-1])]


def inside(pt, poly):
    x, y = pt
    c = False
    for i in range(len(poly)):
        x1, y1 = poly[i]
        x2, y2 = poly[i - 1]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            c = not c
    return c


geoms = {g["properties"]["name"]: g for g in d["objects"]["countries"]["geometries"]}
ru, ua = geoms["Russia"], geoms["Ukraine"]
crimea = [p for p in ru["arcs"] if inside(SIMFEROPOL, ring(p[0]))]
if len(crimea) == 1:
    ru["arcs"] = [p for p in ru["arcs"] if p is not crimea[0]]
    if ua["type"] == "Polygon":
        ua["type"], ua["arcs"] = "MultiPolygon", [ua["arcs"]]
    ua["arcs"].append(crimea[0])
assert any(inside(SIMFEROPOL, ring(p[0])) for p in ua["arcs"]), "Crimea must be in Ukraine"
OUT.write_text(json.dumps(d, separators=(",", ":")), encoding="utf-8")
print("wrote", OUT)
