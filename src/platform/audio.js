// platform/audio.js — M7 音频：双容器 WebAudio 适配（H5 AudioContext / wx.createWebAudioContext）
// 降级策略：工厂未注入或初始化失败 → 全部 no-op（同立绘回退模式，零风险）
// 文件通道：AUDIO_FILES.bgm 置路径常量即优先加载文件，失败回退合成（同广告桩零代码切换）

// 文件预留通道：上线前把 bgm 置为容器可及路径（如 'assets/audio/bgm.m4a'）
export const AUDIO_FILES = { bgm: null };

let ac = null;          // AudioContext 实例
let soundOn = true;     // 音效开关
let bgmOn = true;       // BGM 开关
let bgmTimer = null;    // BGM 续期定时器
const MASTER = 0.3;

export function initAudio(createCtx) {
  try { ac = createCtx ? createCtx() : null; } catch { ac = null; }
}

export function setSoundMode(save) {
  soundOn = !!save.settings?.sound;
  bgmOn = !!save.settings?.bgm;
  if (!bgmOn) bgmStop();
}

// 三态循环：全开 → 仅音效 → 全关 → 全开
export function soundModeCycle(cur) {
  if (cur.sound && cur.bgm) return { sound: true, bgm: false };
  if (cur.sound && !cur.bgm) return { sound: false, bgm: false };
  return { sound: true, bgm: true };
}

// 基础音符：freq 起始频率，dur 秒，type 波形，vol 音量，when 相对当前秒
function tone(freq, dur, type, vol, when = 0, slideTo = null) {
  if (!ac) return;
  try {
    const t0 = ac.currentTime + when;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(vol * MASTER, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g); g.connect(ac.destination);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  } catch { /* 音频设备异常静默 */ }
}

const SFX = {
  click:   () => tone(880, 0.06, 'square', 0.5, 0, 660),
  attack:  () => tone(220, 0.09, 'triangle', 0.7, 0, 110),
  ult:     () => { tone(80, 0.5, 'sine', 1.0, 0, 40); tone(160, 0.3, 'square', 0.4, 0.05, 60); },
  skill:   () => { tone(1046, 0.12, 'sine', 0.6); tone(1318, 0.12, 'sine', 0.6, 0.08); tone(1568, 0.2, 'sine', 0.6, 0.16); },
  coin:    () => { tone(1318, 0.08, 'sine', 0.6); tone(1975, 0.14, 'sine', 0.6, 0.06); },
  compose: () => { tone(523, 0.07, 'triangle', 0.8); tone(523, 0.07, 'triangle', 0.8, 0.1); },
  win:     () => [523, 587, 659, 784, 1046].forEach((f, i) => tone(f, 0.18, 'sine', 0.6, i * 0.1)), // 五声上行
  lose:    () => { tone(330, 0.3, 'sine', 0.7, 0, 220); tone(220, 0.4, 'sine', 0.7, 0.25, 147); },
};

export function sfx(name) {
  if (!ac || !soundOn || !SFX[name]) return;
  SFX[name]();
}

// ===== BGM：五声音阶宫调式 16 小节循环（古琴拟音：基频+2次泛音指数衰减，tempo 72）
const GONG_SCALE = [261.6, 293.7, 329.6, 392.0, 440.0]; // 宫商角徵羽（C 五声）
const BGM_PATTERN = [0, 1, 2, 1, 4, 3, 2, 0, 1, 2, 3, 4, 3, 2, 1, 0]; // 16 音序列
const BGM_BEAT = 60 / 72 / 2; // 八分音符秒数

function pluck(freq, when) {
  if (!ac) return;
  try {
    const t0 = ac.currentTime + when;
    [1, 2, 3].forEach((h, i) => {
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq * h, t0);
      const v = 0.35 / (i + 1);
      g.gain.setValueAtTime(v * MASTER, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.9);
      osc.connect(g); g.connect(ac.destination);
      osc.start(t0); osc.stop(t0 + 1);
    });
  } catch { /* 静默 */ }
}

export function bgmStart() {
  if (!ac || !bgmOn || bgmTimer) return;
  if (AUDIO_FILES.bgm) return; // 文件通道优先时走容器层播放（后续接），合成不启动
  let step = 0;
  const tick = () => {
    if (!bgmOn) return;
    const when = 0;
    pluck(GONG_SCALE[BGM_PATTERN[step % 16]], when);
    if (step % 4 === 0) pluck(GONG_SCALE[0] / 2, when + 0.02); // 低音宫锚定
    step++;
    bgmTimer = setTimeout(tick, BGM_BEAT * 1000);
  };
  tick();
}

export function bgmStop() {
  if (bgmTimer) { clearTimeout(bgmTimer); bgmTimer = null; }
}
