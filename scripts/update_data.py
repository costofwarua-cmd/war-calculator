"""Daily data refresh: russian losses (General Staff via russianwarship.rip) + NBU exchange rates.

Writes data/losses.json and data/fx.json. If a sanity check fails, the old file is kept
and the script exits with code 1 so the CI run shows up red.
"""
import json
import pathlib
import sys
import urllib.request
from datetime import datetime, timezone

DATA = pathlib.Path(__file__).resolve().parents[1] / "data"
LOSSES_URL = "https://russianwarship.rip/api/v2/statistics/latest"
NBU_URL = "https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json"
# Upper bound for one day's increase per category; anything above is treated as a bad feed.
MAX_DAILY = {"personnel_units": 5000, "uav_systems": 10000, "vehicles_fuel_tanks": 2000}
MAX_DAILY_DEFAULT = 500


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "war-calculator/1.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def load(name):
    p = DATA / name
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else None


def save(name, obj):
    (DATA / name).write_text(json.dumps(obj, ensure_ascii=False, indent=1), encoding="utf-8")


def check_losses(new, old):
    errors = []
    for k, v in new["stats"].items():
        if not isinstance(v, int) or v < 0:
            errors.append(f"{k}: invalid value {v!r}")
        if old and k in old["stats"] and v < old["stats"][k]:
            errors.append(f"{k}: decreased {old['stats'][k]} -> {v}")
        inc = new["increase"].get(k, 0)
        if inc > MAX_DAILY.get(k, MAX_DAILY_DEFAULT):
            errors.append(f"{k}: suspicious daily increase {inc}")
    if old and new["date"] < old["date"]:
        errors.append(f"date went backwards {old['date']} -> {new['date']}")
    return errors


def main():
    ok = True
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")

    d = fetch(LOSSES_URL)["data"]
    new = {"date": d["date"], "day": d["day"], "resource": d["resource"],
           "stats": d["stats"], "increase": d["increase"], "fetched_at": now,
           "source": "General Staff of the Armed Forces of Ukraine via russianwarship.rip"}
    errors = check_losses(new, load("losses.json"))
    if errors:
        ok = False
        print("losses.json NOT updated:\n  " + "\n  ".join(errors), file=sys.stderr)
    else:
        save("losses.json", new)
        print(f"losses.json: {new['date']} (day {new['day']})")
        hist = load("history.json")
        if hist and hist["rows"][-1][0] < new["date"]:
            hist["rows"].append([new["date"]] + [new["stats"].get(k, 0) for k in hist["keys"]])
            (DATA / "history.json").write_text(json.dumps(hist, separators=(",", ":")), encoding="utf-8")
            print(f"history.json: appended {new['date']}")

    rates = {x["cc"]: x for x in fetch(NBU_URL) if x["cc"] in ("USD", "EUR")}
    if len(rates) == 2 and all(20 < r["rate"] < 200 for r in rates.values()):
        save("fx.json", {"date": rates["USD"]["exchangedate"], "USD": rates["USD"]["rate"],
                         "EUR": rates["EUR"]["rate"], "source": "National Bank of Ukraine",
                         "url": "https://bank.gov.ua/en/markets/exchangerates", "fetched_at": now})
        print(f"fx.json: USD {rates['USD']['rate']}, EUR {rates['EUR']['rate']}")
    else:
        ok = False
        print(f"fx.json NOT updated: bad rates {rates}", file=sys.stderr)

    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
