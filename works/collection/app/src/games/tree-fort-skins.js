// ツリー砦のスキン（見た目の着せ替え）と、スキンに合わせて描く道具（背景・文字・パネル・ボタン・粒）。
// 画面側は kit だけを使うので、スキンの追加は SKINS に 1 つ足すだけでよい（bg を増やす場合のみ背景の描画も足す）。
export const SANS = '"Hiragino Sans","Yu Gothic","Meiryo",sans-serif';
export const MONO = '"MS Gothic","Osaka-Mono","Noto Sans Mono CJK JP",monospace';
export const SERIF = '"Yu Mincho","Hiragino Mincho ProN","Noto Serif JP","MS Mincho",serif';

export const SKINS = [
  {
    id: 'neon', name: 'ネオン', price: 0, desc: '濃紺の闇に光る、定番のネオン', bg: 'neon', font: MONO, glow: 1, node: 'orb', enemy: 'geo', tower: 'core', part: 'spark', shot: 'streak', bolt: 'neon', boom: 'neon',
    text: '#eaf6ff', dim: '#7f8fd0', fill: 'rgba(8, 14, 40, 0.88)', line: '#2a3a7a', gold: '#ffd84a', bad: '#ff5470', me: '#2ef2ff', op: '#ff3df2',
    branch: { atk: '#ff5a7a', spd: '#ffd84a', def: '#2ef2ff', eco: '#7dff8a', grw: '#c9a3ff', core: '#eaf6ff' },
    enemies: { grunt: '#ff3df2', runner: '#ffb020', tank: '#ff5a3c', swarm: '#ff8ae8', splitter: '#ff6ad0', armor: '#9aa8d8', shooter: '#ff7a5a', healer: '#7dff8a', shield: '#6fd8ff', phantom: '#b8a0ff', boss: '#ff3a5a' }, hp: ['#ff5470', '#ffd84a', '#7dff8a'],
  },
  {
    id: 'rainbow', name: '虹', price: 150, desc: '色相がめぐる、虹色の世界', bg: 'rainbow', font: SANS, glow: 1, node: 'orb', enemy: 'geo', tower: 'core', part: 'star', shot: 'streak', bolt: 'rainbow', boom: 'rainbow', rainbow: true,
    text: '#ffffff', dim: '#b8a8e8', fill: 'rgba(14, 8, 34, 0.86)', line: '#5a3aa0', gold: '#fff27a', bad: '#ff5c8a', me: '#6ff0ff', op: '#ff7af0',
    branch: { atk: '#ff5a7a', spd: '#ffd84a', def: '#2ef2ff', eco: '#7dff8a', grw: '#c9a3ff', core: '#ffffff' },
    enemies: { grunt: '#ff7af0', runner: '#ffb020', tank: '#ff5a3c', swarm: '#ff9af8', splitter: '#ff7ad8', armor: '#b0bce8', shooter: '#ff8a6a', healer: '#8dff9a', shield: '#7fe0ff', phantom: '#c8b0ff', boss: '#ff4a6a' }, hp: ['#ff5c8a', '#fff27a', '#7dff8a'],
  },
  {
    id: 'modern', name: 'モダン', price: 200, desc: '明るくすっきり、フラットな見た目', bg: 'modern', font: SANS, glow: 0, node: 'flat', enemy: 'flat', tower: 'flat', part: 'dot', shot: 'dot', bolt: 'thin', boom: 'flat',
    text: '#1b2430', dim: '#7d8a99', fill: 'rgba(255, 255, 255, 0.95)', line: '#d3dce6', gold: '#e0a100', bad: '#e5484d', me: '#0e9f9a', op: '#6b5bd2',
    branch: { atk: '#e5484d', spd: '#e8a200', def: '#0e9f9a', eco: '#3da35d', grw: '#8b5cf6', core: '#4a5a6a' },
    enemies: { grunt: '#6b5bd2', runner: '#ef8b2c', tank: '#c2384b', swarm: '#9a8bf0', splitter: '#d06bb8', armor: '#5d6b82', shooter: '#d9534f', healer: '#3da35d', shield: '#2f9fd8', phantom: '#8a8aa8', boss: '#b02040' }, hp: ['#e5484d', '#e8a200', '#3da35d'],
  },
  {
    id: 'wa', name: '和', price: 250, desc: '和紙・墨・朱。桜が舞う和の装い', bg: 'wa', font: SERIF, glow: 0.15, node: 'stamp', enemy: 'ink', tower: 'torii', part: 'petal', shot: 'brush', bolt: 'brush', boom: 'ink',
    text: '#1a1410', dim: '#7a6a58', fill: 'rgba(246, 238, 222, 0.95)', line: '#b9a98c', gold: '#b58a1b', bad: '#c0392b', me: '#1f3a6e', op: '#c0392b',
    branch: { atk: '#c0392b', spd: '#b58a1b', def: '#1f3a6e', eco: '#4a7a4a', grw: '#6b4a8a', core: '#1a1410' },
    enemies: { grunt: '#262626', runner: '#7a3b2e', tank: '#3b1a1a', swarm: '#4a4a4a', splitter: '#5a2a3a', armor: '#3a3f4a', shooter: '#7a2a2a', healer: '#2f5a3a', shield: '#2a4a6a', phantom: '#5a5a7a', boss: '#1a0a0a' }, hp: ['#c0392b', '#b58a1b', '#4a7a4a'],
  },
];

// 演出パック（スキンとは別に買える）。見た目の色や形ではなく「出し方」を変える。
export const EFFECTS = [
  { id: 'standard', name: '標準', price: 0, desc: 'シンプルな光と粒' },
  { id: 'geometry', name: '幾何学', price: 180, desc: '多角形・黄金角の螺旋・バラ曲線・波の干渉' },
  { id: 'mandala', name: '曼荼羅', price: 280, desc: '8 方向に広がる対称模様と万華鏡' },
];

export const skinIndex = (id) => Math.max(0, SKINS.findIndex((s) => s.id === id));

// '#rrggbb' / 'hsl(...)' に透明度を付ける
export function rgba(color, a) {
  if (color.startsWith('#')) {
    const n = parseInt(color.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  }
  if (color.startsWith('hsl(')) return color.replace('hsl(', 'hsla(').replace(')', `, ${a})`);
  return color;
}

export function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// 和紙のしみ（毎回同じ位置になるよう固定の乱数で作る）
function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
const FIBERS = (() => {
  const r = lcg(7);
  return Array.from({ length: 180 }, () => ({ x: r() * 240, y: r() * 320, l: 3 + r() * 9, a: r() * Math.PI }));
})();
const STARS = (() => {
  const r = lcg(11);
  return Array.from({ length: 70 }, () => ({ x: r() * 280, y: r() * 360, z: 0.2 + r() * 0.8, p: r() * 6 }));
})();

export function makeKit(skin) {
  const k = {
    skin,
    clock: 0,
    parts: [],
    hue(i = 0, l = 62) {
      return `hsl(${Math.round((k.clock * 70 + i * 47) % 360)}, 100%, ${l}%)`;
    },
    // 虹スキンでは時間と番号で色相が回る。それ以外は base のまま。
    c(base, i = 0) {
      return skin.rainbow ? k.hue(i) : base;
    },
    branchColor(id, i = 0) {
      return k.c(skin.branch[id.replace(/\d+$/, '')] || skin.text, i);
    },
    enemyColor(type, i = 0) {
      return k.c(skin.enemies[type], i);
    },
    glow(g, color, blur) {
      const b = blur * skin.glow;
      if (b > 0) {
        g.shadowColor = color;
        g.shadowBlur = b;
      }
    },
    text(g, str, x, y, size = 12, color = skin.text, align = 'left', blur = 0) {
      g.save();
      g.font = `bold ${size}px ${skin.font}`;
      g.textAlign = align;
      g.textBaseline = 'top';
      g.fillStyle = color;
      if (blur) k.glow(g, color, blur);
      g.fillText(str, x, y);
      g.restore();
    },
    measure(g, str, size) {
      g.save();
      g.font = `bold ${size}px ${skin.font}`;
      const w = g.measureText(str).width;
      g.restore();
      return w;
    },

    // ---- 背景 ----
    bg(g, W, H) {
      const t = k.clock;
      if (skin.bg === 'neon') {
        const grad = g.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, '#04061a');
        grad.addColorStop(1, '#0c1238');
        g.fillStyle = grad;
        g.fillRect(0, 0, W, H);
        g.save();
        g.strokeStyle = 'rgba(90, 130, 255, 0.10)';
        g.lineWidth = 0.6;
        const off = (t * 6) % 24;
        g.beginPath();
        for (let x = 0; x <= W; x += 24) {
          g.moveTo(x, 0);
          g.lineTo(x, H);
        }
        for (let y = -24 + off; y <= H; y += 24) {
          g.moveTo(0, y);
          g.lineTo(W, y);
        }
        g.stroke();
        g.restore();
      } else if (skin.bg === 'rainbow') {
        const grad = g.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, `hsl(${(t * 14) % 360}, 55%, 11%)`);
        grad.addColorStop(1, `hsl(${(t * 14 + 90) % 360}, 55%, 7%)`);
        g.fillStyle = grad;
        g.fillRect(0, 0, W, H);
        for (let i = 0; i < 4; i++) {
          const x = W / 2 + Math.cos(t * 0.35 + i * 1.7) * 90;
          const y = H / 2 + Math.sin(t * 0.28 + i * 2.3) * 120;
          const rg = g.createRadialGradient(x, y, 0, x, y, 130);
          rg.addColorStop(0, `hsla(${(t * 40 + i * 90) % 360}, 100%, 55%, 0.20)`);
          rg.addColorStop(1, 'rgba(0,0,0,0)');
          g.fillStyle = rg;
          g.fillRect(0, 0, W, H);
        }
      } else if (skin.bg === 'modern') {
        const grad = g.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, '#f6f9fc');
        grad.addColorStop(1, '#e4ebf4');
        g.fillStyle = grad;
        g.fillRect(0, 0, W, H);
        g.fillStyle = 'rgba(80, 100, 130, 0.10)';
        for (let x = 12; x < W; x += 24) for (let y = 12; y < H; y += 24) g.fillRect(x - 0.7, y - 0.7, 1.4, 1.4);
        g.fillStyle = 'rgba(14, 159, 154, 0.07)';
        g.beginPath();
        g.arc(W * 0.85, 40, 90, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = 'rgba(107, 91, 210, 0.06)';
        g.beginPath();
        g.arc(30, H - 30, 110, 0, Math.PI * 2);
        g.fill();
      } else {
        // 和: 和紙・朱の日輪・青海波・すみのぼかし
        g.fillStyle = '#efe5cf';
        g.fillRect(0, 0, W, H);
        g.strokeStyle = 'rgba(120, 95, 60, 0.10)';
        g.lineWidth = 0.7;
        g.beginPath();
        for (const f of FIBERS) {
          g.moveTo(f.x, f.y);
          g.lineTo(f.x + Math.cos(f.a) * f.l, f.y + Math.sin(f.a) * f.l);
        }
        g.stroke();
        g.fillStyle = 'rgba(192, 57, 43, 0.14)';
        g.beginPath();
        g.arc(W * 0.72, 62, 44, 0, Math.PI * 2);
        g.fill();
        // 青海波（下の方にうっすら）
        g.strokeStyle = 'rgba(31, 58, 110, 0.10)';
        g.lineWidth = 1;
        for (let row = 0; row < 5; row++) {
          const y = H - 8 - row * 9;
          for (let x = -12 + (row % 2) * 12; x < W + 12; x += 24) {
            for (let r = 4; r <= 12; r += 4) {
              g.beginPath();
              g.arc(x, y, r, Math.PI, 0);
              g.stroke();
            }
          }
        }
        const v = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.8);
        v.addColorStop(0, 'rgba(0,0,0,0)');
        v.addColorStop(1, 'rgba(90, 60, 30, 0.25)');
        g.fillStyle = v;
        g.fillRect(0, 0, W, H);
      }
    },
    // 星や粒の背景（ツリー画面）。z は奥行き（0〜1）で、動かすと視差がつく。
    stars(g, px, py, area) {
      if (skin.bg === 'modern' || skin.bg === 'wa') return;
      for (const s of STARS) {
        const sx = (((s.x + px * s.z * 0.5) % 280) + 280) % 280 - 20;
        const sy = (((s.y + py * s.z * 0.5) % (area.h + 40)) + area.h + 40) % (area.h + 40) + area.y - 20;
        const tw = 0.4 + 0.6 * Math.abs(Math.sin(k.clock * 1.5 + s.p));
        g.fillStyle = skin.rainbow ? k.hue(s.p, 75) : `rgba(200, 220, 255, ${0.5 * tw})`;
        g.globalAlpha = skin.rainbow ? 0.6 * tw : 1;
        g.fillRect(sx, sy, 1 + s.z, 1 + s.z);
        g.globalAlpha = 1;
      }
    },

    // ---- パネル・ボタン ----
    panel(g, r, o = {}) {
      const { stroke = skin.line, glow = null, blur = 8, radius = 6, lw = 1, fill = skin.fill } = o;
      g.save();
      if (skin.id === 'modern') {
        g.shadowColor = 'rgba(30, 50, 80, 0.18)';
        g.shadowBlur = 12;
        g.shadowOffsetY = 3;
        rr(g, r.x, r.y, r.w, r.h, radius + 3);
        g.fillStyle = fill;
        g.fill();
        g.shadowColor = 'transparent';
        g.lineWidth = lw;
        g.strokeStyle = glow || stroke;
        g.stroke();
      } else if (skin.id === 'wa') {
        rr(g, r.x, r.y, r.w, r.h, 2);
        g.fillStyle = fill;
        g.fill();
        g.lineWidth = lw + 1.2;
        g.strokeStyle = skin.text;
        g.stroke();
        rr(g, r.x + 3, r.y + 3, r.w - 6, r.h - 6, 1);
        g.lineWidth = 0.7;
        g.strokeStyle = glow || skin.dim;
        g.stroke();
      } else {
        if (glow) k.glow(g, glow, blur);
        rr(g, r.x, r.y, r.w, r.h, radius);
        g.fillStyle = fill;
        g.fill();
        g.lineWidth = lw;
        if (skin.rainbow) {
          const gr = g.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h);
          for (let i = 0; i <= 4; i++) gr.addColorStop(i / 4, k.hue(i, 65));
          g.strokeStyle = gr;
        } else g.strokeStyle = stroke;
        g.stroke();
      }
      g.restore();
    },
    button(g, r, label, o = {}) {
      const { on = true, active = false, color = skin.me, size = 12 } = o;
      const col = k.c(color, 1);
      g.save();
      if (skin.id === 'modern') {
        rr(g, r.x, r.y, r.w, r.h, 8);
        if (on) {
          g.shadowColor = rgba(col, 0.35);
          g.shadowBlur = active ? 14 : 8;
          g.shadowOffsetY = 2;
        }
        g.fillStyle = on ? col : '#dde4ec';
        g.fill();
        g.shadowColor = 'transparent';
        k.text(g, label, r.x + r.w / 2, r.y + r.h / 2 - size / 2 - 1, size, on ? '#ffffff' : '#9aa6b4', 'center');
      } else if (skin.id === 'wa') {
        rr(g, r.x, r.y, r.w, r.h, 3);
        g.fillStyle = active || (on && o.stamp) ? col : 'rgba(246, 238, 222, 0.96)';
        g.fill();
        g.lineWidth = on ? 2 : 1;
        g.strokeStyle = on ? skin.text : skin.dim;
        g.stroke();
        k.text(g, label, r.x + r.w / 2, r.y + r.h / 2 - size / 2 - 1, size, active || (on && o.stamp) ? '#fff6e6' : on ? skin.text : skin.dim, 'center');
      } else {
        if (on) k.glow(g, col, active ? 14 : 7);
        rr(g, r.x, r.y, r.w, r.h, 6);
        g.fillStyle = active ? col : rgba(on ? col : skin.dim, on ? 0.14 : 0.06);
        g.fill();
        g.lineWidth = 1.3;
        g.strokeStyle = rgba(on ? col : skin.dim, on ? 0.95 : 0.4);
        g.stroke();
        g.shadowBlur = 0;
        k.text(g, label, r.x + r.w / 2, r.y + r.h / 2 - size / 2 - 1, size, active ? '#04061a' : on ? '#ffffff' : rgba(skin.dim, 0.7), 'center');
      }
      g.restore();
    },

    // ---- 粒（スキンごとの形） ----
    burst(x, y, colors, n, speed = 90, up = 0, shape = skin.part, size = 2.2) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = speed * (0.3 + Math.random() * 0.7);
        k.parts.push({
          x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - up, life: 0.5 + Math.random() * 0.8, max: 1.3,
          size: size * (0.6 + Math.random() * 0.9), color: colors[i % colors.length], shape,
          rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 8, seed: Math.random() * 6,
        });
      }
      if (k.parts.length > 700) k.parts.splice(0, k.parts.length - 700);
    },
    // 向き ang の方向へ、spread の範囲で吹き出す粒（貫通の火花など）
    spray(x, y, ang, spread, n, colors, speed = 140, shape = skin.part, size = 2) {
      for (let i = 0; i < n; i++) {
        const a = ang + (Math.random() - 0.5) * spread * 2;
        const v = speed * (0.4 + Math.random() * 0.6);
        k.parts.push({
          x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.3 + Math.random() * 0.4, max: 0.7,
          size: size * (0.7 + Math.random() * 0.8), color: colors[i % colors.length], shape,
          rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 8, seed: Math.random() * 6,
        });
      }
    },
    update(dt) {
      for (const p of k.parts) {
        p.life -= dt;
        p.rot += p.vr * dt;
        if (p.shape === 'petal') {
          p.vy += 40 * dt;
          p.vx += Math.sin(k.clock * 3 + p.seed) * 40 * dt;
        } else if (p.shape === 'ink') {
          p.vy += 20 * dt;
        } else p.vy += 110 * dt;
        p.vx *= 1 - 0.8 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
      k.parts = k.parts.filter((p) => p.life > 0);
    },
    drawParts(g) {
      g.save();
      for (const p of k.parts) {
        const a = Math.min(1, p.life / 0.4);
        g.globalAlpha = a;
        const col = skin.rainbow ? k.hue(p.seed * 20, 65) : p.color;
        g.fillStyle = col;
        if (p.shape === 'petal') {
          g.save();
          g.translate(p.x, p.y);
          g.rotate(p.rot);
          g.scale(1, 0.55 + 0.45 * Math.abs(Math.sin(k.clock * 4 + p.seed)));
          g.beginPath();
          g.ellipse(0, 0, p.size * 1.6, p.size * 0.9, 0, 0, Math.PI * 2);
          g.fill();
          g.restore();
        } else if (p.shape === 'dot' || p.shape === 'ink') {
          g.beginPath();
          g.arc(p.x, p.y, p.size * (p.shape === 'ink' ? 1.1 * a + 0.3 : 1), 0, Math.PI * 2);
          g.fill();
        } else if (p.shape === 'star') {
          g.save();
          g.translate(p.x, p.y);
          g.rotate(p.rot);
          if (skin.glow) k.glow(g, col, 6);
          const s = p.size * 1.6;
          g.fillRect(-s, -0.6, s * 2, 1.2);
          g.fillRect(-0.6, -s, 1.2, s * 2);
          g.restore();
        } else {
          if (skin.glow) k.glow(g, col, 5);
          g.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        }
      }
      g.restore();
    },
  };
  return k;
}
