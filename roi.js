const ROI_DATA_URL = "data/roi.json";

// Formato COP rápido
function formatCOP(value) {
  const n = Number(value) || 0;
  return n.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
}

function setCurrentYear() {
  const el = document.getElementById("current-year");
  if (el) el.textContent = new Date().getFullYear();
}

function calcPayback(years, cumulative) {
  // primer año donde acumulado >= 0
  for (let i = 0; i < cumulative.length; i++) {
    if (cumulative[i] >= 0) return years[i];
  }
  return null;
}

function calcROI10(investment, cumulative, years) {
  // ROI a 10 años: (beneficio neto acumulado a 10 años / inversión) * 100
  const idx = years.indexOf(10);
  if (idx === -1) return null;
  const netAt10 = cumulative[idx]; // acumulado incluye inversión negativa inicial
  const roi = (netAt10 / Math.abs(investment)) * 100;
  return roi;
}

async function loadROI() {
  const canvas = document.getElementById("roiChart");
  if (!canvas) return;

  const res = await fetch(ROI_DATA_URL);
  if (!res.ok) throw new Error("No se pudo cargar data/roi.json");

  const data = await res.json();

  // Esperado:
  // data.investment (negativo o positivo, nosotros lo manejamos)
  // data.years = [0..10]
  // data.cashflow = [flujo anual], año 0 suele ser -inversión
  // data.cumulative = [acumulado]
  const years = data.years || [];
  const cashflow = data.cashflow || [];
  const cumulative = data.cumulative || [];

  // Métricas
  const investment = Number(data.investment) || 0;
  const payback = calcPayback(years, cumulative);
  const roi10 = calcROI10(investment, cumulative, years);

  const paybackEl = document.getElementById("payback");
  const roi10El = document.getElementById("roi10");
  const capexEl = document.getElementById("capex");
  const savingsY1El = document.getElementById("savingsY1");

  if (paybackEl) paybackEl.textContent = payback ? `${payback} años` : "No recupera en el horizonte";
  if (roi10El) roi10El.textContent = (roi10 === null) ? "—" : `${roi10.toFixed(1)} %`;
  if (capexEl) capexEl.textContent = formatCOP(Math.abs(investment));
  if (savingsY1El) {
    // Ahorro año 1: cashflow del año 1 (si año 0 es inversión)
    const idxY1 = years.indexOf(1);
    savingsY1El.textContent = idxY1 >= 0 ? formatCOP(cashflow[idxY1]) : "—";
  }

  // Chart.js
  new Chart(canvas, {
    type: "bar",
    data: {
      labels: years.map(y => `Año ${y}`),
      datasets: [
  {
    label: "Flujo anual (COP)",
    data: cashflow,
    backgroundColor: "rgba(158, 211, 245, 0.85)", // azul claro SOLTIEC
    borderColor: "#0F6E8C",
    borderWidth: 1,
    borderRadius: 6
  },
  {
    label: "Retorno acumulado (COP)",
    type: "line",
    data: cumulative,
    yAxisID: "y",
    borderColor: "#0A4E63",     // azul oscuro SOLTIEC
    backgroundColor: "rgba(15, 110, 140, 0.15)",
    pointBackgroundColor: "#0F6E8C",
    pointBorderColor: "#0F6E8C",
    pointRadius: 4,
    tension: 0.3               // curva suave
  }
]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      scales: {
        y: {
          ticks: {
            callback: (val) => {
              const n = Number(val);
              return isNaN(n) ? val : (n / 1_000_000).toFixed(0) + "M";
            }
          }
        }
      },
      plugins: {
        legend: { display: true },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const label = ctx.dataset.label || "";
              const val = ctx.parsed.y;
              return `${label}: ${formatCOP(val)}`;
            }
          }
        }
      }
    }
  });
}
document.addEventListener("DOMContentLoaded", async () => {
  setCurrentYear();
  try {
    await loadROI();
  } catch (e) {
    console.error(e);
  }
});
