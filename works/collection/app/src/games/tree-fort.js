// ツリー砦: スキルツリーを広げて砦を強くする、短い周回のタワーディフェンス。
// ツリー画面で、ためたポイントを使ってノードを開放（ドラッグで動かす・タップで選ぶ）→「出撃」で戦闘。
// 戦闘は砦が自動で攻撃し、押し寄せる敵の波を守る（画面タップで追加の一撃）。倒れる（または撤退）と、
// 稼いだポイントがツリーに入る。取得済みのノードは、いつでも無料で戻せる（返金）。
// ショップ: ポイントで「スキン（見た目）」と「演出（幾何学・曼荼羅など）」を買える。選ぶとその場でプレビュー。
// データ: tree-fort-data.js / 戦闘: tree-fort-battle.js / 見た目: tree-fort-skins.js・tree-fort-view.js
import { inside } from '../core/draw.js';
import { Store } from '../core/storage.js';
import { NODE, TREE, START_OWNED, computeStats, canBuy, canRefund } from './tree-fort-data.js';
import { createBattle, ARENA } from './tree-fort-battle.js';
import { SKINS, EFFECTS, makeKit } from './tree-fort-skins.js';
import {
  MAP, NODE_R, BTN_BUY, BTN_GO, BTN_SHOP, BTN_RETREAT, shopLayout, nodeScreenPos,
  drawTree, drawBattle, drawShop, drawResult, spawnFx,
} from './tree-fort-view.js';

const SAVE_ID = 'tree-fort-save';
const PAN_LIMIT = 140;
const kits = {};
const kitOf = (skinId) => {
  if (!kits[skinId]) kits[skinId] = makeKit(SKINS.find((s) => s.id === skinId) || SKINS[0]);
  return kits[skinId];
};

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
  return {
    owned,
    points: Math.max(0, Math.floor(raw?.points || 0)),
    bestWave: Math.max(0, Math.floor(raw?.bestWave || 0)),
    runs: Math.max(0, Math.floor(raw?.runs || 0)),
    skinsOwned,
    fxOwned,
    skin: skinsOwned.has(raw?.skin) ? raw.skin : 'neon',
    fx: fxOwned.has(raw?.fx) ? raw.fx : 'standard',
  };
}

export default function create(env) {
  const { W, H, input, sound } = env;

  // 画面の状態（描画側 tree-fort-view.js が読む）
  const sc = {
    W, H, clock: 0, t: 0, kit: kitOf('neon'), fx: 'standard', effects: [], shake: 0, flash: { a: 0, col: '#ffffff' },
    combo: { n: 0, t: 0, pop: 0 }, save: null, sel: 'core', pan: { x: 0, y: 0 }, nodePop: {}, shownPts: 0, msg: '', msgT: 0,
    shop: { sel: 'skin:neon', skin: 'neon', fx: 'standard' }, run: null, res: null,
  };
  let screen, drag, lastFxId, waveScore, lastSnd;

  const persist = () => {
    const s = sc.save;
    Store.save(SAVE_ID, {
      owned: [...s.owned], points: s.points, bestWave: s.bestWave, runs: s.runs,
      skinsOwned: [...s.skinsOwned], fxOwned: [...s.fxOwned], skin: s.skin, fx: s.fx,
    });
  };

  // 装備中（ショップでは試着中）のスキンと演出を、描画側へ渡す
  function applyLook() {
    const useShop = screen === 'shop';
    const skinId = useShop ? sc.shop.skin : sc.save.skin;
    sc.kit = kitOf(skinId);
    sc.fx = useShop ? sc.shop.fx : sc.save.fx;
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
    drag = null;
    lastFxId = 0;
    waveScore = 0;
    lastSnd = {};
    applyLook();
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
    persist();
    const p = nodeScreenPos(sc, n);
    const col = sc.kit.branchColor(n.id, 0);
    spawnFx(sc, 'buy', p.x, p.y, col);
    sc.nodePop[n.id] = 0;
    flash(col, 0.18);
    [660, 880, 1175, 1568].forEach((f, i) => setTimeout(() => sound.beep(f, 0.12, 'sine', 0.06), i * 70));
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

  function startRun() {
    sc.run = createBattle(computeStats(sc.save.owned));
    sc.effects = [];
    sc.combo = { n: 0, t: 0, pop: 0 };
    lastFxId = 0;
    screen = 'battle';
    applyLook();
    flash('#ffffff', 0.35);
    [440, 660, 990].forEach((f, i) => setTimeout(() => sound.beep(f, 0.1, 'sine', 0.06), i * 60));
  }

  function onTreeTap(x, y) {
    if (inside(x, y, BTN_GO)) {
      startRun();
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
    if (input.keyAction && !input.pointerDown) startRun();
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
        [660, 880, 1175, 1568, 1976].forEach((f, i) => setTimeout(() => sound.beep(f, 0.12, 'sine', 0.06), i * 70));
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
  function finishRun(retreat) {
    if (!sc.run || screen !== 'battle') return;
    const wave = sc.run.b.wave;
    const earned = sc.run.earned();
    const s = sc.save;
    s.points += earned;
    const newBest = wave > s.bestWave;
    s.bestWave = Math.max(s.bestWave, wave);
    s.runs++;
    persist();
    sc.res = { t: 0, wave, earned, total: s.points, retreat, newBest };
    waveScore = wave;
    screen = 'result';
    sc.shownPts = s.points;
    sc.run = null;
    sc.kit.burst(120, 120, [sc.kit.skin.gold, sc.kit.skin.me, '#ffffff'], 70, 160, 50);
    env.end();
  }

  // 戦闘のイベント（演出・効果音・画面の揺れ）を、新しく起きた分だけ拾う
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
        [330, 495, 660].forEach((hz, i) => setTimeout(() => sound.beep(hz, 0.12, 'sine', 0.05), i * 80));
      } else if (f.kind === 'clear') {
        spawnFx(sc, 'clear', ARENA.cx, ARENA.cy, sk.gold);
        [784, 988, 1175].forEach((hz, i) => setTimeout(() => sound.beep(hz, 0.1, 'sine', 0.05), i * 60));
      }
    }
  }

  function updateBattle(dt) {
    if (input.pressed) {
      if (inside(input.x, input.y, BTN_RETREAT)) {
        finishRun(true);
        return;
      }
      if (sc.run.tap(input.x, input.y)) snd('tap', 0.05, () => sound.beep(1100, 0.04, 'square', 0.04));
    }
    sc.run.step(dt);
    handleFx();
    if (sc.run.b.over) finishRun(false);
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
    else if (screen === 'shop') updateShop(dt);
    else if (screen === 'battle') updateBattle(dt);
  }

  function draw(g) {
    if (screen === 'battle' && sc.run) drawBattle(g, sc);
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
      drawResult(g, sc, ui);
    },
    dispose() {
      // 途中でメニューへ戻った場合も、稼いだポイントは受け取る
      if (screen === 'battle' && sc.run) {
        sc.save.points += sc.run.earned();
        sc.save.bestWave = Math.max(sc.save.bestWave, sc.run.b.wave);
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
