// 武器の要素（5 つ × 12 武器）の検証: 式がそろい、レベルとともに強くなり、画面用の値が正しく出る（描画なし）。
// 実行: node works/collection/tests/tree-fort-elements.test.mjs
import assert from 'node:assert/strict';
import { ELEMENTS, EV, MAX_K, weaponElements, upgradeChanges, shown, makeEV } from '../app/src/games/tree-fort-elements.js';
import { WEAPONS } from '../app/src/games/tree-fort-weapons.js';
import { TREE, NODE, computeStats, canBuy } from '../app/src/games/tree-fort-data.js';
import { createBattle, tagMulOf } from '../app/src/games/tree-fort-battle.js';
import { RELIC } from '../app/src/games/tree-fort-meta.js';

let passed = 0;
const test = (name, fn) => {
  fn();
  passed++;
  console.log(`ok - ${name}`);
};

test('elements: 12 武器すべてに、名前が重ならない要素が 5 つずつある', () => {
  assert.equal(Object.keys(ELEMENTS).length, WEAPONS.length);
  for (const w of WEAPONS) {
    const list = ELEMENTS[w.id];
    assert.ok(list, `${w.id} の要素がない`);
    assert.equal(list.length, 5, `${w.id} は 5 要素`);
    assert.equal(new Set(list.map((e) => e.key)).size, 5, `${w.id} のキーが重なる`);
    assert.equal(new Set(list.map((e) => e.name)).size, 5, `${w.id} の名前が重なる`);
    for (const e of list) for (let L = 1; L <= 10; L++) assert.ok(Number.isFinite(e.get(L)) && e.get(L) >= 0, `${w.id}.${e.key} Lv${L}`);
  }
});

test('elements: 各要素は、レベルが上がっても弱くならない（間隔・予告時間は短くなる）', () => {
  for (const w of WEAPONS) {
    for (const e of ELEMENTS[w.id]) {
      for (let L = 2; L <= 10; L++) {
        const a = e.get(L - 1);
        const b = e.get(L);
        if (e.lower) assert.ok(b <= a + 1e-9, `${w.id}.${e.key} Lv${L} で遅くなる（${a} → ${b}）`);
        else assert.ok(b >= a - 1e-9, `${w.id}.${e.key} Lv${L} で弱くなる（${a} → ${b}）`);
      }
    }
    // 要素のどれかは、Lv1 より Lv10 で強い
    assert.ok(ELEMENTS[w.id].some((e) => (e.lower ? e.get(10) < e.get(1) : e.get(10) > e.get(1))), `${w.id} が伸びない`);
  }
});

test('elements: 戦闘が読む式（EV）が、要素と同じ値を返す。MAX の威力は ×1.25 で表示される', () => {
  assert.equal(EV.missile.count(5), 6);
  assert.equal(EV.missile.count(9), 10);
  assert.equal(EV.bomb.radius(1), 30);
  assert.equal(EV.bomb.radius(3), 38);
  assert.ok(Math.abs(EV.missile.dmg(1) - 1.6) < 1e-9);
  const dmg = ELEMENTS.missile.find((e) => e.key === 'dmg');
  assert.equal(shown(dmg, 10), EV.missile.dmg(10) * MAX_K);
  assert.equal(shown(dmg, 9), EV.missile.dmg(9));
  // Lv10 だけの特典
  assert.equal(EV.flame.arc(10), Math.PI);
  assert.equal(EV.drone.shots(10), 4);
  assert.equal(EV.mine.count(10), 5);
});

test('screen: 武器をタップしたときの一覧に、現在値・増減・次の値・進み具合が出る', () => {
  const rows = weaponElements('missile', 7);
  assert.equal(rows.length, 5);
  const count = rows.find((r) => r.key === 'count');
  assert.equal(count.cur, '8 発');
  assert.equal(count.next, '8');
  assert.ok(count.changed && count.better && count.delta === '+2', `弾数が増えたと出る（${count.delta}）`);
  assert.ok(count.ratio > 0 && count.ratio < 1);
  const first = weaponElements('missile', 1);
  assert.ok(first.every((r) => !r.changed && r.delta === ''), 'Lv1 は増減なし');
  const max = weaponElements('missile', 10);
  assert.ok(max.every((r) => r.next === null) && max.every((r) => r.ratio >= 0.999), 'Lv10 は次なし・満タン');
  // 間隔は短いほど強い: 進み具合が、短くなるほど増える
  const cd5 = weaponElements('missile', 5).find((r) => r.key === 'cd');
  const cd9 = weaponElements('missile', 9).find((r) => r.key === 'cd');
  assert.ok(cd9.ratio > cd5.ratio, '間隔が短くなるほど進み具合が増える');
  // 新しく現れる要素は「新規」と出る
  const kids = weaponElements('bomb', 5).find((r) => r.key === 'kids');
  assert.equal(kids.delta, '新規');
});

test('screen: 強化カード用に、次のレベルで変わる要素が短い文で出る', () => {
  const ch = upgradeChanges('missile', 2);
  assert.ok(ch.length >= 1 && ch.length <= 3);
  assert.ok(ch.every((s) => s.includes('→')));
  assert.deepEqual(upgradeChanges('missile', 10), [], 'Lv10 の次はない');
});

test('arm: 要素の分類。威力・連射・範囲・数・持続に振り分けられ、効果が極端になる要素は対象外', () => {
  for (const w of WEAPONS) assert.ok(ELEMENTS[w.id].some((e) => e.cat === 'dmg'), `${w.id} に威力の分類がない`);
  const cat = (id, key) => ELEMENTS[id].find((e) => e.key === key).cat;
  assert.equal(cat('missile', 'count'), 'count');
  assert.equal(cat('missile', 'cd'), 'rate');
  assert.equal(cat('missile', 'aoe'), 'size');
  assert.equal(cat('frost', 'time'), 'time');
  for (const [id, key] of [['bomb', 'repeat'], ['bomb', 'kids'], ['lightning', 'strikes'], ['drone', 'shots'], ['meteor', 'delay'], ['frost', 'slow'], ['blade', 'spin']]) {
    assert.equal(cat(id, key), null, `${id}.${key} は対象外`);
  }
});

test('arm: ツリーの底上げが、分類ごとに要素へ掛かる（威力 ×、連射 間隔 −、範囲 ×、数 +、持続 ×）', () => {
  const st = { wdmg: 0.2, wrate: 0.2, wsize: 0.2, wcount: 2, wtime: 0.3 };
  const ev = makeEV(st);
  assert.ok(Math.abs(ev.missile.dmg(5) - EV.missile.dmg(5) * 1.2) < 1e-9);
  assert.ok(Math.abs(ev.missile.cd(5) - EV.missile.cd(5) * 0.8) < 1e-9);
  assert.ok(Math.abs(ev.missile.aoe(5) - EV.missile.aoe(5) * 1.2) < 1e-9);
  assert.equal(ev.missile.count(5), EV.missile.count(5) + 2);
  assert.ok(Math.abs(ev.frost.time(5) - EV.frost.time(5) * 1.3) < 1e-9);
  assert.equal(ev.bomb.repeat(9), EV.bomb.repeat(9), '対象外は変わらない');
  assert.equal(ev.bomb.kids(1), 0, '0 の要素（なし）は、数が足されて現れない');
  assert.ok(ev.flame.arc(10) <= Math.PI + 1e-9, '扇は 360° まで');
  assert.equal(makeEV({ wrate: 5 }).missile.cd(5), EV.missile.cd(5) * 0.4, '連射の短縮は 60% まで');
  // 画面用の値にも掛かる
  const a = weaponElements('missile', 5).find((r) => r.key === 'count');
  const b = weaponElements('missile', 5, st).find((r) => r.key === 'count');
  assert.equal(a.cur, '6 発');
  assert.equal(b.cur, '8 発');
});

test('arm: ツリーの 10 ノード（武器強化）が、位置・前提・効果どおりにそろい、全部取ると +20% / −20% / +20% / +2 / +30%', () => {
  const arms = TREE.filter((n) => n.id.startsWith('arm'));
  assert.equal(arms.length, 10);
  const pos = new Set(TREE.map((n) => `${n.gx},${n.gy}`));
  assert.equal(pos.size, TREE.length, 'ノードの位置が重なる');
  for (const n of arms) for (const r of n.req) assert.ok(NODE[r], `${n.id} の前提 ${r}`);
  const st = computeStats(TREE.map((n) => n.id));
  assert.ok(Math.abs(st.wdmg - 0.2) < 1e-9 && Math.abs(st.wrate - 0.2) < 1e-9 && Math.abs(st.wsize - 0.2) < 1e-9 && st.wcount === 2 && Math.abs(st.wtime - 0.3) < 1e-9);
  // 前の枝が必要
  assert.equal(canBuy(new Set(['core']), 9999, 'arm2').ok, false);
  assert.equal(canBuy(new Set(['core']), 9999, 'arm1').ok, true);
  // 費用（2.5 倍済み）
  assert.equal(NODE.arm1.cost, 60);
  assert.equal(NODE.arm4.cost, 200);
  assert.equal(NODE.arm9.cost, 400);
});

test('arm: 数が増えても、氷結弾・レーザー・毒霧・全武器が例外なく動く（Lv1・5・10）', () => {
  const stats = { ...computeStats(['core', 'atk1', 'def1', 'def2', 'def3']), wdmg: 0.2, wrate: 0.2, wsize: 0.2, wcount: 2, wtime: 0.3 };
  for (const w of WEAPONS) {
    for (const level of [1, 5, 10]) {
      let s = 5;
      const rng = () => ((s = (s * 16807) % 2147483647) / 2147483647);
      const sim = createBattle(stats, rng, { stage: 0, loadout: [{ id: w.id, level }] });
      sim.b.tower.hp = sim.b.tower.max = 99999;
      for (let i = 0; i < 30 * 25; i++) sim.step(1 / 30);
      assert.ok(sim.b.kills > 0, `${w.id} Lv${level} が動かない`);
    }
  }
});

test('elem: ツリーの「属性」の枝 6 ノードが、位置・前提・効果どおりにそろう', () => {
  const nodes = TREE.filter((n) => n.id.startsWith('elem'));
  assert.equal(nodes.length, 6);
  assert.equal(new Set(TREE.map((n) => `${n.gx},${n.gy}`)).size, TREE.length, 'ノードの位置が重なる');
  for (const n of nodes) {
    assert.equal(n.cost, 150, `${n.id} は 150 P`);
    for (const r of n.req) assert.ok(NODE[r]);
  }
  assert.equal(canBuy(new Set(['core']), 9999, 'elem2').ok, false);
  assert.equal(canBuy(new Set(['core']), 9999, 'elem1').ok, true);
  const st = computeStats(nodes.map((n) => n.id).concat('core'));
  for (const k of ['tfire', 'tice', 'tlightning', 'tpoison', 'tlight', 'tgravity']) assert.ok(Math.abs(st[k] - 0.2) < 1e-9, k);
  assert.deepEqual(computeStats(['core']).tfire, 0);
});

test('elem: 属性の枝は、その属性（と継続ダメージ）の与ダメージだけを +20% し、遺物と重なる', () => {
  const tm = tagMulOf({ tfire: 0.2, tgravity: 0.2, tice: 0 });
  assert.ok(Math.abs(tm.fire - 1.2) < 1e-9 && Math.abs(tm.burn - 1.2) < 1e-9, '火は燃焼も');
  assert.ok(Math.abs(tm.gravity - 1.2) < 1e-9 && Math.abs(tm.physical - 1.2) < 1e-9, '重力・物理');
  assert.equal(tm.ice, undefined);
  assert.deepEqual(tagMulOf(computeStats(['core'])), {});
  const dmgOf = (owned, tag, relic) => {
    let s = 3;
    const rng = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const sim = createBattle(computeStats(owned), rng, { stage: 0, onlyTypes: ['tank'], leveling: false });
    sim.b.tower.hp = sim.b.tower.max = 99999;
    for (let i = 0; i < 30 * 12 && !sim.b.enemies.length; i++) sim.step(1 / 30);
    const e = sim.b.enemies[0];
    e.hp = e.max = 100000;
    if (relic) {
      sim.b.relicOpts = [RELIC.ember];
      sim.chooseRelic(0);
    }
    const h = e.hp;
    sim.hurt(e, 100, { tag, noCrit: true, manual: true });
    return h - e.hp;
  };
  const base = dmgOf(['core'], 'fire');
  assert.ok(Math.abs(dmgOf(['core', 'elem1'], 'fire') / base - 1.2) < 1e-6, '火 +20%');
  assert.ok(Math.abs(dmgOf(['core', 'elem1'], 'ice') / dmgOf(['core'], 'ice') - 1) < 1e-6, '氷は変わらない');
  assert.ok(Math.abs(dmgOf(['core', 'elem1'], 'fire', true) / base - 1.2 * 1.3) < 1e-6, '遺物（火 +30%）と重なる');
});

console.log(`\n${passed} 件すべて成功`);
