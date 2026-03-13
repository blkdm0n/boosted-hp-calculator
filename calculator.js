const ATM = 14.7; // atmospheric PSI at sea level
let hpType = 'whp'; // 'whp' or 'chp'
let boostChart = null;

function setHpType(type) {
  hpType = type;
  document.getElementById('btn-whp').classList.toggle('active', type === 'whp');
  document.getElementById('btn-chp').classList.toggle('active', type === 'chp');
  document.getElementById('hp-label').textContent =
    type === 'whp' ? 'Current Wheel HP (WHP)' : 'Current Crank HP (BHP)';
  calculate();
}

function syncSlider() {
  const v = parseFloat(document.getElementById('boost-input').value) || 1;
  const clamped = Math.min(60, Math.max(1, v));
  document.getElementById('boost-slider').value = clamped;
  document.getElementById('slider-label').textContent = clamped + ' PSI';
  calculate();
}

function syncBoost() {
  const v = document.getElementById('boost-slider').value;
  document.getElementById('boost-input').value = v;
  document.getElementById('slider-label').textContent = v + ' PSI';
  calculate();
}

function calculate() {
  const drivetrainRatio = parseFloat(document.getElementById('drivetrain').value);
  const efficiency      = parseFloat(document.getElementById('efficiency').value);
  const fuelMultiplier  = parseFloat(document.getElementById('fuel').value);
  const boostPSI        = Math.min(60, Math.max(1, parseFloat(document.getElementById('boost-input').value) || 1));
  const inputHP         = Math.max(1, parseFloat(document.getElementById('hp-input').value) || 0);

  // Derive stock WHP and BHP from input
  let stockWHP, stockBHP;
  if (hpType === 'whp') {
    stockWHP = inputHP;
    stockBHP = Math.round(inputHP / drivetrainRatio);
  } else {
    stockBHP = inputHP;
    stockWHP = Math.round(inputHP * drivetrainRatio);
  }

  // Pressure ratio formula
  const pressureRatio = (ATM + boostPSI) / ATM;
  const boostedBHP    = Math.round(stockBHP * pressureRatio * efficiency * fuelMultiplier);
  const boostedWHP    = Math.round(boostedBHP * drivetrainRatio);

  const gainWHP = boostedWHP - stockWHP;
  const gainPct = ((boostedWHP / stockWHP - 1) * 100).toFixed(1);

  // Update stat boxes
  document.getElementById('res-stock-whp').textContent  = stockWHP.toLocaleString();
  document.getElementById('res-stock-bhp').textContent  = stockBHP.toLocaleString();
  document.getElementById('res-boost-whp').textContent  = boostedWHP.toLocaleString();
  document.getElementById('res-boost-bhp').textContent  = boostedBHP.toLocaleString();
  document.getElementById('res-gain').textContent       = '+' + gainWHP.toLocaleString() + ' hp';
  document.getElementById('res-gain-pct').textContent   = gainPct + '% increase vs stock';

  // Risk badge — E85 lowers risk at a given boost level due to better knock resistance
  const badge = document.getElementById('risk-badge');
  const riskText = document.getElementById('risk-text');
  badge.className = 'risk-badge';
  const isE85 = fuelMultiplier >= 1.10;
  const lowThresh = isE85 ? 12 : 8;
  const medThresh = isE85 ? 25 : 18;
  if (boostPSI <= lowThresh) {
    badge.classList.add('risk-low');
    riskText.textContent = 'Low — street safe' + (isE85 ? ' (E85 helps)' : '');
  } else if (boostPSI <= medThresh) {
    badge.classList.add('risk-med');
    riskText.textContent = 'Moderate — supporting mods needed';
  } else {
    badge.classList.add('risk-high');
    riskText.textContent = 'High — built engine required';
  }

  drawGauge(boostPSI, 60);
  updateChart(stockBHP, efficiency, fuelMultiplier, drivetrainRatio);
}

// ---- Gauge ----
function drawGauge(value, max) {
  const canvas = document.getElementById('gauge-canvas');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const cx = W / 2, cy = H - 10;
  const r  = H - 24;
  const startAngle = Math.PI;
  const endAngle   = 2 * Math.PI;
  const fraction   = Math.min(value / max, 1);
  const currentAngle = startAngle + fraction * Math.PI;

  // Track background
  ctx.beginPath();
  ctx.arc(cx, cy, r, startAngle, endAngle);
  ctx.lineWidth = 18;
  ctx.strokeStyle = '#2b3045';
  ctx.lineCap = 'round';
  ctx.stroke();

  // Colored fill
  const grad = ctx.createLinearGradient(cx - r, cy, cx + r, cy);
  grad.addColorStop(0,   '#22c55e');
  grad.addColorStop(0.5, '#f97316');
  grad.addColorStop(1,   '#ef4444');

  ctx.beginPath();
  ctx.arc(cx, cy, r, startAngle, currentAngle);
  ctx.lineWidth = 18;
  ctx.strokeStyle = grad;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Needle
  const needleAngle = startAngle + fraction * Math.PI;
  const nx = cx + (r) * Math.cos(needleAngle);
  const ny = cy + (r) * Math.sin(needleAngle);
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(nx, ny);
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#fff';
  ctx.lineCap = 'round';
  ctx.stroke();

  // Center dot
  ctx.beginPath();
  ctx.arc(cx, cy, 6, 0, 2 * Math.PI);
  ctx.fillStyle = '#fff';
  ctx.fill();

  // Label
  ctx.fillStyle = '#f97316';
  ctx.font = 'bold 26px Segoe UI, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(value + ' PSI', cx, cy - 22);

  ctx.fillStyle = '#7a8199';
  ctx.font = '13px Segoe UI, system-ui, sans-serif';
  ctx.fillText('boost pressure', cx, cy - 4);
}

// ---- Chart ----
function updateChart(stockBHP, efficiency, fuelMultiplier, drivetrainRatio) {
  const labels   = [];
  const dataNA   = [];
  const dataBst  = [];
  const dataE85  = [];
  const showE85  = fuelMultiplier < 1.10; // only show E85 comparison line when not already on E85

  for (let psi = 0; psi <= 60; psi += 2) {
    labels.push(psi + ' PSI');
    dataNA.push(Math.round(stockBHP * drivetrainRatio));
    const ratio = (ATM + psi) / ATM;
    dataBst.push(Math.round(stockBHP * ratio * efficiency * fuelMultiplier * drivetrainRatio));
    dataE85.push(Math.round(stockBHP * ratio * efficiency * 1.10 * drivetrainRatio));
  }

  if (boostChart) {
    boostChart.data.labels = labels;
    boostChart.data.datasets[0].data = dataNA;
    boostChart.data.datasets[1].data = dataBst;
    boostChart.data.datasets[2].data = showE85 ? dataE85 : [];
    boostChart.data.datasets[2].hidden = !showE85;
    boostChart.update('none');
    return;
  }

  const ctx = document.getElementById('boost-chart').getContext('2d');
  boostChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Stock WHP',
          data: dataNA,
          borderColor: '#7a8199',
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderDash: [5, 4],
          pointRadius: 0,
          tension: 0,
        },
        {
          label: 'Boosted WHP',
          data: dataBst,
          borderColor: '#f97316',
          backgroundColor: 'rgba(249,115,22,0.08)',
          borderWidth: 3,
          pointRadius: 0,
          fill: true,
          tension: 0.35,
        },
        {
          label: 'Boosted WHP (E85 +10%)',
          data: dataE85,
          borderColor: '#22c55e',
          backgroundColor: 'rgba(34,197,94,0.06)',
          borderWidth: 2,
          borderDash: [6, 4],
          pointRadius: 0,
          fill: false,
          tension: 0.35,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: { color: '#7a8199', font: { size: 12, weight: '600' }, boxWidth: 16 },
        },
        tooltip: {
          backgroundColor: '#1e2330',
          borderColor: '#2b3045',
          borderWidth: 1,
          titleColor: '#e8eaf0',
          bodyColor: '#7a8199',
          callbacks: {
            label: ctx => ' ' + ctx.dataset.label + ': ' + ctx.parsed.y.toLocaleString() + ' hp',
          },
        },
      },
      scales: {
        x: {
          ticks: {
            color: '#7a8199',
            maxTicksLimit: 10,
            font: { size: 11 },
          },
          grid: { color: '#1e2330' },
        },
        y: {
          ticks: {
            color: '#7a8199',
            font: { size: 11 },
            callback: v => v.toLocaleString() + ' hp',
          },
          grid: { color: '#1e2330' },
        },
      },
    },
  });
}

// Initialise
calculate();
