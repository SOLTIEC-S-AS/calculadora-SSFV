const URL_CITIES = "data/cities.json";

// Variables globales para usar en cálculos
let leadData = {};
let calculos = {};

// --- SECCIÓN: CARGA DE DEPARTAMENTOS Y CIUDADES + CAPTURA DE DATOS ---
document.addEventListener("DOMContentLoaded", async () => {
  const deptSelect = document.getElementById("department");
  const citySelect = document.getElementById("city");

  if (!deptSelect || !citySelect) {
    console.error("No se encontraron los selects #department o #city");
    return;
  }

  // ✅ Auto-resize comentarios (protegido)
  const textarea = document.getElementById("comentarios");
  if (textarea) {
    textarea.addEventListener("input", autoResize);
  }

  try {
    const response = await fetch(URL_CITIES);
    if (!response.ok) throw new Error("No se pudo cargar cities.json");

    const departamentos = await response.json(); // array grande

    // Llenar departamentos
    departamentos.forEach((dep) => {
      const opt = document.createElement("option");
      opt.value = dep.departamento;
      opt.textContent = dep.departamento;
      deptSelect.appendChild(opt);
    });

    // Llenar ciudades según departamento
    deptSelect.addEventListener("change", () => {
      const nombreDept = deptSelect.value;
      const depObj = departamentos.find((d) => d.departamento === nombreDept);

      citySelect.innerHTML = '<option value="">Selecciona una ciudad</option>';
      if (!depObj) return;

      depObj.ciudades.forEach((ciudad) => {
        const opt = document.createElement("option");
        opt.value = ciudad;
        opt.textContent = ciudad;
        citySelect.appendChild(opt);
      });
    });
  } catch (err) {
    console.error("Error cargando ciudades:", err);
  }

  // ✅ Botón calcular: captura variables y hace cálculos
  const btnCalcular = document.getElementById("btn-calcular");
  if (btnCalcular) {
    btnCalcular.addEventListener("click", () => {
      // 1) Guardar datos del usuario
      leadData = getFormData();

      // 2) Hacer cálculos
      calculos = calcularPresupuesto(leadData);

      // 3) Ver en consola
      console.log("Datos usuario (leadData):", leadData);
      console.log("Cálculos (calculos):", calculos);

      // 4) Mostrar en pantalla (opcional)
      mostrarResultado(calculos);
    });
  }
});
// --- FIN: CARGA DE DEPARTAMENTOS Y CIUDADES + CAPTURA DE DATOS ---


// --- SECCIÓN: COMENTARIOS (auto-resize) ---
function autoResize() {
  this.style.height = "auto";
  this.style.height = this.scrollHeight + "px";
}
// --- FIN: COMENTARIOS ---


// --- SECCIÓN: LECTURA DE FORMULARIO ---
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
// --- FIN: LECTURA DE FORMULARIO ---


// --- SECCIÓN: CÁLCULOS ---
function calcularPresupuesto(data) {
  const sumaFacturas = data.fact1 + data.fact2 + data.fact3;
  const promFacturas = sumaFacturas / 3;
  const consumoDia = promFacturas / 30;

  // ✅ Potencia Pico del Sistema (regla: % cobertura / 10)
  // Ej: 10% => 1 kWp, 50% => 5 kWp, 100% => 10 kWp
  const potenciaPicoSistema = data.porcentaje / 10;

  // (Tu cálculo original)
  const presupuestoFinal = sumaFacturas / 30;

  return {
    sumaFacturas,
    promFacturas,
    consumoDia,
    potenciaPicoSistema,
    presupuestoFinal
  };
}
// --- FIN: CÁLCULOS ---


// --- SECCIÓN: UI RESULTADOS (opcional) ------------------------------------------------------
function mostrarResultado(calculos) {
  const resultadoDiv = document.getElementById("resultado");
  if (!resultadoDiv) return;

  resultadoDiv.innerHTML = `
    <strong>Resultado preliminar</strong><br><br>
    Suma facturas: <b>${calculos.sumaFacturas.toFixed(2)}</b><br>
    Promedio facturas: <b>${calculos.promFacturas.toFixed(2)}</b><br>
    Consumo diario estimado: <b>${calculos.consumoDia.toFixed(2)}</b><br>
    Potencia Pico del Sistema: <b>${calculos.potenciaPicoSistema.toFixed(1)} kWp</b><br>
    Presupuesto estimado diario: <b>${calculos.presupuestoFinal.toFixed(2)}</b>
  `;
}
// --- FIN: UI RESULTADOS ---



// --- SECCIÓN: VALIDACIÓN % A CUBRIR CON SOLAR (BLUR + INPUT) ---
document.addEventListener("DOMContentLoaded", () => {
  const porcentajeInput = document.getElementById("porcentaje");
  const btnCalcular = document.getElementById("btn-calcular");

  if (!porcentajeInput) return;

  // Crear mensaje de error dinámicamente
  const errorMsg = document.createElement("div");
  errorMsg.className = "error-text";
  errorMsg.textContent = "El porcentaje debe estar entre 10% y 100%";
  errorMsg.style.display = "none";

  porcentajeInput.parentNode.appendChild(errorMsg);

  function validarPorcentajeYBoton() {
    const value = Number(porcentajeInput.value);

    const invalido = Number.isNaN(value) || value < 10 || value > 100;

    // UI de error
    if (invalido) {
      porcentajeInput.classList.add("input-error");
      errorMsg.style.display = "block";
    } else {
      porcentajeInput.classList.remove("input-error");
      errorMsg.style.display = "none";
    }

    // Botón calcular
    if (btnCalcular) {
      btnCalcular.disabled = invalido;
    }
  }

  // Validar al salir del input
  porcentajeInput.addEventListener("blur", validarPorcentajeYBoton);

  // Validar mientras escribe (mejor UX)
  porcentajeInput.addEventListener("input", validarPorcentajeYBoton);

  // Validación inicial al cargar
  validarPorcentajeYBoton();
});
// --- FIN: VALIDACIÓN % ---


// --- SECCIÓN: FOOTER YEAR ---
document.addEventListener("DOMContentLoaded", () => {
  const yearSpan = document.getElementById("current-year");
  if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear();
  }
});
// --- FIN: FOOTER YEAR ---
