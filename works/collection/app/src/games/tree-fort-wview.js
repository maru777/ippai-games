// ツリー砦: 武器の描画（戦闘中の弾・雲・光線など）と「武器庫」画面。状態は持たず、sc（画面の状態）を読んで描く。
import { ARENA } from './tree-fort-battle.js';
import { weaponLevelOf } from './tree-fort-data.js';
import {
  WEAPONS, WEAPON, SYNERGIES, SYNERGY, SLOT_BASE, SLOT_MAX, SLOT_COST, MAX_LEVEL, activeSynergies, weaponCost,
} from './tree-fort-weapons.js';
import { rgba, rr } from './tree-fort-skins.js';

const TAU = Math.PI * 2;

// 属性の色と名前
export const TAG_COLOR = {
  fire: '#ff8a3c', ice: '#8fe8ff', poison: '#8dff6a', lightning: '#7fd6ff', light: '#fff2a0', gravity: '#b48cff',
  physical: '#e8f0ff', machine: '#7affc8', steam: '#ffffff', toxic: '#a6ff3c', burn: '#ff8a3c',
};
export const TAG_NAME = { fire: '火', ice: '氷', poison: '毒', lightning: '雷', light: '光', gravity: '重力', physical: '物理', machine: '機械' };

// ---- 戦闘中の描画 ----
// 地面にあるもの（毒の雲・燃える大地・地雷・重力井戸・流星の予告）。敵より下に描く。
export function drawWeaponsUnder(g, sc) {
  const w = sc.run.b.w;
  const { clock, kit } = sc;
  g.save();
  for (const z of w.zones) {
    const u = z.t / z.life;
    const col = z.kind === 'poison' ? TAG_COLOR.poison : TAG_COLOR.fire;
    const a = Math.min(1, (1 - u) * 2) * (0.75 + 0.25 * Math.sin(clock * 4 + z.x));
    const gr = g.createRadialGradient(z.x, z.y, 0, z.x, z.y, z.r);
    gr.addColorStop(0, rgba(col, 0.38 * a));
    gr.addColorStop(0.8, rgba(col, 0.22 * a));
    gr.addColorStop(1, rgba(col, 0));
    g.fillStyle = gr;
    g.beginPath();
    g.arc(z.x, z.y, z.r, 0, TAU);
    g.fill();
    // 泡・火の粉
    g.fillStyle = rgba(col, 0.55 * a);
    for (let i = 0; i < 5; i++) {
      const ph = (clock * 0.7 + i * 0.37 + z.x * 0.01) % 1;
      const ang = i * 1.9 + z.y;
      g.beginPath();
      g.arc(z.x + Math.cos(ang) * z.r * 0.6 * (0.4 + 0.6 * ((i * 0.31) % 1)), z.y + Math.sin(ang) * z.r * 0.6 - ph * 12, 1.6 * (1 - ph) + 0.4, 0, TAU);
      g.fill();
    }
  }
  for (const m of w.mines) {
    const armed = m.arm <= 0;
    const blink = armed ? 0.5 + 0.5 * Math.sin(clock * 10) : 0.3;
    g.save();
    g.translate(m.x, m.y);
    g.rotate(Math.PI / 4);
    if (kit.skin.glow) kit.glow(g, '#ff5470', 6 * blink);
    g.fillStyle = armed ? rgba('#c9a36a', 0.9) : rgba('#c9a36a', 0.4);
    g.fillRect(-3.4, -3.4, 6.8, 6.8);
    g.fillStyle = rgba('#ff5470', blink);
    g.fillRect(-1.2, -1.2, 2.4, 2.4);
    g.restore();
  }
  for (const wl of w.wells) {
    const u = wl.t / wl.life;
    const a = Math.min(1, (1 - u) * 3, u * 6 + 0.2);
    g.save();
    g.translate(wl.x, wl.y);
    g.globalAlpha = a;
    if (kit.skin.glow) kit.glow(g, TAG_COLOR.gravity, 10);
    g.strokeStyle = TAG_COLOR.gravity;
    g.lineWidth = 1.3;
    // 中心へ巻き込む渦巻き
    for (let k = 0; k < 3; k++) {
      g.beginPath();
      for (let i = 0; i <= 40; i++) {
        const t = i / 40;
        const rad = wl.r * (1 - t) * (0.2 + 0.8 * t) + 2;
        const ang = k * (TAU / 3) + t * 7 - clock * 4;
        i ? g.lineTo(Math.cos(ang) * rad * 1.05, Math.sin(ang) * rad * 1.05) : g.moveTo(Math.cos(ang) * rad * 1.05, Math.sin(ang) * rad * 1.05);
      }
      g.stroke();
    }
    g.fillStyle = '#1a0a3a';
    g.beginPath();
    g.arc(0, 0, 4 + 2 * Math.sin(clock * 8), 0, TAU);
    g.fill();
    g.restore();
  }
  for (const m of w.meteors) {
    if (m.t < 0) continue;
    const u = Math.min(1, m.t / m.delay);
    g.save();
    g.strokeStyle = rgba(TAG_COLOR.fire, 0.4 + 0.5 * u);
    g.lineWidth = 1.2;
    g.setLineDash([3, 3]);
    g.beginPath();
    g.arc(m.x, m.y, m.r * (1.15 - 0.15 * u), 0, TAU);
    g.stroke();
    g.setLineDash([]);
    g.beginPath();
    g.moveTo(m.x - 5, m.y);
    g.lineTo(m.x + 5, m.y);
    g.moveTo(m.x, m.y - 5);
    g.lineTo(m.x, m.y + 5);
    g.stroke();
    g.restore();
  }
  g.restore();
}

// 空中・射出するもの（炎・光線・弾・ドローン・降ってくる隕石）。敵より上に描く。
export function drawWeaponsOver(g, sc) {
  const w = sc.run.b.w;
  const { cx, cy } = ARENA;
  const { clock, kit } = sc;
  const sk = kit.skin;
  g.save();
  for (const f of w.flames) {
    const u = f.t / f.life;
    g.save();
    g.translate(cx, cy);
    g.rotate(f.a);
    const L = f.range * (0.6 + 0.4 * Math.min(1, u * 3));
    const gr = g.createRadialGradient(0, 0, 4, 0, 0, L);
    gr.addColorStop(0, rgba('#fff2a0', 0.9 * (1 - u)));
    gr.addColorStop(0.5, rgba('#ff8a3c', 0.6 * (1 - u)));
    gr.addColorStop(1, rgba('#ff3c2a', 0));
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(0, 0);
    g.arc(0, 0, L, -f.half, f.half);
    g.closePath();
    g.fill();
    g.restore();
  }
  for (const bm of w.beams) {
    const u = bm.t / bm.life;
    const a = 1 - u * u;
    const ex = cx + Math.cos(bm.a) * 240;
    const ey = cy + Math.sin(bm.a) * 240;
    g.save();
    g.lineCap = 'round';
    if (sk.glow) kit.glow(g, TAG_COLOR.light, 14);
    g.strokeStyle = rgba(TAG_COLOR.light, 0.55 * a);
    g.lineWidth = bm.w + 4;
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(ex, ey);
    g.stroke();
    g.shadowBlur = 0;
    g.strokeStyle = rgba('#ffffff', a);
    g.lineWidth = Math.max(1.5, bm.w * 0.45);
    g.stroke();
    g.restore();
  }
  for (const p of w.proj) {
    g.save();
    if (p.kind === 'frost') {
      const ang = Math.atan2(p.vy, p.vx);
      g.translate(p.x, p.y);
      g.rotate(ang);
      if (sk.glow) kit.glow(g, TAG_COLOR.ice, 10);
      g.fillStyle = TAG_COLOR.ice;
      g.beginPath();
      g.moveTo(6, 0);
      g.lineTo(0, 3.2);
      g.lineTo(-5, 0);
      g.lineTo(0, -3.2);
      g.closePath();
      g.fill();
      g.fillStyle = '#ffffff';
      g.fillRect(-1, -0.7, 4, 1.4);
    } else if (p.kind === 'missile') {
      const ang = Math.atan2(p.vy, p.vx);
      // 排気の尾
      g.strokeStyle = rgba('#ffd84a', 0.5);
      g.lineWidth = 2;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(p.x, p.y);
      g.lineTo(p.x - Math.cos(ang) * 11, p.y - Math.sin(ang) * 11);
      g.stroke();
      g.translate(p.x, p.y);
      g.rotate(ang);
      if (sk.glow) kit.glow(g, '#ffb020', 8);
      g.fillStyle = '#ffd84a';
      g.fillRect(-3.5, -1.6, 7, 3.2);
      g.fillStyle = '#ff5a3c';
      g.beginPath();
      g.moveTo(3.5, -1.6);
      g.lineTo(6, 0);
      g.lineTo(3.5, 1.6);
      g.closePath();
      g.fill();
    } else {
      if (sk.glow) kit.glow(g, TAG_COLOR.machine, 8);
      g.fillStyle = p.slow ? TAG_COLOR.ice : p.pierce > 1 ? TAG_COLOR.light : TAG_COLOR.machine;
      g.beginPath();
      g.arc(p.x, p.y, 2.2, 0, TAU);
      g.fill();
    }
    g.restore();
  }
  for (const d of w.drones) {
    g.save();
    g.translate(d.x, d.y);
    g.rotate(clock * 3);
    if (sk.glow) kit.glow(g, TAG_COLOR.machine, 10);
    g.fillStyle = rgba(TAG_COLOR.machine, 0.35);
    g.strokeStyle = TAG_COLOR.machine;
    g.lineWidth = 1.3;
    g.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU;
      i ? g.lineTo(Math.cos(a) * 4.8, Math.sin(a) * 4.8) : g.moveTo(Math.cos(a) * 4.8, Math.sin(a) * 4.8);
    }
    g.closePath();
    g.fill();
    g.stroke();
    g.restore();
  }
  // 降ってくる隕石
  for (const m of w.meteors) {
    if (m.t < 0) continue;
    const u = Math.min(1, m.t / m.delay);
    const h = (1 - u) * 190;
    const x = m.x - h * 0.4;
    const y = m.y - h;
    g.save();
    g.strokeStyle = rgba('#ff8a3c', 0.55);
    g.lineWidth = 3;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x - 0.4 * 26, y - 26);
    g.stroke();
    if (sk.glow) kit.glow(g, '#ff8a3c', 12);
    g.fillStyle = '#ffd89a';
    g.beginPath();
    g.arc(x, y, 5 + 3 * u, 0, TAU);
    g.fill();
    g.restore();
  }
  g.restore();
}

// 回転刃（砦の周りを回る刃）
export function drawBlades(g, sc) {
  const { cx, cy } = ARENA;
  const { kit } = sc;
  const sk = kit.skin;
  for (const bl of sc.run.b.w.blades) {
    g.save();
    const c = sk.bg === 'wa' ? '#1a1410' : kit.c(TAG_COLOR.physical, bl.x * 0.05);
    g.lineCap = 'round';
    for (let k = 0; k < 6; k++) {
      g.strokeStyle = rgba(c, 0.5 - k * 0.08);
      g.lineWidth = 4 - k * 0.5;
      g.beginPath();
      g.arc(cx, cy, Math.hypot(bl.x - cx, bl.y - cy), bl.a - 0.18 * (k + 1), bl.a - 0.18 * k);
      g.stroke();
    }
    if (sk.glow) kit.glow(g, c, 10);
    g.fillStyle = sk.bg === 'wa' ? '#1a1410' : '#ffffff';
    g.beginPath();
    g.arc(bl.x, bl.y, 3.2, 0, TAU);
    g.fill();
    g.restore();
  }
}

// 敵に付いている状態異常の見た目（燃焼・毒・鈍足・凍結）
export function drawStatus(g, sc, e) {
  const { clock } = sc;
  const r = e.r;
  if (e.burn && e.burn.t > 0) {
    g.save();
    g.fillStyle = rgba('#ff8a3c', 0.75);
    for (let i = 0; i < 3; i++) {
      const ph = (clock * 2.2 + i * 0.33 + e.x * 0.02) % 1;
      g.beginPath();
      g.arc(e.x + (i - 1) * 3, e.y - r - ph * 9, 1.8 * (1 - ph) + 0.4, 0, TAU);
      g.fill();
    }
    g.restore();
  }
  if (e.poison && e.poison.t > 0) {
    g.save();
    g.strokeStyle = rgba('#8dff6a', 0.7);
    g.lineWidth = 1;
    for (let i = 0; i < 2; i++) {
      const ph = (clock * 1.2 + i * 0.5 + e.y * 0.03) % 1;
      g.beginPath();
      g.arc(e.x + (i ? 4 : -4), e.y - r - ph * 8, 1.6, 0, TAU);
      g.stroke();
    }
    g.restore();
  }
  if (e.slow && e.slow.t > 0 && !(e.freeze > 0)) {
    g.save();
    g.strokeStyle = rgba('#8fe8ff', 0.6);
    g.lineWidth = 1.2;
    g.beginPath();
    g.arc(e.x, e.y, r + 3, 0, TAU);
    g.stroke();
    g.restore();
  }
  if (e.freeze > 0) {
    g.save();
    g.fillStyle = rgba('#bff3ff', 0.55);
    g.strokeStyle = '#ffffff';
    g.lineWidth = 1.2;
    g.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + 0.5;
      i ? g.lineTo(e.x + Math.cos(a) * (r + 3), e.y + Math.sin(a) * (r + 3)) : g.moveTo(e.x + Math.cos(a) * (r + 3), e.y + Math.sin(a) * (r + 3));
    }
    g.closePath();
    g.fill();
    g.stroke();
    g.restore();
  }
}

// ---- 武器庫 ----
export const ARM_TABS = [
  { id: 'weapons', label: '武器', rect: { x: 8, y: 32, w: 108, h: 20 } },
  { id: 'syn', label: '組み合わせ', rect: { x: 124, y: 32, w: 108, h: 20 } },
];
export const ARM_LIST = { x: 4, y: 56, w: 232, h: 182 };
export const ARM_ROW_H = 26;
export const BTN_ARM_UP = { x: 4, y: 288, w: 90, h: 28 };
export const BTN_ARM_EQ = { x: 98, y: 288, w: 66, h: 28 };
export const BTN_ARM_BACK = { x: 168, y: 288, w: 68, h: 28 };
export const SLOT_STRIP = { x: 96, y: 5, w: 96, h: 20 };

export const armoryItems = (tab) => (tab === 'weapons' ? WEAPONS : SYNERGIES);
export const armoryMaxScroll = (tab) => Math.max(0, armoryItems(tab).length * ARM_ROW_H - ARM_LIST.h + 4);

export function armoryRows(sc) {
  return armoryItems(sc.armory.tab).map((it, i) => ({ id: it.id, rect: { x: 8, y: ARM_LIST.y + 2 + i * ARM_ROW_H - sc.armory.scroll, w: 216, h: 24 } }));
}

// スロットの帯の、i 番目（0 始まり）の四角
export const slotRect = (i) => ({ x: SLOT_STRIP.x + i * 16, y: SLOT_STRIP.y + 2, w: 14, h: 16 });

export function drawArmory(g, sc) {
  const { kit, W, H, clock, save, armory } = sc;
  const sk = kit.skin;
  kit.bg(g, W, H);
  kit.stars(g, Math.sin(clock * 0.3) * 30, clock * 5, { x: 0, y: 30, w: 240, h: 208 });

  // 上のバー: ポイント・スロット・題
  kit.panel(g, { x: 4, y: 3, w: 88, h: 24 }, { stroke: sk.gold, glow: sk.gold, blur: 6, radius: 8 });
  const pts = `${Math.round(sc.shownPts)}`;
  kit.text(g, pts, 11, 7, 15, sk.gold, 'left', 8);
  kit.text(g, 'P', 13 + kit.measure(g, pts, 15), 11, 10, sk.dim);
  for (let i = 0; i < SLOT_MAX; i++) {
    const r = slotRect(i);
    const unlocked = i < save.slots;
    const id = save.loadout[i];
    g.save();
    if (id && unlocked) {
      const c = WEAPON[id].color;
      if (sk.glow) kit.glow(g, c, 8);
      rr(g, r.x, r.y, r.w, r.h, 3);
      g.fillStyle = rgba(c, 0.85);
      g.fill();
    } else if (unlocked) {
      rr(g, r.x, r.y, r.w, r.h, 3);
      g.strokeStyle = rgba(sk.dim, 0.8);
      g.setLineDash([2, 2]);
      g.lineWidth = 1;
      g.stroke();
    } else {
      rr(g, r.x, r.y, r.w, r.h, 3);
      g.fillStyle = rgba(sk.dim, 0.18);
      g.fill();
      kit.text(g, '+', r.x + r.w / 2, r.y + 2, 11, rgba(sk.dim, 0.9), 'center');
    }
    g.restore();
  }
  kit.text(g, '武器庫', W - 8, 8, 13, sk.text, 'right', 6);

  // タブ
  for (const t of ARM_TABS) {
    kit.button(g, t.rect, t.label, { color: sk.me, size: 11, active: armory.tab === t.id });
  }

  // 一覧（はみ出す分は切る）
  g.save();
  g.beginPath();
  g.rect(ARM_LIST.x, ARM_LIST.y, ARM_LIST.w, ARM_LIST.h);
  g.clip();
  const active = activeSynergies(save.loadout);
  const rows = armoryRows(sc);
  const items = armoryItems(armory.tab);
  rows.forEach((row, i) => {
    const r = row.rect;
    if (r.y > ARM_LIST.y + ARM_LIST.h || r.y + r.h < ARM_LIST.y) return;
    const sel = armory.sel === row.id;
    if (armory.tab === 'weapons') {
      const wp = items[i];
      const L = weaponLevelOf(save.owned, save.weapons, wp.id);
      const eq = save.loadout.includes(wp.id) && L > 0;
      const c = wp.color;
      kit.panel(g, r, { stroke: sel ? sk.gold : eq ? c : sk.line, glow: sel ? sk.gold : eq ? c : null, blur: 7, radius: 6, lw: sel ? 1.6 : 1 });
      g.save();
      if (sk.glow && L > 0) kit.glow(g, c, 8);
      g.fillStyle = L > 0 ? c : rgba(sk.dim, 0.5);
      g.beginPath();
      g.arc(r.x + 12, r.y + 12, 5, 0, TAU);
      g.fill();
      g.restore();
      kit.text(g, wp.name, r.x + 24, r.y + 5, 12, L > 0 ? sk.text : sk.dim);
      kit.text(g, wp.tags.map((t) => TAG_NAME[t]).join('・'), r.x + 24 + kit.measure(g, wp.name, 12) + 5, r.y + 8, 8, sk.dim);
      // レベルの四角
      for (let k = 0; k < MAX_LEVEL; k++) {
        g.fillStyle = k < L ? c : rgba(sk.dim, 0.25);
        g.fillRect(r.x + 126 + k * 8, r.y + 8, 6, 8);
      }
      const st = eq ? '装備中' : L > 0 ? `Lv${L}` : `${wp.cost[0]} P`;
      kit.text(g, st, r.x + r.w - 6, r.y + 6, 10, eq ? sk.branch.eco : L > 0 ? sk.me : save.points >= wp.cost[0] ? sk.gold : sk.bad, 'right');
    } else {
      const sy = items[i];
      const on = active.has(sy.id);
      kit.panel(g, r, { stroke: sel ? sk.gold : on ? sk.gold : sk.line, glow: sel ? sk.gold : on ? sk.gold : null, blur: 7, radius: 6, lw: sel ? 1.6 : 1 });
      kit.text(g, sy.name, r.x + 8, r.y + 5, 12, on ? sk.gold : sk.text, 'left', on ? 5 : 0);
      const need = sy.needs.map((n) => (n.startsWith('tag:') ? `${TAG_NAME[n.slice(4)]}属性` : WEAPON[n].name)).join(' + ');
      kit.text(g, need, r.x + r.w - 6, r.y + 7, 9, on ? sk.gold : sk.dim, 'right');
    }
  });
  g.restore();
  // スクロールの印
  const max = armoryMaxScroll(armory.tab);
  if (max > 0) {
    const th = Math.max(16, (ARM_LIST.h * ARM_LIST.h) / (ARM_LIST.h + max));
    const ty = ARM_LIST.y + ((ARM_LIST.h - th) * armory.scroll) / max;
    g.fillStyle = rgba(sk.dim, 0.45);
    g.fillRect(ARM_LIST.x + ARM_LIST.w - 3, ty, 2, th);
  }

  // 下の説明
  kit.panel(g, { x: 4, y: 241, w: W - 8, h: 44 }, { stroke: sk.gold, glow: sk.gold, blur: 8, radius: 8 });
  if (armory.tab === 'weapons') {
    const wp = WEAPON[armory.sel];
    const L = weaponLevelOf(save.owned, save.weapons, wp.id);
    kit.text(g, wp.name, 12, 245, 12, wp.color, 'left', 6);
    kit.text(g, wp.desc, 12 + kit.measure(g, wp.name, 12) + 8, 248, 8.5, sk.dim);
    const cur = L > 0 ? `Lv${L}: ${wp.levels[L - 1]}` : '未解放';
    kit.text(g, cur, 12, 259, 9, sk.text);
    const next = L < MAX_LEVEL ? `次 Lv${L + 1}: ${wp.levels[L]}（${weaponCost(wp.id, L + 1)} P）` : 'MAX';
    kit.text(g, next, 12, 270, 9, sk.dim);
  } else {
    const sy = SYNERGY[armory.sel];
    const on = active.has(sy.id);
    kit.text(g, sy.name, 12, 245, 12, sk.gold, 'left', 6);
    kit.text(g, on ? '発動中' : 'そろえば発動', W - 12, 247, 9, on ? sk.branch.eco : sk.dim, 'right');
    kit.text(g, sy.desc, 12, 261, 9, sk.text);
  }
  if (sc.msgT > 0 && sc.msg) kit.text(g, sc.msg, W / 2, 232, 9.5, sk.bad, 'center', 4);

  // ボタン
  if (armory.tab === 'weapons') {
    const wp = WEAPON[armory.sel];
    const L = weaponLevelOf(save.owned, save.weapons, wp.id);
    const cost = L < MAX_LEVEL ? weaponCost(wp.id, L + 1) : 0;
    const upLabel = L >= MAX_LEVEL ? 'MAX' : L === 0 ? `解放 ${cost}P` : `強化 ${cost}P`;
    kit.button(g, BTN_ARM_UP, upLabel, { on: L < MAX_LEVEL && save.points >= cost, color: sk.gold, size: 11 });
    const eq = save.loadout.includes(wp.id);
    kit.button(g, BTN_ARM_EQ, eq ? '外す' : '装備', { on: L > 0, color: eq ? sk.bad : sk.me, size: 12 });
  } else {
    kit.button(g, BTN_ARM_UP, '―', { on: false, color: sk.gold, size: 11 });
    kit.button(g, BTN_ARM_EQ, '―', { on: false, color: sk.me, size: 12 });
  }
  kit.button(g, BTN_ARM_BACK, 'もどる', { color: sk.op, size: 12 });
  kit.drawParts(g);
  if (sc.flash.a > 0.01) {
    g.fillStyle = rgba(sc.flash.col, sc.flash.a);
    g.fillRect(0, 0, W, H);
  }
}

export { SLOT_BASE, SLOT_COST, SLOT_MAX };
