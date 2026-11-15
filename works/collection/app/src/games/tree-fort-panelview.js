// ツリー砦: 戦闘中に開く 2 つのパネル（戦闘は止まる）。
//   武器パネル: HUD の武器アイコンをタップ → その武器の要素 5 つ（現在値・前のレベルからの増減・次の値・Lv10 までの進み具合）と属性
//   ステータス画面: HUD の「ステータス」ボタン → 砦の強さ（初期・ツリー・この挑戦での増減）、属性、遺物、契約、OD
// 状態は持たず、sc（画面の状態）と b（戦闘）を読んで描く。
import { WEAPON } from './tree-fort-weapons.js';
import { weaponElements } from './tree-fort-elements.js';
import { BASE_STATS } from './tree-fort-data.js';
import { RELIC, CONTRACT } from './tree-fort-meta.js';
import { TAG_COLOR, TAG_NAME } from './tree-fort-wview.js';
import { rgba, rr } from './tree-fort-skins.js';
import { drawIcon } from './tree-fort-icons.js';

const TAU = Math.PI * 2;

// 属性（火・氷など）の小さなラベル。(x, y) が左上。幅を返す。
export function attrChip(g, kit, x, y, tag, size = 8.5) {
  const label = TAG_NAME[tag] || tag;
  const w = kit.measure(g, label, size) + 8;
  g.save();
  g.fillStyle = rgba(TAG_COLOR[tag] || '#ffffff', 0.22);
  rr(g, x, y, w, size + 4, 3);
  g.fill();
  g.strokeStyle = TAG_COLOR[tag] || '#ffffff';
  g.lineWidth = 1;
  rr(g, x, y, w, size + 4, 3);
  g.stroke();
  g.restore();
  kit.text(g, label, x + 4, y + 1.5, size, TAG_COLOR[tag] || '#ffffff', 'left', 0);
  return w;
}
export function attrChips(g, kit, x, y, tags, size = 8.5) {
  let cx = x;
  for (const t of tags) cx += attrChip(g, kit, cx, y, t, size) + 3;
  return cx - x;
}

// ---- 位置 ----
export const panelRect = (sc) => ({ x: 6, y: 18, w: sc.W - 12, h: sc.H - 36 });
export const closeRect = (sc) => {
  const p = panelRect(sc);
  return { x: p.x + p.w / 2 - 46, y: p.y + p.h - 30, w: 92, h: 24 };
};
export const listRect = (sc) => {
  const p = panelRect(sc);
  return { x: p.x + 4, y: p.y + 30, w: p.w - 8, h: p.h - 66 };
};

// ---- ステータスの行 ----
const n1 = (v) => `${Math.round(v * 10) / 10}`;
const STAT_LINES = [
  ['砦', null],
  ['耐久（HP）', 'hp', (v) => n1(v), (b) => `いま ${Math.ceil(b.tower.hp)} / ${Math.ceil(b.tower.max)}`],
  ['攻撃力', 'dmg', n1],
  ['連射速度', 'rate', (v) => `${n1(v)} 回/秒`],
  ['射程', 'range', (v) => `${Math.round(v)}`],
  ['同時に狙う数', 'targets', (v) => `${Math.round(v)}`],
  ['貫通', 'pierce', (v) => `${Math.round(v)}`],
  ['会心率', 'crit', (v) => `${Math.round(v * 100)}%`],
  ['修復', 'regen', (v) => `${n1(v)} /秒`],
  ['ダメージ軽減', 'reduce', (v) => `${Math.round(v * 100)}%`],
  ['吸収（撃破で回復）', 'leech', n1],
  ['敵の減速（近く）', 'slow', (v) => `${Math.round(v * 100)}%`],
  ['成長・報酬', null],
  ['経験値', 'xpMul', (v) => `×${Math.round(v * 100) / 100}`],
  ['レベルアップの選択肢', 'choices', (v) => `${Math.round(v)} つ`],
  ['獲得ポイント', 'pointMul', (v) => `+${Math.round(v * 100)}%`],
  ['波ボーナス', 'waveBonus', (v) => `+${Math.round(v)}`],
  ['武器の素質', 'weaponLv', (v) => `最初から Lv${1 + Math.floor(v)}`],
];

// 行の一覧（スクロールする）。h = その行の高さ。
export function statusRows(b) {
  const rows = [];
  const base = BASE_STATS;
  for (const [name, key, fmt, extra] of STAT_LINES) {
    if (!key) {
      rows.push({ t: 'head', text: name, h: 18 });
      continue;
    }
    const now = b.stats[key];
    const s0 = b.stats0[key] ?? now;
    const tree = s0 - (base[key] ?? 0);
    const run = now - s0;
    const plain = (v) => fmt(v).replace(/^\+/, ''); // 値の先頭の + は、増減の記号と重ならないよう外す
    const parts = [`初期 ${plain(base[key] ?? 0)}`];
    if (Math.abs(tree) > 1e-9) parts.push(`ツリー ${tree > 0 ? '+' : '−'}${plain(Math.abs(tree))}`);
    if (Math.abs(run) > 1e-9) parts.push(`この挑戦 ${run > 0 ? '+' : '−'}${plain(Math.abs(run))}`);
    rows.push({ t: 'stat', name, value: fmt(now), detail: parts.join(' / ') + (extra ? `　${extra(b)}` : ''), up: Math.abs(tree) + Math.abs(run) > 1e-9, h: 27 });
  }
  rows.push({ t: 'head', text: '武器（タップで要素を見る）', h: 18 });
  for (const w of b.loadout) rows.push({ t: 'weapon', id: w.id, level: w.level, h: 22 });
  rows.push({ t: 'head', text: '属性ダメージ（遺物・組み合わせで強くなる）', h: 18 });
  const tags = Object.keys(TAG_NAME);
  rows.push({ t: 'attrs', tags: tags.map((k) => ({ k, v: b.tagMul[k] || 1 })), h: 34 });
  rows.push({ t: 'head', text: `遺物（${b.relics.length}）`, h: 18 });
  if (!b.relics.length) rows.push({ t: 'note', text: 'まだ持っていません（精鋭の敵が宝箱を落とします）', h: 18 });
  for (const id of b.relics) rows.push({ t: 'relic', id, h: 27 });
  rows.push({ t: 'head', text: `契約（${b.contracts.length}）`, h: 18 });
  if (!b.contracts.length) rows.push({ t: 'note', text: 'まだ結んでいません', h: 18 });
  for (const id of b.contracts) rows.push({ t: 'contract', id, h: 27 });
  rows.push({ t: 'head', text: 'OD（オーバードライブ）', h: 18 });
  rows.push({ t: 'od', h: 27 });
  return rows;
}
export const statusHeight = (b) => statusRows(b).reduce((a, r) => a + r.h, 0);
// 行の位置（スクロールを引いた y）。タップの判定にも使う。
export function statusLayout(sc, b, scroll) {
  const lr = listRect(sc);
  let y = lr.y - scroll;
  return statusRows(b).map((r) => {
    const out = { ...r, rect: { x: lr.x, y, w: lr.w, h: r.h } };
    y += r.h;
    return out;
  });
}

function frame(g, sc, title) {
  const { kit, W, H } = sc;
  const sk = kit.skin;
  g.fillStyle = sk.bg === 'wa' || sk.bg === 'modern' ? 'rgba(240, 235, 225, 0.86)' : 'rgba(2, 4, 16, 0.86)';
  g.fillRect(0, 0, W, H);
  const p = panelRect(sc);
  kit.panel(g, p, { stroke: sk.gold, glow: sk.gold, blur: 10, radius: 10, lw: 1.4 });
  kit.text(g, title, p.x + 10, p.y + 7, 14, sk.gold, 'left', 6);
  return { p, sk };
}

// ---- ステータス画面 ----
export function drawStatusPanel(g, sc) {
  const { kit } = sc;
  const b = sc.run.b;
  const { p, sk } = frame(g, sc, 'ステータス');
  kit.text(g, `Lv ${b.level}　WAVE ${b.wave}`, p.x + p.w - 10, p.y + 9, 10, sk.dim, 'right');
  const lr = listRect(sc);
  g.save();
  g.beginPath();
  g.rect(lr.x, lr.y, lr.w, lr.h);
  g.clip();
  for (const row of statusLayout(sc, b, sc.panel.scroll)) {
    const r = row.rect;
    if (r.y + r.h < lr.y || r.y > lr.y + lr.h) continue;
    if (row.t === 'head') {
      kit.text(g, row.text, r.x + 2, r.y + 4, 10, sk.gold, 'left', 0);
      g.strokeStyle = rgba(sk.gold, 0.35);
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(r.x, r.y + r.h - 1.5);
      g.lineTo(r.x + r.w, r.y + r.h - 1.5);
      g.stroke();
    } else if (row.t === 'stat') {
      kit.text(g, row.name, r.x + 4, r.y + 2, 11, sk.text);
      kit.text(g, row.value, r.x + r.w - 4, r.y + 2, 12, row.up ? sk.gold : sk.text, 'right', row.up ? 4 : 0);
      kit.text(g, row.detail, r.x + 4, r.y + 15, 8, sk.dim);
    } else if (row.t === 'weapon') {
      const def = WEAPON[row.id];
      drawIcon(g, row.id, r.x + 12, r.y + 11, 17, def.color, 1.8);
      kit.text(g, `${def.name}　Lv${row.level}${row.level >= 10 ? ' MAX' : ''}`, r.x + 28, r.y + 4, 11, sk.text);
      attrChips(g, kit, r.x + r.w - 4 - 2 - def.tags.reduce((a, t) => a + kit.measure(g, TAG_NAME[t] || t, 8.5) + 11, 0), r.y + 4, def.tags);
    } else if (row.t === 'attrs') {
      let x = r.x + 2;
      for (const t of row.tags) {
        const w = 27;
        g.fillStyle = rgba(TAG_COLOR[t.k] || '#ffffff', t.v > 1 ? 0.25 : 0.08);
        rr(g, x, r.y + 2, w, 28, 3);
        g.fill();
        kit.text(g, TAG_NAME[t.k], x + w / 2, r.y + 5, 8.5, TAG_COLOR[t.k] || '#ffffff', 'center', 0);
        kit.text(g, `×${Math.round(t.v * 100) / 100}`, x + w / 2, r.y + 17, 8.5, t.v > 1 ? sk.gold : sk.dim, 'center');
        x += w + 2;
      }
    } else if (row.t === 'relic') {
      const rl = RELIC[row.id];
      drawIcon(g, 'relic', r.x + 12, r.y + 13, 16, rl.color, 1.8);
      kit.text(g, rl.name, r.x + 28, r.y + 2, 11, sk.text);
      kit.text(g, rl.desc, r.x + 28, r.y + 15, 8, sk.dim);
    } else if (row.t === 'contract') {
      const ct = CONTRACT[row.id];
      drawIcon(g, 'contract', r.x + 12, r.y + 13, 16, ct.color, 1.8);
      kit.text(g, ct.name, r.x + 28, r.y + 2, 11, sk.text);
      kit.text(g, `代償: ${ct.give}　報酬: ${ct.get}`, r.x + 28, r.y + 15, 8, sk.dim);
    } else if (row.t === 'od') {
      const od = b.od.cfg;
      drawIcon(g, 'lightning', r.x + 12, r.y + 13, 16, od.def.color, 1.8);
      kit.text(g, `${od.def.name}　持続 ${b.od.dur} 秒　充電 ×${Math.round(od.chargeK * 100) / 100}`, r.x + 28, r.y + 2, 11, sk.text);
      kit.text(g, `${od.def.desc}　いま ${Math.floor(b.od.gauge)}%`, r.x + 28, r.y + 15, 8, sk.dim);
    } else {
      kit.text(g, row.text, r.x + 4, r.y + 3, 9, sk.dim);
    }
  }
  g.restore();
  // 下の続きがあるときの印
  const total = statusRows(b).reduce((a, r) => a + r.h, 0);
  if (sc.panel.scroll < total - lr.h - 2) kit.text(g, '▼ 下にスクロール', p.x + p.w / 2, lr.y + lr.h + 1, 8, sk.dim, 'center');
  kit.button(g, closeRect(sc), 'とじる', { color: sk.op, size: 12 });
}

// ---- 武器パネル ----
export function drawWeaponPanel(g, sc) {
  const { kit } = sc;
  const b = sc.run.b;
  const id = sc.panel.id;
  const def = WEAPON[id];
  const lv = (b.loadout.find((w) => w.id === id) || { level: 1 }).level;
  const { p, sk } = frame(g, sc, def.name);
  g.save();
  if (sk.glow) kit.glow(g, def.color, 8);
  drawIcon(g, id, p.x + p.w - 26, p.y + 17, 26, def.color, 1.9);
  g.restore();
  kit.text(g, `Lv ${lv} / 10${lv >= 10 ? '  MAX' : ''}`, p.x + 10, p.y + 25, 11, lv >= 10 ? sk.gold : sk.text, 'left', lv >= 10 ? 5 : 0);
  // 属性
  const cw = attrChips(g, kit, p.x + 90, p.y + 24, def.tags);
  kit.text(g, '属性', p.x + 90 + cw + 4, p.y + 26, 8.5, sk.dim);
  // 要素 5 つ
  const rows = weaponElements(id, lv);
  const y0 = p.y + 46;
  const rh = 36;
  rows.forEach((e, i) => {
    const y = y0 + i * rh;
    kit.text(g, e.name, p.x + 10, y, 10.5, sk.text);
    kit.text(g, e.cur, p.x + p.w - 10, y - 1, 12, e.changed ? sk.gold : sk.text, 'right', e.changed ? 4 : 0);
    // Lv1 → Lv10 の進み具合のバー
    const bx = p.x + 10;
    const bw = p.w - 20;
    g.fillStyle = rgba(sk.dim, 0.25);
    rr(g, bx, y + 15, bw, 5, 2.5);
    g.fill();
    g.fillStyle = def.color;
    rr(g, bx, y + 15, Math.max(5, bw * e.ratio), 5, 2.5);
    g.fill();
    // 増減と、次のレベルの値
    const note = e.delta ? `前のレベルから ${e.delta === '新規' ? '新しく出た' : e.delta}` : lv === 1 ? '' : '前のレベルと同じ';
    kit.text(g, note, bx, y + 22, 8, e.changed ? (e.better ? sk.branch.eco : sk.bad) : sk.dim);
    kit.text(g, e.next === null ? 'これ以上は上がらない（MAX）' : `次の Lv${lv + 1}: ${e.next}`, p.x + p.w - 10, y + 22, 8, sk.dim, 'right');
  });
  const ly = y0 + 5 * rh + 2;
  // MAX の大技
  const u = b.w.ult && b.w.ult[id];
  if (lv >= 10) {
    const ready = u && u.charge >= 1;
    kit.text(g, `大技ゲージ ${u ? Math.floor(u.charge * 100) : 0}%${ready ? '（HUD のアイコンをタップで発動）' : ''}`, p.x + 10, ly, 9.5, ready ? sk.gold : sk.text, 'left', ready ? 4 : 0);
  } else {
    kit.text(g, `MAX（Lv10）: ${def.levels[9].replace('MAX: ', '')}`.slice(0, 27) + '…', p.x + 10, ly, 8.5, sk.dim);
  }
  kit.text(g, def.desc, p.x + 10, ly + 14, 8.5, sk.dim);
  kit.button(g, closeRect(sc), 'とじる', { color: sk.op, size: 12 });
}

void TAU;
