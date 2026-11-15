// ツリー砦の、30 波・中ボス/大ボス（HP の段階）・接触ルールの検証（描画なし）。
// 実行: node works/collection/tests/tree-fort-boss.test.mjs
import assert from 'node:assert/strict';
import { createBattle, STAGE_WAVES, TYPES, ARENA, TUNE } from '../app/src/games/tree-fort-battle.js';
import { computeStats } from '../app/src/games/tree-fort-data.js';
import { CONTRACT_WAVES } from '../app/src/games/tree-fort-meta.js';

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

const STRONG = computeStats(['core', 'atk1', 'atk2', 'spd1', 'spd2', 'def1', 'def2', 'def3', 'def4']);
const { cx, cy } = ARENA;
// 指定した波まで、敵を出さずに早送りして、その波の敵を出す
function atWave(stage, wave, stats = STRONG) {
  const sim = createBattle(stats, seeded(5), { stage, leveling: false });
  sim.b.wave = wave - 1;
  sim.b.phase = 'rest';
  sim.b.restT = 0;
  sim.b.tower.hp = sim.b.tower.max = 99999;
  for (let i = 0; i < 5; i++) sim.step(1 / 30);
  return sim;
}
// その波の敵を出し切るまで進めて、ボスが出たかを返す（次の波には進まない）
function spawnBoss(sim) {
  const w0 = sim.b.wave;
  for (let i = 0; i < 30 * 20 && sim.b.wave === w0 && !sim.b.boss; i++) sim.step(1 / 30);
  return sim.b.boss;
}

test('waves: ステージは 30 波。10・20 波は中ボス、30 波は大ボス。ほかの波にボスは出ない', () => {
  assert.equal(STAGE_WAVES, 30);
  const kind = (w) => {
    const sim = atWave(1, w);
    const e = spawnBoss(sim);
    return e ? e.tier : null;
  };
  assert.equal(kind(9), null);
  assert.equal(kind(10), 'mid');
  assert.equal(kind(11), null);
  assert.equal(kind(20), 'mid');
  assert.equal(kind(30), 'big');
});

test('waves: 無限モードも 10 波ごとに中ボス、30 波ごとに大ボス', () => {
  const kind = (w) => {
    const sim = atWave(0, w);
    const e = spawnBoss(sim);
    return e ? e.tier : null;
  };
  assert.equal(kind(10), 'mid');
  assert.equal(kind(30), 'big');
  assert.equal(kind(40), 'mid');
  assert.equal(kind(60), 'big');
  assert.equal(kind(45), null);
});

test('boss: 中ボスの HP は 2 段階、大ボスは 3 段階。大ボスのほうが体力が多い', () => {
  const mid = spawnBoss(atWave(1, 10));
  const big = spawnBoss(atWave(1, 30));
  assert.equal(mid.phases, 2);
  assert.equal(big.phases, 3);
  assert.ok(big.max > mid.max, '大ボスの体力が多くない');
  assert.ok(mid.r < big.r);
});

test('boss: 1 段階を削り切ると、そこで止まって外へ弾かれ、しばらく無敵。一撃で何段階も飛ばさない', () => {
  const sim = atWave(1, 30);
  const e = spawnBoss(sim);
  e.x = cx + 40;
  e.y = cy;
  const d0 = Math.hypot(e.x - cx, e.y - cy);
  // 全体を一撃で削るほどのダメージを与える
  sim.b.stats.dmg = e.max * 5;
  sim.tap(e.x, e.y);
  assert.equal(e.phase, 1, '1 段階だけ進む');
  assert.ok(Math.abs(e.hp - e.max * (2 / 3)) < 1e-6, `段階の境目で止まる（${e.hp}）`);
  assert.ok(e.invul > 0 && e.kbT > 0);
  const hpBefore = e.hp;
  sim.tap(e.x, e.y);
  sim.b.cd.tap = 0;
  assert.equal(e.hp, hpBefore, '無敵の間は傷つかない');
  for (let i = 0; i < 30; i++) sim.step(1 / 30);
  const d1 = Math.hypot(e.x - cx, e.y - cy);
  assert.ok(d1 > d0 + 40, `外へ弾かれる（${d0.toFixed(0)} → ${d1.toFixed(0)}）`);
  assert.ok(sim.b.fx.some((f) => f.kind === 'bossBreak') || e.phase === 1);
});

test('boss: 最後の段階を削ると倒れる。中ボスを倒すと宝箱（遺物）が出る', () => {
  const sim = atWave(1, 10);
  const e = spawnBoss(sim);
  e.x = cx + 40;
  e.y = cy;
  sim.b.stats.dmg = e.max * 5;
  sim.tap(e.x, e.y);
  assert.equal(e.phase, 1);
  e.invul = 0;
  sim.b.cd.tap = 0;
  sim.b.leveling = true;
  sim.tap(e.x, e.y);
  assert.ok(e.dead, '最後の段階で倒れる');
  assert.ok(sim.b.relicOpts || sim.b.relicPending > 0, '中ボスが宝箱を落とす');
});

test('contact: 雑魚は、砦にぶつかると、砦も敵もダメージを受ける。弱い敵は倒れ、体力のある敵は小さく弾かれる', () => {
  const sim = createBattle(STRONG, seeded(9), { stage: 0, leveling: false, onlyTypes: ['grunt'] });
  sim.b.tower.hp = sim.b.tower.max = 99999;
  for (let i = 0; i < 30 * 5 && sim.b.enemies.length < 1; i++) sim.step(1 / 30);
  // 雑魚: ぶつかって倒れる
  const grunt = sim.b.enemies.find((e) => !e.dead);
  grunt.x = cx + 14;
  grunt.y = cy;
  const hp0 = sim.b.tower.hp;
  sim.step(1 / 30);
  assert.ok(sim.b.tower.hp < hp0, '砦がダメージを受ける');
  assert.ok(grunt.dead, '弱い敵はぶつかって倒れる');
  // 体力のある敵（重装）: 生き残って弾かれる
  const sim2 = createBattle(STRONG, seeded(9), { stage: 0, leveling: false, onlyTypes: ['tank'] });
  sim2.b.tower.hp = sim2.b.tower.max = 99999;
  for (let i = 0; i < 30 * 8 && sim2.b.enemies.length < 1; i++) sim2.step(1 / 30);
  const tank = sim2.b.enemies.find((e) => !e.dead);
  tank.hp = tank.max = TYPES.tank.hp * 6;
  tank.x = cx + 15;
  tank.y = cy;
  const d0 = Math.hypot(tank.x - cx, tank.y - cy);
  sim2.step(1 / 30);
  assert.ok(!tank.dead && tank.hp < tank.max, '体力のある敵は、ダメージを受けても生き残る');
  for (let i = 0; i < 12; i++) sim2.step(1 / 30);
  assert.ok(Math.hypot(tank.x - cx, tank.y - cy) > d0, '小さく弾かれる');
});

test('contact: ボスは、砦にぶつかると、ダメージを受けつつ大きく弾かれる（倒れない）', () => {
  const sim = atWave(1, 30);
  const e = spawnBoss(sim);
  e.x = cx + 20;
  e.y = cy;
  const hp0 = e.hp;
  const t0 = sim.b.tower.hp;
  sim.step(1 / 30);
  assert.ok(sim.b.tower.hp < t0, '砦がダメージを受ける');
  assert.ok(e.hp < hp0, 'ボスもダメージを受ける');
  assert.ok(!e.dead);
  const d0 = Math.hypot(e.x - cx, e.y - cy);
  for (let i = 0; i < 25; i++) sim.step(1 / 30);
  assert.ok(Math.hypot(e.x - cx, e.y - cy) > d0 + 30, '大きく弾かれる');
});

test('contract: 契約が出る波は、ボス（10・20・30 波）の前に準備できる位置にある', () => {
  assert.deepEqual(CONTRACT_WAVES, [5, 15, 25]);
  for (const w of CONTRACT_WAVES) assert.ok(w % 10 !== 0 && w < STAGE_WAVES);
});

test('balance: ボスは自動の攻撃に強く、手動の攻撃は通る。介入（OD）はボーナスポイントになる', () => {
  assert.ok(TUNE.bossAutoK < 1 && TUNE.bossHp > 1, 'ボスは放置では厳しい設定');
  const sim = createBattle(STRONG, seeded(7), { stage: 1, leveling: false, slots: 3, loadout: [{ id: 'bomb', level: 10 }] });
  const e = { type: 'boss', hp: 1000, max: 1000, x: cx + 60, y: cy, r: 10, hitT: 0, st: {} };
  sim.b.enemies.push(e);
  sim.hurt(e, 100, {});
  const auto = 1000 - e.hp;
  e.hp = 1000;
  sim.hurt(e, 100, { manual: true });
  const manual = 1000 - e.hp;
  assert.ok(manual > auto * 2, `手動 ${manual} / 自動 ${auto}`);
  const p0 = sim.b.act.pts;
  sim.b.od.gauge = 100;
  assert.ok(sim.overdrive());
  assert.equal(sim.b.act.od, 1);
  assert.ok(sim.b.act.pts > p0, 'ODでボーナスポイントが入る');
});

console.log(`\n${passed} 件すべて成功`);
