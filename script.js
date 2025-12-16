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
    departamentos.forEach(dep => {
      const opt = document.createElement("option");
      opt.value = dep.departamento;
      opt.textContent = dep.departamento;
      deptSelect.appendChild(opt);
    });

    // Llenar ciudades según departamento
    deptSelect.addEventListener("change", () => {
      const nombreDept = deptSelect.value;
      const depObj = departamentos.find(d => d.departamento === nombreDept);

      citySelect.innerHTML = '<option value="">Selecciona una ciudad</option>';
      if (!depObj) return;

      depObj.ciudades.forEach(ciudad => {
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
  const consumDia=promFacturas/30;


  
  const presupuestoFinal = sumaFacturas / 30;

  return {
    sumaFacturas,
    presupuestoFinal
  };
}
// --- FIN: CÁLCULOS ---


// --- SECCIÓN: UI RESULTADOS (opcional) ---
function mostrarResultado(calculos) {
  const resultadoDiv = document.getElementById("resultado");
  if (!resultadoDiv) return;

  resultadoDiv.innerHTML = `
    <strong>Resultado preliminar</strong><br><br>
    Suma facturas: <b>${calculos.sumaFacturas.toFixed(2)}</b><br>
    Presupuesto estimado diario: <b>${calculos.presupuestoFinal.toFixed(2)}</b>
  `;
}
// --- FIN: UI RESULTADOS ---



// --- SECCIÓN: VALIDACIÓN % A CUBRIR CON SOLAR (BLUR) ---
document.addEventListener("DOMContentLoaded", () => {
  const porcentajeInput = document.getElementById("porcentaje");
  if (!porcentajeInput) return;

  // Crear mensaje de error dinámicamente
  const errorMsg = document.createElement("div");
  errorMsg.className = "error-text";
  errorMsg.textContent = "El porcentaje debe estar entre 10% y 100%";
  errorMsg.style.display = "none";

  porcentajeInput.parentNode.appendChild(errorMsg);

  porcentajeInput.addEventListener("blur", () => {
    const value = Number(porcentajeInput.value);

    if (Number.isNaN(value) || value < 10 || value > 100) {
      // ❌ Error
      porcentajeInput.classList.add("input-error");
      errorMsg.style.display = "block";
    } else {
      // ✅ Correcto
      porcentajeInput.classList.remove("input-error");
      errorMsg.style.display = "none";
    }
  });
});


const btnCalcular = document.getElementById("btn-calcular");

if (value < 10 || value > 100) {
  btnCalcular.disabled = true;
} else {
  btnCalcular.disabled = false;
}


document.addEventListener("DOMContentLoaded", () => {
  const yearSpan = document.getElementById("current-year");
  if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear();
  }
});
