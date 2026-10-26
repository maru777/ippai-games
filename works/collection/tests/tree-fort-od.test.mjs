// ツリー砦の OD（オーバードライブ）の検証: タイプ・強化・保存の整形・戦闘での効果（描画なし）。
// 実行: node works/collection/tests/tree-fort-od.test.mjs
import assert from 'node:assert/strict';
import {
  OD_TYPES, OD_UPGRADES, OD_MAX_LV, OD_BASE_SEC, defaultOd, sanitizeOd, odConfig, odCost, odAct,
} from '../app/src/games/tree-fort-od.js';
import { computeStats } from '../app/src/games/tree-fort-data.js';
import { createBattle } from '../app/src/games/tree-fort-battle.js';

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
const battle = (od, seed = 3) => createBattle(BASE, seeded(seed), { stage: 0, od: odConfig(od) });
// 敵を数体出して、OD を満タンにして発動する
function ready(od) {
  const sim = battle(od);
  for (let i = 0; i < 30 * 12; i++) sim.step(1 / 30); // 敵を集める
  sim.b.od.gauge = 100;
  return sim;
}

test('data: タイプと強化の定義がそろい、費用が増えていく', () => {
  assert.ok(OD_TYPES.length >= 4);
  assert.equal(new Set(OD_TYPES.map((t) => t.id)).size, OD_TYPES.length);
  assert.equal(OD_TYPES[0].id, 'boost');
  assert.equal(OD_TYPES[0].price, 0, '加速は最初から持っている');
  for (const t of OD_TYPES) assert.ok(t.name && t.desc && t.start && /^#/.test(t.color), t.id);
  assert.equal(OD_UPGRADES.length, 3);
  for (const u of OD_UPGRADES) {
    assert.equal(u.costs.length, OD_MAX_LV);
    for (let i = 1; i < u.costs.length; i++) assert.ok(u.costs[i] > u.costs[i - 1], `${u.id} の費用が増えない`);
  }
});

test('save: 壊れた保存データは、安全な既定値に整えられる', () => {
  assert.deepEqual(sanitizeOd(undefined), defaultOd());
  assert.deepEqual(sanitizeOd('x'), defaultOd());
  const od = sanitizeOd({ type: 'ghost', owned: ['frost', 'ghost', 9], lv: { dur: 99, charge: -3, power: 'a', zzz: 1 } });
  assert.deepEqual(od.owned.sort(), ['boost', 'frost']);
  assert.equal(od.type, 'boost', '持っていないタイプは装備できない');
  assert.deepEqual(od.lv, { dur: OD_MAX_LV, charge: 0, power: 0 });
  assert.equal(sanitizeOd({ type: 'frost', owned: ['frost'] }).type, 'frost');
});

test('buy: タイプの購入・装備、強化の購入が、ポイントと上限どおりに動く', () => {
  const od = defaultOd();
  assert.equal(odAct(od, 0, 'type', 'blast').ok, false, 'ポイント不足');
  const r = odAct(od, 1000, 'type', 'blast');
  assert.ok(r.ok && r.paid === 250 && od.type === 'blast' && od.owned.includes('blast'));
  assert.equal(odAct(od, 1000, 'type', 'blast').ok, false, '装備中');
  assert.equal(odAct(od, 0, 'type', 'boost').paid, 0, '持っているタイプへの切り替えは無料');
  assert.equal(od.type, 'boost');
  for (let i = 0; i < OD_MAX_LV; i++) assert.ok(odAct(od, 9999, 'up', 'dur').ok);
  assert.equal(od.lv.dur, OD_MAX_LV);
  assert.equal(odCost(od, 'up', 'dur'), null);
  assert.equal(odAct(od, 9999, 'up', 'dur').ok, false, '最大');
  assert.equal(odAct(od, 10, 'up', 'power').ok, false, 'ポイント不足');
});

test('config: 強化が、持続時間・充電速度・ダメージ・発動時の効果に反映される', () => {
  const a = odConfig(defaultOd());
  assert.equal(a.dur, OD_BASE_SEC);
  assert.ok(a.dmgK === 1.25 && a.speedK === 1.7 && a.chargeK === 1);
  const od = defaultOd();
  od.lv = { dur: 5, charge: 5, power: 5 };
  const b = odConfig(od);
  assert.equal(b.dur, OD_BASE_SEC + 5);
  assert.ok(b.chargeK > 1.7 && b.dmgK > 1.25 * 1.25 && b.effK > 1.7);
});

test('battle: 持続時間は強化で延び、充電も強化で速くなる', () => {
  const od = defaultOd();
  od.lv = { dur: 3, charge: 5, power: 0 };
  const sim = ready(od);
  assert.ok(sim.overdrive());
  assert.equal(sim.b.od.active, OD_BASE_SEC + 3);
  const slow = battle(defaultOd(), 7);
  const fast = battle(od, 7);
  for (const sim2 of [slow, fast]) for (let i = 0; i < 30 * 20; i++) sim2.step(1 / 30);
  assert.ok(fast.b.od.gauge > slow.b.od.gauge || fast.b.od.gauge === 100, `充電が速くならない（${slow.b.od.gauge} / ${fast.b.od.gauge}）`);
});

test('battle: 爆裂は、発動の瞬間に全員にダメージ（威力で増える）', () => {
  const od = defaultOd();
  od.type = 'blast';
  od.owned.push('blast');
  const sim = ready(od);
  const before = sim.b.enemies.filter((e) => !e.dead).reduce((a, e) => a + e.hp, 0);
  assert.ok(before > 0, '敵がいない');
  assert.ok(sim.overdrive());
  const after = sim.b.enemies.filter((e) => !e.dead).reduce((a, e) => a + e.hp, 0);
  assert.ok(after < before || sim.b.enemies.every((e) => e.dead), '爆破されない');
});

test('battle: 氷結は、発動で全員が凍り、OD 中は敵が遅い。再生は、発動で耐久が回復する', () => {
  const f = defaultOd();
  f.type = 'frost';
  f.owned.push('frost');
  const sim = ready(f);
  assert.ok(sim.overdrive());
  assert.ok(sim.b.enemies.filter((e) => !e.dead).every((e) => e.freeze > 0), '凍らない');

  const r = defaultOd();
  r.type = 'regen';
  r.owned.push('regen');
  const sim2 = ready(r);
  sim2.b.tower.hp = sim2.b.tower.max * 0.4;
  const hp0 = sim2.b.tower.hp;
  assert.ok(sim2.overdrive());
  assert.ok(sim2.b.tower.hp >= hp0 + sim2.b.tower.max * 0.2, '耐久が回復しない');
});

test('battle: タイプごとに、OD 中のダメージ倍率と攻撃の勢いが違う（加速が最大）', () => {
  const dmgK = OD_TYPES.map((t) => odConfig({ ...defaultOd(), type: t.id, owned: ['boost', t.id] }).dmgK);
  assert.equal(Math.max(...dmgK), dmgK[0], '加速が一番ダメージが高い');
  const cfg = (id) => odConfig({ ...defaultOd(), type: id, owned: ['boost', id] });
  assert.ok(cfg('frost').slowK < 1 && cfg('regen').reduceK < 1 && cfg('blast').fireK > 1);
});

test('battle: 爆裂は、致命傷の瞬間にゲージが満タンなら自動発動して踏みとどまる（ほかのタイプ・ゲージ不足では倒れる）', () => {
  const od = (type) => ({ ...defaultOd(), type, owned: ['boost', type] });
  const hit = (sim) => {
    // 砦の耐久をほぼゼロにして、敵に触れさせる
    sim.b.tower.hp = 0.5;
    const e = sim.b.enemies.find((q) => !q.dead);
    e.x = 120;
    e.y = 172;
    sim.step(1 / 30);
  };
  const a = ready(od('blast'));
  hit(a);
  assert.ok(!a.b.over, '爆裂なのに倒れた');
  assert.ok(a.b.od.active > 0, 'OD が発動していない');
  assert.ok(a.b.tower.hp >= a.b.tower.max * 0.15 - 1e-6, '耐久が戻らない');
  assert.equal(a.b.odSaves, 1);
  assert.equal(a.b.od.gauge, 0, 'ゲージを使っていない');
  const b = ready(od('frost'));
  hit(b);
  assert.ok(b.b.over, '爆裂以外は踏みとどまらない');
  const c = ready(od('blast'));
  c.b.od.gauge = 99;
  hit(c);
  assert.ok(c.b.over, 'ゲージ不足でも踏みとどまった');
});

console.log(`\n${passed} 件すべて成功`);
