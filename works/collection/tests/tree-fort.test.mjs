// ツリー砦のデータと戦闘の検証（描画なし）。実行: node works/collection/tests/tree-fort.test.mjs
import assert from 'node:assert/strict';
import { TREE, NODE, START_OWNED, computeStats, canBuy, canRefund, BASE_STATS } from '../app/src/games/tree-fort-data.js';
import { createBattle, simulate } from '../app/src/games/tree-fort-battle.js';

let passed = 0;
const test = (name, fn) => {
  fn();
  passed++;
  console.log(`ok - ${name}`);
};

// 乱数を固定して再現できるようにする
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

test('tree: id が一意で、前提がすべて存在し、核から全ノードへたどれる', () => {
  const ids = new Set(TREE.map((n) => n.id));
  assert.equal(ids.size, TREE.length);
  for (const n of TREE) for (const r of n.req) assert.ok(ids.has(r), `${n.id} の前提 ${r} がない`);
  const reach = new Set(START_OWNED);
  let grew = true;
  while (grew) {
    grew = false;
    for (const n of TREE) {
      if (!reach.has(n.id) && n.req.every((r) => reach.has(r))) {
        reach.add(n.id);
        grew = true;
      }
    }
  }
  assert.equal(reach.size, TREE.length);
});

test('tree: 位置の重複がなく、fx は既知の能力値だけを指す', () => {
  const pos = new Set(TREE.map((n) => `${n.gx},${n.gy}`));
  assert.equal(pos.size, TREE.length);
  for (const n of TREE) for (const k of Object.keys(n.fx || {})) assert.ok(k in BASE_STATS, `${n.id}: 未知の能力値 ${k}`);
});

test('stats: 何も取らなければ基本値、全部取れば全攻撃が解放される', () => {
  const base = computeStats(START_OWNED);
  assert.equal(base.dmg, BASE_STATS.dmg);
  assert.deepEqual(base.weapons, { bomb: false, lightning: false, blade: false });
  const all = computeStats(TREE.map((n) => n.id));
  assert.deepEqual(all.weapons, { bomb: true, lightning: true, blade: true });
  assert.ok(all.dmg > base.dmg && all.hp > base.hp && all.rate > base.rate);
  assert.ok(all.crit <= 1 && all.reduce <= 0.8);
});

test('buy/refund: 前提・ポイント・依存の規則どおりに動く', () => {
  const owned = new Set(START_OWNED);
  assert.equal(canBuy(owned, 100, 'atk2').ok, false); // 前の枝が必要
  assert.equal(canBuy(owned, NODE.atk1.cost - 1, 'atk1').ok, false); // ポイント不足
  assert.equal(canBuy(owned, NODE.atk1.cost, 'atk1').ok, true);
  owned.add('atk1');
  assert.equal(canBuy(owned, 100, 'atk1').ok, false); // 取得済み
  owned.add('atk2');
  assert.equal(canRefund(owned, 'atk1').ok, false); // atk2 が依存
  assert.equal(canRefund(owned, 'atk2').ok, true);
  assert.equal(canRefund(owned, 'core').ok, false);
});

test('battle: 砦は撃ち、敵を倒してポイントを得る', () => {
  const sim = createBattle(computeStats(START_OWNED), seeded(3));
  for (let i = 0; i < 30 * 12; i++) sim.step(1 / 30);
  assert.ok(sim.b.kills > 0, '何も倒せていない');
  assert.ok(sim.earned() > 0);
  assert.ok(sim.b.wave >= 1);
});

test('battle: タップ攻撃は近い敵にだけ当たり、クールダウンがある', () => {
  const sim = createBattle(computeStats(START_OWNED), seeded(5));
  for (let i = 0; i < 30 * 4; i++) sim.step(1 / 30);
  const e = sim.b.enemies[0];
  assert.ok(e, '敵がいない');
  assert.equal(sim.tap(e.x, e.y), true);
  assert.equal(sim.tap(e.x, e.y), false, 'クールダウン中は撃てない');
  assert.equal(createBattle(computeStats(START_OWNED), seeded(5)).tap(5, 5), false, '敵がいない所は空振り');
});

// ツリーで解放した武器を Lv1 で装備した状態にする
const loadoutOf = (st) => Object.entries(st.weapons).filter(([, v]) => v).map(([id]) => ({ id, level: 1 }));

// 強化ごとの到達波（バランス確認）。乱数のばらつきを避けるため複数回の平均で比べる。
const avgWave = (ids, n = 6) => {
  const st = computeStats(ids);
  let sum = 0;
  for (let i = 0; i < n; i++) sum += simulate(st, seeded(100 + i), loadoutOf(st)).wave;
  return sum / n;
};

test('balance: 初期状態は数波で倒れ、強化するほど遠くまで行ける', () => {
  const w0 = avgWave(START_OWNED);
  const early = avgWave(['core', 'atk1', 'spd1', 'def1']);
  const mid = avgWave(['core', 'atk1', 'atk2', 'atk3', 'spd1', 'spd2', 'spd3', 'def1', 'def2', 'eco1']);
  const all = avgWave(TREE.map((n) => n.id));
  console.log(`   平均到達波: 初期 ${w0.toFixed(1)} / 序盤 ${early.toFixed(1)} / 中盤 ${mid.toFixed(1)} / 全開放 ${all.toFixed(1)}`);
  assert.ok(w0 >= 2 && w0 <= 7, `初期の到達波 ${w0}`);
  assert.ok(early > w0, '序盤の強化で伸びない');
  assert.ok(mid > early, '中盤の強化で伸びない');
  assert.ok(all > mid + 3, '全開放が強くなっていない');
});

test('balance: 攻撃の種類を増やすと強くなる（爆弾・雷・刃のそれぞれ）', () => {
  const base = ['core', 'atk1', 'atk2', 'spd1', 'spd2', 'def1', 'def2'];
  const w = avgWave(base);
  for (const [name, extra] of [['bomb', ['atk3', 'atk4', 'atk5']], ['lightning', ['spd3', 'spd4', 'spd5']], ['blade', ['def3', 'def4', 'def5']]]) {
    const w2 = avgWave([...base, ...extra]);
    console.log(`   ${name}: ${w.toFixed(1)} → ${w2.toFixed(1)}`);
    assert.ok(w2 > w, `${name} で伸びない`);
  }
});

test('economy: 初期の 1 回の挑戦でツリーの最初の数個が買える', () => {
  let sum = 0;
  for (let i = 0; i < 6; i++) sum += simulate(computeStats(START_OWNED), seeded(200 + i), { tap: true }).points; // 放置では、すぐ負けて、ほとんど稼げない
  const avg = sum / 6;
  console.log(`   初期の 1 回の獲得ポイント: ${avg.toFixed(0)}`);
  assert.ok(avg >= 10, `ポイントが少なすぎる ${avg}`);
  assert.ok(avg <= 400, `ポイントが多すぎる ${avg}`);
  // 放置より、タップするほうがずっと稼げる（操作が効いている）
  let idle = 0;
  for (let i = 0; i < 6; i++) idle += simulate(computeStats(START_OWNED), seeded(200 + i)).points;
  assert.ok(avg > (idle / 6) * 1.5, `タップしても放置と変わらない（タップ ${avg} / 放置 ${idle / 6}）`);
});

console.log(`\n${passed} 件すべて成功`);
