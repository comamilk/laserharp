const canvas = document.getElementById('harp');
const ctx = canvas.getContext('2d');
const msg = document.getElementById('msg');
const ui = document.getElementById('ui');
const uiContainer = document.getElementById('ui-container');
const uiToggle = document.getElementById('ui-toggle');

// メッセージを更新
msg.innerText = "Laser Harp Simulator";

let audioCtx;
let width, height;
let strings = [];
let mousePos = { x: -999, y: -999 };
let isStarted = false;

// BGM設定
let bgmBuffer = null;
let bgmSource = null;
let bgmStartTime = 0;
let bgmPausedAt = 0;
let isBgmPlaying = false;

// シンセ音色の設定
let synthConfig = {
  type: 'triangle',
  attack: 0.05,
  release: 0.2,
  volume: 0.3
};

// レイアウト設定
const unitW = 240;      
const gap = 110;        
const pillarW = 22;     
const laserSpacing = 95; 
const synthNotes = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00];

uiToggle.addEventListener('click', () => {
  uiContainer.classList.toggle('folded');
});

// --- UI生成ロジック ---
function createUI() {
  ui.innerHTML = "";

  const bgmSection = document.createElement('div');
  bgmSection.style.borderBottom = "1px solid #0f0";
  bgmSection.style.paddingBottom = "10px";
  bgmSection.style.marginBottom = "10px";
  bgmSection.innerHTML = `
    <div style="color:#0f0; margin-bottom:5px; font-size:10px; opacity:0.7;">BGM / SYSTEM</div>
    <div class="row"><input type="file" accept="audio/*" id="bgm-file"></div>
    <div class="row" style="margin-top:5px; gap:5px;">
      <button id="bgm-play" style="flex:1; background:#020; color:#0f0; border:1px solid #0f0; font-size:11px; padding:8px; cursor:pointer;">PLAY</button>
      <button id="bgm-pause" style="flex:1; background:#220; color:#ff0; border:1px solid #ff0; font-size:11px; padding:8px; cursor:pointer;">PAUSE</button>
      <button id="stop-all" style="flex:1; background:#200; color:#f00; border:1px solid #f00; font-size:11px; padding:8px; cursor:pointer;">STOP</button>
    </div>
  `;
  ui.appendChild(bgmSection);

  const tabWrapper = document.createElement('div');
  tabWrapper.style.display = "flex";
  tabWrapper.style.marginBottom = "10px";
  tabWrapper.innerHTML = `
    <button id="tab-sampler" style="flex:1; background:#0f0; color:#000; border:none; padding:8px; font-size:12px; cursor:pointer; font-weight:bold;">SAMPLER</button>
    <button id="tab-synth" style="flex:1; background:#000; color:#0f0; border:1px solid #0f0; padding:8px; font-size:12px; cursor:pointer;">SYNTH</button>
  `;
  ui.appendChild(tabWrapper);

  const contentArea = document.createElement('div');
  ui.appendChild(contentArea);

  function showSampler() {
    document.getElementById('tab-sampler').style.background = "#0f0";
    document.getElementById('tab-sampler').style.color = "#000";
    document.getElementById('tab-synth').style.background = "#000";
    document.getElementById('tab-synth').style.color = "#0f0";
    
    contentArea.innerHTML = `
      <div style="color:#0f0; font-size:10px; margin-bottom:10px; padding:0 5px; opacity:0.8; line-height:1.4;">
        ※各ボタンで複数ファイルを選択すると、<br>弾くたびに音が順番に切り替わります。
      </div>
    `;

    for (let i = 0; i < 6; i++) {
      const row = document.createElement('div');
      row.className = 'row';
      const label = i < 3 ? `L-${i + 1}` : `R-${i - 2}`;
      row.innerHTML = `
        <span style="width:25px; color:#0f0; font-size:12px;">${label}</span>
        <input type="file" accept="audio/*" id="file-${i}" multiple>
        <select id="mode-${i}" style="background:#000; color:#0f0; border:1px solid #0f0; font-size:10px;">
          <option value="oneshot">one shot</option>
          <option value="hold">hold</option>
        </select>
      `;
      contentArea.appendChild(row);
      document.getElementById(`file-${i}`).addEventListener('change', (e) => loadSamples(e, i));
    }
  }

  function showSynth() {
    document.getElementById('tab-synth').style.background = "#0f0";
    document.getElementById('tab-synth').style.color = "#000";
    document.getElementById('tab-sampler').style.background = "#000";
    document.getElementById('tab-sampler').style.color = "#0f0";
    contentArea.innerHTML = `
      <div style="padding:5px;">
        <div class="row"><span style="flex:1; font-size:12px; color:#0f0;">WAVE</span>
          <select id="synth-type" style="flex:2; background:#000; color:#0f0; border:1px solid #0f0;">
            <option value="triangle" ${synthConfig.type === 'triangle' ? 'selected' : ''}>TRIANGLE</option>
            <option value="square" ${synthConfig.type === 'square' ? 'selected' : ''}>SQUARE</option>
            <option value="sawtooth" ${synthConfig.type === 'sawtooth' ? 'selected' : ''}>SAWTOOTH</option>
            <option value="sine" ${synthConfig.type === 'sine' ? 'selected' : ''}>SINE</option>
          </select>
        </div>
        <div class="row" style="margin-top:10px;"><span style="flex:1; font-size:12px; color:#0f0;">VOL</span>
          <input type="range" id="synth-vol" min="0" max="1" step="0.01" value="${synthConfig.volume}" style="flex:2"></div>
        <div class="row" style="margin-top:10px;"><span style="flex:1; font-size:12px; color:#0f0;">ATK</span>
          <input type="range" id="synth-atk" min="0.01" max="0.5" step="0.01" value="${synthConfig.attack}" style="flex:2"></div>
        <div class="row" style="margin-top:10px;"><span style="flex:1; font-size:12px; color:#0f0;">REL</span>
          <input type="range" id="synth-rel" min="0.05" max="1.0" step="0.01" value="${synthConfig.release}" style="flex:2"></div>
      </div>
    `;
    document.getElementById('synth-type').addEventListener('change', (e) => synthConfig.type = e.target.value);
    document.getElementById('synth-vol').addEventListener('input', (e) => synthConfig.volume = parseFloat(e.target.value));
    document.getElementById('synth-atk').addEventListener('input', (e) => synthConfig.attack = parseFloat(e.target.value));
    document.getElementById('synth-rel').addEventListener('input', (e) => synthConfig.release = parseFloat(e.target.value));
  }

  showSampler();
  document.getElementById('tab-sampler').addEventListener('click', showSampler);
  document.getElementById('tab-synth').addEventListener('click', showSynth);
  document.getElementById('bgm-file').addEventListener('change', loadBGM);
  document.getElementById('bgm-play').addEventListener('click', playBGM);
  document.getElementById('bgm-pause').addEventListener('click', pauseBGM);
  document.getElementById('stop-all').addEventListener('click', stopAllAudio);
}

// --- オーディオ処理 ---
function initAudioContext() { 
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  if(!isStarted) {
    isStarted = true;
    msg.style.opacity = 0;
    setTimeout(() => msg.style.display = 'none', 500);
  }
}

async function loadBGM(e) {
  initAudioContext();
  const file = e.target.files[0];
  if (!file) return;
  const ab = await file.arrayBuffer();
  bgmBuffer = await audioCtx.decodeAudioData(ab);
  bgmPausedAt = 0;
}

function playBGM() {
  if (!bgmBuffer || isBgmPlaying) return;
  initAudioContext();
  bgmSource = audioCtx.createBufferSource();
  bgmSource.buffer = bgmBuffer;
  bgmSource.loop = true;
  bgmSource.connect(audioCtx.destination);
  bgmSource.start(0, bgmPausedAt);
  bgmStartTime = audioCtx.currentTime - bgmPausedAt;
  isBgmPlaying = true;
}

function pauseBGM() {
  if (!isBgmPlaying || !bgmSource) return;
  bgmPausedAt = audioCtx.currentTime - bgmStartTime;
  bgmSource.stop();
  isBgmPlaying = false;
}

async function loadSamples(e, index) {
  initAudioContext();
  const files = Array.from(e.target.files);
  strings[index].buffers = [];
  for (const file of files) {
    const ab = await file.arrayBuffer();
    const ad = await audioCtx.decodeAudioData(ab);
    strings[index].buffers.push(ad);
  }
}

function stopAllAudio() {
  if (bgmSource) { bgmSource.stop(); bgmSource = null; }
  bgmPausedAt = 0; isBgmPlaying = false;
  strings.forEach(s => { if (s.source) try { s.source.stop(); } catch(e){} });
}

function playSound(index) {
  if(!isStarted) return;
  initAudioContext();
  const s = strings[index];
  if (s.source) {
    const oG = s.gainNode; const oS = s.source;
    if (oG) { oG.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05); 
    setTimeout(() => { try { oS.stop(); } catch(e){} }, 60); }
  }
  const g = audioCtx.createGain();
  let src;
  if (s.buffers.length > 0) {
    src = audioCtx.createBufferSource(); src.buffer = s.buffers[s.currentIndex];
    s.currentIndex = (s.currentIndex + 1) % s.buffers.length;
    s.isSynth = false; g.gain.setValueAtTime(0.8, audioCtx.currentTime);
  } else {
    src = audioCtx.createOscillator(); src.type = synthConfig.type;
    src.frequency.setValueAtTime(synthNotes[index], audioCtx.currentTime);
    g.gain.setValueAtTime(0, audioCtx.currentTime);
    g.gain.linearRampToValueAtTime(synthConfig.volume, audioCtx.currentTime + synthConfig.attack);
    s.isSynth = true;
  }
  src.connect(g).connect(audioCtx.destination); src.start();
  s.source = src; s.gainNode = g;
}

function stopSound(index) {
  const s = strings[index];
  const mEl = document.getElementById(`mode-${index}`);
  const m = mEl ? mEl.value : 'oneshot';
  if (!s.source || !s.gainNode) return;
  if (m === 'hold' || s.isSynth) {
    const rel = s.isSynth ? synthConfig.release : 0.1;
    s.gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + rel);
    const t = s.source; setTimeout(() => { try { t.stop(); } catch(e){} }, rel * 1000 + 10);
  }
}

// --- メインロジック ---
function init() {
  width = canvas.width = window.innerWidth;
  height = canvas.height = window.innerHeight;
  strings = [];
  const cx = width / 2, cy = height / 2;
  const lx = cx - (gap / 2) - unitW, rx = cx + (gap / 2);
  for (let i = 0; i < 6; i++) {
    const isR = i >= 3, lIdx = i % 3, y = cy - laserSpacing + (lIdx * laserSpacing);
    strings.push({
      x1: isR ? rx : lx, x2: isR ? rx + unitW : lx + unitW,
      y: y, side: isR ? 'right' : 'left', active: false, buffers: [], currentIndex: 0,
      source: null, gainNode: null, isSynth: false
    });
  }
}

function draw() {
  ctx.fillStyle = '#050a1a';
  ctx.fillRect(0, 0, width, height);
  if (strings.length === 0) return;

  const tY = strings[0].y - 35; 
  const bY = strings[2].y + 50; 
  const pH = bY - tY;
  const pPos = [strings[0].x1, strings[0].x2, strings[3].x1, strings[3].x2];
  
  pPos.forEach((x, i) => {
    ctx.save();
    const dX = (i % 2 === 0) ? x - pillarW : x;
    const grad = ctx.createLinearGradient(dX, tY, dX + pillarW, tY);
    grad.addColorStop(0, '#111'); grad.addColorStop(0.5, '#333'); grad.addColorStop(1, '#111');
    ctx.fillStyle = grad; ctx.fillRect(dX, tY, pillarW, pH);
    ctx.strokeStyle = '#444'; ctx.strokeRect(dX, tY, pillarW, pH);
    ctx.restore();
  });

  strings.forEach((s, i) => {
    const isHit = Math.abs(mousePos.y - s.y) < 25 && mousePos.x >= s.x1 && mousePos.x <= s.x2;
    if (isHit) { if (!s.active) { s.active = true; playSound(i); } }
    else { if (s.active) { s.active = false; stopSound(i); } }
    
    let lS = s.x1, lE = s.x2;
    if (isHit) { if (s.side === 'left') lS = mousePos.x; else lE = mousePos.x; }
    
    ctx.save();
    ctx.shadowBlur = 10; ctx.shadowColor = '#0f0'; ctx.lineWidth = 2; ctx.strokeStyle = '#0f0';
    ctx.beginPath(); ctx.moveTo(lS, s.y); ctx.lineTo(lE, s.y); ctx.stroke();
    
    ctx.shadowBlur = 5; ctx.fillStyle = '#0f0';
    const launchX = (s.side === 'left') ? s.x2 : s.x1;
    ctx.beginPath(); ctx.arc(launchX, s.y, 1.5, 0, Math.PI * 2); ctx.fill();

    if (isHit) {
      ctx.beginPath(); ctx.shadowBlur = 20; ctx.shadowColor = '#fff'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
      if (s.side === 'left') { ctx.moveTo(lS, s.y); ctx.lineTo(lS + 5, s.y); }
      else { ctx.moveTo(lE - 5, s.y); ctx.lineTo(lE, s.y); }
      ctx.stroke();
      
      ctx.fillStyle = '#fff'; ctx.shadowBlur = 15; ctx.shadowColor = '#0f0';
      ctx.beginPath(); ctx.arc(mousePos.x, s.y, 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  });
  requestAnimationFrame(draw);
}

function updatePos(e) {
  let x, y;
  if (e.touches && e.touches.length > 0) {
    x = e.touches[0].clientX;
    y = e.touches[0].clientY;
    e.preventDefault();
  } else {
    x = e.clientX;
    y = e.clientY;
  }
  mousePos.x = x;
  mousePos.y = y;
}

function clearPos() {
  mousePos.x = -999;
  mousePos.y = -999;
}

canvas.addEventListener('mousedown', initAudioContext);
canvas.addEventListener('mousemove', updatePos);
canvas.addEventListener('touchstart', (e) => { initAudioContext(); updatePos(e); }, {passive: false});
canvas.addEventListener('touchmove', updatePos, {passive: false});
canvas.addEventListener('touchend', clearPos);
canvas.addEventListener('mouseleave', clearPos);

window.addEventListener('resize', init);
createUI(); init(); draw();
