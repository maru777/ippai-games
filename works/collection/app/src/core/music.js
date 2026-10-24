// ポータル用の BGM。曲（譜面）は 1 つで、世界ごとに音色（楽器の鳴らし方）だけを差し替える。
// 音声ファイルは使わず、WebAudio で鳴らす。世界を切り替えると、音色どうしの音量を入れ替えてなめらかにつなぐ。
// 使い方: Music.start('keitai') / Music.setWorld('puzzle') / Music.stop()。AudioContext は Sound が持つ（最初のタップ後）。
import { Sound } from './sound.js';

const BPM = 126;
const STEP = 60 / BPM / 2; // 8 分音符 1 つ分（秒）
const FADE = 0.6; // 世界の切り替えにかける秒数
const LOOKAHEAD = 0.18;

const mtof = (n) => 440 * 2 ** ((n - 69) / 12);

// 曲: 8 小節 × 8 ステップ（C - Am - F - G の進行）。0 は休符。
const ROOTS = [48, 45, 41, 43, 41, 43, 40, 45];
const MINOR = [false, true, false, false, false, false, true, true];
const MELODY = [
  [76, 0, 79, 0, 76, 74, 72, 0],
  [72, 0, 76, 0, 74, 72, 69, 0],
  [77, 0, 76, 0, 74, 72, 74, 0],
  [74, 0, 79, 0, 77, 76, 74, 0],
  [77, 0, 81, 0, 79, 77, 76, 0],
  [79, 0, 77, 0, 76, 74, 72, 0],
  [76, 0, 79, 0, 83, 0, 79, 0],
  [81, 0, 79, 0, 76, 0, 72, 0],
];
const ARP = [0, 4, 7, 12, 7, 4, 7, 4];
const ARP_MINOR = [0, 3, 7, 12, 7, 3, 7, 3];
const BASS = [0, 0, 7, 0]; // 偶数ステップ 0,2,4,6 で根音・根音・5 度・根音

let ctx = null;
let master = null;
let buses = null; // { keitai: GainNode, versus, puzzle }
let noiseBuf = null;
let timer = 0;
let nextT = 0;
let step = 0;
let world = 'keitai';
let running = false;
let muted = false;
const until = { keitai: 0, versus: 0, puzzle: 0 }; // 切り替え後も、この時刻まで前の音色を鳴らし続ける（フェードアウト用）

function env(g, t, a, d, peak) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}

function tone(out, type, freq, t, dur, vol, opt = {}) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (opt.slideTo) o.frequency.exponentialRampToValueAtTime(opt.slideTo, t + dur);
  const a = opt.attack || 0.004;
  env(g, t, a, dur, vol);
  let node = o;
  if (opt.lp) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(opt.lp, t);
    if (opt.lpTo) f.frequency.exponentialRampToValueAtTime(opt.lpTo, t + dur);
    o.connect(f);
    node = f;
  }
  node.connect(g).connect(out);
  o.start(t);
  o.stop(t + a + dur + 0.05);
}

function noise(out, t, dur, vol, hp = 0, lp = 0) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const g = ctx.createGain();
  env(g, t, 0.002, dur, vol);
  let node = src;
  if (hp) {
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = hp;
    node.connect(f);
    node = f;
  }
  if (lp) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = lp;
    node.connect(f);
    node = f;
  }
  node.connect(g).connect(out);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.05);
}

// 世界ごとの音色。各関数は「どの楽器をどう鳴らすか」だけを持つ。
const TIMBRE = {
  // 8bit: 矩形波・三角波・ノイズだけの、平らで硬い音
  keitai: {
    lead: (o, f, t, d) => tone(o, 'square', f, t, d, 0.05),
    arp: (o, f, t, d) => tone(o, 'square', f, t, Math.min(d, 0.1), 0.02),
    bass: (o, f, t, d) => tone(o, 'triangle', f, t, d, 0.13),
    kick: (o, t) => tone(o, 'triangle', 150, t, 0.12, 0.2, { slideTo: 40 }),
    snare: (o, t) => noise(o, t, 0.1, 0.07),
    hat: (o, t) => noise(o, t, 0.03, 0.025, 6000),
  },
  // やわらかい音: 正弦波中心、ゆっくり立ち上がるパッドと、短い余韻
  versus: {
    lead: (o, f, t, d) => {
      tone(o, 'sine', f, t, d * 1.6, 0.07, { attack: 0.01 });
      tone(o, 'triangle', f * 2, t, d, 0.012, { attack: 0.01 });
    },
    arp: (o, f, t, d) => tone(o, 'sine', f, t, d * 1.2, 0.025, { attack: 0.01 }),
    bass: (o, f, t, d) => tone(o, 'sine', f, t, d * 1.3, 0.16, { attack: 0.01 }),
    pad: (o, notes, t, d) => notes.forEach((n) => tone(o, 'sine', mtof(n), t, d, 0.025, { attack: 0.3 })),
    kick: (o, t) => tone(o, 'sine', 110, t, 0.18, 0.18, { slideTo: 45 }),
    snare: (o, t) => noise(o, t, 0.14, 0.035, 1200, 6000),
    hat: (o, t) => noise(o, t, 0.04, 0.012, 7000, 11000),
  },
  // ネオン: のこぎり波をフィルタで丸め、エコーを重ねる
  puzzle: {
    lead: (o, f, t, d) => tone(o, 'sawtooth', f, t, d * 1.3, 0.045, { lp: 3200, lpTo: 900, attack: 0.006 }),
    arp: (o, f, t, d) => tone(o, 'square', f, t, Math.min(d, 0.12), 0.02, { lp: 2400, lpTo: 700 }),
    bass: (o, f, t, d) => tone(o, 'sawtooth', f, t, d, 0.1, { lp: 520, lpTo: 180 }),
    kick: (o, t) => tone(o, 'sine', 170, t, 0.14, 0.24, { slideTo: 38 }),
    snare: (o, t) => noise(o, t, 0.16, 0.06, 1800, 9000),
    hat: (o, t) => noise(o, t, 0.035, 0.02, 8000),
  },
};

function playStep(i, t) {
  const bar = Math.floor(i / 8) % 8;
  const s = i % 8;
  const root = ROOTS[bar];
  const minor = MINOR[bar];
  for (const w of Object.keys(buses)) {
    if (w !== world && t > until[w]) continue;
    const out = buses[w];
    const T = TIMBRE[w];
    if (s === 0 && T.pad) T.pad(out, [root + 12, root + (minor ? 15 : 16), root + 19], t, STEP * 8);
    if (s % 2 === 0) T.bass(out, mtof(root + BASS[s / 2]), t, STEP * 1.8);
    T.arp(out, mtof(root + 24 + (minor ? ARP_MINOR : ARP)[s]), t, STEP * 0.9);
    const m = MELODY[bar][s];
    if (m) T.lead(out, mtof(m), t, STEP * 1.9);
    if (s === 0 || s === 4) T.kick(out, t);
    if (s === 2 || s === 6) T.snare(out, t);
    T.hat(out, t + (s % 2 ? STEP * 0.5 : 0));
  }
}

function tick() {
  if (!ctx) return;
  while (nextT < ctx.currentTime + LOOKAHEAD) {
    if (nextT < ctx.currentTime - 0.5) nextT = ctx.currentTime + 0.05; // 長く止まっていたら追いつかず仕切り直す
    playStep(step, nextT);
    nextT += STEP;
    step = (step + 1) % 64;
  }
}

function build() {
  ctx = Sound.ctx;
  master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const mk = (extra) => {
    const g = ctx.createGain();
    g.gain.value = 0;
    if (extra) extra(g);
    else g.connect(master);
    return g;
  };
  // ネオン世界だけ、フィードバック付きのエコーを通す
  const echo = (g) => {
    const dly = ctx.createDelay(1);
    dly.delayTime.value = STEP * 3;
    const fb = ctx.createGain();
    fb.gain.value = 0.32;
    const wet = ctx.createGain();
    wet.gain.value = 0.45;
    g.connect(master);
    g.connect(dly);
    dly.connect(fb).connect(dly);
    dly.connect(wet).connect(master);
  };
  buses = { keitai: mk(), versus: mk(), puzzle: mk(echo) };
}

export const Music = {
  get running() { return running; },
  get muted() { return muted; },
  setMuted(m) {
    muted = m;
    Sound.setMuted(m);
    if (master) master.gain.setTargetAtTime(m || !running ? 0 : 0.8, ctx.currentTime, 0.05);
  },
  // 鳴らし始める。AudioContext がまだなら（最初のタップの前）何もしない。
  start(w = world) {
    if (!Sound.ctx) return false;
    if (!ctx) build();
    if (ctx.state === 'suspended') ctx.resume();
    world = w;
    const now = ctx.currentTime;
    if (!running) {
      running = true;
      nextT = now + 0.08;
      step = 0;
      clearInterval(timer);
      timer = setInterval(tick, 50);
    }
    for (const k of Object.keys(buses)) buses[k].gain.setTargetAtTime(k === world ? 1 : 0, now, 0.05);
    master.gain.setTargetAtTime(muted ? 0 : 0.8, now, 0.3);
    return true;
  },
  // 世界を切り替える。前の音色は FADE 秒かけて小さくし、同じ曲のまま新しい音色へつなぐ。
  setWorld(w) {
    if (w === world) return;
    const prev = world;
    world = w;
    if (!running) return;
    const now = ctx.currentTime;
    until[prev] = now + FADE * 3;
    buses[prev].gain.setTargetAtTime(0, now, FADE / 3);
    buses[w].gain.setTargetAtTime(1, now, FADE / 3);
  },
  stop() {
    if (!running) return;
    running = false;
    const now = ctx.currentTime;
    master.gain.setTargetAtTime(0, now, 0.15);
    const t = timer;
    setTimeout(() => {
      if (!running && t === timer) clearInterval(timer);
    }, 900);
  },
  // タブが裏に回ったら止めて、戻ったら再開する
  suspend() { if (ctx && running) ctx.suspend(); },
  resume() { if (ctx && running) ctx.resume(); },
};
