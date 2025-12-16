import json
import time
import random
from pathlib import Path
from urllib.parse import urlencode

import requests


# =========================
# ARCHIVOS
# =========================
BASE_DIR = Path(__file__).resolve().parent

# 🔹 Tu JSON actual (el que ya generaste con nombres bonitos)
IN_JSON = BASE_DIR / "colombia_municipios_coords.json"

# 🔹 Salida final con HSP
OUT_JSON = BASE_DIR / "colombia_municipios_coords_hsp.json"

# 🔹 Progreso incremental (para reanudar)
PROGRESS_JSON = BASE_DIR / "colombia_municipios_coords_hsp_progress.json"


# =========================
# CONFIG REQUESTS
# =========================
NASA_BASE = "https://power.larc.nasa.gov/api/temporal/climatology/point"
TIMEOUT = 25
MAX_RETRIES = 5

# Pausa entre requests (para no saturar)
BASE_SLEEP = 0.35
JITTER_SLEEP = 0.25

# Guardar progreso cada N municipios
SAVE_EVERY = 25


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(path: Path, obj: dict) -> None:
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding="utf-8")


def nasa_hsp(lat: float, lon: float, session: requests.Session) -> float:
    """
    Devuelve HSP promedio anual (kWh/m²/día) usando NASA POWER:
    ALLSKY_SFC_SW_DWN (climatology).
    """
    params = {
        "parameters": "ALLSKY_SFC_SW_DWN",
        "community": "RE",
        "longitude": lon,
        "latitude": lat,
        "format": "JSON",
    }
    url = NASA_BASE + "?" + urlencode(params)

    r = session.get(url, timeout=TIMEOUT)
    r.raise_for_status()
    data = r.json()

    monthly = (
        data.get("properties", {})
            .get("parameter", {})
            .get("ALLSKY_SFC_SW_DWN")
    )

    if not isinstance(monthly, dict) or not monthly:
        raise ValueError("Respuesta NASA sin ALLSKY_SFC_SW_DWN")

    vals = []
    for v in monthly.values():
        if isinstance(v, (int, float)) and v == v and abs(v) < 1e6:  # filtra NaN y raros
            vals.append(float(v))

    if len(vals) < 10:
        raise ValueError("Datos mensuales insuficientes para promedio anual")

    return sum(vals) / len(vals)


# =========================
# CARGA DATOS
# =========================
if not IN_JSON.exists():
    raise FileNotFoundError(f"No encuentro el JSON de entrada: {IN_JSON.resolve()}")

data = load_json(IN_JSON)

# Progreso: si existe, reanuda
if PROGRESS_JSON.exists():
    progress = load_json(PROGRESS_JSON)
    # Si el progress está vacío o es otra cosa rara, volvemos a "data"
    if isinstance(progress, dict) and len(progress) > 0:
        data = progress

# =========================
# LOOP PRINCIPAL
# =========================
session = requests.Session()
session.headers.update({"User-Agent": "Colombia-HSP-Builder/1.0"})

keys = list(data.keys())
total = len(keys)

done_ok = 0
done_fail = 0
processed = 0

for idx, key in enumerate(keys, start=1):
    obj = data.get(key, {})

    # Si ya tiene hsp numérica, saltar
    if isinstance(obj, dict) and isinstance(obj.get("hsp"), (int, float)):
        processed += 1
        continue

    # Validar coords
    lat = obj.get("lat")
    lon = obj.get("lon")
    if not isinstance(lat, (int, float)) or not isinstance(lon, (int, float)):
        obj["hsp"] = None
        obj["error_hsp"] = "Sin lat/lon válidos"
        data[key] = obj
        done_fail += 1
        processed += 1
        continue

    last_err = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            hsp = nasa_hsp(lat, lon, session)
            obj["hsp"] = hsp
            if "error_hsp" in obj:
                del obj["error_hsp"]
            data[key] = obj

            done_ok += 1
            processed += 1
            print(f"✅ {idx}/{total}  {key}  -> HSP={hsp:.3f}")
            break
        except Exception as e:
            last_err = str(e)
            sleep_s = (BASE_SLEEP + random.random() * JITTER_SLEEP) * (attempt ** 1.3)
            print(f"⚠️  {idx}/{total}  {key}  intento {attempt}/{MAX_RETRIES}: {last_err}  (sleep {sleep_s:.2f}s)")
            time.sleep(sleep_s)

    if not isinstance(obj.get("hsp"), (int, float)):
        obj["hsp"] = None
        obj["error_hsp"] = last_err or "Error desconocido"
        data[key] = obj
        done_fail += 1
        processed += 1

    # Guardado incremental
    if processed % SAVE_EVERY == 0:
        save_json(PROGRESS_JSON, data)
        print(f"💾 Guardado progreso: {processed}/{total}")

    # Throttle
    time.sleep(BASE_SLEEP + random.random() * JITTER_SLEEP)

# Guardado final
save_json(PROGRESS_JSON, data)
save_json(OUT_JSON, data)

print("\n==============================")
print("✅ Finalizado.")
print("📥 Entrada:", IN_JSON.resolve())
print("📤 Salida :", OUT_JSON.resolve())
print("💾 Progreso:", PROGRESS_JSON.resolve())
print(f"✅ OK: {done_ok} | ❌ Fallidos: {done_fail} | Total: {total}")
print("👉 Si hubo fallidos, vuelve a correr el script y reanuda.")
print("==============================")


#Link para Medelín:
#https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=ALLSKY_SFC_SW_DWN&community=RE&latitude=6.246631&longitude=-75.581775&format=JSON
