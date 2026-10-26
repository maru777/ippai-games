// ツリー砦の描画。スキン（kit）と演出パック（fx: standard / geometry / mandala）の組み合わせで見た目が決まる。
// 状態は持たない（画面の状態 sc を読んで描くだけ）。論理座標は幅 240 × 高さ H（既定 320。縦長の端末では最大 520 まで伸びる）。
// 上端起点の部品は y を変えず、下端起点の部品（ボタン・説明パネル）は layoutView(H) で下へずらし、中央の領域を伸ばす。
import { ARENA } from './tree-fort-battle.js';
import { drawWeaponsUnder, drawWeaponsOver, drawBlades, drawStatus, TAG_COLOR } from './tree-fort-wview.js';
import { drawBattleHud } from './tree-fort-rview.js';
import { TREE, NODE, UNLOCKS, canBuy, canRefund } from './tree-fort-data.js';
import { SKINS, EFFECTS, rgba, rr } from './tree-fort-skins.js';

const TAU = Math.PI * 2;
const GOLDEN = Math.PI * (3 - Math.sqrt(5)); // 黄金角（約 137.5 度）

export const STEP = 44;
export const NODE_R = 15;
export const MAP = { x: 0, y: 30, w: 240, h: 208 };
export const MAP_CX = 120;
export const BTN_BUY = { x: 8, y: 288, w: 108, h: 28 };
export const BTN_GO = { x: 124, y: 288, w: 108, h: 28 };
export const BTN_ARMORY = { x: 112, y: 4, w: 38, h: 22 };
export const BTN_ODSHOP = { x: 154, y: 4, w: 30, h: 22 };
export const BTN_SHOP = { x: 188, y: 4, w: 48, h: 22 };
export const BTN_MENU = { x: 72, y: 4, w: 38, h: 22 };
export const BTN_RETREAT = { x: 192, y: 4, w: 44, h: 22 };

// 画面の高さ H に合わせて、下端起点の部品を動かす（320 からの増分 DH だけ下へ）。矩形は同じ object を書き換える。
let DH = 0;
export function layoutView(H) {
  DH = Math.max(0, H - 320);
  MAP.h = 208 + DH;
  BTN_BUY.y = 288 + DH;
  BTN_GO.y = 288 + DH;
}
const panelY = () => 241 + DH; // 下の説明パネルの上端

// ショップの行の配置（スキン 4 つ + 演出 3 つ）。余った高さは、スキンと演出の間と下に配る。
export function shopLayout() {
  const rows = [];
  const s0 = Math.round(DH * 0.15);
  const f0 = Math.round(DH * 0.45);
  SKINS.forEach((_, i) => rows.push({ type: 'skin', idx: i, rect: { x: 8, y: 50 + s0 + i * 23, w: 224, h: 21 } }));
  EFFECTS.forEach((_, i) => rows.push({ type: 'fx', idx: i, rect: { x: 8, y: 164 + f0 + i * 23, w: 224, h: 21 } }));
  return { rows, headers: [{ y: 35 + s0, label: '見た目（スキン）' }, { y: 149 + f0, label: '演出（エフェクト）' }] };
}

// ---- 幾何の道具 ----
export function polyPath(g, x, y, r, n, rot = 0) {
  g.beginPath();
  for (let i = 0; i < n; i++) {
    const a = rot + (i * TAU) / n;
    if (i) g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    else g.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  g.closePath();
}

// 星型多角形 {n/k}
export function starPath(g, x, y, r, n, k, rot = 0) {
  g.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = rot + (((i * k) % n) * TAU) / n;
    if (i) g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    else g.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  g.closePath();
}

// バラ曲線 r = R cos(kθ)
function rosePath(g, x, y, R, k, rot, grow = 1) {
  g.beginPath();
  const steps = 180;
  const turns = k % 2 ? 1 : 2;
  for (let i = 0; i <= steps; i++) {
    const th = (i / steps) * TAU * turns * 0.5 * 2;
    const r = R * grow * Math.cos(k * th);
    const px = x + r * Math.cos(th + rot);
    const py = y + r * Math.sin(th + rot);
    if (i) g.lineTo(px, py);
    else g.moveTo(px, py);
  }
}

// ハイポトロコイド（スピログラフ）
function spiroPath(g, x, y, R, r, d, rot) {
  g.beginPath();
  const steps = 260;
  const k = (R - r) / r;
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * TAU * r;
    const px = x + ((R - r) * Math.cos(t) + d * Math.cos(k * t)) * 0.3;
    const py = y + ((R - r) * Math.sin(t) - d * Math.sin(k * t)) * 0.3;
    const rx = Math.cos(rot) * (px - x) - Math.sin(rot) * (py - y);
    const ry = Math.sin(rot) * (px - x) + Math.cos(rot) * (py - y);
    if (i) g.lineTo(x + rx, y + ry);
    else g.moveTo(x + rx, y + ry);
  }
}

// ---- 演出の発生（画面ロジックから呼ぶ。演出パックごとに出し方が変わる）----
export function spawnFx(sc, kind, x, y, color, power = 1) {
  const { kit, fx } = sc;
  const cx = ARENA.cx;
  const cy = ARENA.cy;
  const push = (o) => {
    o.t = 0;
    sc.effects.push(o);
  };
  const pal = [color, '#ffffff', kit.skin.gold];
  if (kind === 'kill') {
    kit.burst(x, y, pal, 7, 70, 20);
    if (fx === 'geometry') push({ kind: 'phyllo', x, y, n: 26, R: 24, color, life: 0.7, rot: Math.random() * TAU });
    else if (fx === 'mandala') push({ kind: 'sym', cx, cy, x, y, n: 8, color, life: 0.8 });
    else push({ kind: 'ring', x, y, r0: 3, r1: 16, color, lw: 1.5, life: 0.3 });
  } else if (kind === 'boom') {
    kit.burst(x, y, pal, 26, 150, 30);
    push({ kind: 'ring', x, y, r0: 6, r1: 46 * power, color, lw: 2.5, life: 0.45 });
    if (fx === 'geometry') {
      push({ kind: 'rose', x, y, R: 34, k: 5, color, life: 0.7, rot: Math.random() * TAU });
      push({ kind: 'ring', x, y, r0: 6, r1: 52, color: kit.skin.gold, lw: 1.5, life: 0.6, shape: 'star', n: 9, k: 4 });
    } else if (fx === 'mandala') {
      push({ kind: 'sym', cx, cy, x, y, n: 8, color, life: 1.0 });
      push({ kind: 'spiro', x, y, R: 40, color, life: 0.9 });
    }
  } else if (kind === 'hit') {
    kit.burst(x, y, [kit.skin.bad, '#ffffff'], 16, 120, 10, 'spark', 2.4);
    push({ kind: 'ring', x: cx, y: cy, r0: 14, r1: 54, color: kit.skin.bad, lw: 3, life: 0.4, shape: fx === 'geometry' ? 'poly' : 'circle', n: 6 });
  } else if (kind === 'buy') {
    kit.burst(x, y, pal, 46, 130, 30);
    push({ kind: 'ring', x, y, r0: 6, r1: 60, color, lw: 3, life: 0.6 });
    if (fx === 'geometry') {
      push({ kind: 'phyllo', x, y, n: 60, R: 52, color, life: 1.0, rot: 0 });
      push({ kind: 'ring', x, y, r0: 6, r1: 56, color: kit.skin.gold, lw: 1.6, life: 0.8, shape: 'star', n: 7, k: 3 });
    } else if (fx === 'mandala') {
      push({ kind: 'sym', cx: x, cy: y, x: x + 22, y, n: 12, color, life: 1.0 });
      push({ kind: 'sym', cx: x, cy: y, x: x + 42, y, n: 12, color: kit.skin.gold, life: 1.2 });
      push({ kind: 'spiro', x, y, R: 36, color, life: 1.1 });
    }
  } else if (kind === 'refund') {
    kit.burst(x, y, [kit.skin.dim, color], 16, 60, 0, 'dot');
    push({ kind: 'ring', x, y, r0: 40, r1: 4, color: kit.skin.dim, lw: 2, life: 0.35 });
  } else if (kind === 'wave') {
    push({ kind: 'ring', x: cx, y: cy, r0: 10, r1: 190, color, lw: 3, life: 0.9, shape: fx === 'geometry' ? 'star' : 'circle', n: 12, k: 5 });
    if (fx === 'mandala') push({ kind: 'spiro', x: cx, y: cy, R: 120, color, life: 1.4 });
  } else if (kind === 'clear') {
    kit.burst(cx, cy, pal, 40, 150, 40);
    if (fx === 'geometry') push({ kind: 'phyllo', x: cx, y: cy, n: 80, R: 100, color: kit.skin.gold, life: 1.4, rot: 0 });
    else if (fx === 'mandala') push({ kind: 'sym', cx, cy, x: cx + 60, y: cy, n: 12, color: kit.skin.gold, life: 1.2 });
  } else if (kind === 'syn') {
    kit.burst(x, y, [TAG_COLOR.fire, '#ffffff', kit.skin.gold], 22, 110, 20, kit.skin.part, 2.4);
    push({ kind: 'ring', x, y, r0: 6, r1: 52, color: kit.skin.gold, lw: 2.5, life: 0.55, shape: fx === 'geometry' ? 'star' : 'circle', n: 8, k: 3 });
    if (fx === 'mandala') push({ kind: 'sym', cx, cy, x, y, n: 8, color: kit.skin.gold, life: 0.9 });
  } else if (kind === 'muzzle') {
    kit.burst(x, y, [color, '#ffffff'], 2, 60, 0, 'spark', 1.6);
  }
}

// 画面の演出（輪・螺旋・バラ曲線・対称模様など）を描く
export function drawSceneFx(g, sc) {
  const { kit } = sc;
  g.save();
  for (const f of sc.effects) {
    const u = Math.min(1, f.t / f.life);
    const a = 1 - u;
    const col = kit.skin.rainbow ? kit.hue(f.x * 0.05 + f.t * 4) : f.color;
    g.globalAlpha = Math.max(0, a);
    g.strokeStyle = col;
    g.fillStyle = col;
    if (kit.skin.glow) kit.glow(g, col, 8);
    if (f.kind === 'ring') {
      g.lineWidth = f.lw * (0.5 + a * 0.7);
      const r = f.r0 + (f.r1 - f.r0) * (1 - (1 - u) * (1 - u));
      if (f.shape === 'star') starPath(g, f.x, f.y, r, f.n, f.k, u * 1.2);
      else if (f.shape === 'poly') polyPath(g, f.x, f.y, r, f.n, u * 2);
      else {
        g.beginPath();
        g.arc(f.x, f.y, r, 0, TAU);
      }
      g.stroke();
    } else if (f.kind === 'phyllo') {
      // 黄金角で並べた点が、外へ広がりながら回る（フィボナッチ螺旋）
      const grow = 1 - (1 - u) * (1 - u);
      for (let i = 1; i <= f.n; i++) {
        const rr0 = Math.sqrt(i / f.n) * f.R * grow;
        const ang = i * GOLDEN + f.rot + u * 1.5;
        const s = 1 + 1.4 * (1 - i / f.n);
        g.beginPath();
        g.arc(f.x + Math.cos(ang) * rr0, f.y + Math.sin(ang) * rr0, s * a + 0.4, 0, TAU);
        g.fill();
      }
    } else if (f.kind === 'rose') {
      g.lineWidth = 1.4;
      rosePath(g, f.x, f.y, f.R, f.k, f.rot + u * 1.5, 1 - (1 - u) * (1 - u));
      g.stroke();
    } else if (f.kind === 'spiro') {
      g.lineWidth = 1.1;
      spiroPath(g, f.x, f.y, f.R, 3 + Math.round(u * 0), 2.2, u * 2);
      g.stroke();
    } else if (f.kind === 'sym') {
      // 中心 (cx, cy) のまわりに n 方向 + 鏡像で点を並べて、万華鏡のような模様にする
      const dx = f.x - f.cx;
      const dy = f.y - f.cy;
      const pts = [];
      for (let i = 0; i < f.n; i++) {
        const ang = (i * TAU) / f.n;
        const c = Math.cos(ang);
        const s = Math.sin(ang);
        pts.push([f.cx + dx * c - dy * s, f.cy + dx * s + dy * c]);
        pts.push([f.cx + dx * c + dy * s, f.cy + dx * s - dy * c]);
      }
      const sz = 1 + 2.2 * a;
      for (const [px, py] of pts) {
        g.beginPath();
        g.arc(px, py, sz, 0, TAU);
        g.fill();
      }
      g.lineWidth = 0.8;
      g.globalAlpha = Math.max(0, a * 0.55);
      g.beginPath();
      pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py)));
      g.closePath();
      g.stroke();
    }
  }
  g.restore();
}

// ---- 戦闘の部品 ----
function drawEnemyBody(g, kit, e, t) {
  const sk = kit.skin;
  const { cx, cy } = ARENA;
  const col = kit.enemyColor(e.type, e.x * 0.03 + e.y * 0.02);
  const flash = e.hit > 0;
  const body = flash ? '#ffffff' : col;
  const ang = Math.atan2(cy - e.y, cx - e.x);
  const r = e.r;
  g.save();
  g.translate(e.x, e.y);
  if (sk.enemy === 'geo') {
    kit.glow(g, col, 10);
    g.fillStyle = flash ? '#ffffff' : rgba(col, 0.3);
    g.strokeStyle = body;
    g.lineWidth = 1.8;
    if (e.type === 'runner') {
      g.rotate(ang);
      g.beginPath();
      g.moveTo(r + 3, 0);
      g.lineTo(-r, r);
      g.lineTo(-r * 0.5, 0);
      g.lineTo(-r, -r);
      g.closePath();
    } else if (e.type === 'tank') {
      polyPath(g, 0, 0, r + 1, 6, t * 0.6);
    } else {
      g.rotate(t * 2 + e.x * 0.1);
      rr(g, -r, -r, r * 2, r * 2, 2.5);
    }
    g.fill();
    g.stroke();
    g.shadowBlur = 0;
    g.fillStyle = body;
    g.beginPath();
    g.arc(0, 0, 1.6, 0, TAU);
    g.fill();
  } else if (sk.enemy === 'flat') {
    g.shadowColor = 'rgba(30, 40, 60, 0.28)';
    g.shadowBlur = 6;
    g.shadowOffsetY = 2;
    g.fillStyle = body;
    g.beginPath();
    if (e.type === 'runner') {
      g.rotate(ang);
      g.moveTo(r + 2, 0);
      g.lineTo(-r, r * 0.9);
      g.lineTo(-r, -r * 0.9);
      g.closePath();
    } else g.arc(0, 0, r + 1, 0, TAU);
    g.fill();
    g.shadowColor = 'transparent';
    if (e.type === 'tank') {
      g.strokeStyle = 'rgba(255,255,255,0.7)';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(0, 0, r - 2.5, 0, TAU);
      g.stroke();
    }
    if (e.type !== 'runner') {
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.arc(-2, -1, 1.3, 0, TAU);
      g.arc(2, -1, 1.3, 0, TAU);
      g.fill();
    }
  } else {
    // 墨のにじみ（輪郭がゆらぐ丸）
    g.fillStyle = body;
    g.beginPath();
    const n = 12;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const rad = (r + 1) * (1 + 0.16 * Math.sin(i * 2.3 + t * 5 + e.x * 0.2));
      const px = Math.cos(a) * rad;
      const py = Math.sin(a) * rad;
      if (i) g.lineTo(px, py);
      else g.moveTo(px, py);
    }
    g.closePath();
    g.fill();
    if (e.type === 'tank') {
      g.fillStyle = '#c0392b';
      for (const sx of [-1, 1]) {
        g.beginPath();
        g.moveTo(sx * 3, -r + 1);
        g.lineTo(sx * 7, -r - 5);
        g.lineTo(sx * 8, -r + 2);
        g.closePath();
        g.fill();
      }
    }
    if (e.type === 'runner') {
      g.strokeStyle = 'rgba(122, 59, 46, 0.55)';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(-Math.cos(ang) * (r + 2), -Math.sin(ang) * (r + 2));
      g.lineTo(-Math.cos(ang) * (r + 10), -Math.sin(ang) * (r + 10));
      g.stroke();
    }
    g.fillStyle = '#f6eede';
    g.beginPath();
    g.ellipse(-2, -1, 1.5, 2, 0, 0, TAU);
    g.ellipse(2, -1, 1.5, 2, 0, 0, TAU);
    g.fill();
  }
  g.restore();
}

// 新しい種類の敵の体（小群・分裂・装甲・射手・癒し手・障壁・幽霊・ボス）
const SIDES = { swarm: 3, splitter: 4, armor: 8, shooter: 4, healer: 0, shield: 0, phantom: 0, boss: 8 };
function drawNewEnemy(g, kit, e, t) {
  const sk = kit.skin;
  const { cx, cy } = ARENA;
  const col = kit.enemyColor(e.type, e.x * 0.03 + e.y * 0.02);
  const flash = e.hit > 0;
  const body = flash ? '#ffffff' : col;
  const r = e.r;
  const sides = SIDES[e.type];
  const rot = e.type === 'shooter' || e.type === 'splitter' ? Math.PI / 4 : e.type === 'swarm' ? Math.atan2(cy - e.y, cx - e.x) : t * (e.type === 'boss' ? 0.4 : 0.6) + e.x * 0.05;
  g.save();
  g.translate(e.x, e.y);
  if (sk.enemy === 'geo') {
    kit.glow(g, col, e.type === 'boss' ? 18 : 10);
    g.fillStyle = flash ? '#ffffff' : rgba(col, e.type === 'boss' ? 0.4 : 0.3);
    g.strokeStyle = body;
    g.lineWidth = e.type === 'boss' ? 2.8 : 1.8;
  } else if (sk.enemy === 'flat') {
    g.shadowColor = 'rgba(30, 40, 60, 0.28)';
    g.shadowBlur = 6;
    g.shadowOffsetY = 2;
    g.fillStyle = body;
  } else g.fillStyle = body;
  if (sides >= 3) polyPath(g, 0, 0, r + 1, sides, rot);
  else {
    g.beginPath();
    if (e.type === 'phantom') {
      // ゆらぐ裾のある幽霊
      g.arc(0, -1, r + 1, Math.PI, 0);
      for (let i = 0; i <= 4; i++) g.lineTo((r + 1) - i * (r + 1) * 0.5, r + 1 + (i % 2 ? 2 : -0.5) + Math.sin(t * 8 + i) * 0.8);
      g.closePath();
    } else g.arc(0, 0, r + 1, 0, TAU);
  }
  g.fill();
  if (sk.enemy === 'geo') g.stroke();
  g.shadowBlur = 0;
  g.shadowColor = 'transparent';
  const mark = sk.enemy === 'ink' ? '#f6eede' : sk.enemy === 'flat' ? '#ffffff' : body;
  g.strokeStyle = mark;
  g.fillStyle = mark;
  g.lineWidth = 1.4;
  if (e.type === 'healer') {
    g.fillRect(-1, -r * 0.55, 2, r * 1.1);
    g.fillRect(-r * 0.55, -1, r * 1.1, 2);
  } else if (e.type === 'armor') {
    polyPath(g, 0, 0, r - 2.5, 8, rot);
    g.stroke();
  } else if (e.type === 'shooter') {
    const a = Math.atan2(cy - e.y, cx - e.x);
    g.lineWidth = 2.2;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(Math.cos(a) * (r + 5), Math.sin(a) * (r + 5));
    g.stroke();
  } else if (e.type === 'splitter') {
    g.beginPath();
    g.moveTo(-r * 0.7, -r * 0.7);
    g.lineTo(r * 0.7, r * 0.7);
    g.stroke();
  } else if (e.type === 'boss') {
    // 王冠のトゲと、回る外輪
    g.fillStyle = sk.enemy === 'ink' ? '#c0392b' : kit.c(sk.gold, 4);
    for (let i = -2; i <= 2; i++) {
      g.beginPath();
      g.moveTo(i * 5 - 2.5, -r - 1);
      g.lineTo(i * 5, -r - 7 - (i === 0 ? 3 : 0));
      g.lineTo(i * 5 + 2.5, -r - 1);
      g.closePath();
      g.fill();
    }
    g.strokeStyle = rgba(col, 0.6);
    g.setLineDash([4, 4]);
    g.lineDashOffset = -t * 20;
    g.beginPath();
    g.arc(0, 0, r + 6, 0, TAU);
    g.stroke();
    g.setLineDash([]);
  }
  if (e.type !== 'swarm' && e.type !== 'healer') {
    g.fillStyle = sk.enemy === 'ink' ? '#f6eede' : '#ffffff';
    g.beginPath();
    g.arc(-r * 0.32, -r * 0.1, Math.max(1, r * 0.13), 0, TAU);
    g.arc(r * 0.32, -r * 0.1, Math.max(1, r * 0.13), 0, TAU);
    g.fill();
  }
  // 障壁（バリア）
  if (e.shield > 0) {
    g.strokeStyle = rgba('#7fe0ff', 0.35 + 0.5 * (e.shield / e.shieldMax));
    g.lineWidth = 2;
    g.beginPath();
    g.arc(0, 0, r + 4, 0, TAU);
    g.stroke();
  }
  g.restore();
}

// 敵 1 体の描画（体・精鋭の輪・幽霊の透け・体力バー）
const SPAWN_R = 175; // 敵の出現距離（tree-fort-battle.js の spawn と同じ）。縦長の画面では出現位置が見えるので、ふわっと現す
function drawEnemy(g, kit, e, t) {
  const sk = kit.skin;
  g.save();
  const fade = Math.max(0, Math.min(1, (SPAWN_R - Math.hypot(e.x - ARENA.cx, e.y - ARENA.cy)) / 22));
  g.globalAlpha = fade;
  if (e.phased) g.globalAlpha = fade * (0.22 + 0.08 * Math.sin(t * 10));
  if (e.elite) {
    g.save();
    kit.glow(g, sk.gold, 12);
    g.strokeStyle = rgba(sk.gold, 0.8);
    g.lineWidth = 1.6;
    g.setLineDash([3, 3]);
    g.lineDashOffset = -t * 14;
    g.beginPath();
    g.arc(e.x, e.y, e.r + 4.5, 0, TAU);
    g.stroke();
    g.restore();
  }
  if (e.type === 'grunt' || e.type === 'runner' || e.type === 'tank') drawEnemyBody(g, kit, e, t);
  else drawNewEnemy(g, kit, e, t);
  g.restore();
  const bar = e.type === 'tank' || e.type === 'armor' || e.type === 'shield' || e.type === 'healer' || e.type === 'shooter' || e.elite;
  if (bar && e.hp < e.max && e.type !== 'boss') {
    const w = e.r * 2 + 2;
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(e.x - w / 2, e.y - e.r - 8, w, 2.5);
    g.fillStyle = e.elite ? sk.gold : kit.enemyColor(e.type, 0);
    g.fillRect(e.x - w / 2, e.y - e.r - 8, (w * e.hp) / e.max, 2.5);
  }
}

function hpColor(kit, ratio) {
  const h = kit.skin.hp;
  return ratio > 0.55 ? h[2] : ratio > 0.25 ? h[1] : h[0];
}

function drawTower(g, sc) {
  const { kit, run, clock } = sc;
  const { b } = run;
  const sk = kit.skin;
  const { cx, cy } = ARENA;
  const ratio = b.tower.hp / b.tower.max;
  const col = kit.c(sk.me, 0);
  g.save();
  g.translate(cx, cy);
  // 幾何学: 入れ子の多角形がゆっくり逆回転する
  if (sc.fx === 'geometry') {
    g.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const c = kit.c(sk.branch.def, i);
      g.strokeStyle = rgba(c, 0.55 - i * 0.07);
      if (sk.glow) kit.glow(g, c, 6);
      polyPath(g, 0, 0, 17 + i * 5, 3 + i, clock * (i % 2 ? -0.5 : 0.5) + i);
      g.stroke();
    }
    g.shadowBlur = 0;
  } else if (sc.fx === 'mandala') {
    g.lineWidth = 0.9;
    for (let i = 0; i < 2; i++) {
      const c = kit.c(i ? sk.gold : sk.me, i * 2);
      g.strokeStyle = rgba(c, 0.5);
      if (sk.glow) kit.glow(g, c, 6);
      spiroPath(g, 0, 0, 40 + i * 8, 5, 3.2 + i, clock * (i ? -0.4 : 0.4));
      g.stroke();
    }
    g.shadowBlur = 0;
  }
  // HP の輪
  g.lineWidth = 3;
  g.strokeStyle = rgba(sk.dim, 0.25);
  g.beginPath();
  g.arc(0, 0, 19, 0, TAU);
  g.stroke();
  g.strokeStyle = hpColor(kit, ratio);
  if (sk.glow) kit.glow(g, hpColor(kit, ratio), 8);
  g.beginPath();
  g.arc(0, 0, 19, -Math.PI / 2, -Math.PI / 2 + TAU * ratio);
  g.stroke();
  g.shadowBlur = 0;
  const hit = b.tower.flash > 0;
  if (sk.tower === 'core') {
    kit.glow(g, col, 16);
    g.fillStyle = hit ? '#ffffff' : rgba(col, 0.28);
    g.strokeStyle = hit ? '#ff5470' : col;
    g.lineWidth = 2;
    polyPath(g, 0, 0, 12, 6, clock * 0.8);
    g.fill();
    g.stroke();
    polyPath(g, 0, 0, 7.5, 3, -clock * 1.6);
    g.stroke();
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(0, 0, 2.4 + Math.sin(clock * 6) * 0.7, 0, TAU);
    g.fill();
  } else if (sk.tower === 'flat') {
    g.shadowColor = 'rgba(30, 40, 60, 0.3)';
    g.shadowBlur = 8;
    g.shadowOffsetY = 2;
    g.fillStyle = hit ? '#ffd6d8' : '#ffffff';
    g.beginPath();
    g.arc(0, 0, 12, 0, TAU);
    g.fill();
    g.shadowColor = 'transparent';
    g.lineWidth = 3;
    g.strokeStyle = sk.me;
    g.beginPath();
    g.arc(0, 0, 12, 0, TAU);
    g.stroke();
    g.fillStyle = sk.me;
    g.beginPath();
    g.arc(0, 0, 4.5, 0, TAU);
    g.fill();
  } else {
    // 鳥居
    const red = hit ? '#e8574a' : '#c0392b';
    g.fillStyle = red;
    g.strokeStyle = '#1a1410';
    g.lineWidth = 1.2;
    g.fillRect(-9, -8, 3.4, 18);
    g.fillRect(5.6, -8, 3.4, 18);
    g.strokeRect(-9, -8, 3.4, 18);
    g.strokeRect(5.6, -8, 3.4, 18);
    g.beginPath();
    g.moveTo(-13, -9);
    g.lineTo(13, -9);
    g.lineTo(11, -13);
    g.lineTo(-11, -13);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillRect(-9, -5, 18, 2.6);
    g.strokeRect(-9, -5, 18, 2.6);
    g.fillStyle = '#1a1410';
    g.fillRect(-13, -14, 26, 2);
  }
  g.restore();
}

function jagged(pts, f, amp) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const n = 5;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    for (let j = 0; j < n; j++) {
      const u = j / n;
      const off = j === 0 ? 0 : Math.sin(f.id * 12.9898 + i * 78.233 + j * 37.719 + Math.floor(f.t * 40)) * amp;
      out.push({ x: a.x + dx * u + (-dy / len) * off, y: a.y + dy * u + (dx / len) * off });
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

function drawBolt(g, sc, f) {
  const { kit } = sc;
  const sk = kit.skin;
  const u = f.t / f.life;
  g.save();
  g.globalAlpha = Math.max(0, 1 - u * 0.8);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  let path;
  if (sc.fx === 'geometry') {
    // 2 つの正弦波が干渉する光の線
    path = [];
    for (let i = 0; i < f.pts.length - 1; i++) {
      const a = f.pts[i];
      const b = f.pts[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const n = Math.max(8, Math.round(len / 3));
      for (let j = 0; j <= n; j++) {
        const t = j / n;
        const amp = Math.sin(t * Math.PI) * 6 * (1 - u);
        const w = Math.sin(t * 22 + sc.clock * 30) * 0.6 + Math.sin(t * 13 - sc.clock * 21) * 0.4;
        path.push({ x: a.x + dx * t + (-dy / len) * w * amp, y: a.y + dy * t + (dx / len) * w * amp });
      }
    }
  } else path = jagged(f.pts, f, sk.bolt === 'thin' ? 3 : 5);
  const draw = (lw, color) => {
    g.lineWidth = lw;
    g.strokeStyle = color;
    g.beginPath();
    path.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
    g.stroke();
  };
  if (sk.bolt === 'brush') {
    draw(f.manual ? 3 : 4.5, 'rgba(26, 20, 16, 0.85)');
    draw(1.2, 'rgba(192, 57, 43, 0.9)');
  } else if (sk.bolt === 'thin') {
    draw(f.manual ? 1.5 : 2.2, sk.me);
  } else {
    const c = sk.bolt === 'rainbow' ? kit.hue(f.id, 65) : sk.me;
    kit.glow(g, c, 14);
    draw(f.manual ? 3 : 5, rgba(c, 0.5));
    g.shadowBlur = 0;
    draw(f.manual ? 1 : 1.8, '#ffffff');
  }
  g.restore();
}

// MAX の武器の演出に重ねる、金色の光（爆発・輪は広がる光の輪と火花、雷は金色の太い線）
function drawMaxHalo(g, sc, f) {
  const { kit } = sc;
  const sk = kit.skin;
  const u = f.t / f.life;
  g.save();
  g.globalAlpha = Math.max(0, 1 - u) * 0.8;
  g.strokeStyle = sk.gold;
  g.fillStyle = sk.gold;
  if (sk.glow) kit.glow(g, sk.gold, 14);
  if (f.kind === 'bolt') {
    g.lineWidth = 6 * (1 - u * 0.6);
    g.lineCap = 'round';
    g.globalAlpha *= 0.55;
    g.beginPath();
    f.pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
    g.stroke();
  } else if (f.kind === 'boom' || f.kind === 'ring') {
    const r = f.r * (0.35 + 0.9 * (1 - (1 - u) * (1 - u)));
    g.lineWidth = 3;
    g.beginPath();
    g.arc(f.x, f.y, r * 1.12, 0, TAU);
    g.stroke();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + (f.id || 0);
      g.beginPath();
      g.arc(f.x + Math.cos(a) * r * 1.2, f.y + Math.sin(a) * r * 1.2, 2.2 * (1 - u) + 0.6, 0, TAU);
      g.fill();
    }
  }
  g.restore();
}

function drawBoomDisc(g, sc, f) {
  const { kit } = sc;
  const sk = kit.skin;
  const u = f.t / f.life;
  const r = f.r * (0.35 + 0.9 * (1 - (1 - u) * (1 - u)));
  g.save();
  g.globalAlpha = Math.max(0, 1 - u);
  if (sk.boom === 'ink') {
    g.fillStyle = 'rgba(26, 20, 16, 0.8)';
    g.beginPath();
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU;
      const rad = r * (0.8 + 0.3 * Math.sin(i * 3.1 + f.id));
      i ? g.lineTo(f.x + Math.cos(a) * rad, f.y + Math.sin(a) * rad) : g.moveTo(f.x + Math.cos(a) * rad, f.y + Math.sin(a) * rad);
    }
    g.closePath();
    g.fill();
    g.strokeStyle = '#c0392b';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(f.x, f.y, r * 1.1, 0, TAU);
    g.stroke();
  } else if (sk.boom === 'flat') {
    const tc = TAG_COLOR[f.tag] || sk.gold;
    g.fillStyle = rgba(tc, 0.35);
    g.beginPath();
    g.arc(f.x, f.y, r, 0, TAU);
    g.fill();
    g.strokeStyle = tc;
    g.lineWidth = 2;
    g.stroke();
  } else {
    const c = sk.boom === 'rainbow' ? kit.hue(f.id, 60) : (TAG_COLOR[f.tag] || sk.gold);
    const gr = g.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
    gr.addColorStop(0, '#ffffff');
    gr.addColorStop(0.4, rgba(c, 0.7));
    gr.addColorStop(1, rgba(c, 0));
    g.fillStyle = gr;
    g.beginPath();
    g.arc(f.x, f.y, r, 0, TAU);
    g.fill();
  }
  g.restore();
}

// 背景の幾何模様（演出パックごと。砦を中心に回る）
function drawBackdrop(g, sc) {
  const { kit, clock } = sc;
  const { cx, cy } = ARENA;
  const sk = kit.skin;
  if (sc.fx === 'geometry') {
    g.save();
    g.lineWidth = 0.8;
    for (let i = 0; i < 7; i++) {
      const c = kit.c(sk.me, i);
      g.strokeStyle = rgba(c, sk.bg === 'modern' || sk.bg === 'wa' ? 0.13 : 0.1);
      polyPath(g, cx, cy, 52 + i * 26, 3 + (i % 4), clock * (i % 2 ? -0.07 : 0.07) + i * 0.4);
      g.stroke();
    }
    g.restore();
  } else if (sc.fx === 'mandala') {
    g.save();
    g.lineWidth = 0.7;
    const n = 24;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + clock * 0.05;
      g.strokeStyle = rgba(kit.c(sk.me, i), sk.bg === 'modern' || sk.bg === 'wa' ? 0.12 : 0.1);
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * 30, cy + Math.sin(a) * 30);
      g.lineTo(cx + Math.cos(a) * 230, cy + Math.sin(a) * 230);
      g.stroke();
    }
    g.restore();
  }
}

// ---- 戦闘画面 ----
// 戦場の縦のずれ（ロジックの座標 ARENA は 320 高さのまま。描画と手動攻撃のタップ位置だけを、このずれで変換する）
export const battleOffset = (sc) => Math.max(0, sc.H - 320) / 2;

export function drawBattle(g, sc) {
  const { kit, run, W, H, clock } = sc;
  const { b } = run;
  const sk = kit.skin;
  const { cx, cy } = ARENA;
  g.save();
  if (sc.shake > 0.2) g.translate((Math.random() - 0.5) * sc.shake * 2, (Math.random() - 0.5) * sc.shake * 2);
  kit.bg(g, W, H);
  // 戦場（砦・敵・弾・演出）は、塔が上下の部品の間の中央に来るよう、増えた高さの半分だけ下へずらして描く
  g.translate(0, battleOffset(sc));
  drawBackdrop(g, sc);

  // 射程と結界
  g.save();
  g.lineWidth = 1;
  g.setLineDash([3, 5]);
  g.lineDashOffset = -clock * 8;
  g.strokeStyle = rgba(kit.c(sk.me, 2), sk.bg === 'modern' || sk.bg === 'wa' ? 0.4 : 0.3);
  g.beginPath();
  g.arc(cx, cy, b.stats.range, 0, TAU);
  g.stroke();
  if (b.stats.slow > 0) {
    g.setLineDash([]);
    g.strokeStyle = rgba(sk.branch.eco, 0.18 + 0.1 * Math.sin(clock * 3));
    g.lineWidth = 2;
    g.beginPath();
    g.arc(cx, cy, 75, 0, TAU);
    g.stroke();
  }
  g.restore();

  drawSceneFx(g, sc);
  drawWeaponsUnder(g, sc);
  for (const e of b.enemies) {
    drawEnemy(g, kit, e, clock);
    drawStatus(g, sc, e);
  }
  for (const sh of b.eshots) {
    g.save();
    kit.glow(g, sk.bad, 8);
    g.fillStyle = sk.bad;
    g.beginPath();
    g.arc(sh.x, sh.y, 2.6, 0, TAU);
    g.fill();
    g.strokeStyle = rgba(sk.bad, 0.4);
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(sh.x, sh.y);
    g.lineTo(sh.x - sh.vx * 0.06, sh.y - sh.vy * 0.06);
    g.stroke();
    g.restore();
  }
  drawTower(g, sc);
  drawWeaponsOver(g, sc);

  drawBlades(g, sc);
  // 弾
  for (const s of b.shots) {
    const c = kit.c(s.lance ? sk.gold : sk.me, s.x * 0.05);
    g.save();
    if (s.lance && sk.shot !== 'brush') {
      // 貫通弾: 長い光の槍。貫くたびに太く明るくなり、後ろに残光が伸びる
      const ang = Math.atan2(s.vy, s.vx);
      const grow = 1 + s.passes * 0.45;
      g.translate(s.x, s.y);
      g.rotate(ang);
      g.lineCap = 'round';
      kit.glow(g, c, 16);
      g.strokeStyle = rgba(c, 0.28);
      g.lineWidth = 5 * grow;
      g.beginPath();
      g.moveTo(-34, 0);
      g.lineTo(2, 0);
      g.stroke();
      g.strokeStyle = c;
      g.lineWidth = 2.6 * grow;
      g.beginPath();
      g.moveTo(-17, 0);
      g.lineTo(4, 0);
      g.stroke();
      g.shadowBlur = 0;
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.moveTo(9 + s.passes, 0);
      g.lineTo(2, -2.8 * grow);
      g.lineTo(2, 2.8 * grow);
      g.closePath();
      g.fill();
    } else if (sk.shot === 'streak') {
      kit.glow(g, c, 9);
      g.strokeStyle = c;
      g.lineWidth = 2.2;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(s.x - s.vx * 0.035, s.y - s.vy * 0.035);
      g.lineTo(s.x, s.y);
      g.stroke();
      g.strokeStyle = '#ffffff';
      g.lineWidth = 0.9;
      g.stroke();
    } else if (sk.shot === 'brush') {
      g.strokeStyle = '#1a1410';
      g.lineWidth = 3;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(s.x - s.vx * 0.04, s.y - s.vy * 0.04);
      g.lineTo(s.x, s.y);
      g.stroke();
    } else {
      g.fillStyle = sk.me;
      g.beginPath();
      g.arc(s.x, s.y, 2.4, 0, TAU);
      g.fill();
    }
    g.restore();
  }
  // 雷・爆発・手動攻撃
  for (const f of b.fx) {
    if (f.max) drawMaxHalo(g, sc, f);
    if (f.kind === 'maxPulse') {
      // MAX の大技: 砦から広がる金色の輪
      const u = f.t / f.life;
      g.save();
      g.globalAlpha = Math.max(0, 1 - u);
      g.strokeStyle = sk.gold;
      g.lineWidth = 5 * (1 - u) + 1;
      if (sk.glow) kit.glow(g, sk.gold, 16);
      g.beginPath();
      g.arc(cx, cy, 20 + u * 220, 0, TAU);
      g.stroke();
      g.restore();
    }
    if (f.kind === 'boom') drawBoomDisc(g, sc, f);
    else if (f.kind === 'bolt') drawBolt(g, sc, f);
    else if (f.kind === 'pierce') {
      // 貫いた瞬間: 敵の背後へ走る光の筋と、はじける輪
      const u = f.t / f.life;
      g.save();
      g.translate(f.x, f.y);
      g.rotate(f.a);
      g.globalAlpha = Math.max(0, 1 - u * u);
      const col = kit.c(sk.gold, f.n);
      if (sk.glow) kit.glow(g, col, 14);
      g.strokeStyle = sk.bg === 'wa' ? '#1a1410' : col;
      g.lineCap = 'round';
      for (const k of [-1, 0, 1]) {
        g.lineWidth = k === 0 ? 3 : 1.4;
        g.beginPath();
        g.moveTo(4 + u * 8, k * 3.5);
        g.lineTo(18 + u * 46 * (k === 0 ? 1.4 : 1), k * 3.5 * (1 + u));
        g.stroke();
      }
      g.lineWidth = 1.6;
      g.beginPath();
      g.arc(0, 0, 4 + u * 16, -1.1, 1.1);
      g.stroke();
      g.restore();
    } else if (f.kind === 'ring') {
      const u = f.t / f.life;
      g.save();
      g.globalAlpha = Math.max(0, 1 - u);
      g.strokeStyle = TAG_COLOR[f.tag] || sk.gold;
      g.lineWidth = 2;
      if (sk.glow) kit.glow(g, g.strokeStyle, 8);
      g.beginPath();
      g.arc(f.x, f.y, f.r * (0.2 + 0.8 * (1 - (1 - u) * (1 - u))), 0, TAU);
      g.stroke();
      g.restore();
    } else if (f.kind === 'muzzle') {
      const u = f.t / f.life;
      g.save();
      g.globalAlpha = 1 - u;
      kit.glow(g, kit.c(sk.me, 1), 12);
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.arc(cx + Math.cos(f.a) * 15, cy + Math.sin(f.a) * 15, 3.2 * (1 - u) + 1, 0, TAU);
      g.fill();
      g.restore();
    }
  }
  kit.drawParts(g);

  // ダメージ数字・波の表示
  for (const f of b.fx) {
    const u = f.t / f.life;
    if (f.kind === 'dmg') {
      const size = f.crit ? 14 : 9;
      g.save();
      g.globalAlpha = Math.max(0, 1 - u * u);
      const pop = f.crit ? 1 + 0.5 * Math.max(0, 1 - u * 5) : 1;
      g.translate(f.x, f.y - u * 16);
      g.scale(pop, pop);
      kit.text(g, `${Math.round(f.amount)}${f.crit ? '!' : ''}`, 0, -size / 2, size, f.crit ? sk.gold : sk.text, 'center', f.crit ? 8 : 0);
      g.restore();
    } else if (f.kind === 'wave') {
      const a = Math.min(1, (1 - u) * 2.2) * Math.min(1, u * 8);
      g.save();
      g.globalAlpha = a;
      g.translate(W / 2, 96);
      if (sc.fx === 'geometry') {
        g.strokeStyle = rgba(kit.c(sk.me, 3), 0.7);
        g.lineWidth = 1.2;
        starPath(g, 0, 0, 52 + u * 26, 8, 3, u * 3);
        g.stroke();
        polyPath(g, 0, 0, 38 + u * 10, 6, -u * 2);
        g.stroke();
      } else if (sc.fx === 'mandala') {
        g.strokeStyle = rgba(kit.c(sk.gold, 2), 0.7);
        g.lineWidth = 1;
        spiroPath(g, 0, 0, 80, 5, 3.4, u * 3);
        g.stroke();
      }
      const label = f.boss ? (sk.id === 'wa' ? '大将の波' : 'BOSS WAVE') : sk.id === 'wa' ? `第${f.wave}波` : `WAVE ${f.wave}`;
      const sc2 = 1 + (1 - Math.min(1, u * 6)) * 0.6;
      g.scale(sc2, sc2);
      kit.text(g, label, 0, -14, 26, kit.c(sk.me, 0), 'center', 14);
      g.restore();
    } else if (f.kind === 'levelup') {
      g.save();
      g.globalAlpha = Math.max(0, 1 - u);
      g.strokeStyle = kit.c(sk.gold, 2);
      g.lineWidth = 3;
      if (sk.glow) kit.glow(g, g.strokeStyle, 14);
      g.beginPath();
      g.arc(ARENA.cx, ARENA.cy, 14 + u * 90, 0, TAU);
      g.stroke();
      g.restore();
    } else if (f.kind === 'ultCast') {
      // 大技の発動: 武器名と広がる輪
      const pop = 1 + Math.max(0, 1 - u * 6) * 0.4;
      g.save();
      g.globalAlpha = Math.max(0, Math.min(1, (1 - u) * 2.2));
      g.strokeStyle = f.color;
      g.lineWidth = 3;
      if (sk.glow) kit.glow(g, f.color, 16);
      for (let k = 0; k < 2; k++) {
        g.beginPath();
        g.arc(ARENA.cx, ARENA.cy, 14 + u * (140 + k * 70), 0, TAU);
        g.stroke();
      }
      g.translate(W / 2, 100);
      g.scale(pop, pop);
      kit.text(g, `${f.name}　大技！`, 0, -10, 20, kit.c(sk.gold, 3), 'center', 14);
      g.restore();
    } else if (f.kind === 'weaponMax') {
      // Lv10 到達: 大きな「MAX!」と武器名、広がる輪
      const pop = 1 + Math.max(0, 1 - u * 6) * 0.5;
      g.save();
      g.globalAlpha = Math.max(0, Math.min(1, (1 - u) * 2.2));
      g.strokeStyle = f.color;
      g.lineWidth = 4;
      if (sk.glow) kit.glow(g, f.color, 18);
      for (let k = 0; k < 3; k++) {
        g.beginPath();
        g.arc(ARENA.cx, ARENA.cy, 16 + u * (120 + k * 60), 0, TAU);
        g.stroke();
      }
      g.translate(W / 2, 110);
      g.scale(pop, pop);
      kit.text(g, 'MAX!', 0, -16, 38, kit.c(sk.gold, 3), 'center', 20);
      kit.text(g, f.name, 0, 22, 14, f.color, 'center', 10);
      g.restore();
    } else if (f.kind === 'chest') {
      g.save();
      g.globalAlpha = Math.max(0, 1 - u * u);
      kit.text(g, '宝箱！', f.x, f.y - 14 - u * 18, 12, sk.gold, 'center', 10);
      g.restore();
    } else if (f.kind === 'gotWeapon' || f.kind === 'gotRelic' || f.kind === 'contract') {
      // 名前と説明は、HUD の一言（b.toast）で出す
    } else if (f.kind === 'overdrive') {
      g.save();
      g.globalAlpha = Math.max(0, 1 - u);
      kit.text(g, 'OVERDRIVE!!', W / 2, 150 - u * 20, 24 + u * 8, kit.c(sk.gold, 3), 'center', 16);
      g.restore();
    } else if (f.kind === 'summon' || f.kind === 'split') {
      g.save();
      g.globalAlpha = Math.max(0, 1 - u);
      g.strokeStyle = f.kind === 'summon' ? sk.bad : sk.gold;
      g.lineWidth = 2;
      g.beginPath();
      g.arc(f.x, f.y, 6 + u * 26, 0, TAU);
      g.stroke();
      g.restore();
    } else if (f.kind === 'syn') {
      const pop = 1 + Math.max(0, 1 - u * 6) * 0.6;
      g.save();
      g.globalAlpha = Math.max(0, Math.min(1, (1 - u) * 2));
      g.translate(Math.max(40, Math.min(W - 40, f.x)), Math.max(60, f.y - 16 - u * 14));
      g.scale(pop, pop);
      kit.text(g, `${f.name}！`, 0, -8, 14, kit.c(sk.gold, f.id), 'center', 12);
      g.restore();
    } else if (f.kind === 'clear') {
      g.save();
      g.globalAlpha = Math.max(0, 1 - u * u);
      kit.text(g, sk.id === 'wa' ? `守り切った  +${f.bonus}` : `CLEAR  +${f.bonus} P`, W / 2, 130 - u * 20, 13, sk.gold, 'center', 10);
      g.restore();
    }
  }
  // 連続撃破
  if (sc.combo.n >= 3 && sc.combo.t > 0) {
    const pop = 1 + Math.max(0, sc.combo.pop) * 0.5;
    g.save();
    g.globalAlpha = Math.min(1, sc.combo.t * 2);
    g.translate(W / 2, 214);
    g.scale(pop, pop);
    kit.text(g, sk.id === 'wa' ? `${sc.combo.n}連` : `${sc.combo.n} COMBO`, 0, -9, 17, kit.c(sk.gold, sc.combo.n), 'center', 12);
    g.restore();
  }
  g.restore();

  // 画面の端が赤くなる（耐久が少ない）
  const ratio = b.tower.hp / b.tower.max;
  if (ratio < 0.4) {
    const v = g.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
    v.addColorStop(0, 'rgba(255, 40, 70, 0)');
    v.addColorStop(1, `rgba(255, 40, 70, ${(0.4 - ratio) * (0.7 + 0.3 * Math.sin(clock * 8))})`);
    g.fillStyle = v;
    g.fillRect(0, 0, W, H);
  }

  // 上のバー
  kit.panel(g, { x: 4, y: 3, w: W - 8, h: 24 }, { stroke: kit.c(sk.me, 0), glow: kit.c(sk.me, 0), blur: 5, radius: 8 });
  kit.text(g, sk.id === 'wa' ? `第${b.wave}波` : `W${b.wave}`, 12, 9, 12, sk.text);
  const bx = 52;
  const bw = 78;
  g.save();
  rr(g, bx, 9, bw, 10, 5);
  g.fillStyle = sk.bg === 'wa' || sk.bg === 'modern' ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.1)';
  g.fill();
  const hc = hpColor(kit, ratio);
  rr(g, bx, 9, Math.max(6, bw * ratio), 10, 5);
  kit.glow(g, hc, 8);
  g.fillStyle = hc;
  g.fill();
  g.restore();
  kit.text(g, '耐久', bx + 5, 10, 7.5, '#06081a', 'left', 0);
  kit.text(g, `獲得 +${run.earned()}P`, 135, 10, 10, sk.gold, 'left', 6);
  const armed = sc.retreatUntil > sc.t; // 撤退は、もう一度タップで確定
  kit.button(g, BTN_RETREAT, armed ? 'もう一度' : sk.id === 'wa' ? '退' : '撤退', { color: sk.bad, size: armed ? 9 : 10, active: armed });
  // 波の進み具合: 戦闘中は「倒した割合」、波の合間は「次の波までの時間」
  {
    const left = run.remaining();
    const resting = b.phase === 'rest';
    const prog = resting ? 1 - Math.max(0, b.restT) / (b.wave === 0 ? 1.2 : 1.4) : b.waveTotal ? 1 - left / b.waveTotal : 0;
    const bc = resting ? sk.gold : kit.c(sk.me, 3);
    g.save();
    rr(g, 10, 31, W - 20, 5, 2.5);
    g.fillStyle = sk.bg === 'wa' || sk.bg === 'modern' ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.1)';
    g.fill();
    rr(g, 10, 31, Math.max(5, (W - 20) * Math.max(0, Math.min(1, prog))), 5, 2.5);
    kit.glow(g, bc, 6);
    g.fillStyle = bc;
    g.fill();
    g.restore();
    let label;
    if (resting) label = b.wave === 0 ? 'まもなく開始' : `波クリア！ 次の波まで ${Math.max(0, b.restT).toFixed(1)} 秒`;
    else if (left === 0) label = 'もうすぐクリア';
    else if (b.queue.length) label = sk.id === 'wa' ? `第${b.wave}波　あと ${left} 体（未出現 ${b.queue.length}）` : `WAVE ${b.wave}　あと ${left} 体（未出現 ${b.queue.length}）`;
    else label = sk.id === 'wa' ? `第${b.wave}波　あと ${left} 体` : `WAVE ${b.wave}　あと ${left} 体`;
    kit.text(g, label, W / 2, 39, 9.5, resting ? sk.gold : sk.text, 'center', 3);
  }
  if (b.od.active > 0) {
    const v = g.createRadialGradient(W / 2, H / 2, H * 0.28, W / 2, H / 2, H * 0.72);
    v.addColorStop(0, 'rgba(255, 216, 74, 0)');
    v.addColorStop(1, `rgba(255, 216, 74, ${0.28 + 0.12 * Math.sin(clock * 12)})`);
    g.fillStyle = v;
    g.fillRect(0, 0, W, H);
  }
  drawBattleHud(g, sc);
  if (b.wave <= 1 && b.t < 7) kit.text(g, '敵をタップで追加攻撃', W / 2, H - 56, 11, sk.dim, 'center');

  if (sc.flash.a > 0.01) {
    g.fillStyle = rgba(sc.flash.col, sc.flash.a);
    g.fillRect(0, 0, W, H);
  }
}

// ---- ツリー画面 ----
const nodePos = (sc, n) => ({ x: MAP_CX + sc.pan.x + n.gx * STEP, y: MAP.y + MAP.h / 2 + sc.pan.y + n.gy * STEP });
export const nodeScreenPos = nodePos;

export function nodeState(sc, n) {
  if (sc.save.owned.has(n.id)) return 'owned';
  if (n.req.every((r) => sc.save.owned.has(r))) return sc.save.points >= n.cost ? 'buyable' : 'available';
  return 'locked';
}

export function drawTree(g, sc) {
  const { kit, W, H, clock, save } = sc;
  const sk = kit.skin;
  kit.bg(g, W, H);
  g.save();
  g.beginPath();
  g.rect(MAP.x, MAP.y, MAP.w, MAP.h);
  g.clip();
  kit.stars(g, sc.pan.x, sc.pan.y, MAP);
  // 幾何学・曼荼羅: ツリー全体の背後に回る模様
  if (sc.fx !== 'standard') {
    const c0 = nodePos(sc, NODE.core);
    g.lineWidth = 0.8;
    for (let i = 0; i < 6; i++) {
      g.strokeStyle = rgba(kit.c(sk.me, i), 0.1);
      if (sc.fx === 'geometry') polyPath(g, c0.x, c0.y, 50 + i * 40, 3 + i, clock * 0.05 * (i % 2 ? -1 : 1));
      else starPath(g, c0.x, c0.y, 50 + i * 40, 12, 5 - (i % 3), clock * 0.04 * (i % 2 ? -1 : 1));
      g.stroke();
    }
  }
  // つながり
  for (const n of TREE) {
    const p = nodePos(sc, n);
    for (const r of n.req) {
      const q = nodePos(sc, NODE[r]);
      const open = save.owned.has(r);
      const own = save.owned.has(n.id);
      const c = kit.branchColor(n.id, p.x * 0.04);
      g.save();
      if (own) {
        kit.glow(g, c, 10);
        g.strokeStyle = c;
        g.lineWidth = 3;
      } else {
        g.strokeStyle = open ? rgba(c, 0.5) : rgba(sk.dim, 0.22);
        g.lineWidth = open ? 1.8 : 1.2;
        g.setLineDash(open ? [4, 4] : [2, 5]);
        g.lineDashOffset = open ? -clock * 14 : 0;
      }
      g.beginPath();
      g.moveTo(q.x, q.y);
      g.lineTo(p.x, p.y);
      g.stroke();
      g.restore();
      if (own) {
        // 線の上を光が流れる
        for (let k = 0; k < 2; k++) {
          const u = (clock * 0.6 + k * 0.5 + n.gx * 0.13 + n.gy * 0.11) % 1;
          g.save();
          kit.glow(g, '#ffffff', 8);
          g.fillStyle = sk.bg === 'wa' ? '#fff6e6' : '#ffffff';
          g.beginPath();
          g.arc(q.x + (p.x - q.x) * u, q.y + (p.y - q.y) * u, 2.1, 0, TAU);
          g.fill();
          g.restore();
        }
      }
    }
  }
  // ノード
  for (const n of TREE) {
    const p = nodePos(sc, n);
    if (p.x < -30 || p.x > W + 30 || p.y < MAP.y - 30 || p.y > MAP.y + MAP.h + 30) continue;
    const st = nodeState(sc, n);
    const c = kit.branchColor(n.id, p.x * 0.04);
    const popT = sc.nodePop[n.id];
    const pop = popT === undefined ? 1 : 1 + 0.55 * Math.sin(Math.min(1, popT / 0.45) * Math.PI);
    const pulse = 0.5 + 0.5 * Math.sin(clock * 5 + n.gx);
    g.save();
    g.translate(p.x, p.y);
    g.scale(pop, pop);
    const markSize = 14;
    const big = n.unlock ? NODE_R + 2 : NODE_R;
    if (st === 'owned') {
      // 幾何学・曼荼羅: 取得したノードに装飾
      if (sc.fx === 'geometry') {
        g.strokeStyle = rgba(c, 0.7);
        g.lineWidth = 1;
        polyPath(g, 0, 0, big + 6, 3 + (Math.abs(n.gx + n.gy * 2) % 5), clock * 0.8);
        g.stroke();
      } else if (sc.fx === 'mandala') {
        g.fillStyle = rgba(c, 0.8);
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * TAU + clock * 0.6;
          g.beginPath();
          g.arc(Math.cos(a) * (big + 6), Math.sin(a) * (big + 6), 1.5, 0, TAU);
          g.fill();
        }
      }
      if (sk.node === 'orb') {
        kit.glow(g, c, 16);
        const gr = g.createRadialGradient(-4, -4, 1, 0, 0, big);
        gr.addColorStop(0, '#ffffff');
        gr.addColorStop(0.45, c);
        gr.addColorStop(1, rgba(c, 0.6));
        g.fillStyle = gr;
        g.beginPath();
        g.arc(0, 0, big, 0, TAU);
        g.fill();
        g.shadowBlur = 0;
      } else if (sk.node === 'flat') {
        g.shadowColor = rgba(c, 0.4);
        g.shadowBlur = 8;
        g.shadowOffsetY = 2;
        rr(g, -big, -big, big * 2, big * 2, 8);
        g.fillStyle = c;
        g.fill();
        g.shadowColor = 'transparent';
      } else {
        // 判（はんこ）
        g.fillStyle = c;
        g.beginPath();
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * TAU;
          const rad = big * (1 + 0.06 * Math.sin(i * 5.3 + n.gx * 3));
          i ? g.lineTo(Math.cos(a) * rad, Math.sin(a) * rad) : g.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
        }
        g.closePath();
        g.fill();
        g.strokeStyle = 'rgba(246, 238, 222, 0.6)';
        g.lineWidth = 1;
        g.beginPath();
        g.arc(0, 0, big - 3, 0, TAU);
        g.stroke();
      }
      kit.text(g, n.mark, 0, -markSize / 2 - 1, markSize, sk.node === 'orb' ? '#04061a' : '#fff6e6', 'center');
      if (n.unlock) {
        g.strokeStyle = rgba(c, 0.9);
        g.lineWidth = 1.2;
        g.setLineDash([3, 3]);
        g.lineDashOffset = -clock * 12;
        polyPath(g, 0, 0, big + 5, 6, clock * 0.5);
        g.stroke();
      }
    } else {
      const dim = st === 'locked';
      const fillA = st === 'buyable' ? 0.2 : 0.07;
      if (st === 'buyable') {
        g.strokeStyle = rgba(c, 0.35 + 0.35 * pulse);
        g.lineWidth = 2;
        g.beginPath();
        g.arc(0, 0, big + 3 + pulse * 3, 0, TAU);
        g.stroke();
        kit.glow(g, c, 12);
      }
      if (sk.node === 'flat') rr(g, -big, -big, big * 2, big * 2, 8);
      else {
        g.beginPath();
        g.arc(0, 0, big, 0, TAU);
      }
      g.fillStyle = rgba(sk.bg === 'wa' || sk.bg === 'modern' ? '#ffffff' : c, st === 'buyable' ? (sk.bg === 'wa' || sk.bg === 'modern' ? 0.9 : fillA) : sk.bg === 'wa' || sk.bg === 'modern' ? 0.55 : fillA);
      g.fill();
      g.lineWidth = st === 'buyable' ? 2 : 1.2;
      g.strokeStyle = rgba(st === 'buyable' ? c : dim ? sk.dim : c, st === 'buyable' ? 1 : dim ? 0.4 : 0.6);
      g.stroke();
      g.shadowBlur = 0;
      kit.text(g, n.mark, 0, -markSize / 2 - 1, markSize, rgba(st === 'buyable' ? c : dim ? sk.dim : c, dim ? 0.55 : 1), 'center');
      kit.text(g, `${n.cost}`, 0, big + 3, 9, st === 'buyable' ? sk.gold : st === 'available' ? sk.bad : rgba(sk.dim, 0.7), 'center');
    }
    if (n.id === sc.sel) {
      g.strokeStyle = sk.text;
      g.lineWidth = 1.4;
      g.setLineDash([5, 4]);
      g.lineDashOffset = -clock * 22;
      if (sc.fx === 'geometry') polyPath(g, 0, 0, big + 8, 4, clock * 1.2);
      else {
        g.beginPath();
        g.arc(0, 0, big + 8, 0, TAU);
      }
      g.stroke();
    }
    g.restore();
  }
  drawSceneFx(g, sc);
  kit.drawParts(g);
  g.restore();

  // 上のバー: ポイント・メニューへ戻る・図鑑・OD 工房・ショップ
  kit.panel(g, { x: 4, y: 3, w: 64, h: 24 }, { stroke: sk.gold, glow: sk.gold, blur: 6, radius: 8 });
  kit.button(g, BTN_MENU, 'メニュー', { color: sk.dim, size: 7.5 });
  const pts = `${Math.round(sc.shownPts)}`;
  kit.text(g, pts, 12, 7, 15, sk.gold, 'left', 8);
  kit.text(g, 'P', 14 + kit.measure(g, pts, 15), 11, 10, sk.dim);
  kit.button(g, BTN_ARMORY, '図鑑', { color: sk.me, size: 11 });
  kit.button(g, BTN_ODSHOP, 'OD', { color: sk.gold, size: 11 });
  kit.button(g, BTN_SHOP, 'ショップ', { color: sk.op, size: 10 });

  // 下のパネル
  const n = NODE[sc.sel];
  const st = nodeState(sc, n);
  const c = kit.branchColor(n.id, 0);
  const py = panelY();
  kit.panel(g, { x: 4, y: py, w: W - 8, h: 44 }, { stroke: c, glow: c, blur: 8, radius: 8 });
  kit.text(g, n.name, 12, py + 4, 12, c, 'left', 6);
  if (n.unlock) kit.text(g, `NEW ${UNLOCKS[n.unlock].name}`, W - 12, py + 5, 9, sk.gold, 'right', 6);
  kit.text(g, n.desc, 12, py + 17, 9.5, sk.text);
  let line;
  if (sc.msgT > 0 && sc.msg) line = sc.msg;
  else if (st === 'owned') line = n.id === 'core' ? '開放済み' : `開放済み（戻すと ${n.cost} P 返る）`;
  else line = `必要: ${n.cost} P${st === 'locked' ? '（前の枝が必要）' : ''}`;
  kit.text(g, line, 12, py + 28, 9, sc.msgT > 0 && sc.msg ? sk.bad : sk.dim);

  const owned = save.owned.has(sc.sel);
  const ok = owned ? canRefund(save.owned, sc.sel).ok : canBuy(save.owned, save.points, sc.sel).ok;
  kit.button(g, BTN_BUY, owned ? 'もどす' : 'かいほう', { on: ok, color: owned ? sk.me : sk.gold, size: 13 });
  const gp = 0.5 + 0.5 * Math.sin(clock * 4);
  if (sk.glow) {
    g.save();
    g.strokeStyle = rgba(kit.c(sk.op, 0), 0.25 + 0.4 * gp);
    g.lineWidth = 2;
    rr(g, BTN_GO.x - 2, BTN_GO.y - 2, BTN_GO.w + 4, BTN_GO.h + 4, 8);
    g.stroke();
    g.restore();
  }
  kit.button(g, BTN_GO, '出撃！', { color: sk.op, size: 14, active: true, stamp: true });

  if (sc.flash.a > 0.01) {
    g.fillStyle = rgba(sc.flash.col, sc.flash.a);
    g.fillRect(0, 0, W, H);
  }
  if (sc.t < 5 && save.runs === 0) kit.text(g, 'ドラッグで動かす・タップで選ぶ', W / 2, MAP.y + MAP.h - 6, 9, sk.dim, 'center');
}

// ---- ショップ ----
export function drawShop(g, sc) {
  const { kit, W, H, clock, save, shop } = sc;
  const sk = kit.skin;
  kit.bg(g, W, H);
  kit.stars(g, Math.sin(clock * 0.3) * 40, clock * 6, MAP);
  drawSceneFx(g, sc);
  kit.panel(g, { x: 4, y: 3, w: 146, h: 24 }, { stroke: sk.gold, glow: sk.gold, blur: 6, radius: 8 });
  const pts = `${Math.round(sc.shownPts)}`;
  kit.text(g, pts, 12, 7, 15, sk.gold, 'left', 8);
  kit.text(g, 'P', 14 + kit.measure(g, pts, 15), 11, 10, sk.dim);
  kit.text(g, 'ショップ', W - 10, 8, 14, sk.text, 'right', 6);

  const lay = shopLayout();
  for (const h of lay.headers) kit.text(g, h.label, 10, h.y, 10, sk.dim);
  for (const row of lay.rows) {
    const item = row.type === 'skin' ? SKINS[row.idx] : EFFECTS[row.idx];
    const have = row.type === 'skin' ? save.skinsOwned.has(item.id) : save.fxOwned.has(item.id);
    const equipped = (row.type === 'skin' ? save.skin : save.fx) === item.id;
    const selected = shop.sel === `${row.type}:${item.id}`;
    const r = row.rect;
    const c = kit.c(row.type === 'skin' ? sk.me : sk.op, row.idx * 2);
    kit.panel(g, r, { stroke: selected ? sk.gold : sk.line, glow: selected ? sk.gold : null, blur: 8, radius: 6, lw: selected ? 1.6 : 1 });
    kit.text(g, item.name, r.x + 10, r.y + 4, 12, selected ? sk.gold : sk.text, 'left', selected ? 5 : 0);
    let label;
    let col;
    if (equipped) {
      label = '装備中';
      col = sk.branch.eco;
    } else if (have) {
      label = '所持';
      col = sk.me;
    } else {
      label = `${item.price} P`;
      col = save.points >= item.price ? sk.gold : sk.bad;
    }
    kit.text(g, label, r.x + r.w - 10, r.y + 4, 11, col, 'right');
    if (selected) {
      g.save();
      g.strokeStyle = rgba(c, 0.5);
      g.setLineDash([3, 3]);
      g.lineDashOffset = -clock * 10;
      rr(g, r.x - 2, r.y - 2, r.w + 4, r.h + 4, 7);
      g.stroke();
      g.restore();
    }
  }
  const [type, id] = shop.sel.split(':');
  const item = type === 'skin' ? SKINS.find((s) => s.id === id) : EFFECTS.find((e) => e.id === id);
  const have = type === 'skin' ? save.skinsOwned.has(id) : save.fxOwned.has(id);
  const equipped = (type === 'skin' ? save.skin : save.fx) === id;
  const py = panelY();
  kit.panel(g, { x: 4, y: py, w: W - 8, h: 44 }, { stroke: sk.gold, glow: sk.gold, blur: 8, radius: 8 });
  kit.text(g, `${item.name}${type === 'skin' ? '（スキン）' : '（演出）'}`, 12, py + 4, 12, sk.gold, 'left', 6);
  kit.text(g, item.desc, 12, py + 17, 9.5, sk.text);
  kit.text(g, have ? (equipped ? '装備中です' : '持っています') : `プレビュー中 — ${item.price} P で購入`, 12, py + 29, 9, sk.dim);
  const label = equipped ? '装備中' : have ? '装備する' : '買う';
  const ok = !equipped && (have || save.points >= item.price);
  kit.button(g, BTN_BUY, label, { on: ok, color: have ? sk.me : sk.gold, size: 13 });
  kit.button(g, BTN_GO, 'もどる', { color: sk.op, size: 13 });
  kit.drawParts(g);
  if (sc.flash.a > 0.01) {
    g.fillStyle = rgba(sc.flash.col, sc.flash.a);
    g.fillRect(0, 0, W, H);
  }
}

// ---- 結果 ----
export function drawResult(g, sc, ui) {
  const { kit, W, H, res } = sc;
  const sk = kit.skin;
  g.fillStyle = sk.bg === 'wa' || sk.bg === 'modern' ? 'rgba(240, 235, 225, 0.82)' : 'rgba(3, 5, 20, 0.78)';
  g.fillRect(0, 0, W, H);
  const k = Math.min(1, res.t / 1.2);
  const c = kit.c(sk.me, 0);
  g.save();
  g.translate(0, Math.max(0, H - 320) / 2);
  kit.text(g, res.retreat ? (sk.id === 'wa' ? '撤退' : 'RETREAT') : sk.id === 'wa' ? '落城' : 'RUN END', W / 2, 40, 28, c, 'center', 14);
  kit.text(g, sk.id === 'wa' ? `第 ${Math.round(res.wave * k)} 波` : `WAVE ${Math.round(res.wave * k)}`, W / 2, 82, 22, sk.text, 'center', 6);
  kit.text(g, `獲得  +${Math.round(res.earned * k)} P`, W / 2, 124, 15, sk.gold, 'center', 8);
  kit.text(g, `所持  ${res.total} P`, W / 2, 148, 12, sk.dim, 'center');
  if (res.newBest && res.wave > 0) kit.text(g, 'NEW RECORD!', W / 2, 168, 13, kit.c(sk.gold, 2), 'center', 10);
  g.restore();
  kit.button(g, ui.retry, 'ツリーへ', { color: sk.me, size: 14 });
  kit.button(g, ui.menu, 'メニュー', { color: sk.dim, size: 14 });
  kit.drawParts(g);
}
