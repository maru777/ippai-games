// ツリー砦: 出撃前に、開始装備（出撃時に持つ武器）を選ぶ画面。ツリーの「武器庫」（st1）を取ると、ステージ選択のあとに挟まる。
// 状態は持たず、sc（画面の状態）を読んで描く。タップの判定に使う位置は loadoutCards から。
import { BTN_BUY, BTN_GO, MAP, drawSceneFx } from './tree-fort-view.js';
import { WEAPONS, WEAPON } from './tree-fort-weapons.js';
import { TREE_WEAPON_NODE } from './tree-fort-data.js';
import { attrChips } from './tree-fort-panelview.js';
import { rgba, rr } from './tree-fort-skins.js';
import { drawIcon } from './tree-fort-icons.js';

const dh = (sc) => Math.max(0, sc.H - 320);

// 武器 12 種のカード（2 列）。unlocked = ツリーで解放済みか
export function loadoutCards(sc) {
  const ex = Math.round(dh(sc) * 0.15);
  return WEAPONS.map((w, i) => ({
    id: w.id,
    unlocked: sc.save.owned.has(TREE_WEAPON_NODE[w.id]),
    rect: { x: 8 + (i % 2) * 116, y: 50 + ex + Math.floor(i / 2) * 31, w: 108, h: 29 },
  }));
}

export function drawLoadout(g, sc) {
  const { kit, W, H, clock } = sc;
  const sk = kit.skin;
  const lo = sc.loadout;
  kit.bg(g, W, H);
  kit.stars(g, Math.sin(clock * 0.3) * 40, clock * 6, MAP);
  drawSceneFx(g, sc);
  kit.panel(g, { x: 4, y: 3, w: 146, h: 24 }, { stroke: sk.gold, glow: sk.gold, blur: 6, radius: 8 });
  kit.text(g, `${lo.sel.length} / ${lo.slots}`, 12, 7, 15, sk.gold, 'left', 8);
  kit.text(g, '装備', 14 + kit.measure(g, `${lo.sel.length} / ${lo.slots}`, 15), 11, 10, sk.dim);
  kit.text(g, '開始装備を選ぶ', W - 10, 8, 14, sk.text, 'right', 6);
  kit.text(g, `出撃で持つ武器を、${lo.slots} つまで選ぶ`, W / 2, 34, 8.5, sk.dim, 'center');

  for (const c of loadoutCards(sc)) {
    const r = c.rect;
    const def = WEAPON[c.id];
    const on = lo.sel.includes(c.id);
    const info = lo.info === c.id;
    g.save();
    g.globalAlpha = c.unlocked ? 1 : 0.4;
    kit.panel(g, r, { stroke: on ? sk.gold : info ? sk.me : sk.line, glow: on ? sk.gold : null, blur: 8, radius: 6, lw: on ? 1.8 : 1 });
    if (on) {
      g.fillStyle = rgba(sk.gold, 0.12);
      rr(g, r.x, r.y, r.w, r.h, 6);
      g.fill();
    }
    drawIcon(g, c.id, r.x + 15, r.y + r.h / 2, 20, def.color, 1.8);
    kit.text(g, def.name, r.x + 30, r.y + 3, 10.5, on ? sk.gold : sk.text, 'left', on ? 4 : 0);
    if (c.unlocked) attrChips(g, kit, r.x + 30, r.y + 16, def.tags, 7);
    else kit.text(g, '未解放', r.x + 30, r.y + 17, 8, sk.dim);
    if (on) kit.text(g, '✔', r.x + r.w - 10, r.y + 4, 11, sk.gold, 'center', 4);
    g.restore();
  }

  // 説明（最後にタップした武器）
  const py = 241 + dh(sc);
  kit.panel(g, { x: 4, y: py, w: W - 8, h: 44 }, { stroke: sk.gold, glow: sk.gold, blur: 8, radius: 8 });
  if (lo.info) {
    const def = WEAPON[lo.info];
    kit.text(g, def.name, 12, py + 4, 12, sk.gold, 'left', 6);
    kit.text(g, def.desc, 12, py + 18, 9, sk.text);
    kit.text(g, def.levels[0], 12, py + 30, 8.5, sk.dim);
  } else {
    kit.text(g, '武器をタップして、選ぶ・外す', 12, py + 7, 11, sk.text);
    kit.text(g, '未解放は、ツリーの「武器庫」の枝で', 12, py + 24, 8.5, sk.dim);
  }
  if (sc.msgT > 0 && sc.msg) kit.text(g, sc.msg, W / 2, py - 13, 9.5, sk.bad, 'center', 4);
  kit.button(g, BTN_BUY, '出撃！', { on: lo.sel.length > 0, color: sk.gold, size: 14, active: lo.sel.length > 0 });
  kit.button(g, BTN_GO, 'もどる', { color: sk.op, size: 13 });
  kit.drawParts(g);
  if (sc.flash.a > 0.01) {
    g.fillStyle = rgba(sc.flash.col, sc.flash.a);
    g.fillRect(0, 0, W, H);
  }
}
