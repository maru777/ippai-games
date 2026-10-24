// ツリー砦の「遊びの幅」（遺物・精鋭・契約・特色・オーバードライブ・星・今日の挑戦・実績）の検証。描画なし。
// 実行: node works/collection/tests/tree-fort-meta.test.mjs
import assert from 'node:assert/strict';
import {
  STAGE_INFO, MODS, combineMods, dailyChallenge, RELICS, RELIC, relicOptions, CONTRACTS, ACHIEVEMENTS,
} from '../app/src/games/tree-fort-meta.js';
import { computeStats } from '../app/src/games/tree-fort-data.js';
import { createBattle, simulate, STAGE_COUNT } from '../app/src/games/tree-fort-battle.js';
import { autoPick } from '../app/src/games/tree-fort-run.js';
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
const ALL = new Set(WEAPONS.map((w) => w.id));
const BASE = computeStats(['core', 'atk1', 'spd1', 'def1']);

function settle(sim) {
  while (sim.b.options || sim.b.relicOpts || sim.b.event) {
    if (sim.b.options) sim.pick(autoPick(sim.b.options));
    else if (sim.b.relicOpts) sim.chooseRelic(0);
    else sim.chooseContract(0);
  }
}
const run = (opts, seed = 3, maxSec = 300, until) => {
  const sim = createBattle(BASE, seeded(seed), { leveling: true, slots: 3, discovered: new Set(ALL), ...opts });
  for (let i = 0; i < 30 * maxSec && !sim.b.over; i++) {
    settle(sim);
    sim.step(1 / 30);
    if (until && until(sim)) break;
  }
  return sim;
};

test('stage info: 10 ステージぶんの名前・ボス・特色が決まっていて、特色は実在する', () => {
  assert.equal(STAGE_INFO.length, STAGE_COUNT + 1);
  for (let s = 1; s <= STAGE_COUNT; s++) {
    const i = STAGE_INFO[s];
    assert.ok(i.name && i.boss);
    for (const m of i.mods) assert.ok(MODS[m], `${s}: ${m}`);
  }
});

test('mods: 特色をまとめた倍率が正しく掛かる', () => {
  assert.deepEqual(combineMods([]), { spd: 1, hp: 1, count: 1, armor: 0, spawn: 1, regen: 0, elite: 1, range: 1, pointAdd: 0, xp: 1 });
  const m = combineMods(['swift', 'horde', 'plated']);
  assert.equal(m.spd, 1.2);
  assert.equal(m.count, 1.35);
  assert.ok(Math.abs(m.hp - 0.85) < 1e-9);
  assert.equal(m.armor, 1.2);
});

test('mods: 霧は射程を減らし、疾風は敵の足を速くし、豊穣はポイントを増やす', () => {
  const st = computeStats(['core']);
  assert.ok(createBattle(st, seeded(1), { mods: ['fog'] }).b.stats.range < st.range);
  assert.ok(createBattle(st, seeded(1), { mods: ['wealthy'] }).b.stats.pointMul > st.pointMul);
  const speedOf = (mods) => {
    const sim = createBattle(st, seeded(2), { stage: 0, mods, onlyTypes: ['grunt'] });
    for (let i = 0; i < 30 * 4; i++) sim.step(1 / 30);
    return sim.b.enemies[0] ? sim.b.enemies[0].spd : 0;
  };
  assert.ok(speedOf(['swift']) > speedOf([]) * 1.15);
});

test('daily: 同じ日は同じ挑戦、日が変わると変わる。特色は 2 つ', () => {
  const a = dailyChallenge(new Date(2026, 9, 24));
  const b = dailyChallenge(new Date(2026, 9, 24));
  const c = dailyChallenge(new Date(2026, 9, 25));
  assert.deepEqual(a, b);
  assert.notEqual(a.seed, c.seed);
  assert.equal(a.mods.length, 2);
  for (const m of a.mods) assert.ok(MODS[m]);
  assert.equal(a.key, '2026-10-24');
});

test('relics: 16 種が重複なく、持っていないものから選択肢が出る', () => {
  assert.ok(RELICS.length >= 12);
  assert.equal(new Set(RELICS.map((r) => r.id)).size, RELICS.length);
  for (const r of RELICS) assert.ok(r.name && r.desc && /^#/.test(r.color));
  const have = ['ember', 'storm'];
  const opts = relicOptions(seeded(4), have, 3);
  assert.equal(opts.length, 3);
  assert.ok(opts.every((o) => !have.includes(o.id)));
  assert.equal(relicOptions(seeded(4), RELICS.map((r) => r.id), 3).length, 0, 'すべて持っていれば出ない');
});

test('relics: 精鋭の敵が宝箱を落とし、選ぶと効果が反映される', () => {
  const sim = run({ stage: 0 }, 5, 600, (s) => s.b.relicOpts);
  assert.ok(sim.b.relicOpts && sim.b.relicOpts.length === 3, '宝箱が出ない');
  const hpBefore = sim.b.stats.dmg;
  const r = sim.chooseRelic(0);
  assert.ok(r && sim.b.relics.includes(r.id));
  assert.equal(sim.b.relicOpts === null || sim.b.relicOpts.length > 0, true);
  assert.ok(sim.b.stats.dmg >= hpBefore);
  // 属性の強化は倍率として記録される
  const s2 = createBattle(BASE, seeded(6), { leveling: true });
  s2.b.relicOpts = [RELIC.ember, RELIC.venom, RELIC.frostheart];
  s2.b.relicPending = 3;
  s2.chooseRelic(0);
  assert.equal(s2.b.tagMul.fire, 1.3);
  s2.b.relicOpts = [RELIC.venom, RELIC.storm, RELIC.lens];
  s2.chooseRelic(0);
  assert.ok(s2.b.dotMul > 1);
});

test('contracts: ステージの 3 波・6 波の前に契約が出て、選ぶと効果が出る。見送りもできる', () => {
  const sim = run({ stage: 1 }, 7, 600, (s) => s.b.event);
  assert.ok(sim.b.event && sim.b.event.options.length === 2, '契約が出ない');
  assert.equal(sim.b.event.wave, 3);
  const t0 = sim.b.t;
  for (let i = 0; i < 10; i++) sim.step(1 / 30);
  assert.equal(sim.b.t, t0, '契約の選択中は止まる');
  sim.chooseContract(-1); // 見送り
  assert.equal(sim.b.event, null);
  assert.equal(sim.b.contracts.length, 0);
  const sim2 = run({ stage: 1 }, 7, 600, (s) => s.b.event);
  const id = sim2.b.event.options[0].id;
  sim2.chooseContract(0);
  assert.deepEqual(sim2.b.contracts, [id]);
  for (const c of CONTRACTS) assert.ok(c.name && c.give && c.get && typeof c.apply === 'function');
});

test('overdrive: 撃破でゲージがたまり、満タンで使うと 8 秒間つよくなる', () => {
  const sim = run({ stage: 0 }, 9, 300, (s) => s.b.od.gauge >= 100);
  assert.ok(sim.b.od.gauge >= 100, 'ゲージがたまらない');
  settle(sim); // 撃破と同時にレベルアップが出ていれば、先に選ぶ
  assert.equal(sim.overdrive(), true);
  assert.equal(sim.b.od.gauge, 0);
  assert.ok(sim.b.od.active > 7);
  assert.equal(sim.overdrive(), false, '使用中は重ねて使えない');
  for (let i = 0; i < 30 * 9; i++) {
    settle(sim);
    sim.step(1 / 30);
  }
  assert.equal(sim.b.od.active, 0);
});

test('stars: ステージクリアで星が決まる（★1 クリア / ★2 耐久が半分以上 / ★3 被弾 3 回以内）', () => {
  let got = null;
  for (let seed = 1; seed <= 6 && !got; seed++) {
    const r = simulate(BASE, seeded(seed), { stage: 1, leveling: true, slots: 3, discovered: new Set(ALL) });
    if (r.cleared) got = r;
  }
  assert.ok(got, 'ステージ 1 をクリアできない');
  assert.ok(got.stars >= 1 && got.stars <= 3);
});

test('achievements: 条件の関数が動き、id が一意', () => {
  assert.equal(new Set(ACHIEVEMENTS.map((a) => a.id)).size, ACHIEVEMENTS.length);
  const none = { stageClear: 0, stars: {}, discoveredWeapons: 3, discoveredSyn: 0, bestCombo: 0, relics: 0, bestWave: 0 };
  assert.ok(ACHIEVEMENTS.every((a) => a.check(none) === false));
  const all = { stageClear: 10, stars: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3 }, discoveredWeapons: 12, discoveredSyn: 11, bestCombo: 50, relics: 4, bestWave: 25 };
  assert.ok(ACHIEVEMENTS.every((a) => a.check(all) === true));
});

console.log(`\n${passed} 件すべて成功`);
