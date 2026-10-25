// BGM。曲（譜面データ SONGS）と音色（楽器の鳴らし方 TIMBRE）を、チャンネルで組み合わせる。
//   ポータル: 世界ごとのチャンネル（keitai / versus / puzzle）。ケータイと対戦は同じ曲を別の音色で鳴らす。
//   ゲーム中: game-<スキン名>（ルーンタワー）。ゲームが bgm を返すと、シェルが切り替える。
//             これだけは譜面ではなくアンビエント（music-ambient.js の和音の進行 + 旋律を、スキンごとの音色で鳴らす）。
// 音声ファイルは使わず、WebAudio で鳴らす。同じ bpm のチャンネルへは音量を入れ替えてなめらかにつなぐ。
// 使い方: Music.start('keitai') / Music.setChannel('puzzle') / Music.stop()。AudioContext は Sound が持つ（最初のタップ後）。
import { Sound } from './sound.js';
import { AMBIENT } from './music-ambient.js';

const FADE = 0.6; // 世界の切り替えにかける秒数
const LOOKAHEAD = 0.18;

const mtof = (n) => 440 * 2 ** ((n - 69) / 12);

// 和音の構成音（根音からの半音）。アルペジオは 4 音を ARP の順に回る。
const CHORD = { M: [0, 4, 7, 12], m: [0, 3, 7, 12], M7: [0, 4, 7, 11], m7: [0, 3, 7, 10], s: [0, 5, 7, 12] };
const ARP = [0, 1, 2, 3, 2, 1, 2, 1];

// 曲: 8 小節 × 8 ステップ（8 分音符）。melody の 0 は休符、bass の null は休み。
// ポータルの曲どうし（同じ bpm）は、音色を切り替えるときに音量を入れ替えてつなぐ。bpm が違う曲へは、いったん止めて頭から始める。
const SONGS = {
  // ケータイ・対戦の世界: のんびり明るい曲
  pop: {
    bpm: 126, arpOct: 24,
    roots: [48, 45, 41, 43, 41, 43, 40, 45],
    modes: ['M', 'm', 'M', 'M', 'M', 'M', 'm', 'm'],
    melody: [
      [76, 0, 79, 0, 76, 74, 72, 0], [72, 0, 76, 0, 74, 72, 69, 0], [77, 0, 76, 0, 74, 72, 74, 0], [74, 0, 79, 0, 77, 76, 74, 0],
      [77, 0, 81, 0, 79, 77, 76, 0], [79, 0, 77, 0, 76, 74, 72, 0], [76, 0, 79, 0, 83, 0, 79, 0], [81, 0, 79, 0, 76, 0, 72, 0],
    ],
    bass: [0, null, 0, null, 7, null, 0, null],
    drums: { kick: [0, 4], snare: [2, 6], hat: true },
  },
  // パズル＆戦略の世界（ポータル）: イ短調の、静かに張りつめた曲
  dusk: {
    bpm: 126, arpOct: 24,
    roots: [45, 41, 43, 40, 45, 41, 38, 40],
    modes: ['m', 'M', 'M', 'm', 'm', 'M', 'm', 'M'],
    melody: [
      [69, 0, 0, 0, 72, 0, 76, 0], [77, 0, 0, 76, 0, 72, 0, 0], [74, 0, 0, 0, 79, 0, 77, 0], [76, 0, 0, 0, 71, 0, 0, 0],
      [69, 0, 72, 0, 76, 0, 81, 0], [77, 0, 81, 0, 77, 0, 76, 0], [74, 0, 77, 0, 81, 0, 77, 0], [76, 0, 80, 0, 83, 0, 80, 0],
    ],
    bass: [0, 0, null, 0, 0, null, 7, null],
    drums: { kick: [0, 4], snare: [6], hat: true },
  },
};

// チャンネル = 曲 + 音色 + 音量。ポータルは世界ごと、ゲーム中は game-<スキン名>（ambient = アンビエントの種類）。
const CHANNELS = {
  keitai: { song: 'pop', timbre: 'keitai', vol: 1 },
  versus: { song: 'pop', timbre: 'versus', vol: 1 },
  puzzle: { song: 'dusk', timbre: 'puzzle', vol: 1 },
  'game-neon': { ambient: 'neon', vol: 0.7 },
  'game-rainbow': { ambient: 'rainbow', vol: 0.7 },
  'game-modern': { ambient: 'modern', vol: 0.7 },
  'game-wa': { ambient: 'wa', vol: 0.7 },
};
const ECHO = new Set(['puzzle']);
const isAmb = (ch) => !!CHANNELS[ch].ambient;
const stepOf = (ch) => (isAmb(ch) ? 0 : 60 / SONGS[CHANNELS[ch].song].bpm / 2);

let ctx = null;
let master = null;
let buses = null; // チャンネル名 → GainNode
let noiseBuf = null;
let ambReverb = null;
let amb = null; // 鳴っているアンビエント { id, bus, noiseSrc, breath, next, idx }
let timer = 0;
let nextT = 0;
let step = 0;
let stepDur = 0.2;
let channel = 'keitai';
let running = false;
let muted = false;
const until = {}; // 切り替え後も、この時刻まで前のチャンネルを鳴らし続ける（フェードアウト用）

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

// 音色。各関数は「どの楽器をどう鳴らすか」だけを持つ（曲の中身は SONGS）。
const NONE = () => {};
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
    // わずかにずらした 2 本ののこぎり波（コーラス）を、フィルタで丸める
    lead: (o, f, t, d) => {
      tone(o, 'sawtooth', f * 0.997, t, d * 1.5, 0.028, { lp: 2200, lpTo: 700, attack: 0.012 });
      tone(o, 'sawtooth', f * 1.003, t, d * 1.5, 0.028, { lp: 2200, lpTo: 700, attack: 0.012 });
    },
    arp: (o, f, t, d) => tone(o, 'triangle', f, t, Math.min(d * 1.3, 0.2), 0.03, { lp: 2600, lpTo: 600, attack: 0.006 }),
    bass: (o, f, t, d) => tone(o, 'sawtooth', f, t, d * 1.2, 0.09, { lp: 420, lpTo: 150, attack: 0.008 }),
    kick: (o, t) => tone(o, 'sine', 150, t, 0.16, 0.22, { slideTo: 42 }),
    snare: (o, t) => noise(o, t, 0.2, 0.05, 1500, 7000),
    hat: (o, t) => noise(o, t, 0.03, 0.014, 8000, 12000),
  },
};

function playStep(i, t) {
  const bar = Math.floor(i / 8) % 8;
  const s = i % 8;
  for (const ch of Object.keys(buses)) {
    if (ch !== channel && !(t <= (until[ch] || 0))) continue;
    const { song: sid, timbre } = CHANNELS[ch];
    const song = SONGS[sid];
    const out = buses[ch];
    const T = TIMBRE[timbre];
    const root = song.roots[bar];
    const chord = CHORD[song.modes[bar]];
    if (s === 0 && T.pad) T.pad(out, [root + 12 + chord[0], root + 12 + chord[1], root + 12 + chord[2]], t, stepDur * 8);
    const bo = song.bass[s];
    if (bo != null) T.bass(out, mtof(root + bo), t, stepDur * 1.8);
    T.arp(out, mtof(root + song.arpOct + chord[ARP[s]]), t, stepDur * 0.9);
    const m = song.melody[bar][s];
    if (m) T.lead(out, mtof(m), t, stepDur * 1.9);
    const dr = song.drums;
    if (dr.kick.includes(s)) T.kick(out, t);
    if (dr.snare.includes(s)) T.snare(out, t);
    if (dr.hat) T.hat(out, t + (s % 2 ? stepDur * 0.5 : 0));
  }
}

// ---- アンビエント（game-<スキン名>）。和音を 1 つずつ重ねて鳴らし、その上に旋律を置く ----
function ambEnv(g, t, vol, att, hold, rel) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + att);
  g.gain.setValueAtTime(vol, t + hold);
  g.gain.linearRampToValueAtTime(0.0001, t + hold + rel);
}

function ambPad(sp, t, c) {
  const p = sp.pad;
  const len = sp.dur + p.rel;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = p.lp;
  lp.Q.value = 0.4;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.05 + Math.random() * 0.05;
  const lg = ctx.createGain();
  lg.gain.value = p.lpMove;
  lfo.connect(lg);
  lg.connect(lp.frequency);
  lfo.start(t);
  lfo.stop(t + len + 0.2);
  lp.connect(amb.bus);
  c.up.forEach((m, k) => {
    const f0 = mtof(m);
    (p.octave && k % 2 === 0 ? [f0, f0 * 2] : [f0]).forEach((f, j) => {
      p.types.forEach((type, q) => {
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.value = f;
        o.detune.value = (q ? 1 : -1) * p.detune * (0.6 + Math.random() * 0.6);
        const g = ctx.createGain();
        ambEnv(g, t, p.gain * (j ? 0.45 : 1), p.att, sp.dur, p.rel);
        o.connect(g);
        g.connect(lp);
        o.start(t);
        o.stop(t + len + 0.1);
      });
    });
  });
  // 低音: 和音の根音をゆっくり
  const bo = ctx.createOscillator();
  bo.type = 'sine';
  bo.frequency.value = mtof(c.bass);
  const bg = ctx.createGain();
  ambEnv(bg, t, 0.1, 0.8, sp.dur - 0.5, 1.2);
  bo.connect(bg);
  bg.connect(amb.bus);
  bo.start(t);
  bo.stop(t + sp.dur + 1.5);
  if (amb.breath) amb.breath.frequency.setTargetAtTime(mtof(c.up[2] + 12), t, 1.5);
}

// 旋律の 1 音（スキンごとの音色）
function ambNote(sp, t, m) {
  const f = mtof(m);
  const k = sp.mel;
  const out = amb.bus;
  const hit = (type, freq, vol, dec, at = 0.01) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol * k, t + at);
    g.gain.exponentialRampToValueAtTime(0.0001, t + at + dec);
    o.connect(g);
    g.connect(out);
    o.start(t);
    o.stop(t + at + dec + 0.1);
  };
  if (sp.voice === 'glass') {
    hit('sine', f, 0.06, 3.2, 0.03);
    hit('sine', f * 2.01, 0.018, 2, 0.03);
  } else if (sp.voice === 'bell') {
    hit('sine', f, 0.055, 3.6, 0.005);
    hit('sine', f * 2.76, 0.02, 1.8, 0.005);
    hit('sine', f * 5.4, 0.008, 0.9, 0.005);
  } else if (sp.voice === 'epiano') {
    hit('sine', f, 0.07, 2.8, 0.01);
    hit('sine', f * 2, 0.024, 1.4, 0.01);
    hit('triangle', f * 3, 0.008, 0.5, 0.005);
  } else {
    // 琴: 撥弦の短い雑音 + 減衰する音
    hit('triangle', f, 0.075, 1.8, 0.004);
    hit('sine', f * 2, 0.02, 1, 0.004);
    noise(out, t, 0.05, 0.06 * k, f * 1.5, f * 3);
  }
}

function ambStart(ch) {
  if (amb) ambStop(true);
  const sp = AMBIENT[CHANNELS[ch].ambient];
  const now = ctx.currentTime;
  const bus = ctx.createGain();
  bus.gain.value = 0;
  bus.gain.setTargetAtTime(CHANNELS[ch].vol, now, 0.8);
  bus.connect(master);
  const send = ctx.createGain();
  send.gain.value = 1;
  bus.connect(send);
  send.connect(ambReverb);
  // 息のようなノイズ（絶えず薄く鳴る）。和は和音に合わせて息の高さを変える
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const nf = ctx.createBiquadFilter();
  nf.type = 'bandpass';
  nf.frequency.value = sp.noise.f;
  nf.Q.value = sp.noise.q;
  const ng = ctx.createGain();
  ng.gain.value = sp.noise.g;
  src.connect(nf);
  nf.connect(ng);
  ng.connect(bus);
  src.start(now);
  amb = { id: ch, sp, bus, send, noiseSrc: src, breath: sp.noise.breath ? nf : null, next: now + 0.1, idx: 0 };
}

function ambStop(quick) {
  if (!amb) return;
  const a = amb;
  amb = null;
  const now = ctx.currentTime;
  a.bus.gain.cancelScheduledValues(now);
  a.bus.gain.setTargetAtTime(0, now, quick ? 0.2 : 0.6);
  setTimeout(() => {
    try { a.noiseSrc.stop(ctx.currentTime); } catch (e) { /* すでに止まっている */ }
    a.bus.disconnect();
    a.send.disconnect();
  }, 3000);
}

function ambTick() {
  if (!amb) return;
  const { sp } = amb;
  if (amb.next < ctx.currentTime - 0.5) amb.next = ctx.currentTime + 0.05; // 長く止まっていたら仕切り直す
  while (amb.next < ctx.currentTime + 1.5) {
    const c = sp.chords[amb.idx % sp.chords.length];
    ambPad(sp, amb.next, c);
    c.mel.forEach((m, i) => { if (m) ambNote(sp, amb.next + (i * sp.dur) / 4, m); });
    amb.next += sp.dur;
    amb.idx++;
  }
}

function tick() {
  if (!ctx) return;
  if (isAmb(channel)) {
    ambTick();
    return;
  }
  while (nextT < ctx.currentTime + LOOKAHEAD) {
    if (nextT < ctx.currentTime - 0.5) nextT = ctx.currentTime + 0.05; // 長く止まっていたら追いつかず仕切り直す
    playStep(step, nextT);
    nextT += stepDur;
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
  // 残響: 減衰するノイズをインパルス応答にした畳み込み
  const reverb = ctx.createConvolver();
  const len = Math.floor(ctx.sampleRate * 1.8);
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const ch = ir.getChannelData(c);
    for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2.5;
  }
  reverb.buffer = ir;
  const rv = ctx.createGain();
  rv.gain.value = 0.9;
  reverb.connect(rv).connect(master);
  // アンビエント用: 4.5 秒の長い残響
  ambReverb = ctx.createConvolver();
  const alen = Math.floor(ctx.sampleRate * 4.5);
  const air = ctx.createBuffer(2, alen, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const ch = air.getChannelData(c);
    for (let i = 0; i < alen; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / alen) ** 2.6;
  }
  ambReverb.buffer = air;
  const awet = ctx.createGain();
  awet.gain.value = 0.5;
  ambReverb.connect(awet).connect(master);
  buses = {};
  for (const ch of Object.keys(CHANNELS)) {
    const g = ctx.createGain();
    g.gain.value = 0;
    g.connect(master);
    // ネオン・虹のチャンネルだけ、フィードバック付きのエコーを通す
    if (ECHO.has(ch)) {
      const dly = ctx.createDelay(1);
      dly.delayTime.value = stepOf(ch) * 3;
      const fb = ctx.createGain();
      fb.gain.value = 0.3;
      const wet = ctx.createGain();
      wet.gain.value = 0.4;
      g.connect(dly);
      dly.connect(fb).connect(dly);
      dly.connect(wet).connect(master);
    }
    // ケータイ以外には、やわらかい残響を足す（8bit らしさを薄める）。アンビエントは専用の長い残響を使う
    if (ch !== 'keitai' && !isAmb(ch)) {
      const send = ctx.createGain();
      send.gain.value = 0.28;
      g.connect(send);
      send.connect(reverb);
    }
    buses[ch] = g;
  }
}

export const Music = {
  get running() { return running; },
  get muted() { return muted; },
  get channel() { return channel; },
  setMuted(m) {
    muted = m;
    Sound.setMuted(m);
    if (master) master.gain.setTargetAtTime(m || !running ? 0 : 0.8, ctx.currentTime, 0.05);
  },
  // 鳴らし始める（すでに鳴っているときは、チャンネルを切り替える）。AudioContext がまだなら（最初のタップの前）何もしない。
  start(ch = channel) {
    if (!Sound.ctx) return false;
    if (!ctx) build();
    if (ctx.state === 'suspended') ctx.resume();
    if (running) {
      this.setChannel(ch);
      return true;
    }
    channel = ch;
    const now = ctx.currentTime;
    running = true;
    if (isAmb(ch)) ambStart(ch);
    else stepDur = stepOf(ch);
    nextT = now + 0.08;
    step = 0;
    clearInterval(timer);
    timer = setInterval(tick, 50);
    for (const k of Object.keys(buses)) buses[k].gain.setTargetAtTime(k === ch && !isAmb(ch) ? CHANNELS[k].vol : 0, now, 0.05);
    master.gain.setTargetAtTime(muted ? 0 : 0.8, now, 0.3);
    return true;
  },
  // チャンネルを切り替える。同じ bpm なら同じ曲位置のまま音量を入れ替えてつなぎ、違えば前を素早く消して頭から始める。
  setChannel(ch) {
    if (ch === channel) return;
    const prev = channel;
    channel = ch;
    if (!running) return;
    const now = ctx.currentTime;
    if (isAmb(prev)) ambStop();
    if (isAmb(ch)) {
      if (!isAmb(prev)) {
        until[prev] = 0;
        buses[prev].gain.setTargetAtTime(0, now, 0.2);
      }
      ambStart(ch);
      return;
    }
    if (isAmb(prev)) {
      // アンビエントから譜面の曲へ: 頭から始める
      stepDur = stepOf(ch);
      nextT = now + 0.3;
      step = 0;
      buses[ch].gain.setTargetAtTime(CHANNELS[ch].vol, now + 0.25, 0.1);
      return;
    }
    if (stepOf(prev) === stepOf(ch)) {
      until[prev] = now + FADE * 3;
      buses[prev].gain.setTargetAtTime(0, now, FADE / 3);
      buses[ch].gain.setTargetAtTime(CHANNELS[ch].vol, now, FADE / 3);
    } else {
      until[prev] = 0;
      buses[prev].gain.setTargetAtTime(0, now, 0.08);
      stepDur = stepOf(ch);
      nextT = now + 0.3;
      step = 0;
      buses[ch].gain.setTargetAtTime(CHANNELS[ch].vol, now + 0.25, 0.1);
    }
  },
  setWorld(w) { this.setChannel(w); },
  stop() {
    if (!running) return;
    running = false;
    const now = ctx.currentTime;
    master.gain.setTargetAtTime(0, now, 0.15);
    ambStop(true);
    const t = timer;
    setTimeout(() => {
      if (!running && t === timer) clearInterval(timer);
    }, 900);
  },
  // タブが裏に回ったら止めて、戻ったら再開する
  tick, // 検証用（本番は setInterval から呼ばれる）
  suspend() { if (ctx && running) ctx.suspend(); },
  resume() { if (ctx && running) ctx.resume(); },
};
