"""One-off: download the full daily loss history into data/history.json (compact rows).
The daily job (update_data.py) then appends new days."""
import json, pathlib, time, urllib.request

DATA = pathlib.Path(__file__).resolve().parents[1] / "data"
KEYS = ["personnel_units", "tanks", "armoured_fighting_vehicles", "artillery_systems", "mlrs",
        "aa_warfare_systems", "planes", "helicopters", "vehicles_fuel_tanks", "warships_cutters",
        "cruise_missiles", "uav_systems", "special_military_equip", "atgm_srbm_systems", "submarines"]


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "war-calculator/1.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)["data"]


rows, url = {}, "https://russianwarship.rip/api/v2/statistics?offset=0&limit=50"
while url:
    d = get(url)
    for r in d["records"]:
        rows[r["date"]] = [r["date"]] + [r["stats"].get(k, 0) for k in KEYS]
    nxt = d["paging"].get("next_url")
    url = nxt if nxt and d["records"] else None
    time.sleep(0.3)

out = {"keys": KEYS, "rows": [rows[k] for k in sorted(rows)],
       "source": "General Staff of the Armed Forces of Ukraine via russianwarship.rip"}
(DATA / "history.json").write_text(json.dumps(out, separators=(",", ":")), encoding="utf-8")
print(len(out["rows"]), out["rows"][0][0], out["rows"][-1][0])
