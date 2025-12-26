const URL_CITIES = "https://soltiec-s-as.github.io/calculadora-SSFV/data/cities.json";
const SESSION_KEY = "ssf_app_state_v1";

let citiesMap = {};
let leadData = {};
let calculos = {};

// ---------------------
// Conservar datos ingresados al cambiar de pestaña
// ---------------------
function isReloadNavigation() {
  const nav = performance.getEntriesByType?.("navigation")?.[0];
  return nav?.type === "reload";
}
function resetIfReload() {
  if (isReloadNavigation()) {
    sessionStorage.removeItem(SESSION_KEY);
  }
}
function saveAppState(partial = {}) {
  const current = loadAppState();
  const next = {
    ...current,
    ...partial,
    _ts: Date.now()
  };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
}
function loadAppState() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "{}");
  } catch {
    return {};
  }
}

// ---------------------
// Auto-resize área de texto
// ---------------------
function autoResize() {
  this.style.height = "auto";
  this.style.height = this.scrollHeight + "px";
}

// ---------------------
// Facturas sin números negativos
// ---------------------
function parsePositiveNumber(str) {
  const s = String(str ?? "").trim();
  if (!s) return 0;
  const n = Number(s);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, n);
}
function sanitizeFacturaInput(el) {
  let v = String(el.value ?? "");
  v = v.replace(/[^\d.]/g, "");
  const parts = v.split(".");
  if (parts.length > 2) {
    v = parts[0] + "." + parts.slice(1).join("");
  }
  if (v.startsWith(".")) v = "0" + v;
  el.value = v;
}

// ---------------------
// Datos del formulario
// ---------------------
function getFormData() {
  return {
    fact1: parsePositiveNumber(document.getElementById("fact1")?.value),
    fact2: parsePositiveNumber(document.getElementById("fact2")?.value),
    fact3: parsePositiveNumber(document.getElementById("fact3")?.value),
    department: document.getElementById("department")?.value || "",
    city: document.getElementById("city")?.value || "",
    estrato: document.getElementById("estrato")?.value || "",
    porcentaje: parsePositiveNumber(document.getElementById("porcentaje")?.value),
    baterias: document.getElementById("baterias")?.value || "",
    nombre: document.getElementById("nombre")?.value || "",
    telefono: document.getElementById("telefono")?.value || "",
    correo: document.getElementById("correo")?.value || "",
    comentarios: document.getElementById("comentarios")?.value || ""
  };
}

// ---------------------
// Cálculo de presupuesto
// ---------------------
function calcularPresupuesto(data, hsp) {
  const sumaFacturas = data.fact1 + data.fact2 + data.fact3;
  const promFacturas = sumaFacturas / 3;
  const consumoDia = promFacturas / 30;
  const potenciaPicoSistema = (data.porcentaje * consumoDia) / (0.97 * 0.90 * 0.97 * 100 * hsp);
  const energiaAno=hsp*potenciaPicoSistema*360*0.85;
  const presupuestoFinal = sumaFacturas / 30;

  return {
    sumaFacturas,
    promFacturas,
    consumoDia,
    potenciaPicoSistema,
    presupuestoFinal,
    hsp: Number.isFinite(hsp) ? hsp : null,
    energiaAno
  };
}

// ---------------------
// UI RESULTADOS
// ---------------------
function mostrarResultado(calculos) {
  const resultadoDiv = document.getElementById("resultado");
  if (!resultadoDiv) return;

  const hspTxt = (calculos.hsp == null)
    ? `<span style="color:#b00;">(sin HSP: revisa selección de ciudad)</span>`
    : `<b>${calculos.hsp.toFixed(3)}</b>`;

  resultadoDiv.innerHTML = `
    <strong>Presupuesto preliminar</strong><br><br>
    Potencia Pico del Sistema: <b>${calculos.potenciaPicoSistema.toFixed(2)} kWp</b><br>
    Energía generada anual: <b>${calculos.energiaAno.toFixed(2)} kWh</b><br>
    Área necesaria en techo <b>${calculos.potenciaPicoSistema.toFixed(1)} m²</b><br>
    Presupuesto estimado: <b>${calculos.presupuestoFinal} $</b>
    ${calculos.hsp.toFixed(2)}
  `;
}

// ---------------------
// CARGA cities.json (nuevo formato: objeto)
// ---------------------
async function loadCitiesMap() {
  const resp = await fetch(URL_CITIES);
  if (!resp.ok) throw new Error("No se pudo cargar cities.json");
  const data = await resp.json();
  if (Array.isArray(data)) {
    throw new Error("Tu cities.json sigue en formato viejo (array). Debe ser objeto { 'Depto|Ciudad': {...} }");
  }

  return data;
}

// ---------------------
// POBLAR SELECTS: Departamento -> Ciudad
// ---------------------
function getDepartamentosUnicos(mapObj) {
  const set = new Set();
  for (const key of Object.keys(mapObj)) {
    const item = mapObj[key];
    if (item?.departamento) set.add(item.departamento);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
}

function getCiudadesPorDepartamento(mapObj, departamento) {
  const cities = [];
  for (const key of Object.keys(mapObj)) {
    const item = mapObj[key];
    if (item?.departamento === departamento) {
      cities.push(item.municipio);
    }
  }
  // Orden + quitar repetidas
  return Array.from(new Set(cities)).sort((a, b) => a.localeCompare(b, "es"));
}

function findCityRecord(mapObj, departamento, municipio) {
  const key = `${departamento}|${municipio}`;
  return mapObj[key] || null;
}

function fillDepartments(deptSelect, departamentos) {
  deptSelect.innerHTML = '<option value="">Selecciona un departamento</option>';
  departamentos.forEach(dep => {
    const opt = document.createElement("option");
    opt.value = dep;
    opt.textContent = dep;
    deptSelect.appendChild(opt);
  });
}

function fillCities(citySelect, ciudades) {
  citySelect.innerHTML = '<option value="">Selecciona una ciudad</option>';
  ciudades.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    citySelect.appendChild(opt);
  });
}

// ---------------------
// VALIDACIÓN % (10 a 100) + botón
// ---------------------
function setupPorcentajeValidation() {
  const porcentajeInput = document.getElementById("porcentaje");
  const btnCalcular = document.getElementById("btn-calcular");
  if (!porcentajeInput) return;

  const errorMsg = document.createElement("div");
  errorMsg.className = "error-text";
  errorMsg.textContent = "El porcentaje debe estar entre 10% y 100%";
  errorMsg.style.display = "none";
  porcentajeInput.parentNode.appendChild(errorMsg);

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

    // OJO: ya no bloqueamos el botón por aquí.
    // La validación obligatoria se hace al submit.
    if (btnCalcular) btnCalcular.disabled = false;
  }

  porcentajeInput.addEventListener("input", validar);
  porcentajeInput.addEventListener("blur", validar);
  validar();
}

// ---------------------
// VALIDACIÓN FACTURAS: sin "-" y solo >= 0 con "."
// ---------------------
function setupFacturasValidation() {
  const ids = ["fact1", "fact2", "fact3"];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;

    // Evitar negativos desde el teclado
    el.addEventListener("keydown", (e) => {
      if (e.key === "-" || e.key === "e" || e.key === "E") {
        e.preventDefault();
      }
    });

    // Sanitizar mientras escribe
    el.addEventListener("input", () => sanitizeFacturaInput(el));
  });
}

// ---------------------
// VALIDACIÓN OBLIGATORIA (NUEVO)
// ---------------------
function setupRequiredFieldsValidation() {
  const form = document.getElementById("ssfvForm");
  const alertBox = document.getElementById("formAlert");
  if (!form || !alertBox) return;

  const fields = {
    fact1: document.getElementById("fact1"),
    fact2: document.getElementById("fact2"),
    fact3: document.getElementById("fact3"),
    department: document.getElementById("department"),
    city: document.getElementById("city"),
    estrato: document.getElementById("estrato"),
    porcentaje: document.getElementById("porcentaje"),
    baterias: document.getElementById("baterias"),
  };

  const mark = (el, bad) => {
    if (!el) return;
    el.classList.toggle("field-error", !!bad);
  };

  const showAlert = (msg) => {
    alertBox.textContent = msg;
    alertBox.style.display = "block";
  };

  const clearAlert = () => {
    alertBox.textContent = "";
    alertBox.style.display = "none";
  };

  function validateAll() {
    clearAlert();
    Object.values(fields).forEach(el => mark(el, false));

    const d = getFormData();
    const errors = [];

    // Facturas: obligatorias y > 0
    if (!(d.fact1 > 0)) errors.push({ el: fields.fact1 });
    if (!(d.fact2 > 0)) errors.push({ el: fields.fact2 });
    if (!(d.fact3 > 0)) errors.push({ el: fields.fact3 });

    // Selects obligatorios
    if (!d.department) errors.push({ el: fields.department });
    if (!d.city) errors.push({ el: fields.city });
    if (!d.estrato) errors.push({ el: fields.estrato });
    if (!d.baterias) errors.push({ el: fields.baterias });

    // % solar obligatorio entre 10 y 100
    const pct = Number(fields.porcentaje?.value);
    if (!fields.porcentaje?.value || Number.isNaN(pct) || pct < 10 || pct > 100) {
      errors.push({ el: fields.porcentaje });
    }

    if (errors.length) {
      errors.forEach(e => mark(e.el, true));
      showAlert("Te faltan datos obligatorios. Revisa los campos marcados en rojo.");
      errors[0].el?.focus?.();
      return false;
    }
    return true;
  }

  // Validar al enviar (submit)
  form.addEventListener("submit", (e) => {
    e.preventDefault();

    if (!validateAll()) return;

    // ✅ si todo está OK, calculamos:
    leadData = getFormData();
    const rec = findCityRecord(citiesMap, leadData.department, leadData.city);
    const hsp = rec?.hsp;

    calculos = calcularPresupuesto(leadData, hsp);

    // Guardar para ROI/back
    saveAppState({ leadData, calculos });

    mostrarResultado(calculos);

    // Si luego navegas a ROI, aquí sería el lugar:
    // window.location.href = "roi.html";
  });

  // Opcional: limpiar alerta cuando el usuario empiece a corregir
  form.addEventListener("input", () => {
    if (alertBox.style.display === "block") {
      clearAlert();
    }
  });
}

// ---------------------
// Persistencia "solo entre páginas" en la pestaña
// (NO persiste si recargas porque la limpiamos en resetIfReload())
// ---------------------
function setupAutosaveInputs() {
  const allIds = [
    "fact1", "fact2", "fact3",
    "department", "city",
    "estrato", "porcentaje", "baterias",
    "nombre", "telefono", "correo", "comentarios"
  ];

  function saveNow() {
    const data = getFormData();
    saveAppState({ leadData: data });
  }

  allIds.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("input", saveNow);
    el.addEventListener("change", saveNow);
  });
}

function restoreInputsFromState() {
  const state = loadAppState();
  if (!state?.leadData) return;

  const d = state.leadData;

  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = val ?? "";
  };

  setVal("fact1", d.fact1);
  setVal("fact2", d.fact2);
  setVal("fact3", d.fact3);

  setVal("estrato", d.estrato);
  setVal("porcentaje", d.porcentaje);
  setVal("baterias", d.baterias);

  setVal("nombre", d.nombre);
  setVal("telefono", d.telefono);
  setVal("correo", d.correo);
  setVal("comentarios", d.comentarios);

  // department/city los restauramos después de cargar citiesMap,
  // para que existan las options.
}

// ---------------------
// INIT
// ---------------------
document.addEventListener("DOMContentLoaded", async () => {
  // 0) Reset si fue recarga
  resetIfReload();

  // Footer year
  const yearSpan = document.getElementById("current-year");
  if (yearSpan) yearSpan.textContent = new Date().getFullYear();

  // Auto-resize comentarios
  const textarea = document.getElementById("comentarios");
  if (textarea) textarea.addEventListener("input", autoResize);

  // Validaciones base
  setupPorcentajeValidation();
  setupFacturasValidation();

  // Autosave en sesión (para ROI/back)
  setupAutosaveInputs();
  restoreInputsFromState();

  // Cargar citiesMap (nuevo)
  try {
    citiesMap = await loadCitiesMap();
  } catch (err) {
    console.error("Error cargando cities.json:", err);
    return;
  }

  const deptSelect = document.getElementById("department");
  const citySelect = document.getElementById("city");
  if (!deptSelect || !citySelect) {
    console.error("No se encontraron los selects #department o #city");
    return;
  }

  // Llenar departamentos
  const departamentos = getDepartamentosUnicos(citiesMap);
  fillDepartments(deptSelect, departamentos);

  // Restaurar depto/ciudad si había estado guardado
  const state = loadAppState();
  const prevDept = state?.leadData?.department || "";
  const prevCity = state?.leadData?.city || "";

  if (prevDept) {
    deptSelect.value = prevDept;
    const ciudades = getCiudadesPorDepartamento(citiesMap, prevDept);
    fillCities(citySelect, ciudades);
  }

  if (prevDept && prevCity) {
    citySelect.value = prevCity;
  }

  // Cuando cambia departamento, carga ciudades
  deptSelect.addEventListener("change", () => {
    const dep = deptSelect.value;

    fillCities(citySelect, dep ? getCiudadesPorDepartamento(citiesMap, dep) : []);
    citySelect.value = ""; // limpiar selección ciudad

    saveAppState({ leadData: getFormData() });
  });

  // Cuando cambia ciudad, guarda
  citySelect.addEventListener("change", () => {
    saveAppState({ leadData: getFormData() });
  });

  // ✅ Validación obligatoria + cálculo por submit
  setupRequiredFieldsValidation();

  // Si venías de ROI y ya había cálculos, puedes mostrarlos de una:
  if (state?.calculos && document.getElementById("resultado")) {
    mostrarResultado(state.calculos);
  }
});

function sendHeightToParent() {
  const height = document.documentElement.scrollHeight;
  parent.postMessage({ iframeHeight: height }, "*");
}

// enviar al cargar
window.addEventListener("load", sendHeightToParent);

// enviar si cambia contenido
window.addEventListener("resize", sendHeightToParent);
setInterval(sendHeightToParent, 500);