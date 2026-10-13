// WebAudio の簡易ビープ音。最初の操作で AudioContext を作る（自動再生制限のため）。
let ctx = null;
let muted = false;

export const Sound = {
  unlock() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) ctx = new AC();
  },
  setMuted(m) { muted = m; },
  get muted() { return muted; },
  beep(freq = 440, dur = 0.08, type = 'square', vol = 0.06) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + dur);
  },
  // 下降音（ゲームオーバー）
  fall() {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(440, t);
    o.frequency.exponentialRampToValueAtTime(70, t + 0.45);
    g.gain.setValueAtTime(0.07, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + 0.45);
  },
};
