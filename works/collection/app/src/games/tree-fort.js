// ツリー砦: ローグライト式のタワーディフェンス。
//   ハブ（ツリー）: ためたポイントで、ステータスを伸ばすノードを開放する（ドラッグで動かす・タップで選ぶ）。
//   ステージ: 10 波 + ボスの全 10 面、無限、日替わりの「今日の挑戦」。★1〜3 の評価。
//   戦闘: 砦が自動で攻撃。敵を倒して経験値をため、レベルアップごとに 3 択（武器・強化）。武器は初めて選ぶと「発見」され、図鑑に載る。
//         精鋭の敵の宝箱（遺物）、波の合間の契約、ため技（オーバードライブ）、倍速、画面タップの追加攻撃。
//   ショップ: ポイントで、スキン（見た目）と演出（幾何学・曼荼羅など）を買う。
// データ: tree-fort-data / -weapons / -meta / -run、戦闘: -battle、見た目: -skins / -view / -wview / -rview。
import { inside } from '../core/draw.js';
import { Store } from '../core/storage.js';
import { NODE, TREE, START_OWNED, computeStats, canBuy, canRefund, TREE_WEAPON_NODE } from './tree-fort-data.js';
import { WEAPON, SYNERGIES, SLOT_BASE, SLOT_MAX, SLOT_COST } from './tree-fort-weapons.js';
import { createBattle, ARENA, STAGE_COUNT } from './tree-fort-battle.js';
import { STAGE_INFO, RELICS, ACHIEVEMENTS, dailyChallenge } from './tree-fort-meta.js';
import { SKINS, EFFECTS, makeKit } from './tree-fort-skins.js';
import {
  MAP, NODE_R, BTN_BUY, BTN_GO, BTN_SHOP, BTN_ARMORY, BTN_RETREAT, shopLayout, nodeScreenPos,
  drawTree, drawBattle, drawShop, spawnFx,
} from './tree-fort-view.js';
import {
  ST_LIST, ST_ROW_H, BTN_ST_BACK, BTN_ST_GO, stageEntries, stageRows, stageMaxScroll, drawStageSelect,
  cardRects, BTN_REROLL, drawChoice, BTN_SPEED, BTN_OD,
  CX_TABS, CX_LIST, BTN_CX_BACK, SLOT_STRIP, slotRect, codexItems, codexRows, codexMaxScroll, achProgress, drawCodex, drawResultNew,
} from './tree-fort-rview.js';

const SAVE_ID = 'tree-fort-save';
const PAN_LIMIT = 140;
const kits = {};
const kitOf = (skinId) => {
  if (!kits[skinId]) kits[skinId] = makeKit(SKINS.find((s) => s.id === skinId) || SKINS[0]);
  return kits[skinId];
};
const BASE_DISCOVERED = ['bomb', 'frost', 'blade']; // 最初から知っている武器
const uniq = (a) => [...new Set(a)];

// 日付から決まる乱数（今日の挑戦）
function seededRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 保存データを読む。古い形式（武器をポイントで買う方式）は、買ったぶんを返金して新方式へ移す。
function loadSave() {
  const raw = Store.load(SAVE_ID, null);
  const owned = new Set(START_OWNED);
  if (raw && Array.isArray(raw.owned)) for (const id of raw.owned) if (NODE[id]) owned.add(id);
  // 前提が欠けた取得済みノードは無効にする（データ変更への備え）
  let changed = true;
  while (changed) {
    changed = false;
    for (const id of [...owned]) {
      if (!NODE[id].req.every((r) => owned.has(r))) {
        owned.delete(id);
        changed = true;
      }
    }
  }
  const skinsOwned = new Set(['neon']);
  const fxOwned = new Set(['standard']);
  if (raw && Array.isArray(raw.skinsOwned)) for (const id of raw.skinsOwned) if (SKINS.some((s) => s.id === id)) skinsOwned.add(id);
  if (raw && Array.isArray(raw.fxOwned)) for (const id of raw.fxOwned) if (EFFECTS.some((e) => e.id === id)) fxOwned.add(id);

  let points = Math.max(0, Math.floor(raw?.points || 0));
  const discovered = { weapons: [...BASE_DISCOVERED], syn: [], relics: [] };
  let migrated = 0;
  if (raw && raw.ver >= 2) {
    for (const id of raw.discovered?.weapons || []) if (WEAPON[id]) discovered.weapons.push(id);
    for (const id of raw.discovered?.syn || []) if (SYNERGIES.some((s) => s.id === id)) discovered.syn.push(id);
    for (const id of raw.discovered?.relics || []) if (RELICS.some((r) => r.id === id)) discovered.relics.push(id);
  } else if (raw && raw.weapons && typeof raw.weapons === 'object') {
    // v1 → v2: 武器のレベルに使ったポイントを返金し、持っていた武器は「発見済み」にする
    for (const [id, lv] of Object.entries(raw.weapons)) {
      if (!WEAPON[id] || !Number.isInteger(lv)) continue;
      for (let i = 0; i < Math.min(lv, 5); i++) migrated += WEAPON[id].cost[i];
      discovered.weapons.push(id);
    }
    points += migrated;
  }
  // ツリーのノードで「最初から装備する」武器は、発見済み
  for (const [wid, node] of Object.entries(TREE_WEAPON_NODE)) if (owned.has(node)) discovered.weapons.push(wid);
  discovered.weapons = uniq(discovered.weapons);
  discovered.syn = uniq(discovered.syn);
  discovered.relics = uniq(discovered.relics);

  const stars = {};
  if (raw && raw.stars && typeof raw.stars === 'object') {
    for (const [k, v] of Object.entries(raw.stars)) if (Number.isInteger(+k) && +k >= 1 && +k <= STAGE_COUNT) stars[+k] = Math.max(0, Math.min(3, Math.floor(v)));
  }
  const num = (v) => Math.max(0, Math.floor(Number(v) || 0));
  return {
    owned,
    points,
    migrated,
    bestWave: num(raw?.bestWave),
    runs: num(raw?.runs),
    skinsOwned,
    fxOwned,
    skin: skinsOwned.has(raw?.skin) ? raw.skin : 'neon',
    fx: fxOwned.has(raw?.fx) ? raw.fx : 'standard',
    slots: Math.max(SLOT_BASE, Math.min(SLOT_MAX, num(raw?.slots) || SLOT_BASE)),
    discovered,
    stageClear: Math.min(STAGE_COUNT, num(raw?.stageClear)),
    stars,
    speed: [1, 2, 3].includes(raw?.speed) ? raw.speed : 1,
    daily: raw?.daily && typeof raw.daily.key === 'string' ? { key: raw.daily.key, done: !!raw.daily.done } : { key: '', done: false },
    ach: Array.isArray(raw?.ach) ? raw.ach.filter((id) => ACHIEVEMENTS.some((a) => a.id === id)) : [],
    bestCombo: num(raw?.bestCombo),
    bestRelics: num(raw?.bestRelics),
  };
}

export default function create(env) {
  const { W, H, input, sound } = env;

  // 画面の状態（描画側 tree-fort-view / -rview / -wview が読む）
  const sc = {
    W, H, clock: 0, t: 0, kit: kitOf('neon'), fx: 'standard', effects: [], shake: 0, flash: { a: 0, col: '#ffffff' },
    combo: { n: 0, t: 0, pop: 0 }, save: null, sel: 'core', pan: { x: 0, y: 0 }, nodePop: {}, shownPts: 0, msg: '', msgT: 0,
    shop: { sel: 'skin:neon', skin: 'neon', fx: 'standard' }, run: null, res: null,
    codex: { tab: 'weapons', sel: 'bomb', scroll: 0, slotAsk: 0, slotAskT: 0 },
    stageList: [], stageSel: null, stageScroll: 0, choiceT: 0, daily: dailyChallenge(),
  };
  // screen: tree | shop | codex | stages | battle | result
  let screen, drag, lastFxId, waveScore, lastSnd, runInfo, listDrag, lastOpts, lastKey;
  let resumeStages = false;

  const persist = () => {
    const s = sc.save;
    Store.save(SAVE_ID, {
      ver: 2,
      owned: [...s.owned], points: s.points, bestWave: s.bestWave, runs: s.runs,
      skinsOwned: [...s.skinsOwned], fxOwned: [...s.fxOwned], skin: s.skin, fx: s.fx,
      slots: s.slots, discovered: s.discovered, stageClear: s.stageClear, stars: s.stars, speed: s.speed, daily: s.daily,
      ach: s.ach, bestCombo: s.bestCombo, bestRelics: s.bestRelics,
    });
  };

  // 装備中（ショップでは試着中）のスキンと演出を、描画側へ渡す
  function applyLook() {
    const useShop = screen === 'shop';
    const skinId = useShop ? sc.shop.skin : sc.save.skin;
    sc.kit = kitOf(skinId);
    sc.fx = useShop ? sc.shop.fx : sc.save.fx;
  }

  function openStages() {
    sc.daily = dailyChallenge();
    sc.stageList = stageEntries(sc.save, sc.daily);
    const want = `s${Math.min(STAGE_COUNT, sc.save.stageClear + 1)}`;
    if (!sc.stageSel || !sc.stageList.some((e) => e.id === sc.stageSel && !e.locked)) sc.stageSel = want;
    const idx = Math.max(0, sc.stageList.findIndex((e) => e.id === sc.stageSel));
    sc.stageScroll = Math.max(0, Math.min(stageMaxScroll(sc.stageList.length), (idx - 3) * ST_ROW_H));
    screen = 'stages';
    applyLook();
  }

  function reset() {
    screen = 'tree';
    sc.save = loadSave();
    sc.sel = 'core';
    sc.pan = { x: 0, y: 0 };
    sc.msg = '';
    sc.msgT = 0;
    sc.t = 0;
    sc.nodePop = {};
    sc.effects = [];
    sc.shake = 0;
    sc.flash.a = 0;
    sc.shownPts = sc.save.points;
    sc.run = null;
    sc.res = null;
    sc.combo = { n: 0, t: 0, pop: 0 };
    sc.codex = { tab: 'weapons', sel: 'bomb', scroll: 0, slotAsk: 0, slotAskT: 0 };
    sc.choiceT = 0;
    drag = null;
    listDrag = null;
    lastFxId = 0;
    lastOpts = null;
    lastKey = false;
    waveScore = 0;
    lastSnd = {};
    runInfo = null;
    applyLook();
    if (sc.save.migrated) {
      persist(); // 返金は一度だけ（保存して、次からは新しい形式で読む）
      sc.msg = `武器の購入に使った ${sc.save.migrated} P を返金しました`;
      sc.msgT = 6;
      sc.save.migrated = 0;
    }
    if (resumeStages) {
      resumeStages = false;
      openStages();
    }
  }

  const say = (m) => {
    sc.msg = m;
    sc.msgT = 2;
  };
  // 同じ種類の効果音が連続しすぎないように間引く
  const snd = (key, gap, fn) => {
    if (sc.clock - (lastSnd[key] ?? -9) < gap) return;
    lastSnd[key] = sc.clock;
    fn();
  };
  const flash = (col, a) => {
    sc.flash.col = col;
    sc.flash.a = Math.max(sc.flash.a, a);
  };
  const clampPan = () => {
    sc.pan.x = Math.max(-PAN_LIMIT, Math.min(PAN_LIMIT, sc.pan.x));
    sc.pan.y = Math.max(-PAN_LIMIT, Math.min(PAN_LIMIT, sc.pan.y));
  };
  const fanfare = (notes = [660, 880, 1175, 1568]) => notes.forEach((f, i) => setTimeout(() => sound.beep(f, 0.12, 'sine', 0.06), i * 70));

  // ---- ツリー ----
  function buy() {
    const r = canBuy(sc.save.owned, sc.save.points, sc.sel);
    if (!r.ok) {
      say(r.why);
      sound.beep(200, 0.08, 'sawtooth', 0.05);
      return;
    }
    const n = NODE[sc.sel];
    sc.save.owned.add(sc.sel);
    sc.save.points -= n.cost;
    // 「最初から装備する」武器のノードは、その武器の発見にもなる
    for (const [wid, node] of Object.entries(TREE_WEAPON_NODE)) {
      if (node === sc.sel && !sc.save.discovered.weapons.includes(wid)) sc.save.discovered.weapons.push(wid);
    }
    persist();
    const p = nodeScreenPos(sc, n);
    const col = sc.kit.branchColor(n.id, 0);
    spawnFx(sc, 'buy', p.x, p.y, col);
    sc.nodePop[n.id] = 0;
    flash(col, 0.18);
    fanfare();
    if (n.unlock) setTimeout(() => sound.noise(0.3, 0.05, 1500), 120);
  }

  function refund() {
    const r = canRefund(sc.save.owned, sc.sel);
    if (!r.ok) {
      say(r.why || '戻せません');
      sound.beep(200, 0.08, 'sawtooth', 0.05);
      return;
    }
    const n = NODE[sc.sel];
    sc.save.owned.delete(sc.sel);
    sc.save.points += n.cost;
    persist();
    const p = nodeScreenPos(sc, n);
    spawnFx(sc, 'refund', p.x, p.y, sc.kit.branchColor(n.id, 0));
    sound.beep(440, 0.08, 'triangle', 0.06);
    sound.beep(330, 0.1, 'triangle', 0.05);
  }

  function onTreeTap(x, y) {
    if (inside(x, y, BTN_GO)) {
      openStages();
      sound.beep(660, 0.06, 'sine', 0.06);
      return;
    }
    if (inside(x, y, BTN_ARMORY)) {
      screen = 'codex';
      sc.codex.scroll = 0;
      sound.beep(740, 0.06, 'square', 0.05);
      return;
    }
    if (inside(x, y, BTN_SHOP)) {
      screen = 'shop';
      sc.shop = { sel: `skin:${sc.save.skin}`, skin: sc.save.skin, fx: sc.save.fx };
      applyLook();
      sound.beep(700, 0.06, 'square', 0.05);
      return;
    }
    if (inside(x, y, BTN_BUY)) {
      if (sc.save.owned.has(sc.sel)) refund();
      else buy();
      return;
    }
    if (!inside(x, y, MAP)) return;
    let best = null;
    let bd = NODE_R * 1.5;
    for (const n of TREE) {
      const p = nodeScreenPos(sc, n);
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bd) {
        bd = d;
        best = n;
      }
    }
    if (best) {
      sc.sel = best.id;
      sc.msg = '';
      sound.beep(520 + TREE.indexOf(best) * 8, 0.04, 'sine', 0.04);
    }
  }

  // ドラッグで地図を動かし、動かさずに離したらタップとして扱う（押す・離すが同じ 1 フレームでも取りこぼさない）
  function updateTree(dt) {
    sc.msgT -= dt;
    if (input.pressed) {
      drag = { sx: input.x, sy: input.y, lx: input.x, ly: input.y, moved: false, inMap: inside(input.x, input.y, MAP) };
    }
    if (drag && input.pointerDown) {
      if (Math.hypot(input.x - drag.sx, input.y - drag.sy) > 6) drag.moved = true;
      if (drag.moved && drag.inMap) {
        sc.pan.x += input.x - drag.lx;
        sc.pan.y += input.y - drag.ly;
        clampPan();
      }
      drag.lx = input.x;
      drag.ly = input.y;
    }
    if (drag && input.released) {
      if (!drag.moved) onTreeTap(drag.sx, drag.sy);
      drag = null;
    } else if (drag && !input.pointerDown) {
      drag = null; // 離した通知を取りこぼしたとき
    }
    if (input.keyAction && !input.pointerDown) openStages();
  }

  // 上下ドラッグでスクロールし、動かさずに離したらタップとして扱う一覧
  function updateList(listRect, getScroll, setScroll, maxScroll, onTap) {
    if (input.pressed) listDrag = { sx: input.x, sy: input.y, ly: input.y, moved: false, inList: inside(input.x, input.y, listRect) };
    if (listDrag && input.pointerDown) {
      if (Math.hypot(input.x - listDrag.sx, input.y - listDrag.sy) > 6) listDrag.moved = true;
      if (listDrag.moved && listDrag.inList) setScroll(Math.max(0, Math.min(maxScroll, getScroll() - (input.y - listDrag.ly))));
      listDrag.ly = input.y;
    }
    if (listDrag && input.released) {
      if (!listDrag.moved) onTap(listDrag.sx, listDrag.sy);
      listDrag = null;
    } else if (listDrag && !input.pointerDown) listDrag = null;
  }

  // ---- ステージ選択 ----
  function startRun(entry) {
    const sv = sc.save;
    const stage = entry.stage; // 1〜10 / 0 無限 / -1 今日の挑戦
    const daily = stage === -1;
    const mods = daily ? sc.daily.mods : stage > 0 ? STAGE_INFO[stage].mods : [];
    const stats = computeStats(sv.owned);
    // ツリーで「最初から装備する」武器
    const loadout = Object.entries(TREE_WEAPON_NODE).filter(([, node]) => sv.owned.has(node)).map(([id]) => ({ id, level: 1 }));
    const discovered = new Set(sv.discovered.weapons);
    sc.run = createBattle(stats, daily ? seededRng(sc.daily.seed) : Math.random, {
      stage: daily ? 0 : stage, mods, leveling: true, slots: sv.slots, discovered, loadout,
    });
    runInfo = { stage, entry, found: { weapons: [], syn: [], relics: [] }, discovered, dailyKey: daily ? sc.daily.key : null };
    sc.effects = [];
    sc.combo = { n: 0, t: 0, pop: 0 };
    sc.choiceT = 0;
    lastFxId = 0;
    lastOpts = null;
    screen = 'battle';
    applyLook();
    flash('#ffffff', 0.35);
    [440, 660, 990].forEach((f, i) => setTimeout(() => sound.beep(f, 0.1, 'sine', 0.06), i * 60));
  }

  function onStageTap(x, y) {
    if (inside(x, y, BTN_ST_BACK)) {
      screen = 'tree';
      sound.beep(500, 0.05, 'square', 0.05);
      return;
    }
    const entry = sc.stageList.find((e) => e.id === sc.stageSel);
    if (inside(x, y, BTN_ST_GO)) {
      if (entry && !entry.locked) startRun(entry);
      else sound.beep(200, 0.08, 'sawtooth', 0.05);
      return;
    }
    if (inside(x, y, ST_LIST)) {
      for (const row of stageRows(sc)) {
        if (inside(x, y, row.rect)) {
          sc.stageSel = row.id;
          sound.beep(560, 0.04, 'sine', 0.04);
          return;
        }
      }
    }
  }

  function updateStages(dt) {
    sc.msgT -= dt;
    updateList(ST_LIST, () => sc.stageScroll, (v) => { sc.stageScroll = v; }, stageMaxScroll(sc.stageList.length), onStageTap);
  }

  // ---- 図鑑 ----
  function buySlot(i) {
    const s = sc.save;
    const a = sc.codex;
    const cost = SLOT_COST[i + 1];
    if (a.slotAsk === i + 1 && sc.t - a.slotAskT < 3) {
      if (s.points < cost) {
        say('ポイントが足りません');
        sound.beep(200, 0.08, 'sawtooth', 0.05);
        return;
      }
      s.points -= cost;
      s.slots++;
      a.slotAsk = 0;
      persist();
      flash(sc.kit.skin.gold, 0.2);
      sc.kit.burst(slotRect(i).x + 7, slotRect(i).y + 8, [sc.kit.skin.gold, '#ffffff'], 30, 110, 20);
      fanfare([880, 1175, 1568]);
      say(`武器の枠が ${s.slots} になった`);
    } else {
      a.slotAsk = i + 1;
      a.slotAskT = sc.t;
      say(`枠を増やす（${cost} P）もう一度タップで決定`);
      sound.beep(700, 0.05, 'square', 0.04);
    }
  }

  function onCodexTap(x, y) {
    const a = sc.codex;
    const s = sc.save;
    if (inside(x, y, BTN_CX_BACK)) {
      screen = 'tree';
      sound.beep(500, 0.05, 'square', 0.05);
      return;
    }
    for (const t of CX_TABS) {
      if (inside(x, y, t.rect)) {
        a.tab = t.id;
        a.sel = codexItems(t.id)[0].id;
        a.scroll = 0;
        sound.beep(600, 0.04, 'sine', 0.04);
        return;
      }
    }
    if (inside(x, y, SLOT_STRIP)) {
      for (let i = 0; i < SLOT_MAX; i++) {
        if (!inside(x, y, slotRect(i))) continue;
        if (i === s.slots) buySlot(i);
        else if (i > s.slots) say('先に手前の枠を増やしてください');
        return;
      }
      return;
    }
    if (inside(x, y, CX_LIST)) {
      for (const row of codexRows(sc)) {
        if (inside(x, y, row.rect)) {
          a.sel = row.id;
          sound.beep(560, 0.04, 'sine', 0.04);
          return;
        }
      }
    }
  }

  function updateCodex(dt) {
    sc.msgT -= dt;
    updateList(CX_LIST, () => sc.codex.scroll, (v) => { sc.codex.scroll = v; }, codexMaxScroll(sc.codex.tab), onCodexTap);
  }

  // ---- ショップ ----
  function shopItem() {
    const [type, id] = sc.shop.sel.split(':');
    return { type, id, item: (type === 'skin' ? SKINS : EFFECTS).find((x) => x.id === id) };
  }

  function updateShop(dt) {
    sc.msgT -= dt;
    if (!input.pressed) return;
    const { x, y } = input;
    if (inside(x, y, BTN_GO)) {
      screen = 'tree';
      applyLook();
      sound.beep(500, 0.05, 'square', 0.05);
      return;
    }
    if (inside(x, y, BTN_BUY)) {
      const { type, id, item } = shopItem();
      const s = sc.save;
      const owned = type === 'skin' ? s.skinsOwned : s.fxOwned;
      const equipped = (type === 'skin' ? s.skin : s.fx) === id;
      if (equipped) return;
      if (!owned.has(id)) {
        if (s.points < item.price) {
          sound.beep(200, 0.08, 'sawtooth', 0.05);
          return;
        }
        s.points -= item.price;
        owned.add(id);
        flash('#ffffff', 0.3);
        sc.kit.burst(120, 150, [sc.kit.skin.gold, '#ffffff', sc.kit.skin.me], 60, 160, 40);
        fanfare([660, 880, 1175, 1568, 1976]);
      } else {
        sound.beep(880, 0.06, 'square', 0.05);
      }
      if (type === 'skin') s.skin = id;
      else s.fx = id;
      persist();
      return;
    }
    for (const row of shopLayout().rows) {
      if (!inside(x, y, row.rect)) continue;
      const id = (row.type === 'skin' ? SKINS : EFFECTS)[row.idx].id;
      sc.shop.sel = `${row.type}:${id}`;
      if (row.type === 'skin') sc.shop.skin = id;
      else sc.shop.fx = id;
      applyLook();
      sc.kit.burst(x, y, [sc.kit.skin.me, sc.kit.skin.op], 8, 60, 10);
      sound.beep(600 + row.idx * 60, 0.04, 'sine', 0.04);
    }
  }

  // ---- 戦闘 ----
  // 挑戦の終わり（倒された・ステージクリア・撤退）。ポイント・発見・星・実績をまとめて保存する。
  function finishRun(retreat) {
    if (!sc.run || screen !== 'battle') return;
    const { b } = sc.run;
    const s = sc.save;
    const stage = runInfo.stage;
    const earned = sc.run.earned();
    let bonus = 0;
    if (b.cleared && stage > 0) {
      if (stage > s.stageClear) bonus += 100 * stage;
      const prev = s.stars[stage] || 0;
      if (b.stars > prev) {
        bonus += 50 * stage * (b.stars - prev);
        s.stars[stage] = b.stars;
      }
      s.stageClear = Math.max(s.stageClear, stage);
    }
    if (stage === -1 && !retreat && !(s.daily.key === runInfo.dailyKey && s.daily.done)) {
      bonus += 40 + 8 * b.wave;
      s.daily = { key: runInfo.dailyKey, done: true };
    }
    if (stage <= 0) s.bestWave = Math.max(s.bestWave, b.wave);
    s.points += earned + bonus;
    s.runs++;
    s.bestCombo = Math.max(s.bestCombo, b.combo.best);
    s.bestRelics = Math.max(s.bestRelics, b.relics.length);
    s.discovered.weapons = uniq([...s.discovered.weapons, ...runInfo.discovered]);
    // 実績
    const got = [];
    const p = achProgress(s);
    for (const a of ACHIEVEMENTS) {
      if (!s.ach.includes(a.id) && a.check(p)) {
        s.ach.push(a.id);
        s.points += a.reward;
        got.push(`${a.name}（+${a.reward} P）`);
      }
    }
    persist();
    sc.res = {
      t: 0, stage, wave: b.wave, level: b.level, earned, bonus, cleared: b.cleared, stars: b.stars, retreat, relics: b.relics.length,
      combo: b.combo.best, total: s.points, found: runInfo.found, ach: got, newBest: stage <= 0 && b.wave >= s.bestWave,
    };
    waveScore = b.cleared ? stage * 10 : stage > 0 ? (stage - 1) * 10 + b.wave : b.wave;
    screen = 'result';
    resumeStages = true;
    sc.shownPts = s.points;
    sc.stageSel = b.cleared && stage > 0 && stage < STAGE_COUNT ? `s${stage + 1}` : runInfo.entry.id;
    sc.run = null;
    sc.kit.burst(120, 120, [sc.kit.skin.gold, sc.kit.skin.me, '#ffffff'], b.cleared ? 90 : 40, 160, 50);
    if (b.cleared) fanfare([523, 659, 784, 1047, 1319]);
    env.end();
  }

  // 戦闘のイベント（演出・効果音・画面の揺れ・発見の記録）を、新しく起きた分だけ拾う
  function handleFx() {
    const { b } = sc.run;
    const sk = sc.kit.skin;
    for (const f of b.fx) {
      if (f.id <= lastFxId) continue;
      lastFxId = f.id;
      if (f.kind === 'pop' && f.kill) {
        spawnFx(sc, 'kill', f.x, f.y, sc.kit.enemyColor(f.type, 0));
        sc.combo.n = sc.combo.t > 0 ? sc.combo.n + 1 : 1;
        sc.combo.t = 1.3;
        sc.combo.pop = 1;
        snd('kill', 0.045, () => sound.beep(520 + Math.min(18, sc.combo.n) * 40 + Math.random() * 30, 0.05, 'triangle', 0.04));
      } else if (f.kind === 'pop') {
        sc.kit.burst(f.x, f.y, [sk.bad, '#ffffff'], 8, 70, 0);
      } else if (f.kind === 'boom') {
        spawnFx(sc, 'boom', f.x, f.y, sk.gold);
        sc.shake = Math.max(sc.shake, 4);
        snd('boom', 0.08, () => {
          sound.noise(0.35, 0.09, 700);
          sound.beep(110, 0.18, 'sawtooth', 0.05);
        });
      } else if (f.kind === 'bolt') {
        const last = f.pts[f.pts.length - 1];
        sc.kit.burst(last.x, last.y, [sc.kit.c(sk.me, 1), '#ffffff'], f.manual ? 4 : 8, 90, 0, 'spark', 1.8);
        snd('bolt', 0.07, () => sound.beep(f.manual ? 1200 : 1500 - f.pts.length * 90, 0.08, 'sawtooth', 0.035));
      } else if (f.kind === 'muzzle') {
        spawnFx(sc, 'muzzle', ARENA.cx + Math.cos(f.a) * 14, ARENA.cy + Math.sin(f.a) * 14, sc.kit.c(sk.me, 0));
        snd('shot', 0.07, () => sound.beep(900 + Math.random() * 120, 0.03, 'square', 0.02));
      } else if (f.kind === 'towerHit') {
        spawnFx(sc, 'hit', f.x, f.y, sk.bad);
        sc.shake = Math.max(sc.shake, 6 + Math.min(6, f.dmg * 0.5));
        flash(sk.bad, 0.22);
        snd('hit', 0.1, () => {
          sound.noise(0.25, 0.1, 400);
          sound.beep(140, 0.15, 'square', 0.06);
        });
      } else if (f.kind === 'wave') {
        spawnFx(sc, 'wave', ARENA.cx, ARENA.cy, sc.kit.c(sk.me, 0));
        flash('#ffffff', 0.18);
        if (f.boss) {
          sc.shake = Math.max(sc.shake, 5);
          sound.noise(0.5, 0.08, 300);
          [220, 165, 130].forEach((hz, i) => setTimeout(() => sound.beep(hz, 0.2, 'sawtooth', 0.06), i * 120));
        } else [330, 495, 660].forEach((hz, i) => setTimeout(() => sound.beep(hz, 0.12, 'sine', 0.05), i * 80));
      } else if (f.kind === 'pierce') {
        sc.kit.spray(f.x, f.y, f.a, 0.3, 9, [sk.gold, '#ffffff', sc.kit.c(sk.me, 1)], 210, sk.part, 2.2);
        sc.shake = Math.max(sc.shake, 1.2);
        snd('pierce', 0.05, () => {
          sound.beep(1650 + f.n * 140, 0.05, 'sawtooth', 0.04);
          sound.beep(900, 0.04, 'square', 0.025);
        });
      } else if (f.kind === 'syn') {
        spawnFx(sc, 'syn', f.x, f.y, sk.gold);
        flash(sk.gold, 0.12);
        snd('syn', 0.3, () => [880, 1320, 1760].forEach((hz, i) => setTimeout(() => sound.beep(hz, 0.09, 'triangle', 0.05), i * 45)));
        if (!sc.save.discovered.syn.includes(f.syn)) {
          // 初めての組み合わせ効果: 図鑑に記録
          sc.save.discovered.syn.push(f.syn);
          runInfo.found.syn.push(f.syn);
          sc.flash.a = Math.max(sc.flash.a, 0.3);
          fanfare([784, 988, 1175, 1568]);
          persist();
        }
      } else if (f.kind === 'ring' && f.tag === 'physical') {
        sc.shake = Math.max(sc.shake, 2);
      } else if (f.kind === 'levelup') {
        spawnFx(sc, 'clear', ARENA.cx, ARENA.cy, sk.gold);
        fanfare([660, 880, 1320]);
      } else if (f.kind === 'gotWeapon') {
        sc.kit.burst(ARENA.cx, ARENA.cy, [f.color, '#ffffff'], f.unknown ? 50 : 20, 140, 30);
        if (f.unknown) {
          runInfo.found.weapons.push(f.wid);
          flash(f.color, 0.3);
          fanfare([880, 1175, 1568, 1976]);
        }
      } else if (f.kind === 'chest') {
        snd('chest', 0.3, () => fanfare([784, 1047, 1319]));
        sc.kit.burst(f.x, f.y, [sk.gold, '#ffffff'], 24, 120, 40);
      } else if (f.kind === 'gotRelic') {
        if (!sc.save.discovered.relics.includes(f.rid)) {
          sc.save.discovered.relics.push(f.rid);
          runInfo.found.relics.push(f.rid);
        }
        flash(f.color, 0.2);
        fanfare([660, 988, 1319]);
      } else if (f.kind === 'contract') {
        flash(f.color, 0.2);
        sound.noise(0.2, 0.06, 600);
      } else if (f.kind === 'overdrive') {
        flash(sk.gold, 0.35);
        sc.shake = Math.max(sc.shake, 3);
        [330, 495, 660, 990].forEach((hz, i) => setTimeout(() => sound.beep(hz, 0.15, 'sawtooth', 0.05), i * 50));
      } else if (f.kind === 'bossIn') {
        sc.shake = Math.max(sc.shake, 6);
      } else if (f.kind === 'bossDown') {
        flash('#ffffff', 0.5);
        sc.shake = 10;
        sc.kit.burst(f.x, f.y, [sk.gold, sk.bad, '#ffffff'], 120, 220, 60);
        sound.noise(0.8, 0.12, 600);
        fanfare([392, 523, 659, 784]);
      } else if (f.kind === 'eshoot') {
        snd('eshoot', 0.15, () => sound.beep(300, 0.06, 'square', 0.03));
      }
    }
  }

  function chooseByTap(rects, onPick) {
    if (input.pressed) {
      for (let i = 0; i < rects.length; i++) if (inside(input.x, input.y, rects[i])) return onPick(i);
    }
    // 数字キー（PC）
    const k = ['1', '2', '3', '4'].findIndex((c) => input.keys.has(c));
    if (k >= 0 && k < rects.length && !lastKey) {
      lastKey = true;
      return onPick(k);
    }
    if (k < 0) lastKey = false;
    return null;
  }

  function updateBattle(dt) {
    const { b } = sc.run;
    // 選択が出ている間は、戦闘が止まる
    if (b.options) {
      if (lastOpts !== b.options) {
        lastOpts = b.options;
        sc.choiceT = 0;
        sound.beep(900, 0.06, 'triangle', 0.05);
      }
      sc.choiceT += dt;
      if (input.pressed && inside(input.x, input.y, BTN_REROLL)) {
        if (sc.run.reroll()) sound.beep(700, 0.05, 'square', 0.05);
        else sound.beep(200, 0.08, 'sawtooth', 0.05);
        return;
      }
      chooseByTap(cardRects(b.options.length), (i) => {
        if (sc.choiceT < 0.25) return; // 出た直後の誤タップ防止
        sc.run.pick(i);
        sound.beep(1100, 0.07, 'sine', 0.06);
        handleFx();
      });
      return;
    }
    if (b.relicOpts) {
      sc.choiceT += dt;
      chooseByTap(cardRects(b.relicOpts.length), (i) => {
        if (sc.choiceT < 0.3) return;
        sc.run.chooseRelic(i);
        sc.choiceT = 0;
        handleFx();
      });
      return;
    }
    if (b.event) {
      sc.choiceT += dt;
      chooseByTap(cardRects(3), (i) => {
        if (sc.choiceT < 0.3) return;
        sc.run.chooseContract(i < 2 ? i : -1);
        sc.choiceT = 0;
        handleFx();
      });
      return;
    }
    sc.choiceT = 0;
    if (input.pressed) {
      if (inside(input.x, input.y, BTN_RETREAT)) {
        finishRun(true);
        return;
      }
      if (inside(input.x, input.y, BTN_SPEED)) {
        sc.save.speed = (sc.save.speed % 3) + 1;
        persist();
        sound.beep(500 + sc.save.speed * 150, 0.05, 'square', 0.05);
        return;
      }
      if (inside(input.x, input.y, BTN_OD)) {
        sc.run.overdrive();
        return;
      }
      if (sc.run.tap(input.x, input.y)) snd('tap', 0.05, () => sound.beep(1100, 0.04, 'square', 0.04));
    }
    // 倍速: 同じ時間幅で、何度か進める
    for (let k = 0; k < sc.save.speed; k++) {
      sc.run.step(dt);
      handleFx();
      if (b.over || b.options || b.relicOpts || b.event) break;
    }
    if (b.over) finishRun(false);
  }

  // 演出の時計（結果画面でもシェルから呼ばれる）
  function tick(dt) {
    sc.clock += dt;
    sc.t += dt;
    sc.kit.clock = sc.clock;
    sc.kit.update(dt);
    for (const f of sc.effects) f.t += dt;
    sc.effects = sc.effects.filter((f) => f.t < f.life);
    sc.shake = Math.max(0, sc.shake - dt * 22);
    sc.flash.a = Math.max(0, sc.flash.a - dt * 1.6);
    sc.combo.t -= dt;
    sc.combo.pop = Math.max(0, sc.combo.pop - dt * 6);
    for (const id of Object.keys(sc.nodePop)) {
      sc.nodePop[id] += dt;
      if (sc.nodePop[id] > 0.5) delete sc.nodePop[id];
    }
    if (sc.save) sc.shownPts += (sc.save.points - sc.shownPts) * Math.min(1, dt * 7);
    if (sc.res) sc.res.t += dt;
  }

  function update(dt) {
    tick(dt);
    if (screen === 'tree') updateTree(dt);
    else if (screen === 'stages') updateStages(dt);
    else if (screen === 'codex') updateCodex(dt);
    else if (screen === 'shop') updateShop(dt);
    else if (screen === 'battle') updateBattle(dt);
  }

  function draw(g) {
    if (screen === 'battle' && sc.run) {
      drawBattle(g, sc);
      const { b } = sc.run;
      if (b.options) drawChoice(g, sc, 'levelup');
      else if (b.relicOpts) drawChoice(g, sc, 'relic');
      else if (b.event) drawChoice(g, sc, 'contract');
    } else if (screen === 'stages') drawStageSelect(g, sc);
    else if (screen === 'codex') drawCodex(g, sc);
    else if (screen === 'shop') drawShop(g, sc);
    else drawTree(g, sc);
  }

  reset();

  return {
    reset,
    update,
    draw,
    tick,
    drawOver(g, ui) {
      drawResultNew(g, sc, ui);
    },
    dispose() {
      // 途中でメニューへ戻った場合も、稼いだポイントと見つけたものは受け取る
      if (screen === 'battle' && sc.run) {
        const s = sc.save;
        s.points += sc.run.earned();
        s.discovered.weapons = uniq([...s.discovered.weapons, ...runInfo.discovered]);
        persist();
      }
    },
    hiRes: 2,
    noHud: true,
    skipReady: true,
    silentOver: true,
    get score() { return waveScore; },
  };
}
