// ツリー砦: ローグライト部分の画面（ステージ選択・レベルアップ/宝箱/契約の選択・戦闘の HUD・図鑑・結果）。
// 状態は持たず、sc（画面の状態）を読んで描くだけ。当たり判定に使う位置（rect）はここから export する。
import {
  STAGE_INFO, MODS, RELICS, RELIC, ACHIEVEMENTS, ENDLESS_UNLOCK,
} from './tree-fort-meta.js';
import { WEAPONS, WEAPON, SYNERGIES, SYNERGY, SLOT_MAX, MAX_LEVEL } from './tree-fort-weapons.js';
import { STAGE_COUNT } from './tree-fort-battle.js';
import { rgba, rr } from './tree-fort-skins.js';
import { TAG_NAME } from './tree-fort-wview.js';
import { drawIcon } from './tree-fort-icons.js';

const TAU = Math.PI * 2;

// ---------------------------------------------------------------------------------------------
// 画面の高さ H に合わせた配置。論理高さは 320〜520。下端起点の部品（ボタン・説明パネル）は増えた高さ DH だけ下へ、
// 一覧は DH だけ伸ばし、中央に置く内容（選択・結果）は DH / 2 だけ下へずらす。矩形は同じ object を書き換える。
let DH = 0;
const panelY = () => 241 + DH;
export function layoutRview(H) {
  DH = Math.max(0, H - 320);
  ST_LIST.h = 204 + DH;
  BTN_ST_BACK.y = 288 + DH;
  BTN_ST_GO.y = 288 + DH;
  BTN_REROLL.y = 276 + DH / 2;
  BTN_SPEED.y = 288 + DH;
  BTN_OD.y = 288 + DH;
  CX_LIST.h = 182 + DH;
  BTN_CX_BACK.y = 288 + DH;
}

// ---------------------------------------------------------------------------------------------
// ステージ選択
export const ST_LIST = { x: 4, y: 34, w: 232, h: 204 };
export const ST_ROW_H = 26;
export const BTN_ST_BACK = { x: 8, y: 288, w: 108, h: 28 };
export const BTN_ST_GO = { x: 124, y: 288, w: 108, h: 28 };

// 選べるステージの一覧（ステージ 1〜10 + 無限 + 今日の挑戦）
export function stageEntries(save, daily) {
  const list = [];
  for (let s = 1; s <= STAGE_COUNT; s++) {
    list.push({
      id: `s${s}`, stage: s, name: STAGE_INFO[s].name, mods: STAGE_INFO[s].mods, boss: STAGE_INFO[s].boss,
      locked: s > save.stageClear + 1, stars: save.stars[s] || 0, cleared: s <= save.stageClear,
    });
  }
  list.push({
    id: 'endless', stage: 0, name: '無限の戦場', mods: [], boss: '', locked: save.stageClear < ENDLESS_UNLOCK, stars: 0, cleared: false,
    note: `ステージ ${ENDLESS_UNLOCK} をクリアで解放`,
  });
  list.push({
    id: 'daily', stage: -1, name: '今日の挑戦', mods: daily.mods, boss: '', locked: false, stars: 0, cleared: save.daily.key === daily.key && save.daily.done,
    note: '日替わり。1 日 1 回、ボーナスのポイント',
  });
  return list;
}

export function stageRows(sc) {
  return sc.stageList.map((e, i) => ({ id: e.id, rect: { x: 8, y: ST_LIST.y + 2 + i * ST_ROW_H - sc.stageScroll, w: 216, h: 24 } }));
}
export const stageMaxScroll = (n) => Math.max(0, n * ST_ROW_H - ST_LIST.h + 4);

const modNames = (ids) => ids.map((m) => MODS[m].name).join('・');

function topBar(g, sc, title) {
  const { kit, W } = sc;
  const sk = kit.skin;
  kit.panel(g, { x: 4, y: 3, w: 104, h: 24 }, { stroke: sk.gold, glow: sk.gold, blur: 6, radius: 8 });
  const pts = `${Math.round(sc.shownPts)}`;
  kit.text(g, pts, 11, 7, 15, sk.gold, 'left', 8);
  kit.text(g, 'P', 13 + kit.measure(g, pts, 15), 11, 10, sk.dim);
  kit.text(g, title, W - 8, 8, 13, sk.text, 'right', 6);
}

export function drawStageSelect(g, sc) {
  const { kit, W, H, clock, save } = sc;
  const sk = kit.skin;
  kit.bg(g, W, H);
  kit.stars(g, Math.sin(clock * 0.3) * 30, clock * 5, ST_LIST);
  topBar(g, sc, 'ステージ');
  g.save();
  g.beginPath();
  g.rect(ST_LIST.x, ST_LIST.y, ST_LIST.w, ST_LIST.h);
  g.clip();
  const rows = stageRows(sc);
  sc.stageList.forEach((e, i) => {
    const r = rows[i].rect;
    if (r.y > ST_LIST.y + ST_LIST.h || r.y + r.h < ST_LIST.y) return;
    const sel = sc.stageSel === e.id;
    const next = !e.locked && !e.cleared && e.stage > 0;
    kit.panel(g, r, { stroke: sel ? sk.gold : next ? sk.me : sk.line, glow: sel ? sk.gold : next ? sk.me : null, blur: 7, radius: 6, lw: sel ? 1.6 : 1 });
    const dim = e.locked ? sk.dim : sk.text;
    const label = e.stage > 0 ? `${e.stage}` : e.stage === 0 ? '∞' : '日';
    kit.text(g, label, r.x + 12, r.y + 5, 13, e.locked ? sk.dim : sk.gold, 'center');
    kit.text(g, e.locked ? '？？？' : e.name, r.x + 26, r.y + 5, 12, dim);
    if (e.locked) kit.text(g, '未解放', r.x + r.w - 8, r.y + 7, 9, sk.dim, 'right');
    else if (e.stage > 0) {
      const st = e.stars;
      kit.text(g, st ? '★'.repeat(st) + '☆'.repeat(3 - st) : e.cleared ? '☆☆☆' : '未クリア', r.x + r.w - 8, r.y + 6, 10, st ? sk.gold : sk.dim, 'right');
    } else if (e.id === 'daily') kit.text(g, e.cleared ? '済' : '未', r.x + r.w - 8, r.y + 6, 10, e.cleared ? sk.branch.eco : sk.gold, 'right');
  });
  g.restore();
  const max = stageMaxScroll(sc.stageList.length);
  if (max > 0) {
    const th = Math.max(16, (ST_LIST.h * ST_LIST.h) / (ST_LIST.h + max));
    g.fillStyle = rgba(sk.dim, 0.45);
    g.fillRect(ST_LIST.x + ST_LIST.w - 3, ST_LIST.y + ((ST_LIST.h - th) * sc.stageScroll) / max, 2, th);
  }

  // 下の説明
  const e = sc.stageList.find((x) => x.id === sc.stageSel) || sc.stageList[0];
  const py = panelY();
  kit.panel(g, { x: 4, y: py, w: W - 8, h: 44 }, { stroke: sk.gold, glow: sk.gold, blur: 8, radius: 8 });
  if (e.locked) {
    kit.text(g, '？？？', 12, py + 4, 12, sk.dim);
    kit.text(g, e.note || `ステージ ${e.stage - 1} をクリアで解放`, 12, py + 20, 9.5, sk.dim);
  } else {
    const title = e.stage > 0 ? `STAGE ${e.stage}  ${e.name}` : e.name;
    kit.text(g, title, 12, py + 4, 12, sk.gold, 'left', 6);
    if (e.stage > 0) {
      kit.text(g, `ボス: ${e.boss}`, W - 12, py + 6, 9, sk.bad, 'right');
      kit.text(g, e.mods.length ? `特色: ${modNames(e.mods)}（${MODS[e.mods[0]].desc}）` : '特色: なし（穏やかな戦い）', 12, py + 19, 9, sk.text);
      kit.text(g, e.cleared ? '★2 耐久が半分以上 / ★3 被弾 3 回以内' : `初クリアで ${100 * e.stage} P。星が増えるとボーナス`, 12, py + 30, 8.5, sk.dim);
    } else {
      kit.text(g, e.mods.length ? `特色: ${modNames(e.mods)}` : e.note, 12, py + 19, 9, sk.text);
      kit.text(g, e.note || '', 12, py + 30, 8.5, sk.dim);
    }
  }
  kit.button(g, BTN_ST_BACK, 'もどる', { color: sk.op, size: 13 });
  kit.button(g, BTN_ST_GO, '出撃！', { on: !e.locked, color: sk.me, size: 14, active: !e.locked, stamp: true });
  kit.drawParts(g);
  if (sc.flash.a > 0.01) {
    g.fillStyle = rgba(sc.flash.col, sc.flash.a);
    g.fillRect(0, 0, W, H);
  }
}

// ---------------------------------------------------------------------------------------------
// 選択（レベルアップ・宝箱・契約）
export function cardRects(n) {
  const h = n >= 4 ? 46 : 58;
  const gap = 6;
  return Array.from({ length: n }, (_, i) => ({ x: 10, y: 64 + DH / 2 + i * (h + gap), w: 220, h }));
}
export const BTN_REROLL = { x: 50, y: 276, w: 140, h: 24 };

function card(g, kit, r, c, o = {}) {
  const sk = kit.skin;
  const sel = o.sel;
  kit.panel(g, r, { stroke: c.color || sk.line, glow: c.color || null, blur: sel ? 14 : 8, radius: 8, lw: sel ? 2 : 1.3 });
  g.save();
  if (sk.glow) kit.glow(g, c.color, 6);
  drawIcon(g, c.icon, r.x + 22, r.y + r.h / 2, r.h >= 50 ? 30 : 26, c.color);
  g.restore();
  kit.text(g, c.name, r.x + 42, r.y + (r.h >= 50 ? 7 : 4), 13, sk.text, 'left', 0);
  if (c.tag) kit.text(g, c.tag, r.x + r.w - 8, r.y + (r.h >= 50 ? 9 : 6), 9, c.tagColor || sk.gold, 'right', c.star ? 6 : 0);
}

export function drawChoice(g, sc, kind) {
  const { kit, W, H, clock } = sc;
  const { b } = sc.run;
  const sk = kit.skin;
  g.fillStyle = sk.bg === 'wa' || sk.bg === 'modern' ? 'rgba(240, 235, 225, 0.78)' : 'rgba(2, 4, 16, 0.78)';
  g.fillRect(0, 0, W, H);
  // 見出しは、カード（cardRects が DH / 2 下げている）と同じだけ下げる
  const oy = DH / 2;
  if (kind === 'levelup') {
    const pop = 1 + Math.max(0, 1 - sc.choiceT * 5) * 0.4;
    g.save();
    g.translate(W / 2, 34 + oy);
    g.scale(pop, pop);
    kit.text(g, b.level <= 1 ? 'START BONUS' : `LEVEL UP!  Lv ${b.level}`, 0, -11, 20, kit.c(sk.gold, 1), 'center', 12);
    g.restore();
    kit.text(g, `1 つ選ぶ${b.pending > 1 ? `（あと ${b.pending - 1} 回）` : ''}`, W / 2, 50 + oy, 9.5, sk.dim, 'center');
    const rects = cardRects(b.options.length);
    b.options.forEach((o, i) => {
      const r = rects[i];
      const tag = { 'weapon-new': o.unknown ? '武器 NEW?' : '武器 NEW', 'weapon-up': '武器 強化', stat: '能力', heal: '回復' }[o.kind] || o.label;
      const icon = o.unknown ? 'unknown' : o.kind === 'heal' ? 'heal' : o.id;
      card(g, kit, r, { name: o.name, color: o.color, icon, tag, tagColor: o.star ? sk.gold : sk.dim, star: o.star });
      const tight = r.h < 50;
      kit.text(g, o.kind === 'weapon-up' ? `${o.label}：${o.desc}` : o.desc, r.x + 42, r.y + (tight ? 19 : 25), 10, sk.text);
      const note = o.note || '';
      if (note) kit.text(g, note, r.x + 42, r.y + (tight ? 32 : 40), 9, o.star || o.unknown ? rgba(sk.gold, 0.95) : sk.dim);
      kit.text(g, `${i + 1}`, r.x + r.w - 8, r.y + r.h - 14, 8, rgba(sk.dim, 0.7), 'right');
    });
    kit.button(g, BTN_REROLL, `選び直し（残り ${b.rerolls}）`, { on: b.rerolls > 0, color: sk.op, size: 11 });
  } else if (kind === 'relic') {
    kit.text(g, '宝箱！', W / 2, 20 + oy, 22, kit.c(sk.gold, 2), 'center', 14);
    kit.text(g, '遺物を 1 つ選ぶ（この挑戦の間ずっと効く）', W / 2, 50 + oy, 9.5, sk.dim, 'center');
    const rects = cardRects(b.relicOpts.length);
    b.relicOpts.forEach((r0, i) => {
      const r = rects[i];
      card(g, kit, r, { name: r0.name, color: r0.color, icon: 'relic', tag: '遺物', tagColor: sk.gold });
      kit.text(g, r0.desc, r.x + 42, r.y + 26, 9.5, sk.text);
    });
  } else {
    kit.text(g, '契約', W / 2, 20 + oy, 22, kit.c(sk.bad, 3), 'center', 14);
    kit.text(g, `第 ${b.event.wave} 波の前。代償と報酬を見て選ぶ`, W / 2, 50 + oy, 9.5, sk.dim, 'center');
    const rects = cardRects(3);
    b.event.options.forEach((c, i) => {
      const r = rects[i];
      card(g, kit, r, { name: c.name, color: c.color, icon: 'contract', tag: '契約', tagColor: sk.dim });
      kit.text(g, `代償: ${c.give}`, r.x + 42, r.y + 25, 9, sk.bad);
      kit.text(g, `報酬: ${c.get}`, r.x + 42, r.y + 38, 9, sk.branch.eco);
    });
    const r = rects[2];
    kit.panel(g, r, { stroke: sk.dim, radius: 8 });
    kit.text(g, '見送る', W / 2, r.y + 20, 13, sk.dim, 'center');
  }
  kit.drawParts(g);
  if (sc.flash.a > 0.01) {
    g.fillStyle = rgba(sc.flash.col, sc.flash.a);
    g.fillRect(0, 0, W, H);
  }
  void clock;
  void H;
}

// ---------------------------------------------------------------------------------------------
// 戦闘の HUD（経験値・持っている武器・倍速・オーバードライブ・ボスの体力・特色）
export const BTN_SPEED = { x: 198, y: 288, w: 36, h: 22 };
// 倍速（×2・×3）は、全ステージをクリアしたあとの、やりこみ要素。それまでは通常速度（1.2 倍）のみ。
export const speedUnlocked = (save) => save.stageClear >= STAGE_COUNT;
export const BASE_SPEED = 1.2;
export const BTN_OD = { x: 6, y: 288, w: 84, h: 22 };

// HUD の武器・遺物アイコンの位置（描画とタップ判定で共通）。タップすると、その説明が出る。
export function hudIcons(b) {
  const out = [];
  b.loadout.forEach((w, i) => out.push({ kind: 'weapon', id: w.id, level: w.level, x: 94 + i * 17, y: 289 + DH, w: 16, h: 16 }));
  b.relics.forEach((id, i) => out.push({ kind: 'relic', id, x: 94 + i * 12, y: 307 + DH, w: 11, h: 11 }));
  return out;
}
// タップした位置に HUD のアイコンがあれば、その説明（toast の形）を返す
export function hudToast(b, x, y) {
  const hit = hudIcons(b).find((r) => x >= r.x - 2 && x <= r.x + r.w + 2 && y >= r.y - 2 && y <= r.y + r.h + 2);
  if (!hit) return null;
  if (hit.kind === 'relic') {
    const r = RELIC[hit.id];
    return { icon: 'relic', title: `遺物「${r.name}」`, sub: r.desc, color: r.color, t: 4 };
  }
  const def = WEAPON[hit.id];
  return { icon: hit.id, title: `${def.name} Lv${hit.level}`, sub: def.levels[hit.level - 1], color: def.color, t: 4 };
}

export function drawBattleHud(g, sc) {
  const { kit, W, clock } = sc;
  const { b } = sc.run;
  const sk = kit.skin;
  const D = DH; // 下端起点の部品は、増えた高さぶん下へ
  // ボスの体力
  let y = 50;
  if (b.boss) {
    const e = b.boss;
    const info = STAGE_INFO[b.stage] || { boss: 'ボス' };
    const ratio = Math.max(0, e.hp / e.max);
    g.save();
    rr(g, 10, y, W - 20, 7, 3.5);
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.fill();
    rr(g, 10, y, Math.max(7, (W - 20) * ratio), 7, 3.5);
    kit.glow(g, sk.bad, 8);
    g.fillStyle = sk.bad;
    g.fill();
    g.restore();
    kit.text(g, `BOSS  ${info.boss}`, 12, y + 9, 8.5, sk.bad, 'left', 4);
    y += 20;
  }
  // 特色
  if (b.mods.length) kit.text(g, b.mods.map((m) => MODS[m].name).join(' / '), W - 8, y + (b.boss ? -9 : 0), 8.5, rgba(sk.gold, 0.9), 'right');

  // 下: 経験値の帯
  g.save();
  rr(g, 8, 314 + D, W - 16, 4, 2);
  g.fillStyle = 'rgba(255,255,255,0.12)';
  g.fill();
  rr(g, 8, 314 + D, Math.max(4, (W - 16) * Math.min(1, b.xp / b.xpNeed)), 4, 2);
  kit.glow(g, sk.me, 6);
  g.fillStyle = kit.c(sk.me, 5);
  g.fill();
  g.restore();
  kit.text(g, `Lv ${b.level}　EXP ${Math.floor(b.xp)}/${b.xpNeed}`, 8, 276 + D, 9, sk.text, 'left', 3);

  // 持っている武器（アイコン + レベル）と遺物。タップで説明
  for (const r of hudIcons(b)) {
    if (r.kind === 'weapon') {
      const def = WEAPON[r.id];
      g.save();
      if (sk.glow) kit.glow(g, def.color, 5);
      drawIcon(g, r.id, r.x + 8, r.y + 8, 17, def.color, 1.9);
      g.restore();
      kit.text(g, `${r.level}`, r.x + 15, r.y + 8, 8, sk.text, 'right', 3);
    } else {
      drawIcon(g, 'relic', r.x + 5.5, r.y + 5.5, 11, RELIC[r.id].color, 2);
    }
  }

  // オーバードライブ
  const od = b.od;
  const ready = od.gauge >= 100 && od.active <= 0;
  if (od.active > 0) {
    g.save();
    rr(g, BTN_OD.x, BTN_OD.y, BTN_OD.w, BTN_OD.h, 6);
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.fill();
    rr(g, BTN_OD.x, BTN_OD.y, Math.max(6, (BTN_OD.w * od.active) / 8), BTN_OD.h, 6);
    kit.glow(g, sk.gold, 12);
    g.fillStyle = kit.c(sk.gold, clock * 3);
    g.fill();
    g.restore();
    kit.text(g, `OD 強化中 ${Math.ceil(od.active)}秒`, BTN_OD.x + BTN_OD.w / 2, BTN_OD.y + 6, 9, '#06081a', 'center');
  } else if (ready) {
    const pulse = 0.5 + 0.5 * Math.sin(clock * 8);
    g.save();
    kit.glow(g, sk.gold, 10 + 10 * pulse);
    g.strokeStyle = rgba(sk.gold, 0.6 + 0.4 * pulse);
    g.lineWidth = 2;
    rr(g, BTN_OD.x - 2, BTN_OD.y - 2, BTN_OD.w + 4, BTN_OD.h + 4, 8);
    g.stroke();
    g.restore();
    kit.button(g, BTN_OD, 'OD 発動！タップ', { color: sk.gold, size: 9, active: true });
  } else {
    g.save();
    rr(g, BTN_OD.x, BTN_OD.y, BTN_OD.w, BTN_OD.h, 6);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fill();
    rr(g, BTN_OD.x, BTN_OD.y, Math.max(0.1, (BTN_OD.w * od.gauge) / 100), BTN_OD.h, 6);
    g.fillStyle = rgba(sk.gold, 0.45);
    g.fill();
    g.strokeStyle = rgba(sk.dim, 0.7);
    g.lineWidth = 1;
    rr(g, BTN_OD.x, BTN_OD.y, BTN_OD.w, BTN_OD.h, 6);
    g.stroke();
    g.restore();
    kit.text(g, `OD 充電 ${Math.floor(od.gauge)}%`, BTN_OD.x + BTN_OD.w / 2, BTN_OD.y + 6, 9, sk.dim, 'center');
  }
  // 取得したものの一言（武器・強化・遺物・契約・OD）
  if (b.toast) {
    const t = b.toast;
    const a = Math.min(1, t.t * 3);
    const r = { x: 10, y: 236 + D, w: W - 20, h: 32 };
    g.save();
    g.globalAlpha = a;
    kit.panel(g, r, { stroke: t.color, glow: t.color, blur: 8, radius: 8, lw: 1.3 });
    drawIcon(g, t.icon, r.x + 18, r.y + r.h / 2, 22, t.color);
    kit.text(g, t.title, r.x + 36, r.y + 4, 11, sk.text, 'left', 0);
    kit.text(g, t.sub, r.x + 36, r.y + 18, 8.5, sk.dim, 'left', 0);
    g.restore();
  }
  // 倍速
  if (speedUnlocked(sc.save)) kit.button(g, BTN_SPEED, `×${sc.save.speed}`, { color: sk.me, size: 12, active: sc.save.speed > 1 });
}

// ---------------------------------------------------------------------------------------------
// 図鑑
export const CX_TABS = [
  { id: 'weapons', label: '武器', rect: { x: 4, y: 32, w: 56, h: 20 } },
  { id: 'syn', label: '組合せ', rect: { x: 62, y: 32, w: 56, h: 20 } },
  { id: 'relics', label: '遺物', rect: { x: 120, y: 32, w: 56, h: 20 } },
  { id: 'ach', label: '実績', rect: { x: 178, y: 32, w: 58, h: 20 } },
];
export const CX_LIST = { x: 4, y: 56, w: 232, h: 182 };
export const CX_ROW_H = 26;
export const BTN_CX_BACK = { x: 164, y: 288, w: 72, h: 28 };
export const SLOT_STRIP = { x: 92, y: 5, w: 96, h: 20 };
export const slotRect = (i) => ({ x: SLOT_STRIP.x + i * 16, y: SLOT_STRIP.y + 2, w: 14, h: 16 });

export const codexItems = (tab) => (tab === 'weapons' ? WEAPONS : tab === 'syn' ? SYNERGIES : tab === 'relics' ? RELICS : ACHIEVEMENTS);
export const codexMaxScroll = (tab) => Math.max(0, codexItems(tab).length * CX_ROW_H - CX_LIST.h + 4);
export function codexRows(sc) {
  return codexItems(sc.codex.tab).map((it, i) => ({ id: it.id, rect: { x: 8, y: CX_LIST.y + 2 + i * CX_ROW_H - sc.codex.scroll, w: 216, h: 24 } }));
}

// 組み合わせの材料を、見つけた分だけ見せる（「氷結弾 + ？」）
export function synHint(syn, save) {
  const known = new Set(save.discovered.weapons);
  return syn.needs.map((n) => {
    if (n.startsWith('tag:')) return WEAPONS.some((w) => known.has(w.id) && w.tags.includes(n.slice(4))) ? `${TAG_NAME[n.slice(4)]}属性` : '？';
    return known.has(n) ? WEAPON[n].name : '？';
  }).join(' ＋ ');
}

// 実績の進み具合の材料
export function achProgress(save) {
  return {
    stageClear: save.stageClear, stars: save.stars, discoveredWeapons: save.discovered.weapons.length, discoveredSyn: save.discovered.syn.length,
    bestCombo: save.bestCombo, relics: save.bestRelics, bestWave: save.bestWave,
  };
}

// 文字が幅に収まらないときだけ、小さくする
const fitSize = (g, kit, str, size, maxW) => Math.max(6.5, Math.min(size, (size * maxW) / Math.max(1, kit.measure(g, str, size))));

export function drawCodex(g, sc) {
  const { kit, W, H, clock, save, codex } = sc;
  const sk = kit.skin;
  kit.bg(g, W, H);
  kit.stars(g, Math.sin(clock * 0.3) * 30, clock * 5, CX_LIST);
  kit.panel(g, { x: 4, y: 3, w: 84, h: 24 }, { stroke: sk.gold, glow: sk.gold, blur: 6, radius: 8 });
  const pts = `${Math.round(sc.shownPts)}`;
  kit.text(g, pts, 11, 7, 15, sk.gold, 'left', 8);
  kit.text(g, 'P', 13 + kit.measure(g, pts, 15), 11, 10, sk.dim);
  // 武器の最大数（枠）: 開放済みは塗り、未開放は「+」
  for (let i = 0; i < SLOT_MAX; i++) {
    const r = slotRect(i);
    g.save();
    rr(g, r.x, r.y, r.w, r.h, 3);
    if (i < save.slots) {
      if (sk.glow) kit.glow(g, sk.me, 6);
      g.fillStyle = rgba(sk.me, 0.7);
      g.fill();
    } else {
      g.fillStyle = rgba(sk.dim, 0.18);
      g.fill();
      kit.text(g, '+', r.x + r.w / 2, r.y + 2, 11, rgba(sk.dim, 0.9), 'center');
    }
    g.restore();
  }
  kit.text(g, '図鑑', W - 8, 8, 13, sk.text, 'right', 6);

  const cnt = {
    weapons: `${save.discovered.weapons.length}/${WEAPONS.length}`, syn: `${save.discovered.syn.length}/${SYNERGIES.length}`,
    relics: `${save.discovered.relics.length}/${RELICS.length}`, ach: `${save.ach.length}/${ACHIEVEMENTS.length}`,
  };
  for (const t of CX_TABS) kit.button(g, t.rect, `${t.label} ${cnt[t.id]}`, { color: sk.me, size: 8, active: codex.tab === t.id });

  g.save();
  g.beginPath();
  g.rect(CX_LIST.x, CX_LIST.y, CX_LIST.w, CX_LIST.h);
  g.clip();
  const items = codexItems(codex.tab);
  const rows = codexRows(sc);
  const dw = new Set(save.discovered.weapons);
  const dsy = new Set(save.discovered.syn);
  const dr = new Set(save.discovered.relics);
  rows.forEach((row, i) => {
    const r = row.rect;
    if (r.y > CX_LIST.y + CX_LIST.h || r.y + r.h < CX_LIST.y) return;
    const it = items[i];
    const sel = codex.sel === it.id;
    let known;
    if (codex.tab === 'weapons') known = dw.has(it.id);
    else if (codex.tab === 'syn') known = dsy.has(it.id);
    else if (codex.tab === 'relics') known = dr.has(it.id);
    else known = save.ach.includes(it.id);
    kit.panel(g, r, { stroke: sel ? sk.gold : known ? (it.color || sk.me) : sk.line, glow: sel ? sk.gold : null, blur: 7, radius: 6, lw: sel ? 1.6 : 1 });
    if (codex.tab === 'ach') {
      kit.text(g, known ? '✔' : '・', r.x + 12, r.y + 5, 12, known ? sk.branch.eco : sk.dim, 'center');
      kit.text(g, it.name, r.x + 24, r.y + 5, 11.5, known ? sk.text : sk.dim);
      kit.text(g, `${it.reward} P`, r.x + r.w - 8, r.y + 7, 9, known ? sk.dim : sk.gold, 'right');
    } else if (codex.tab === 'syn') {
      kit.text(g, known ? it.name : '？？？', r.x + 10, r.y + 5, 12, known ? sk.gold : sk.dim, 'left', known ? 4 : 0);
      kit.text(g, known ? it.needs.map((n) => (n.startsWith('tag:') ? `${TAG_NAME[n.slice(4)]}属性` : WEAPON[n].name)).join(' ＋ ') : synHint(it, save), r.x + r.w - 8, r.y + 7, 8.5, known ? sk.gold : sk.dim, 'right');
    } else {
      const c = it.color;
      g.save();
      if (sk.glow && known) kit.glow(g, c, 8);
      g.fillStyle = known ? c : rgba(sk.dim, 0.45);
      g.beginPath();
      g.arc(r.x + 12, r.y + 12, 5, 0, TAU);
      g.fill();
      g.restore();
      kit.text(g, known ? it.name : '？？？', r.x + 24, r.y + 5, 12, known ? sk.text : sk.dim);
      if (codex.tab === 'weapons' && known) kit.text(g, it.tags.map((t) => TAG_NAME[t]).join('・'), r.x + r.w - 8, r.y + 8, 8.5, sk.dim, 'right');
    }
  });
  g.restore();
  const max = codexMaxScroll(codex.tab);
  if (max > 0) {
    const th = Math.max(16, (CX_LIST.h * CX_LIST.h) / (CX_LIST.h + max));
    g.fillStyle = rgba(sk.dim, 0.45);
    g.fillRect(CX_LIST.x + CX_LIST.w - 3, CX_LIST.y + ((CX_LIST.h - th) * codex.scroll) / max, 2, th);
  }

  // 下の説明
  const py = panelY();
  kit.panel(g, { x: 4, y: py, w: W - 8, h: 44 }, { stroke: sk.gold, glow: sk.gold, blur: 8, radius: 8 });
  const it = items.find((x) => x.id === codex.sel) || items[0];
  if (codex.tab === 'weapons') {
    const known = dw.has(it.id);
    kit.text(g, known ? it.name : '？？？', 12, py + 4, 12, known ? it.color : sk.dim, 'left', 6);
    if (known) {
      kit.text(g, it.desc, 12, py + 18, fitSize(g, kit, it.desc, 9, W - 24), sk.text);
      const lv = `Lv1 ${it.levels[0]} → Lv5 ${it.levels[4]}`;
      kit.text(g, lv, 12, py + 29, fitSize(g, kit, lv, 8.5, W - 24), sk.dim);
    } else kit.text(g, 'まだ見つけていない武器。レベルアップの「？？？」から出会える', 12, py + 20, 9, sk.dim);
  } else if (codex.tab === 'syn') {
    const known = dsy.has(it.id);
    kit.text(g, known ? it.name : '？？？', 12, py + 4, 12, known ? sk.gold : sk.dim, 'left', 6);
    kit.text(g, known ? it.desc : `ヒント: ${synHint(it, save)}`, 12, py + 20, 9, known ? sk.text : sk.dim);
    if (!known) kit.text(g, '材料をそろえて戦うと、発動したときに記録される', 12, py + 31, 8.5, sk.dim);
  } else if (codex.tab === 'relics') {
    const known = dr.has(it.id);
    kit.text(g, known ? it.name : '？？？', 12, py + 4, 12, known ? it.color : sk.dim, 'left', 6);
    kit.text(g, known ? it.desc : '精鋭の敵が落とす宝箱から、見つけられる', 12, py + 20, 9, known ? sk.text : sk.dim);
  } else {
    const known = save.ach.includes(it.id);
    kit.text(g, it.name, 12, py + 4, 12, known ? sk.branch.eco : sk.gold, 'left', 6);
    kit.text(g, it.desc, 12, py + 20, 9, sk.text);
    kit.text(g, known ? '達成済み' : `達成で ${it.reward} P`, 12, py + 31, 8.5, known ? sk.branch.eco : sk.dim);
  }
  if (sc.msgT > 0 && sc.msg) kit.text(g, sc.msg, W / 2, 230 + DH, 9.5, sk.bad, 'center', 4);
  kit.button(g, BTN_CX_BACK, 'もどる', { color: sk.op, size: 12 });
  kit.text(g, `武器の枠 ${save.slots}/${SLOT_MAX}（上の + で増やせる）`, 10, 297 + DH, 8.5, sk.dim);
  kit.drawParts(g);
  if (sc.flash.a > 0.01) {
    g.fillStyle = rgba(sc.flash.col, sc.flash.a);
    g.fillRect(0, 0, W, H);
  }
}

// ---------------------------------------------------------------------------------------------
// 結果
export function drawResultNew(g, sc, ui) {
  const { kit, W, H, res } = sc;
  const sk = kit.skin;
  g.fillStyle = sk.bg === 'wa' || sk.bg === 'modern' ? 'rgba(240, 235, 225, 0.86)' : 'rgba(3, 5, 20, 0.82)';
  g.fillRect(0, 0, W, H);
  const k = Math.min(1, res.t / 1.2);
  const win = res.cleared;
  const c = win ? kit.c(sk.gold, 0) : res.retreat ? sk.dim : sk.bad;
  const title = win ? (sk.id === 'wa' ? '制圧' : 'STAGE CLEAR!') : res.retreat ? (sk.id === 'wa' ? '撤退' : 'RETREAT') : sk.id === 'wa' ? '落城' : 'DEFEATED';
  // 下のボタン（ui.retry / ui.menu）は下端起点（H-124 から）。内容は 320 のときの配置を、増えた高さの半分だけ下げて中央に寄せる。
  g.save();
  g.translate(0, DH / 2);
  kit.text(g, title, W / 2, 10, win ? 22 : 24, c, 'center', 14);
  const stageName = res.stage > 0 ? `STAGE ${res.stage}  ${STAGE_INFO[res.stage].name}` : res.stage === 0 ? '無限の戦場' : '今日の挑戦';
  kit.text(g, stageName, W / 2, 38, 10, sk.dim, 'center');
  if (win) {
    const shown = Math.min(res.stars, Math.floor(res.t * 3));
    kit.text(g, '★'.repeat(shown) + '☆'.repeat(3 - shown), W / 2, 50, 22, sk.gold, 'center', 10);
  } else {
    kit.text(g, res.stage > 0 ? `WAVE ${res.wave} / 10` : `WAVE ${Math.round(res.wave * k)}`, W / 2, 52, 18, sk.text, 'center', 6);
  }
  kit.text(g, `Lv ${res.level}`, W / 2 - 62, 84, 10.5, sk.me, 'center');
  kit.text(g, `遺物 ${res.relics}`, W / 2, 84, 10.5, sk.gold, 'center');
  kit.text(g, `最大連撃 ${res.combo}`, W / 2 + 62, 84, 10.5, sk.op, 'center');
  kit.text(g, `獲得  +${Math.round(res.earned * k)} P`, W / 2, 102, 14, sk.gold, 'center', 8);
  kit.text(g, res.bonus > 0 ? `ボーナス +${res.bonus} P　所持 ${res.total} P` : `所持 ${res.total} P`, W / 2, 122, 9.5, res.bonus > 0 ? sk.branch.eco : sk.dim, 'center');
  const lines = [];
  for (const a of res.ach) lines.push([`実績「${a}」`, sk.gold]);
  for (const id of res.found.weapons) lines.push([`武器を発見！ ${WEAPON[id].name}`, kit.c(sk.me, 1)]);
  for (const id of res.found.syn) lines.push([`組み合わせを発見！ ${SYNERGY[id].name}`, kit.c(sk.gold, 2)]);
  for (const id of res.found.relics) lines.push([`遺物 ${RELIC[id].name}`, sk.op]);
  lines.slice(0, 4).forEach(([t, col], i) => kit.text(g, t, W / 2, 140 + i * 12.5, 9.5, col, 'center', 4));
  if (lines.length > 4) kit.text(g, `ほか ${lines.length - 4} 件`, W / 2, 140 + 4 * 12.5, 8.5, sk.dim, 'center');
  g.restore();
  kit.button(g, ui.retry, 'ステージへ', { color: sk.me, size: 14 });
  kit.button(g, ui.menu, 'メニュー', { color: sk.dim, size: 14 });
  kit.drawParts(g);
}
