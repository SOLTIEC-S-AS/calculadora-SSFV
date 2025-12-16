const URL_CITIES = "data/cities.json";

// Variables globales
let leadData = {};
let calculos = {};

// Cache en memoria del JSON de ciudades
let citiesData = null;

// Índices para selects
let departmentsList = [];
let citiesByDept = {};     // { "Antioquia": ["Medellín", ...] }
let recordByKey = {};      // { "Antioquia|Medellín": {..} }

// ------------------------------
// Helpers
// ------------------------------
function autoResize() {
  this.style.height = "auto";
  this.style.height = this.scrollHeight + "px";
}

function normalizeKeyPart(s) {
  // Respeta tildes/ñ; solo recorta espacios
  return String(s || "").trim();
}

function buildKey(department, city) {
  return `${normalizeKeyPart(department)}|${normalizeKeyPart(city)}`;
}

function setSelectOptions(selectEl, options, placeholderText = "Selecciona") {
  if (!selectEl) return;
  selectEl.innerHTML = `<option value="">${placeholderText}</option>`;
  options.forEach((optValue) => {
    const opt = document.createElement("option");
    opt.value = optValue;
    opt.textContent = optValue;
    selectEl.appendChild(opt);
  });
}

// Lee el JSON "nuevo" y arma índices
function buildIndexesFromCitiesJson(obj) {
  // obj esperado:
  // {
  //   "Huila|Hobo": { departamento:"Huila", municipio:"Hobo", lat:..., lon:..., hsp: ... },
  //   ...
  // }

  recordByKey = obj || {};

  // Construir departamentos únicos + ciudades por departamento
  const deptSet = new Set();
  citiesByDept = {};

  Object.keys(recordByKey).forEach((key) => {
    const rec = recordByKey[key];
    const dept = rec?.departamento ?? key.split("|")[0];
    const city = rec?.municipio ?? key.split("|")[1];

    if (!dept || !city) return;

    deptSet.add(dept);
    if (!citiesByDept[dept]) citiesByDept[dept] = [];
    citiesByDept[dept].push(city);
  });

  // Ordenar
  departmentsList = Array.from(deptSet).sort((a, b) => a.localeCompare(b, "es"));

  Object.keys(citiesByDept).forEach((dept) => {
    citiesByDept[dept] = citiesByDept[dept]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "es"));
  });
}

function getSelectedCityRecord(department, city) {
  const key = buildKey(department, city);
  return recordByKey[key] || null;
}

// ------------------------------
// Form data
// ------------------------------
function getFormData() {
  return {
    fact1: Number(document.getElementById("fact1")?.value || 0),
    fact2: Number(document.getElementById("fact2")?.value || 0),
    fact3: Number(document.getElementById("fact3")?.value || 0),

    department: document.getElementById("department")?.value || "",
    city: document.getElementById("city")?.value || "",

    estrato: Number(document.getElementById("estrato")?.value || 0),

    // % cobertura solar
    porcentaje: Number(document.getElementById("porcentaje")?.value || 0),

    baterias: document.getElementById("baterias")?.value || "no",

    nombre: document.getElementById("nombre")?.value || "",
    telefono: document.getElementById("telefono")?.value || "",
    correo: document.getElementById("correo")?.value || "",
    comentarios: document.getElementById("comentarios")?.value || ""
  };
}

// ------------------------------
// Cálculos
// ------------------------------
function calcularPresupuesto(data, cityRec) {
  const sumaFacturas = data.fact1 + data.fact2 + data.fact3;
  const promFacturas = sumaFacturas / 3;
  const consumoDia = promFacturas / 30;

  // ✅ Potencia Pico del Sistema (regla: % cobertura / 10)
  const potenciaPicoSistema = data.porcentaje / 10;

  // HSP (si existe en el JSON)
  const hsp = cityRec?.hsp ?? null;

  // (Tu cálculo original)
  const presupuestoFinal = sumaFacturas / 30;

  return {
    sumaFacturas,
    promFacturas,
    consumoDia,
    potenciaPicoSistema,
    presupuestoFinal,
    hsp,
    lat: cityRec?.lat ?? null,
    lon: cityRec?.lon ?? null
  };
}

// ------------------------------
// UI de resultados
// ------------------------------
function mostrarResultado(calculos) {
  const resultadoDiv = document.getElementById("resultado");
  if (!resultadoDiv) return;

  const hspTxt = (calculos.hsp !== null && calculos.hsp !== undefined)
    ? `${Number(calculos.hsp).toFixed(3)} kWh/m²/día`
    : "No disponible";

  const coordsTxt = (calculos.lat !== null && calculos.lon !== null)
    ? `${Number(calculos.lat).toFixed(6)}, ${Number(calculos.lon).toFixed(6)}`
    : "No disponibles";

  resultadoDiv.innerHTML = `
    <strong>Resultado preliminar</strong><br><br>
    Suma facturas: <b>${calculos.sumaFacturas.toFixed(2)}</b><br>
    Promedio facturas: <b>${calculos.promFacturas.toFixed(2)}</b><br>
    Consumo diario estimado: <b>${calculos.consumoDia.toFixed(2)}</b><br>
    Potencia Pico del Sistema: <b>${calculos.potenciaPicoSistema.toFixed(1)} kWp</b><br>
    HSP (ciudad): <b>${hspTxt}</b><br>
    Coordenadas: <b>${coordsTxt}</b><br>
    Presupuesto estimado diario: <b>${calculos.presupuestoFinal.toFixed(2)}</b>
  `;
}

// ------------------------------
// Validación % + botón
// ------------------------------
function initPorcentajeValidation() {
  const porcentajeInput = document.getElementById("porcentaje");
  const btnCalcular = document.getElementById("btn-calcular");
  if (!porcentajeInput) return;

  // Crear mensaje de error dinámicamente (una sola vez)
  let errorMsg = porcentajeInput.parentNode?.querySelector?.(".error-text");
  if (!errorMsg) {
    errorMsg = document.createElement("div");
    errorMsg.className = "error-text";
    errorMsg.textContent = "El porcentaje debe estar entre 10% y 100%";
    errorMsg.style.display = "none";
    porcentajeInput.parentNode.appendChild(errorMsg);
  }

  function validar() {
    const value = Number(porcentajeInput.value);
    const invalido = Number.isNaN(value) || value < 10 || value > 100;

    if (invalido) {
      porcentajeInput.classList.add("input-error");
      errorMsg.style.display = "block";
    } else {
      porcentajeInput.classList.remove("input-error");
      errorMsg.style.display = "none";
    }

    if (btnCalcular) btnCalcular.disabled = invalido;
  }

  porcentajeInput.addEventListener("blur", validar);
  porcentajeInput.addEventListener("input", validar);
  validar();
}

// ------------------------------
// Carga cities.json + selects
// ------------------------------
async function loadCitiesJson() {
  const response = await fetch(URL_CITIES);
  if (!response.ok) throw new Error("No se pudo cargar cities.json");
  const data = await response.json();

  // Asegurar que sea objeto (no array)
  if (Array.isArray(data)) {
    throw new Error("Tu cities.json ahora debe ser un OBJETO { 'Depto|Ciudad': {...} }, no un array.");
  }

  return data;
}

function initDepartmentCitySelectors() {
  const deptSelect = document.getElementById("department");
  const citySelect = document.getElementById("city");

  if (!deptSelect || !citySelect) {
    console.error("No se encontraron los selects #department o #city");
    return;
  }

  // 1) Llenar departamentos
  setSelectOptions(deptSelect, departmentsList, "Selecciona un departamento");

  // 2) Cuando cambie el depto, llenar ciudades
  deptSelect.addEventListener("change", () => {
    const dept = deptSelect.value;

    const cities = citiesByDept[dept] || [];
    setSelectOptions(citySelect, cities, "Selecciona una ciudad");

    // Limpia cualquier info previa (si estás mostrando HSP en consola, etc.)
    console.log("Departamento seleccionado:", dept);
  });

  // 3) Cuando cambie la ciudad, obtener HSP del registro
  citySelect.addEventListener("change", () => {
    const dept = deptSelect.value;
    const city = citySelect.value;

    const rec = getSelectedCityRecord(dept, city);
    if (!rec) {
      console.warn("No encontré registro para:", buildKey(dept, city));
      return;
    }

    console.log("Ciudad seleccionada:", rec.municipio, "| HSP:", rec.hsp, "| coords:", rec.lat, rec.lon);
  });
}

// ------------------------------
// Main DOMContentLoaded
// ------------------------------
document.addEventListener("DOMContentLoaded", async () => {
  // Auto-resize comentarios
  const textarea = document.getElementById("comentarios");
  if (textarea) textarea.addEventListener("input", autoResize);

  // Footer year
  const yearSpan = document.getElementById("current-year");
  if (yearSpan) yearSpan.textContent = new Date().getFullYear();

  // Validación porcentaje
  initPorcentajeValidation();

  // Cargar cities.json (nuevo formato)
  try {
    citiesData = await loadCitiesJson();
    buildIndexesFromCitiesJson(citiesData);
    initDepartmentCitySelectors();
  } catch (err) {
    console.error("Error cargando o procesando cities.json:", err);
  }

  // Botón calcular
  const btnCalcular = document.getElementById("btn-calcular");
  if (btnCalcular) {
    btnCalcular.addEventListener("click", () => {
      leadData = getFormData();

      const rec = getSelectedCityRecord(leadData.department, leadData.city);

      // Si no hay registro, seguimos igual pero sin HSP
      calculos = calcularPresupuesto(leadData, rec);

      console.log("Datos usuario (leadData):", leadData);
      console.log("Registro ciudad (rec):", rec);
      console.log("Cálculos (calculos):", calculos);

      mostrarResultado(calculos);
    });
  }
});
