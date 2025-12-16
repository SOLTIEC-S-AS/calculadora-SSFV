import json
import re
from pathlib import Path

import pandas as pd

# =========================
# RUTAS (misma carpeta del script)
# =========================
BASE_DIR = Path(__file__).resolve().parent
CSV_PATH = BASE_DIR / "DIVIPOLA_CentrosPoblados.csv"
CITIES_JSON_PATH = BASE_DIR / "cities.json"
OUT_JSON = BASE_DIR / "colombia_municipios_coords.json"


# =========================
# NORMALIZACIÓN
# =========================
def norm_key(s: str) -> str:
    """
    Normaliza para comparar (sin cambiar el texto final):
    - upper
    - trim
    - colapsa espacios
    - quita dobles espacios
    """
    if s is None or (isinstance(s, float) and pd.isna(s)):
        return ""
    s = str(s).strip()
    s = re.sub(r"\s+", " ", s)
    return s.upper()


def simplify_city_for_match(s: str) -> str:
    """
    Ajustes suaves para mejorar matches con cities.json.
    NO es fuzzy pesado, solo arreglos típicos:
    - quita contenido entre paréntesis: "La Gloria (Cesar)" -> "La Gloria"
    - reemplaza "D.C." y variantes en Bogotá
    """
    s2 = str(s)
    s2 = re.sub(r"\s*\(.*?\)\s*", "", s2).strip()  # quita (....)
    s2 = s2.replace(" D.C.", "").replace(" D. C.", "").replace(" D C", "")
    s2 = re.sub(r"\s+", " ", s2).strip()
    return s2


# =========================
# CARGAR CITIES.JSON COMO CATÁLOGO CANÓNICO
# =========================
if not CITIES_JSON_PATH.exists():
    raise FileNotFoundError(f"No encuentro cities.json en: {CITIES_JSON_PATH.resolve()}")

cities_catalog = json.loads(CITIES_JSON_PATH.read_text(encoding="utf-8"))

# dept_map: "ANTIOQUIA" -> "Antioquia"
dept_map = {}
# city_map_by_dept: "ANTIOQUIA" -> {"MEDELLÍN": "Medellín", ...}
city_map_by_dept = {}

for dep in cities_catalog:
    dep_name = dep.get("departamento", "")
    dep_key = norm_key(dep_name)
    if not dep_key:
        continue

    dept_map[dep_key] = dep_name  # forma exacta como en cities.json
    city_map_by_dept[dep_key] = {}

    for c in dep.get("ciudades", []):
        c_key = norm_key(c)
        if c_key:
            city_map_by_dept[dep_key][c_key] = c  # forma exacta como en cities.json


# =========================
# LEER CSV (fallback encoding)
# =========================
if not CSV_PATH.exists():
    raise FileNotFoundError(f"No encuentro el CSV en: {CSV_PATH.resolve()}")

df = None
last_err = None
for enc in ("utf-8-sig", "cp1252", "latin1"):
    try:
        df = pd.read_csv(CSV_PATH, sep=None, engine="python", encoding=enc)
        print(f"✅ CSV leído con encoding: {enc}")
        break
    except Exception as e:
        last_err = e

if df is None:
    raise RuntimeError(f"No pude leer el CSV con encodings probados. Último error: {last_err}")

df.columns = [str(c).strip().lower() for c in df.columns]


# =========================
# DETECCIÓN DE COLUMNAS CORRECTAS (evitando códigos)
# =========================
def pick_best_column(columns, prefer_patterns, avoid_patterns):
    """
    Elige la mejor columna que:
    - contenga alguno de prefer_patterns
    - NO contenga avoid_patterns
    Prioriza columnas con "nombre" si existe.
    """
    candidates = []
    for c in columns:
        cl = c.lower()
        if any(p in cl for p in prefer_patterns) and not any(a in cl for a in avoid_patterns):
            score = 0
            if "nombre" in cl:
                score += 10
            # penaliza cosas que suelen ser código
            if "cod" in cl or "código" in cl or "codigo" in cl:
                score -= 10
            candidates.append((score, c))

    if not candidates:
        return None

    candidates.sort(reverse=True, key=lambda x: x[0])
    return candidates[0][1]


cols = list(df.columns)

# Nombres (NO códigos)
col_depto_name = pick_best_column(
    cols,
    prefer_patterns=["departamento", "depto"],
    avoid_patterns=["cod", "código", "codigo", "id"]
)

col_muni_name = pick_best_column(
    cols,
    prefer_patterns=["municipio"],
    avoid_patterns=["cod", "código", "codigo", "id"]
)

# Lat/Lon
def pick_lat_lon(columns):
    lat = None
    lon = None
    for c in columns:
        cl = c.lower()
        if lat is None and ("latitud" in cl or cl == "lat" or "latitude" in cl):
            lat = c
        if lon is None and ("longitud" in cl or cl == "lon" or "longitude" in cl):
            lon = c
    return lat, lon

col_lat, col_lon = pick_lat_lon(cols)

missing = []
if col_depto_name is None: missing.append("Nombre Departamento (evitando códigos)")
if col_muni_name is None: missing.append("Nombre Municipio (evitando códigos)")
if col_lat is None: missing.append("Latitud")
if col_lon is None: missing.append("Longitud")

if missing:
    raise ValueError(
        "❌ No pude detectar columnas necesarias:\n- "
        + "\n- ".join(missing)
        + "\n\nColumnas detectadas en el CSV:\n- "
        + "\n- ".join(cols)
    )


# =========================
# LIMPIEZA Y MATCH A NOMBRES CANÓNICOS (cities.json)
# =========================
work = df[[col_depto_name, col_muni_name, col_lat, col_lon]].copy()

work["dep_raw"] = work[col_depto_name].astype(str)
work["mun_raw"] = work[col_muni_name].astype(str)

# limpiar lat/lon
work["lat"] = pd.to_numeric(work[col_lat].astype(str).str.replace(",", ".", regex=False), errors="coerce")
work["lon"] = pd.to_numeric(work[col_lon].astype(str).str.replace(",", ".", regex=False), errors="coerce")

work = work.dropna(subset=["lat", "lon"])

# Normalizar para comparar
work["dep_key"] = work["dep_raw"].map(norm_key)
work["mun_key"] = work["mun_raw"].map(norm_key)

# Match departamento a catálogo (si no coincide, lo dejamos "raw" pero limpio)
def canonical_dept(dep_key, dep_raw):
    if dep_key in dept_map:
        return dept_map[dep_key]
    # fallback: Title Case simple
    dep_clean = simplify_city_for_match(dep_raw).title()
    return dep_clean

# Match ciudad a catálogo por departamento
def canonical_city(dep_key, mun_raw):
    mun_clean = simplify_city_for_match(mun_raw)
    mun_key1 = norm_key(mun_clean)

    if dep_key in city_map_by_dept:
        # match directo
        if mun_key1 in city_map_by_dept[dep_key]:
            return city_map_by_dept[dep_key][mun_key1]

    # fallback: si no matchea, lo dejamos limpio con title()
    return mun_clean.title()

work["departamento"] = work.apply(lambda r: canonical_dept(r["dep_key"], r["dep_raw"]), axis=1)

# Para buscar ciudad canónica, usamos el dept_key original si existe en catálogo;
# si no existe, armamos uno desde el nombre canónico obtenido
def dept_key_for_city_lookup(dep_key, dep_canon):
    if dep_key in city_map_by_dept:
        return dep_key
    return norm_key(dep_canon)

work["dep_key2"] = work.apply(lambda r: dept_key_for_city_lookup(r["dep_key"], r["departamento"]), axis=1)
work["municipio"] = work.apply(lambda r: canonical_city(r["dep_key2"], r["mun_raw"]), axis=1)

# clave final
work["key"] = work["departamento"] + "|" + work["municipio"]

# 1 fila por municipio (primera ocurrencia)
work_unique = work.drop_duplicates(subset=["key"], keep="first")


# =========================
# EXPORT JSON
# =========================
out = {}
for _, r in work_unique.iterrows():
    out[r["key"]] = {
        "departamento": r["departamento"],
        "municipio": r["municipio"],
        "lat": float(r["lat"]),
        "lon": float(r["lon"]),
    }

OUT_JSON.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")

print("✅ Listo. JSON generado con nombres iguales a cities.json.")
print("📄 CSV:", CSV_PATH.resolve())
print("📄 cities.json:", CITIES_JSON_PATH.resolve())
print("📦 JSON:", OUT_JSON.resolve())
print("📍 Municipios únicos guardados:", len(out))
