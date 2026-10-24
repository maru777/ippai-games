// BGM の検証: すべてのチャンネルを、偽の AudioContext で数小節ぶん鳴らして、例外や不正な値（NaN）が出ないことを確認する。
// 実行: node works/collection/tests/music.test.mjs
import assert from 'node:assert/strict';

let bad = 0;
let voices = 0;
const param = () => {
  const chk = (v) => { if (!Number.isFinite(v)) bad++; };
  return {
    value: 0,
    setValueAtTime: chk, linearRampToValueAtTime: chk, setTargetAtTime: chk,
    exponentialRampToValueAtTime: (v) => { chk(v); if (v <= 0) bad++; },
  };
};
const node = () => ({
  gain: param(), frequency: param(), delayTime: param(), type: '', buffer: null,
  connect: (n) => n, start: (t) => { voices++; if (!Number.isFinite(t)) bad++; }, stop: (t) => { if (!Number.isFinite(t)) bad++; },
});
let now = 0;
globalThis.window = {
  AudioContext: class {
    constructor() { this.sampleRate = 8000; this.state = 'running'; this.destination = node(); }
    get currentTime() { return now; }
    createGain() { return node(); }
    createOscillator() { return node(); }
    createBiquadFilter() { return node(); }
    createBufferSource() { return node(); }
    createDelay() { return node(); }
    createConvolver() { return node(); }
    createBuffer(c, n) { return { getChannelData: () => new Float32Array(n) }; }
    resume() {}
    suspend() {}
  },
};
const { Sound } = await import('../app/src/core/sound.js');
const { Music } = await import('../app/src/core/music.js');

let passed = 0;
const test = (name, fn) => {
  fn();
  passed++;
  console.log(`ok - ${name}`);
};
const CHANNELS = ['keitai', 'versus', 'puzzle', 'game-neon', 'game-rainbow', 'game-modern', 'game-wa'];
const run = (sec) => {
  for (let t = 0; t < sec; t += 0.05) {
    now += 0.05;
    Music.tick();
  }
};

test('AudioContext の前は鳴らせず、作ったあとは鳴らせる', () => {
  assert.equal(Music.start('keitai'), false);
  Sound.unlock();
  assert.equal(Music.start('keitai'), true);
  assert.ok(Music.running);
});

test('すべてのチャンネルで、数小節ぶん例外・不正な値なしに音が出る', () => {
  for (const ch of CHANNELS) {
    Music.start(ch);
    voices = 0;
    run(8);
    assert.ok(voices > 20, `${ch}: 音が出ていない (${voices})`);
  }
  assert.equal(bad, 0, '不正な値（NaN・0 以下の指数）が渡された');
});

test('同じ bpm（ポータルの世界）の切り替えと、違う bpm（ゲームへ）の切り替えがどちらも動く', () => {
  Music.start('keitai');
  run(1);
  Music.setChannel('puzzle');
  run(2);
  Music.setChannel('game-wa');
  run(2);
  Music.setChannel('keitai');
  run(2);
  assert.equal(Music.channel, 'keitai');
  assert.equal(bad, 0);
});

test('止めたあとは鳴らない', () => {
  Music.stop();
  assert.equal(Music.running, false);
});

console.log(`\n${passed} 件すべて成功`);
process.exit(0);
