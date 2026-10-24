// ポータル（最初の画面）: 3 つの「世界」タブとゲーム一覧。
// 世界ごとに画面の配色・形・文字・背景の動き・BGM の音色が違い、タブを切り替えると約 0.6 秒でなめらかに移り変わる。
// 一覧はドラッグでスクロールでき、ゲームは「指を離したとき」に選ばれる（スクロール中に選ばれない）。
import { Music } from './core/music.js';

export const W = 240;
export const H = 320;

export const WORLDS = [
  { id: 'keitai', tab: 'ケータイ', title: 'ケータイゲーム集', sub: 'ドット絵のミニゲームをいっぱい' },
  { id: 'versus', tab: '対戦・ボード', title: '対戦・ボード', sub: 'ひとりでも ふたりでも' },
  { id: 'puzzle', tab: 'パズル＆戦略', title: 'パズル＆戦略', sub: 'じっくり考えて、育てて、守る' },
];

// 世界ごとの見た目。色は hex、数値は補間される。
const THEME = {
  keitai: { top: '#9bbc0f', bot: '#8bac0f', ink: '#0f380f', dim: '#306230', card: '#8bac0f', line: '#0f380f', accent: '#0f380f', onAccent: '#9bbc0f', head: '#0f380f', onHead: '#9bbc0f', radius: 0, glow: 0, font: 0 },
  versus: { top: '#1b2440', bot: '#0f1426', ink: '#f4efe2', dim: '#8e97b5', card: '#243055', line: '#4a5a96', accent: '#ffc857', onAccent: '#1b2440', head: '#16203a', onHead: '#f4efe2', radius: 6, glow: 0.25, font: 1 },
  puzzle: { top: '#14052a', bot: '#02060f', ink: '#e8fbff', dim: '#7fa0c8', card: '#150a33', line: '#00e5ff', accent: '#ff3cac', onAccent: '#02060f', head: '#0a0620', onHead: '#e8fbff', radius: 9, glow: 1, font: 1 },
};
const COLOR_KEYS = ['top', 'bot', 'ink', 'dim', 'card', 'line', 'accent', 'onAccent', 'head', 'onHead'];
const NUM_KEYS = ['radius', 'glow', 'font'];

const FONT_PIX = '"MS Gothic", "Osaka-Mono", "Noto Sans Mono CJK JP", monospace';
const FONT_MOD = '"Hiragino Sans", "Yu Gothic UI", "Noto Sans JP", "Meiryo", sans-serif';

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const css = (c, a = 1) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;

const TAB_RECTS = [
  { x: 6, y: 42, w: 70, h: 22 },
  { x: 79, y: 42, w: 84, h: 22 },
  { x: 166, y: 42, w: 68, h: 22 },
];
const MUTE = { x: 196, y: 6, w: 38, h: 18 };
const LIST = { x: 0, y: 70, w: W, h: 232 };
const PITCH = 48;
const CARD_H = 42;
const inside = (x, y, r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;

function rr(g, x, y, w, h, r) {
  g.beginPath();
  if (r < 0.5) g.rect(x, y, w, h);
  else {
    r = Math.min(r, w / 2, h / 2);
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }
}

// opts: { games, best(item) → 文字列 | null, onSelect(item), store }
export function createPortal(opts) {
  const { games, onSelect, store } = opts;
  const saved = store.load('portal', {});
  let world = WORLDS.some((w) => w.id === saved.world) ? saved.world : 'keitai';
  let muted = !!saved.muted;
  Music.setMuted(muted);

  // 補間中の見た目（色は [r,g,b]）。目標へ指数的に近づく
  const cur = {};
  const goal = (id) => THEME[id];
  for (const k of COLOR_KEYS) cur[k] = hex(goal(world)[k]);
  for (const k of NUM_KEYS) cur[k] = goal(world)[k];
  const weight = { keitai: world === 'keitai' ? 1 : 0, versus: world === 'versus' ? 1 : 0, puzzle: world === 'puzzle' ? 1 : 0 };

  let clock = 0;
  let sy = 0;
  let vel = 0;
  let touch = null;
  let pressedId = null;

  const items = () => games.filter((it) => it.world === world);
  const maxScroll = () => Math.max(0, items().length * PITCH + 6 - LIST.h);
  const clamp = (v) => Math.max(0, Math.min(maxScroll(), v));

  function save() {
    store.save('portal', { world, muted });
  }

  function setWorld(id) {
    if (id === world) return;
    world = id;
    sy = 0;
    vel = 0;
    Music.setWorld(id);
    save();
  }

  function cardRect(i) {
    return { x: 10, y: LIST.y + 4 + i * PITCH - sy, w: W - 20, h: CARD_H };
  }

  function hitCard(x, y) {
    if (!inside(x, y, LIST)) return null;
    const list = items();
    for (let i = 0; i < list.length; i++) if (inside(x, y, cardRect(i))) return list[i];
    return null;
  }

  function tap(x, y) {
    if (inside(x, y, MUTE)) {
      muted = !muted;
      Music.setMuted(muted);
      save();
      return;
    }
    for (let i = 0; i < TAB_RECTS.length; i++) if (inside(x, y, TAB_RECTS[i])) return setWorld(WORLDS[i].id);
    const it = hitCard(x, y);
    if (it && (it.load || it.href)) onSelect(it);
  }

  function update(dt, input) {
    clock += dt;
    // ---- 入力: 押す → 動かす → 離す。離したときに、動いていなければタップ、動いていればスクロール
    if (input.pressed && !touch && (input.pointerDown || input.released)) {
      touch = { x0: input.x, y0: input.y, sy0: sy, drag: false, lastY: input.y, lastT: clock, inList: inside(input.x, input.y, LIST) };
      vel = 0;
    }
    if (touch && input.pointerDown) {
      const dy = input.y - touch.y0;
      if (!touch.drag && touch.inList && Math.abs(dy) > 6) touch.drag = true;
      if (touch.drag) {
        sy = clamp(touch.sy0 - dy);
        const dtt = Math.max(1e-3, clock - touch.lastT);
        vel = vel * 0.6 + ((touch.lastY - input.y) / dtt) * 0.4;
        touch.lastY = input.y;
        touch.lastT = clock;
      }
      pressedId = touch.drag ? null : (hitCard(input.x, input.y) || {}).id || null;
    }
    if (touch && (input.released || !input.pointerDown)) {
      if (!touch.drag) tap(input.x, input.y);
      else if (clock - touch.lastT > 0.08) vel = 0; // 止めてから離したら流さない
      touch = null;
      pressedId = null;
    }
    if (!touch && vel) {
      sy = clamp(sy + vel * dt);
      vel *= Math.exp(-dt * 4);
      if (Math.abs(vel) < 4 || sy === 0 || sy === maxScroll()) vel = 0;
    }
    // ---- 見た目の補間
    const k = 1 - Math.exp(-dt * 6);
    const tgt = goal(world);
    for (const key of COLOR_KEYS) {
      const t = hex(tgt[key]);
      for (let c = 0; c < 3; c++) cur[key][c] += (t[c] - cur[key][c]) * k;
    }
    for (const key of NUM_KEYS) cur[key] += (tgt[key] - cur[key]) * k;
    for (const id of Object.keys(weight)) weight[id] += ((id === world ? 1 : 0) - weight[id]) * k;
    // ---- 音: 最初のタップのあと、鳴らし始める
    if (!Music.running) Music.start(world);
  }

  // 文字: 8bit の等幅（keitai）とモダンな書体を、補間の度合いで重ねて描く
  function label(g, str, x, y, size, color, align = 'left') {
    const f = Math.max(0, Math.min(1, (cur.font - 0.35) / 0.3)); // 書体の入れ替えは補間の中ほどで素早く（重なって見える時間を短く）
    g.textAlign = align;
    g.textBaseline = 'top';
    g.fillStyle = color;
    const draw = (font, a) => {
      if (a < 0.02) return;
      g.globalAlpha = a;
      g.font = `bold ${size}px ${font}`;
      g.fillText(str, x, y);
    };
    draw(FONT_PIX, 1 - f);
    draw(FONT_MOD, f);
    g.globalAlpha = 1;
  }

  function drawBackground(g) {
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, css(cur.top));
    grad.addColorStop(1, css(cur.bot));
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
    // keitai: ゆっくり流れるドットの網
    if (weight.keitai > 0.02) {
      g.fillStyle = css(cur.dim, 0.16 * weight.keitai);
      const off = (clock * 5) % 12;
      for (let y = -12 + off; y < H; y += 12) for (let x = (((y / 12) | 0) % 2) * 6; x < W; x += 12) g.fillRect(Math.round(x), Math.round(y), 2, 2);
    }
    // versus: ゆっくり漂うやわらかい光
    if (weight.versus > 0.02) {
      for (let i = 0; i < 5; i++) {
        const x = W / 2 + Math.sin(clock * 0.21 + i * 1.7) * 100;
        const y = 80 + i * 50 + Math.cos(clock * 0.17 + i) * 24;
        const r = g.createRadialGradient(x, y, 0, x, y, 80);
        r.addColorStop(0, `rgba(255,200,87,${0.1 * weight.versus})`);
        r.addColorStop(1, 'rgba(255,200,87,0)');
        g.fillStyle = r;
        g.fillRect(x - 80, y - 80, 160, 160);
      }
    }
    // puzzle: 地平線へ伸びるネオンの格子
    if (weight.puzzle > 0.02) {
      g.save();
      g.globalAlpha = weight.puzzle;
      g.strokeStyle = 'rgba(0,229,255,0.2)';
      g.lineWidth = 0.6;
      const hz = 190;
      g.beginPath();
      for (let i = -8; i <= 8; i++) {
        g.moveTo(W / 2 + i * 8, hz);
        g.lineTo(W / 2 + i * 56, H);
      }
      const ph = (clock * 0.35) % 1;
      for (let i = 0; i < 7; i++) {
        const p = (i + ph) / 7;
        const y = hz + (H - hz) * p * p;
        g.moveTo(0, y);
        g.lineTo(W, y);
      }
      g.stroke();
      g.fillStyle = 'rgba(255,60,172,0.5)';
      for (let i = 0; i < 14; i++) {
        const x = (i * 53.7) % W;
        const y = H - ((clock * (8 + (i % 4) * 4) + i * 31) % H);
        g.fillRect(x, y, 1.5, 1.5);
      }
      g.restore();
    }
  }

  function draw(g) {
    g.save();
    drawBackground(g);
    const r = cur.radius;
    const glow = cur.glow;
    const W0 = WORLDS.find((w) => w.id === world);
    // ---- ヘッダー
    g.fillStyle = css(cur.head);
    g.fillRect(0, 0, W, 38);
    label(g, `PLAYPOCKET  ／  ${W0.sub}`, 8, 3, 7.5, css(cur.onHead, 0.65), 'left');
    label(g, W0.title, 8, 14, 16, css(cur.onHead), 'left');
    // 音のオン/オフ
    rr(g, MUTE.x, MUTE.y, MUTE.w, MUTE.h, r * 0.6);
    g.strokeStyle = css(cur.onHead, 0.7);
    g.lineWidth = 1;
    g.stroke();
    label(g, muted ? '♪ OFF' : '♪ ON', MUTE.x + MUTE.w / 2, MUTE.y + 4, 9, css(cur.onHead, muted ? 0.5 : 1), 'center');
    // ---- タブ
    WORLDS.forEach((w, i) => {
      const t = TAB_RECTS[i];
      const on = weight[w.id];
      g.save();
      if (glow > 0.05 && on > 0.5) {
        g.shadowColor = css(cur.accent, 0.9);
        g.shadowBlur = 8 * glow * on;
      }
      rr(g, t.x + 0.5, t.y + 0.5, t.w - 1, t.h - 1, r * 0.7);
      g.fillStyle = css(cur.accent, on);
      g.fill();
      g.restore();
      rr(g, t.x + 0.5, t.y + 0.5, t.w - 1, t.h - 1, r * 0.7);
      g.strokeStyle = css(cur.line, 0.9);
      g.lineWidth = 1;
      g.stroke();
      // 選択中の文字色は onAccent、そうでなければ ink（重みで混ぜる）
      const col = [0, 1, 2].map((c) => cur.ink[c] * (1 - on) + cur.onAccent[c] * on);
      label(g, w.tab, t.x + t.w / 2, t.y + 6, 9.5, css(col), 'center');
    });
    // ---- 一覧（クリップして、スクロール位置ぶんずらして描く）
    g.save();
    g.beginPath();
    g.rect(LIST.x, LIST.y, LIST.w, LIST.h);
    g.clip();
    items().forEach((it, i) => {
      const c = cardRect(i);
      if (c.y > LIST.y + LIST.h || c.y + c.h < LIST.y) return;
      const live = !!(it.load || it.href);
      const down = pressedId === it.id;
      g.save();
      if (glow > 0.05 && live) {
        g.shadowColor = css(cur.line, 0.7);
        g.shadowBlur = 7 * glow;
      }
      rr(g, c.x + 0.5, c.y + 0.5, c.w - 1, c.h - 1, r);
      g.fillStyle = css(cur.card, live ? 1 : 0.5);
      g.fill();
      g.restore();
      rr(g, c.x + 0.5, c.y + 0.5, c.w - 1, c.h - 1, r);
      g.strokeStyle = css(cur.line, live ? 0.95 : 0.35);
      g.lineWidth = 1;
      g.stroke();
      if (down) {
        rr(g, c.x + 0.5, c.y + 0.5, c.w - 1, c.h - 1, r);
        g.fillStyle = css(cur.accent, 0.28);
        g.fill();
      }
      // 番号のバッジ
      rr(g, c.x + 7, c.y + 9, 24, 24, r * 0.8);
      g.fillStyle = css(cur.accent, live ? 1 : 0.35);
      g.fill();
      label(g, `${i + 1}`, c.x + 19, c.y + 14, 13, css(cur.onAccent), 'center');
      label(g, it.title, c.x + 38, c.y + 6, 14, css(cur.ink, live ? 1 : 0.5));
      const sub = !live ? '準備中' : it.desc;
      label(g, sub, c.x + 38, c.y + 24, 9.5, css(cur.dim), 'left');
      const best = live && opts.best ? opts.best(it) : null;
      if (best) label(g, best, c.x + c.w - 8, c.y + 6, 8.5, css(cur.dim), 'right');
      else if (live) label(g, '▶', c.x + c.w - 10, c.y + 15, 11, css(cur.accent), 'right');
    });
    g.restore();
    // はみ出している側に薄い影（続きがあると分かるように）
    if (maxScroll() > 0) {
      const gb = g.createLinearGradient(0, H - 22, 0, H);
      gb.addColorStop(0, css(cur.bot, 0));
      gb.addColorStop(1, css(cur.bot, sy < maxScroll() - 2 ? 0.95 : 0));
      g.fillStyle = gb;
      g.fillRect(0, H - 22, W, 22);
    }
    if (!Music.running) label(g, 'タップすると ♪ が流れます', W / 2, H - 15, 8.5, css(cur.dim), 'center');
    g.restore();
    return `rgb(${Math.round(cur.bot[0])},${Math.round(cur.bot[1])},${Math.round(cur.bot[2])})`;
  }

  return {
    update,
    draw,
    get world() { return world; },
    enter() { vel = 0; touch = null; pressedId = null; if (Music.running === false) Music.start(world); },
  };
}
