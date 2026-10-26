// ツリー砦: OD 工房の画面（戦闘の外で、OD のタイプを選び、強化を買う）。状態は持たず、sc（画面の状態）を読んで描く。
import { BTN_BUY, BTN_GO, MAP, drawSceneFx } from './tree-fort-view.js';
import { OD_TYPES, OD_TYPE, OD_UPGRADES, OD_UPGRADE, OD_MAX_LV, OD_BASE_SEC, odCost } from './tree-fort-od.js';
import { rgba, rr } from './tree-fort-skins.js';
import { drawIcon } from './tree-fort-icons.js';

const dh = (sc) => Math.max(0, sc.H - 320);

// 行の位置（タイプ 4 つ + 強化 3 つ）。増えた高さは、強化の段と下の説明パネルへ配る。
export function odRows(sc) {
  const ex = Math.round(dh(sc) * 0.25);
  const rows = [];
  OD_TYPES.forEach((t, i) => rows.push({ kind: 'type', id: t.id, rect: { x: 8, y: 46 + i * 23, w: 224, h: 21 } }));
  OD_UPGRADES.forEach((u, i) => rows.push({ kind: 'up', id: u.id, rect: { x: 8, y: 160 + ex + i * 23, w: 224, h: 21 } }));
  return { rows, headers: [{ y: 32, label: 'OD のタイプ（1 つ装備）' }, { y: 146 + ex, label: 'OD の強化（ポイント）' }] };
}

// 現在の強化 Lv での、効果の説明
const upNow = (id, lv) => ({ dur: `${OD_BASE_SEC + lv} 秒`, charge: `充電 ×${(1 + 0.15 * lv).toFixed(2)}`, power: `ダメージ ×${(1 + 0.06 * lv).toFixed(2)}` }[id]);

export function drawOdShop(g, sc) {
  const { kit, W, H, clock, save } = sc;
  const sk = kit.skin;
  const od = save.od;
  const sel = sc.od.sel;
  kit.bg(g, W, H);
  kit.stars(g, Math.sin(clock * 0.3) * 40, clock * 6, MAP);
  drawSceneFx(g, sc);
  kit.panel(g, { x: 4, y: 3, w: 146, h: 24 }, { stroke: sk.gold, glow: sk.gold, blur: 6, radius: 8 });
  const pts = `${Math.round(sc.shownPts)}`;
  kit.text(g, pts, 12, 7, 15, sk.gold, 'left', 8);
  kit.text(g, 'P', 14 + kit.measure(g, pts, 15), 11, 10, sk.dim);
  kit.text(g, 'OD 工房', W - 10, 8, 14, sk.text, 'right', 6);

  const lay = odRows(sc);
  for (const h of lay.headers) kit.text(g, h.label, 10, h.y, 10, sk.dim);
  for (const row of lay.rows) {
    const r = row.rect;
    const selected = sel === `${row.kind}:${row.id}`;
    kit.panel(g, r, { stroke: selected ? sk.gold : sk.line, glow: selected ? sk.gold : null, blur: 8, radius: 6, lw: selected ? 1.6 : 1 });
    if (row.kind === 'type') {
      const t = OD_TYPE[row.id];
      const have = od.owned.includes(row.id);
      const equipped = od.type === row.id;
      g.save();
      if (sk.glow) kit.glow(g, t.color, 6);
      drawIcon(g, 'lightning', r.x + 14, r.y + 10.5, 15, t.color, 2);
      g.restore();
      kit.text(g, t.name, r.x + 28, r.y + 4, 12, selected ? sk.gold : sk.text, 'left', selected ? 5 : 0);
      let label;
      let col;
      if (equipped) {
        label = '装備中';
        col = sk.branch.eco;
      } else if (have) {
        label = '所持';
        col = sk.me;
      } else {
        label = `${t.price} P`;
        col = save.points >= t.price ? sk.gold : sk.bad;
      }
      kit.text(g, label, r.x + r.w - 10, r.y + 4, 11, col, 'right');
    } else {
      const u = OD_UPGRADE[row.id];
      const lv = od.lv[row.id];
      kit.text(g, u.name, r.x + 10, r.y + 4, 12, selected ? sk.gold : sk.text, 'left', selected ? 5 : 0);
      // Lv の目盛り
      for (let i = 0; i < OD_MAX_LV; i++) {
        g.fillStyle = i < lv ? sk.gold : rgba(sk.dim, 0.35);
        g.fillRect(r.x + 90 + i * 11, r.y + 8, 8, 6);
      }
      const c = odCost(od, 'up', row.id);
      kit.text(g, c === null ? '最大' : `${c} P`, r.x + r.w - 10, r.y + 4, 11, c === null ? sk.branch.eco : save.points >= c ? sk.gold : sk.bad, 'right');
    }
    if (selected) {
      g.save();
      g.strokeStyle = rgba(sk.gold, 0.5);
      g.setLineDash([3, 3]);
      g.lineDashOffset = -clock * 10;
      rr(g, r.x - 2, r.y - 2, r.w + 4, r.h + 4, 7);
      g.stroke();
      g.restore();
    }
  }

  // 説明パネル
  const [kind, id] = sel.split(':');
  const py = 241 + dh(sc);
  kit.panel(g, { x: 4, y: py, w: W - 8, h: 44 }, { stroke: sk.gold, glow: sk.gold, blur: 8, radius: 8 });
  let label;
  let ok;
  if (kind === 'type') {
    const t = OD_TYPE[id];
    const have = od.owned.includes(id);
    const equipped = od.type === id;
    kit.text(g, `OD「${t.name}」`, 12, py + 4, 12, t.color, 'left', 6);
    kit.text(g, t.desc, 12, py + 17, 9.5, sk.text);
    kit.text(g, `発動の瞬間: ${t.start}`, 12, py + 29, 9, sk.dim);
    label = equipped ? '装備中' : have ? '装備する' : '買う';
    ok = !equipped && (have || save.points >= t.price);
  } else {
    const u = OD_UPGRADE[id];
    const lv = od.lv[id];
    kit.text(g, `${u.name}（${u.unit} / Lv）`, 12, py + 4, 12, sk.gold, 'left', 6);
    kit.text(g, u.desc, 12, py + 17, 9, sk.text);
    kit.text(g, lv >= OD_MAX_LV ? `いま ${upNow(id, lv)}（最大）` : `いま ${upNow(id, lv)} → ${upNow(id, lv + 1)}`, 12, py + 29, 9, sk.dim);
    const c = odCost(od, 'up', id);
    label = c === null ? '最大' : '強化する';
    ok = c !== null && save.points >= c;
  }
  kit.button(g, BTN_BUY, label, { on: ok, color: sk.gold, size: 13 });
  kit.button(g, BTN_GO, 'もどる', { color: sk.op, size: 13 });
  kit.drawParts(g);
  if (sc.flash.a > 0.01) {
    g.fillStyle = rgba(sc.flash.col, sc.flash.a);
    g.fillRect(0, 0, W, H);
  }
}
