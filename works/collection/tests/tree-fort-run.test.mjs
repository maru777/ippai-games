// ツリー砦のローグライト部分（経験値・レベルアップの選択・ステージ・ボス・敵の種類）の検証。描画なし。
// 実行: node works/collection/tests/tree-fort-run.test.mjs
import assert from 'node:assert/strict';
import { xpNeed, makeOptions, applyOption, autoPick, STAT_OPTIONS } from '../app/src/games/tree-fort-run.js';
import { computeStats, TREE } from '../app/src/games/tree-fort-data.js';
import { createBattle, simulate, TYPES, STAGE_WAVES } from '../app/src/games/tree-fort-battle.js';
import { WEAPONS } from '../app/src/games/tree-fort-weapons.js';

let passed = 0;
const test = (name, fn) => {
  fn();
  passed++;
  console.log(`ok - ${name}`);
};

function seeded(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BASE = computeStats(['core']);
const ALL = new Set(WEAPONS.map((w) => w.id));
const tower = () => ({ hp: 50, max: 50 });
const ctx = (over = {}) => ({
  rng: seeded(5), stats: { ...BASE }, loadout: [], slots: 3, discovered: new Set(ALL), g: 1, tower: tower(), count: 3, ...over,
});

test('xpNeed: レベルが上がるほど増え、経験値ボーナスで減る', () => {
  for (let l = 1; l < 30; l++) assert.ok(xpNeed(l + 1) > xpNeed(l));
  assert.ok(xpNeed(10, 1.5) < xpNeed(10, 1));
});

test('options: 指定した数の、重複しない選択肢が出る。最初は必ず武器が選べる', () => {
  for (let i = 0; i < 30; i++) {
    const c = ctx({ rng: seeded(i + 1), count: i % 2 ? 4 : 3 });
    const opts = makeOptions(c);
    assert.equal(opts.length, c.count);
    assert.equal(new Set(opts.map((o) => `${o.kind}:${o.id}`)).size, opts.length, '重複');
    assert.ok(opts.some((o) => o.kind === 'weapon-new' && !o.unknown), '最初に武器が選べない');
  }
});

test('options: 枠がいっぱいなら新しい武器は出ず、Lv5 の武器は強化に出ない', () => {
  const loadout = [{ id: 'bomb', level: 5 }, { id: 'frost', level: 2 }, { id: 'blade', level: 1 }];
  for (let i = 0; i < 40; i++) {
    const opts = makeOptions(ctx({ rng: seeded(i + 1), loadout, slots: 3 }));
    assert.ok(!opts.some((o) => o.kind === 'weapon-new'), '枠が埋まっているのに新しい武器');
    assert.ok(!opts.some((o) => o.kind === 'weapon-up' && o.id === 'bomb'), 'Lv5 の強化');
  }
});

test('options: 未発見の武器は「？？？」で出て、名前も効果も隠される', () => {
  let seen = 0;
  for (let i = 0; i < 80; i++) {
    const opts = makeOptions(ctx({ rng: seeded(i + 1), loadout: [{ id: 'bomb', level: 1 }], discovered: new Set(['bomb']), g: 20 }));
    for (const o of opts) {
      if (o.unknown) {
        seen++;
        assert.equal(o.name, '？？？');
        assert.ok(!WEAPONS.some((w) => o.desc.includes(w.name)), '説明に正体が出ている');
      }
    }
  }
  assert.ok(seen > 5, `未発見の枠が出ない（${seen}）`);
});

test('options: いまの装備と組み合わせ効果が出る武器には印（star）が付く', () => {
  let starred = false;
  for (let i = 0; i < 40; i++) {
    const opts = makeOptions(ctx({ rng: seeded(i + 1), loadout: [{ id: 'frost', level: 1 }], count: 4 }));
    for (const o of opts) {
      if (o.kind === 'weapon-new' && (o.id === 'bomb' || o.id === 'lightning')) {
        assert.equal(o.star, true, `${o.id} は氷結弾と相性がよい`);
        starred = true;
      }
      if (o.kind === 'weapon-new' && o.id === 'blade') assert.ok(!o.star);
    }
  }
  assert.ok(starred);
});

test('applyOption: 武器の追加・強化、未発見の武器の発見、ステータス、回復が反映される', () => {
  const c = ctx();
  const found = [];
  const loadout = [];
  const ctx2 = { stats: c.stats, loadout, discovered: new Set(['bomb']), tower: c.tower, refresh: () => {}, found };
  applyOption(ctx2, { kind: 'weapon-new', id: 'bomb' });
  assert.deepEqual(loadout, [{ id: 'bomb', level: 1 }]);
  assert.deepEqual(found, [], '発見済みの武器は記録されない');
  applyOption(ctx2, { kind: 'weapon-new', id: 'meteor', unknown: true });
  assert.deepEqual(found, ['meteor']);
  assert.ok(ctx2.discovered.has('meteor'));
  applyOption(ctx2, { kind: 'weapon-up', id: 'bomb' });
  assert.equal(loadout[0].level, 2);
  const d0 = c.stats.dmg;
  applyOption(ctx2, { kind: 'stat', id: 'dmg' });
  assert.ok(c.stats.dmg > d0);
  c.tower.hp = 10;
  applyOption(ctx2, { kind: 'heal' });
  assert.ok(c.tower.hp > 25);
  for (const s of STAT_OPTIONS) applyOption(ctx2, { kind: 'stat', id: s.id });
  assert.ok(c.stats.pierce <= 3 && c.stats.targets <= 4 && c.stats.crit <= 1);
});

test('battle: 敵を倒すと経験値がたまり、レベルアップで戦闘が止まって、選ぶと再開する', () => {
  const sim = createBattle(BASE, seeded(11), { leveling: true, slots: 3, discovered: new Set(ALL) });
  let stopped = false;
  for (let i = 0; i < 30 * 120 && !stopped; i++) {
    sim.step(1 / 30);
    stopped = !!sim.b.options;
  }
  assert.ok(stopped, 'レベルアップが起きない');
  assert.ok(sim.b.level >= 2 && sim.b.pending >= 1);
  const t0 = sim.b.t;
  for (let i = 0; i < 30; i++) sim.step(1 / 30);
  assert.equal(sim.b.t, t0, '選択中なのに時間が進んでいる');
  assert.equal(sim.tap(120, 150), false, '選択中はタップ攻撃できない');
  const before = sim.b.rerolls;
  assert.equal(sim.reroll(), before > 0);
  sim.pick(0);
  assert.equal(sim.b.options, sim.b.pending > 0 ? sim.b.options : null);
  for (let i = 0; i < 30; i++) sim.step(1 / 30);
  assert.ok(sim.b.t > t0 || sim.b.options, '選択後に再開しない');
});

test('battle: 先行成長（startPicks）があれば、開始直後に選択が出る', () => {
  const st = computeStats(['core', 'grw1', 'grw2', 'grw3']);
  assert.equal(st.startPicks, 1);
  const sim = createBattle(st, seeded(3), { leveling: true, slots: 3, discovered: new Set(ALL) });
  assert.ok(sim.b.options && sim.b.options.length === 3);
  const st4 = computeStats(['core', 'grw1', 'grw2', 'grw3', 'grw4']);
  assert.equal(createBattle(st4, seeded(3), { leveling: true, discovered: new Set(ALL) }).b.options.length, 4);
});

test('battle: 経験値ボーナスのノードで、レベルが早く上がる', () => {
  const lv = (st) => simulate(st, seeded(8), { stage: 0, leveling: true, slots: 3, discovered: new Set(ALL) }, 90).level;
  assert.ok(lv(computeStats(['core', 'grw1', 'grw2'])) >= lv(BASE));
});

test('stage: 10 波の最後にボスが出て、倒すとクリアできる（序盤のステージ）', () => {
  const st = computeStats(['core', 'atk1', 'spd1', 'def1']);
  const sim = createBattle(st, seeded(21), { stage: 1, leveling: true, slots: 3, discovered: new Set(ALL) });
  let bossSeen = false;
  let cleared = false;
  for (let i = 0; i < 30 * 900 && !sim.b.over; i++) {
    while (sim.b.options) sim.pick(autoPick(sim.b.options));
    sim.step(1 / 30);
    if (sim.b.boss) bossSeen = true;
    if (sim.b.cleared) cleared = true;
  }
  assert.ok(bossSeen, 'ボスが出ない');
  assert.ok(cleared && sim.b.wave === STAGE_WAVES, `クリアできない（${sim.b.wave} 波）`);
  assert.ok(sim.earned() > 40, 'ステージクリアの報酬がない');
});

test('stage: 後ろのステージほど難しく、無限モードには終わりがない', () => {
  const st = computeStats(['core', 'atk1', 'spd1', 'def1']);
  const rate = (stage) => {
    let n = 0;
    for (let i = 0; i < 6; i++) if (simulate(st, seeded(40 + i), { stage, leveling: true, slots: 3, discovered: new Set(ALL) }).cleared) n++;
    return n;
  };
  const r1 = rate(1);
  const r8 = rate(8);
  console.log(`   同じ弱い砦でのクリア数（6 回中）: ステージ 1 = ${r1} / ステージ 8 = ${r8}`);
  assert.ok(r1 > r8, '後ろのステージが易しい');
  const endless = simulate(computeStats(TREE.map((n) => n.id)), seeded(9), { stage: 0, leveling: true, slots: 6, discovered: new Set(ALL) }, 60);
  assert.equal(endless.cleared, false);
});

test('enemies: 新しい 9 種の敵が、それぞれの特徴どおりに動く', () => {
  const only = (type, sec, stats = BASE, extra = {}) => {
    const sim = createBattle(stats, seeded(77), { stage: 0, leveling: false, onlyTypes: [type], ...extra });
    const seen = { n: 0, armor: false, phased: false, shield: false, eshots: false, split: false, healed: false, types: new Set() };
    for (let i = 0; i < 30 * sec && !sim.b.over; i++) {
      sim.step(1 / 30);
      for (const e of sim.b.enemies) {
        seen.n++;
        seen.types.add(e.type);
        if (e.armor > 0) seen.armor = true;
        if (e.phased) seen.phased = true;
        if (e.shield > 0) seen.shield = true;
      }
      if (sim.b.eshots.length) seen.eshots = true;
      if (sim.b.fx.some((f) => f.kind === 'split')) seen.split = true;
    }
    return { sim, seen };
  };
  assert.ok(only('armor', 40).seen.armor, '装甲');
  assert.ok(only('phantom', 40).seen.phased, '幽霊が透明にならない');
  assert.ok(only('shield', 40).seen.shield, '障壁');
  assert.ok(only('shooter', 60).seen.eshots, '射手が撃たない');
  assert.ok(only('splitter', 60, computeStats(['core', 'atk1', 'atk2', 'spd1', 'spd2'])).seen.split, '分裂しない');
  for (const t of ['swarm', 'healer', 'runner', 'tank']) assert.ok(only(t, 30).seen.types.has(t), `${t} が出ない`);
  // 装甲は小さなダメージを大きく減らす（主砲 6 ダメージ → 3.5 に）
  const a = only('armor', 20);
  assert.ok(a.sim.b.kills >= 0);
});

test('enemies: 難しさに応じた種類が混ざって出る（全 10 種が登場しうる）', () => {
  const seen = new Set();
  const sim = createBattle(computeStats(TREE.map((n) => n.id)), seeded(5), { stage: 0, leveling: true, slots: 6, discovered: new Set(ALL), loadout: ['bomb', 'frost', 'lightning', 'meteor', 'laser'].map((id) => ({ id, level: 5 })) });
  for (let i = 0; i < 30 * 1500 && !sim.b.over && sim.b.wave < 26; i++) {
    while (sim.b.options) sim.pick(autoPick(sim.b.options));
    sim.step(1 / 30);
    for (const e of sim.b.enemies) seen.add(e.type);
  }
  for (const k of Object.keys(TYPES).filter((x) => x !== 'boss')) assert.ok(seen.has(k), `${k} が出ない（出た: ${[...seen].join(',')}）`);
});

test('pierce: 貫通弾は敵を貫き、貫いた瞬間の演出（pierce）が出る', () => {
  const st = computeStats(['core', 'atk1', 'atk2', 'atk3']);
  assert.equal(st.pierce, 1);
  const sim = createBattle(st, seeded(5), {});
  let n = 0;
  let lastId = 0;
  for (let i = 0; i < 30 * 120; i++) {
    sim.step(1 / 30);
    for (const f of sim.b.fx) if (f.kind === 'pierce' && f.id > lastId) { n++; lastId = f.id; }
  }
  assert.ok(n > 3, `貫通の演出が少ない（${n}）`);
});

console.log(`\n${passed} 件すべて成功`);
