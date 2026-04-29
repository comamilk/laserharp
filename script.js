const canvas = document.getElementById('harp');
const ctx = canvas.getContext('2d');
const msg = document.getElementById('msg');
const ui = document.getElementById('ui');
const uiContainer = document.getElementById('ui-container');
const uiToggle = document.getElementById('ui-toggle');

let audioCtx;
let width, height;
let strings = [];
let mousePos = { x: -999, y: -999 };

const unitW = 240;
const gap = 120;
const pillarW = 24;
const laserSpacing = 100;

uiToggle.addEventListener('click', () => {
  uiContainer.classList.toggle('folded');
});

function createUI() {
  ui.innerHTML = "";
  for (let i = 0; i < 6; i++) {
    const row = document.createElement('div');
    row.className = 'row';
    const label = i < 3 ? `L-${i + 1}` : `R-${i - 2}`;
    row.innerHTML = `
            <span style="width:25px; color:#0f0;">${label}</span>
            <input type="file" accept=".wav,.mp3,.flac" id="file-${i}">
            <select id="mode-${i}">
                <option value="oneshot">ONESHOT</option>
                <option value="hold">HOLD</option>
            </select>
        `;
    ui.appendChild(row);
    document.getElementById(`file-${i}`).addEventListener('change', (e) => loadSample(e, i));
  }
}

async function loadSample(e, index) {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const file = e.target.files[0];
  if (!file) return;
  const arrayBuffer = await file.arrayBuffer();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  strings[index].buffer = audioBuffer;
  msg.innerText = `LOADED: ${file.name}`;
}

function init() {
  width = canvas.width = window.innerWidth;
  height = canvas.height = window.innerHeight;
  strings = [];
  const centerY = height / 2;
  const centerX = width / 2;
  const leftX = centerX - gap / 2 - unitW;
  const rightX = centerX + gap / 2;

  for (let i = 0; i < 6; i++) {
    const isRightSide = i >= 3;
    const localIdx = i % 3;
    const y = centerY - laserSpacing + (localIdx * laserSpacing);

    strings.push({
      x1: isRightSide ? rightX : leftX,
      x2: isRightSide ? rightX + unitW : leftX + unitW,
      y: y,
      side: isRightSide ? 'right' : 'left',
      active: false,
      buffer: null,
      source: null,
      gainNode: null
    });
  }
}

function playSample(index) {
  if (!audioCtx || !strings[index].buffer) return;
  const s = strings[index];
  if (s.source) { try { s.source.stop(); } catch (e) { } }
  const source = audioCtx.createBufferSource();
  const gainNode = audioCtx.createGain();
  source.buffer = s.buffer;
  source.connect(gainNode).connect(audioCtx.destination);
  source.start(0);
  s.source = source;
  s.gainNode = gainNode;
}

function stopSample(index) {
  const s = strings[index];
  const mode = document.getElementById(`mode-${index}`).value;
  if (mode === 'hold' && s.source && s.gainNode) {
    s.gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
    setTimeout(() => { try { s.source.stop(); } catch (e) { } }, 100);
  }
}

function draw() {
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#020512';
  ctx.fillRect(0, 0, width, height);
  if (strings.length === 0) return;
  const firstY = strings[0].y;
  const lastY = strings[2].y;
  const pTop = firstY - 30;
  const pHeight = (lastY - firstY) + 60;
  const pX = [strings[0].x1, strings[0].x2, strings[3].x1, strings[3].x2];
  pX.forEach((x, i) => {
    ctx.save();
    const drawX = (i % 2 === 0) ? x - pillarW : x;
    const grad = ctx.createLinearGradient(drawX, pTop, drawX + pillarW, pTop);
    grad.addColorStop(0, '#111'); grad.addColorStop(0.5, '#444'); grad.addColorStop(1, '#111');
    ctx.fillStyle = grad;
    ctx.fillRect(drawX, pTop, pillarW, pHeight);
    ctx.restore();
  });
  strings.forEach((s, i) => {
    const isHitting = Math.abs(mousePos.y - s.y) < 25 && mousePos.x >= s.x1 && mousePos.x <= s.x2;
    let dXStart = s.x1;
    let dXEnd = s.x2;
    if (isHitting) {
      if (!s.active) { s.active = true; playSample(i); }
      if (s.side === 'left') { dXStart = mousePos.x; dXEnd = s.x2; }
      else { dXStart = s.x1; dXEnd = mousePos.x; }
    } else {
      if (s.active) { s.active = false; stopSample(i); }
    }
    ctx.save();
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#0f0';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#0f0';
    ctx.beginPath();
    ctx.moveTo(dXStart, s.y);
    ctx.lineTo(dXEnd, s.y);
    ctx.stroke();
    if (s.active) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.shadowBlur = 30;
      ctx.fillStyle = 'rgba(0, 255, 0, 0.5)';
      ctx.beginPath(); ctx.arc(mousePos.x, s.y, 10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(mousePos.x, s.y, 4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#0f0';
    const srcX = (s.side === 'left') ? s.x2 : s.x1;
    ctx.beginPath(); ctx.arc(srcX, s.y, 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  });
  requestAnimationFrame(draw);
}

canvas.addEventListener('mousemove', (e) => {
  mousePos.x = e.clientX;
  mousePos.y = e.clientY;
});

window.addEventListener('mousedown', () => {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (msg.innerText.includes("READY")) msg.innerText = "SENSORS ONLINE";
});

window.addEventListener('resize', init);
createUI();
init();
draw();
