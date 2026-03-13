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
  const drivetrainSel   = document.getElementById('drivetrain').value;
  const drivetrainRatio = parseFloat(drivetrainSel);
  const efficiency      = parseFloat(document.getElementById('efficiency').value);
  const fuelMultiplier  = parseFloat(document.getElementById('fuel').value);
  const boostPSI        = Math.min(60, Math.max(1, parseFloat(document.getElementById('boost-input').value) || 1));
  const inputHP         = Math.max(1, parseFloat(document.getElementById('hp-input').value) || 0);
  const weightLbs       = Math.max(500, parseFloat(document.getElementById('weight-input').value) || 3500);

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

  renderComparison(boostedBHP, weightLbs, drivetrainSel);
  try { drawGauge(boostPSI, 60); } catch(e) { console.warn('Gauge error:', e); }
  try { updateChart(stockBHP, efficiency, fuelMultiplier, drivetrainRatio); } catch(e) { console.warn('Chart error:', e); }
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

// ---- Production car database (real-world tested times) ----
const PRODUCTION_CARS = [
  { name: 'Honda Civic Type R (FL5)',     hp: 315,  z60: 5.2,  qmile: 13.7, r60130: 18.0 },
  { name: 'Subaru WRX STI',              hp: 310,  z60: 4.8,  qmile: 13.2, r60130: 16.5 },
  { name: 'VW Golf R (Mk8)',             hp: 315,  z60: 4.7,  qmile: 13.1, r60130: 16.0 },
  { name: 'Toyota GR Supra (A90)',       hp: 382,  z60: 4.1,  qmile: 12.4, r60130: 13.5 },
  { name: 'Ford Mustang GT',             hp: 450,  z60: 4.3,  qmile: 12.6, r60130: 14.5 },
  { name: 'Chevrolet Camaro SS',         hp: 455,  z60: 4.0,  qmile: 12.3, r60130: 13.8 },
  { name: 'Dodge Charger Scat Pack',     hp: 485,  z60: 4.2,  qmile: 12.4, r60130: 13.5 },
  { name: 'Tesla Model 3 Performance',   hp: 450,  z60: 3.1,  qmile: 11.5, r60130: 11.5 },
  { name: 'BMW M3 Competition (G80)',    hp: 503,  z60: 3.4,  qmile: 11.6, r60130: 11.8 },
  { name: 'Cadillac CT5-V Blackwing',   hp: 668,  z60: 3.7,  qmile: 11.8, r60130: 11.2 },
  { name: 'Chevrolet Corvette C8',       hp: 490,  z60: 2.9,  qmile: 11.2, r60130: 10.5 },
  { name: 'Nissan GT-R (R35)',           hp: 565,  z60: 2.9,  qmile: 11.4, r60130: 10.0 },
  { name: 'Porsche 911 Carrera S (992)', hp: 443,  z60: 3.5,  qmile: 11.7, r60130: 11.2 },
  { name: 'Ford Mustang Shelby GT500',   hp: 760,  z60: 3.3,  qmile: 11.5, r60130: 10.0 },
  { name: 'Dodge Challenger Hellcat',    hp: 717,  z60: 3.6,  qmile: 11.7, r60130: 10.2 },
  { name: 'Porsche 911 Turbo S (992)',   hp: 640,  z60: 2.6,  qmile: 10.5, r60130:  7.8 },
  { name: 'McLaren 720S',               hp: 710,  z60: 2.8,  qmile: 10.4, r60130:  7.2 },
  { name: 'Ferrari 488 GTB',            hp: 661,  z60: 3.0,  qmile: 10.9, r60130:  8.5 },
  { name: 'Lamborghini Huracán EVO',    hp: 631,  z60: 2.9,  qmile: 10.8, r60130:  8.2 },
  { name: 'Dodge Challenger Demon 170', hp: 1025, z60: 1.66, qmile: 8.91, r60130:  6.8 },
  { name: 'Tesla Model S Plaid',        hp: 1020, z60: 1.99, qmile: 9.23, r60130:  5.5 },
  { name: 'Bugatti Chiron Sport',       hp: 1479, z60: 2.4,  qmile: 9.4,  r60130:  4.5 },
];

// ---- Estimate performance times from HP + weight ----
// Uses the Hale/Hollander quarter-mile formula; 0-60 and 60-130 are derived empirically.
function estimateTimes(hp, weightLbs, drivetrainSel) {
  const wPerHp  = weightLbs / hp;
  const isAWD   = drivetrainSel === '0.78';
  const isFWD   = drivetrainSel === '0.88';

  const qmile   = 6.269 * Math.pow(wPerHp, 1 / 3);

  const launchAdj = isAWD ? -0.55 : isFWD ? -0.15 : -0.30;
  const z60     = Math.max(1.4, 0.51 * qmile + launchAdj - 1.9);

  const rollFactor = isAWD ? 1.40 : isFWD ? 1.85 : 1.70;
  const r60130  = Math.max(3.0, wPerHp * rollFactor);

  return { z60: +z60.toFixed(2), qmile: +qmile.toFixed(2), r60130: +r60130.toFixed(1) };
}

// ---- Tab switcher ----
function switchTab(tab) {
  document.getElementById('view-results').classList.toggle('active', tab === 'results');
  document.getElementById('view-compare').classList.toggle('active', tab === 'compare');
  document.getElementById('tab-results').classList.toggle('active', tab === 'results');
  document.getElementById('tab-compare').classList.toggle('active', tab === 'compare');
  if (tab === 'compare') calculate(); // always re-render comparison when tab opens
  if (boostChart) boostChart.resize();
}

// ---- Render comparison table ----
function renderComparison(boostedBHP, weightLbs, drivetrainSel) {
  const my = estimateTimes(boostedBHP, weightLbs, drivetrainSel);

  document.getElementById('your-z60').textContent    = my.z60    + 's';
  document.getElementById('your-qmile').textContent  = my.qmile  + 's';
  document.getElementById('your-r60130').textContent = my.r60130 + 's';

  const tbody = document.getElementById('compare-tbody');
  if (!tbody) return;

  const sorted = [...PRODUCTION_CARS].sort((a, b) => a.z60 - b.z60);

  tbody.innerHTML = sorted.map(car => {
    const TIE_Z60   = 0.15, TIE_Q = 0.15, TIE_ROLL = 0.3;
    const beatZ60   = my.z60    < car.z60   - TIE_Z60;
    const beatQ     = my.qmile  < car.qmile - TIE_Q;
    const beatRoll  = my.r60130 < car.r60130 - TIE_ROLL;
    const tieZ60    = !beatZ60  && Math.abs(my.z60    - car.z60)    < TIE_Z60;
    const tieQ      = !beatQ    && Math.abs(my.qmile  - car.qmile)  < TIE_Q;
    const tieRoll   = !beatRoll && Math.abs(my.r60130 - car.r60130) < TIE_ROLL;

    const wins   = [beatZ60, beatQ, beatRoll].filter(Boolean).length;
    const losses = [!beatZ60 && !tieZ60, !beatQ && !tieQ, !beatRoll && !tieRoll].filter(Boolean).length;
    const rowCls = wins >= 2 ? 'row-beat' : losses >= 2 ? 'row-lose' : '';

    const tdCls = (beat, tie) => tie ? 'td-tie' : beat ? 'td-beat' : 'td-lose';
    const arrow = (myT, carT, beat, tie) => tie ? '=' : beat ? '\u25bc' : '\u25b2';
    const cell  = (myT, carT, beat, tie) =>
      `<td class="metric-cell"><span class="${tdCls(beat,tie)}">${arrow(myT,carT,beat,tie)} ${carT}s</span></td>`;

    let badge, badgeCls;
    if      (wins === 3)   { badge = '\u2713 Win All';  badgeCls = 'ob-beat'; }
    else if (losses === 3) { badge = '\u2717 Lose All'; badgeCls = 'ob-lose'; }
    else                   { badge = '\u007e Mixed';    badgeCls = 'ob-mix';  }

    return `<tr class="${rowCls}">
      <td><div class="car-name">${car.name}</div><div class="car-stock">${car.hp} hp stock</div></td>
      ${cell(my.z60,    car.z60,    beatZ60,  tieZ60)}
      ${cell(my.qmile,  car.qmile,  beatQ,    tieQ)}
      ${cell(my.r60130, car.r60130, beatRoll, tieRoll)}
      <td style="text-align:center"><span class="overall-badge ${badgeCls}">${badge}</span></td>
    </tr>`;
  }).join('');
}

// Initialise
calculate();
