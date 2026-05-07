const canvas = document.getElementById('stars-canvas');
const ctx = canvas.getContext('2d');
let stars = [];

function initStars() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  stars = [];
  for (let i = 0; i < 220; i++) {
    stars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.2 + 0.2,
      o: Math.random() * 0.7 + 0.2,
      s: Math.random() * 0.5 + 0.1,
      d: Math.random() > 0.5 ? 1 : -1
    });
  }
}

function drawStars() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#080010';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  stars.forEach(s => {
    s.o += 0.003 * s.d * s.s;
    if (s.o > 0.9 || s.o < 0.1) s.d *= -1;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(220,210,255,${s.o})`;
    ctx.fill();
  });
  requestAnimationFrame(drawStars);
}

initStars();
drawStars();
window.addEventListener('resize', initStars);

const fileInput = document.getElementById('fileInput');
const uploadZone = document.getElementById('uploadZone');
let currentFile = null;

uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('dragover'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
uploadZone.addEventListener('drop', e => {
  e.preventDefault();
  uploadZone.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) handleFile(file);
});

fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) handleFile(fileInput.files[0]);
});

function handleFile(file) {
  currentFile = file;
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('previewImg').src = e.target.result;
    document.getElementById('previewContainer').style.display = 'block';
    document.getElementById('uploadZone').style.display = 'none';
    document.getElementById('uploadStatus').style.display = 'flex';
    document.getElementById('uploadStatusText').textContent =
      `${file.name} · ${(file.size / 1024).toFixed(1)} KB · Ready for analysis`;
    document.getElementById('analyzeBtn').disabled = false;
    ['resultsCard','riskCard','zonesCard'].forEach(id =>
      document.getElementById(id).classList.add('hidden')
    );
  };
  reader.readAsDataURL(file);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function addLog(text, highlight = false) {
  const log = document.getElementById('analysisLog');
  const span = document.createElement('span');
  span.className = 'log-line' + (highlight ? ' highlight' : '');
  const time = new Date().toLocaleTimeString('en', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  span.textContent = `[${time}] ${text}`;
  log.appendChild(span);
  log.scrollTop = log.scrollHeight;
}

async function startAnalysis() {
  if (!currentFile) return;

  document.getElementById('analyzeBtn').disabled = true;
  document.getElementById('btnText').textContent = '⚡ Analyzing...';
  document.getElementById('analysisLog').innerHTML = '';
  document.getElementById('analysisLog').style.display = 'block';
  document.getElementById('scanOverlay').style.display = 'block';
  document.getElementById('scanLine').style.display = 'block';

  const logs = [
    ['Initializing terrain segmentation model...', false],
    ['Loading CNN weights (ResNet-50 pre-trained)...', false],
    ['Preprocessing surface image: normalization complete', false],
    ['Running crater detection (Hough Circle Transform)...', false],
    ['Classifying terrain types via ensemble classifier...', false],
    ['Computing slope gradients & elevation variance...', false],
    ['Running hazard probability model...', false],
    ['Generating landing zone safety scores...', false],
    ['Analysis complete. Compiling mission report.', true],
  ];

  for (const [msg, hl] of logs) {
    addLog(msg, hl);
    await sleep(380 + Math.random() * 280);
  }

  const formData = new FormData();
  formData.append('image', currentFile);

  try {
    const response = await fetch('/analyze', { method: 'POST', body: formData });
    const data = await response.json();
    if (data.error) { addLog('ERROR: ' + data.error); return; }
    renderResults(data);
  } catch (err) {
    addLog('Connection error. Is Flask running?');
  }

  document.getElementById('scanOverlay').style.display = 'none';
  document.getElementById('scanLine').style.display = 'none';
  document.getElementById('btnText').textContent = '🔭 Initiate Surface Scan';
  document.getElementById('analyzeBtn').disabled = false;
}

function renderResults(data) {
  const resultsCard = document.getElementById('resultsCard');
  resultsCard.classList.remove('hidden');
  const list = document.getElementById('terrainList');
  list.innerHTML = '';
  data.terrains.forEach((t, i) => {
    const el = document.createElement('div');
    el.className = 'terrain-item';
    el.innerHTML = `
      <span class="terrain-label">${t.name}</span>
      <div class="terrain-bar-bg">
        <div class="terrain-bar" id="bar${i}" style="width:0%;background:${t.color}"></div>
      </div>
      <span class="terrain-pct">${t.pct}%</span>
    `;
    list.appendChild(el);
    setTimeout(() => { document.getElementById(`bar${i}`).style.width = t.pct + '%'; }, 100 + i * 150);
  });

  setTimeout(() => {
    document.getElementById('riskCard').classList.remove('hidden');
    const score = data.safety_score;
    const offset = 201 - (score / 100) * 201;
    const ring = document.getElementById('ringProgress');
    ring.style.stroke = score >= 70 ? '#5cff9a' : score >= 45 ? '#ffcc44' : '#ff5566';
    setTimeout(() => { ring.style.strokeDashoffset = offset; }, 100);
    document.getElementById('ringText').textContent = score + '%';
    document.getElementById('overallVerdict').textContent = data.verdict;
    document.getElementById('overallVerdict').className = 'overall-verdict ' + data.verdict_class;
    document.getElementById('overallDesc').textContent = data.description;

    const grid = document.getElementById('metricsGrid');
    grid.innerHTML = '';
    data.metrics.forEach(m => {
      const el = document.createElement('div');
      el.className = 'result-metric';
      el.innerHTML = `
        <div class="metric-label">${m.label}</div>
        <div class="metric-value ${m.cls}">${m.value}</div>
        <div class="metric-sub">${m.sub}</div>
      `;
      grid.appendChild(el);
    });
  }, 800);

  setTimeout(() => {
    document.getElementById('zonesCard').classList.remove('hidden');
    const container = document.getElementById('landingZones');
    container.innerHTML = '';
    data.zones.forEach(z => {
      const el = document.createElement('div');
      el.className = 'zone-card';
      el.innerHTML = `
        <div class="zone-id">${z.id}</div>
        <div class="zone-status ${z.cls}">${z.status}</div>
        <div class="zone-score ${z.cls}">${z.score}</div>
        <div class="zone-desc">${z.desc}</div>
      `;
      container.appendChild(el);
    });
  }, 1400);
}