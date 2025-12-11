const URL_CITIES = "data/cities.json";



// --- SECCIÓN: CARGA DE DEPARTAMENTOS Y CIUDADES ---
document.addEventListener("DOMContentLoaded", async () => {
  const deptSelect = document.getElementById("department");
  const citySelect = document.getElementById("city");

  if (!deptSelect || !citySelect) {
    console.error("No se encontraron los selects #department o #city");
    return;
  }

  try {
    const response = await fetch(URL_CITIES);
    if (!response.ok) throw new Error("No se pudo cargar cities.json");

    const departamentos = await response.json(); // 👈 aquí viene el array grande
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
});
// --- FIN: CARGA DE DEPARTAMENTOS Y CIUDADES ---