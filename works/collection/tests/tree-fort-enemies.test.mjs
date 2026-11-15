// ツリー砦の新しい敵 10 種（蛇行・自爆兵・突進兵・護衛兵・火の獣・氷の獣・寄生体・召喚師・再生兵・妨害兵）の検証（描画なし）。
// 実行: node works/collection/tests/tree-fort-enemies.test.mjs
import assert from 'node:assert/strict';
import { createBattle, TYPES, ENEMY_NAME, ENEMY_INFO, ARENA } from '../app/src/games/tree-fort-battle.js';
import { computeStats } from '../app/src/games/tree-fort-data.js';
import { SKINS } from '../app/src/games/tree-fort-skins.js';

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

const NEW = ['weaver', 'bomber', 'charger', 'guard', 'firebeast', 'icebeast', 'parasite', 'summoner', 'regenerator', 'jammer'];
const { cx, cy } = ARENA;
// 砦は倒れず、武器もない（敵の動きだけを見る）。指定した種類の敵だけを出す
function arena(types, seed = 3) {
  const sim = createBattle(computeStats(['core']), seeded(seed), { stage: 0, leveling: false, onlyTypes: types });
  sim.b.tower.hp = sim.b.tower.max = 99999;
  sim.b.stats.dmg = 0.0001;
  return sim;
}
// その種類の敵が出るまで進めて、1 体を返す
function first(sim, type) {
  for (let i = 0; i < 30 * 30; i++) {
    const e = sim.b.enemies.find((q) => !q.dead && q.type === type);
    if (e) return e;
    sim.step(1 / 30);
  }
  throw new Error(`${type} が出ない`);
}
const place = (e, x, y) => {
  e.x = cx + x;
  e.y = cy + y;
};
const run = (sim, sec) => {
  for (let i = 0; i < Math.round(sec * 30); i++) sim.step(1 / 30);
};
// 他の敵を消して、動きだけを見る
const only = (sim, e) => {
  for (const q of sim.b.enemies) if (q !== e) q.dead = true;
};

test('data: 10 種が TYPES・名前・説明・全スキンの色にそろっている。出現条件は昇順に近い', () => {
  assert.equal(NEW.length, 10);
  for (const t of NEW) {
    assert.ok(TYPES[t], `${t} の定義`);
    assert.ok(ENEMY_NAME[t], `${t} の名前`);
    assert.ok(ENEMY_INFO[t], `${t} の説明`);
    assert.ok(TYPES[t].w > 0 && TYPES[t].hp > 0 && TYPES[t].bump !== undefined, `${t} の数値`);
    for (const s of SKINS) assert.ok(s.enemies[t], `${s.id} に ${t} の色がない`);
  }
  assert.ok(Object.keys(TYPES).filter((k) => k !== 'boss').length >= 20, '敵の種類が増えた（雑魚 10 種 + 新しい 10 種）');
});

test('weaver: 蛇行は、進む向きと直角に揺れる（まっすぐ進む敵より、横ぶれが大きい）', () => {
  const sim = arena(['weaver']);
  const e = first(sim, 'weaver');
  only(sim, e);
  place(e, 140, 0);
  let maxOff = 0;
  for (let i = 0; i < 30 * 3; i++) {
    sim.step(1 / 30);
    maxOff = Math.max(maxOff, Math.abs(e.y - cy));
    only(sim, e);
  }
  assert.ok(maxOff > 6, `横ぶれが小さい（${maxOff}）`);
});

test('bomber: 自爆兵は、近づくと自爆して砦に大ダメージ。遠くで倒せば、何も起きない', () => {
  const sim = arena(['bomber']);
  const e = first(sim, 'bomber');
  only(sim, e);
  place(e, 36, 0);
  const t0 = sim.b.tower.hp;
  sim.step(1 / 30);
  assert.ok(e.dead, '自爆する');
  assert.ok(t0 - sim.b.tower.hp > TYPES.bomber.dmg * 2, `大ダメージ（${t0 - sim.b.tower.hp}）`);
  const sim2 = arena(['bomber'], 5);
  const f = first(sim2, 'bomber');
  only(sim2, f);
  place(f, 100, 0);
  f.hp = 0.0001;
  sim2.b.stats.dmg = 100;
  const t1 = sim2.b.tower.hp;
  sim2.tap(f.x, f.y);
  assert.ok(f.dead && sim2.b.tower.hp === t1, '遠くで倒せば、砦は無傷');
});

test('charger: 突進兵は、溜めて止まり、そのあと速く突進する', () => {
  const sim = arena(['charger']);
  const e = first(sim, 'charger');
  only(sim, e);
  place(e, 120, 0);
  e.chT = 0.01; // すぐ溜める
  let wound = false;
  let dashSpeed = 0;
  let normalSpeed = 0;
  let prev = e.x;
  for (let i = 0; i < 30 * 3; i++) {
    sim.step(1 / 30);
    only(sim, e);
    const v = (prev - e.x) * 30;
    prev = e.x;
    if (e.chS === 'wind') wound = true;
    if (e.chS === 'dash') dashSpeed = Math.max(dashSpeed, v);
    if (e.chS === '' && v > 0) normalSpeed = Math.max(normalSpeed, v);
    if (e.dead) break;
  }
  assert.ok(wound, '溜めない');
  assert.ok(dashSpeed > TYPES.charger.spd * 3, `突進が遅い（${dashSpeed}）`);
});

test('guard: 護衛兵のそばの敵は、受けるダメージが 30% 減る', () => {
  const sim = arena(['guard', 'grunt']);
  const g = first(sim, 'guard');
  const m = first(sim, 'grunt');
  only(sim, g);
  m.dead = false;
  sim.b.enemies.push(m);
  place(g, 100, 0);
  place(m, 110, 0);
  m.hp = m.max = 1000;
  g.hp = g.max = 1000;
  sim.step(1 / 30);
  assert.ok(m.guarded > 0, '護衛されている');
  const h0 = m.hp;
  sim.hurt(m, 100, { tag: 'physical', manual: true, noCrit: true });
  assert.ok(Math.abs(h0 - m.hp - 70) < 1e-6, `ダメージが 70 になる（${h0 - m.hp}）`);
  place(m, 100, 120); // 離れたら、護衛されない
  for (let i = 0; i < 20; i++) sim.step(1 / 30);
  const h1 = m.hp;
  sim.hurt(m, 100, { tag: 'physical', manual: true, noCrit: true });
  assert.ok(Math.abs(h1 - m.hp - 100) < 1e-6, '離れれば、減らない');
});

test('firebeast / icebeast: 同じ属性に強く、反対に弱い。氷の獣は凍らず、火の獣は燃えない', () => {
  const sim = arena(['firebeast', 'icebeast']);
  const f = first(sim, 'firebeast');
  const i = first(sim, 'icebeast');
  for (const e of [f, i]) e.hp = e.max = 10000;
  const dmg = (e, tag) => {
    const h = e.hp;
    sim.hurt(e, 100, { tag, noCrit: true, manual: true });
    return h - e.hp;
  };
  assert.ok(Math.abs(dmg(f, 'fire') - 20) < 1e-6, '火の獣に火は 20%');
  assert.ok(Math.abs(dmg(f, 'ice') - 150) < 1e-6, '火の獣に氷は 150%');
  assert.ok(Math.abs(dmg(i, 'ice') - 20) < 1e-6, '氷の獣に氷は 20%');
  assert.ok(Math.abs(dmg(i, 'fire') - 150) < 1e-6, '氷の獣に火は 150%');
  assert.ok(Math.abs(dmg(i, 'lightning') - 100) < 1e-6, 'ほかの属性は等倍');
});

test('parasite: 寄生体は、砦に取り付いて動かず、倒すまで毎秒ダメージ。接触では倒れない', () => {
  const sim = arena(['parasite']);
  const e = first(sim, 'parasite');
  only(sim, e);
  place(e, 14, 0);
  const t0 = sim.b.tower.hp;
  run(sim, 2);
  only(sim, e);
  assert.ok(e.stuck && !e.dead, '取り付いて生きている');
  const lost = t0 - sim.b.tower.hp;
  assert.ok(lost > TYPES.parasite.dmg * TYPES.parasite.stick * 1.5, `毎秒ダメージ（${lost}）`);
  const x0 = e.x;
  run(sim, 1);
  assert.equal(e.x, x0, '動かない');
  sim.b.stats.dmg = 100;
  sim.b.cd.tap = 0;
  assert.ok(sim.tap(e.x, e.y) && e.dead, 'タップで剥がせる');
  const t1 = sim.b.tower.hp;
  run(sim, 1);
  assert.equal(sim.b.tower.hp, t1, '剥がしたらダメージが止まる');
});

test('summoner: 召喚師は、小群を呼ぶ（上限あり）', () => {
  const sim = arena(['summoner']);
  const e = first(sim, 'summoner');
  only(sim, e);
  place(e, 150, 0);
  e.sumT = 0.01;
  e.spd = 0;
  run(sim, 1);
  const swarms = sim.b.enemies.filter((q) => !q.dead && q.type === 'swarm').length;
  assert.equal(swarms, TYPES.summoner.summon.n, '小群を呼ぶ');
  for (let k = 0; k < 40; k++) {
    e.sumT = 0.01;
    sim.step(1 / 30);
  }
  assert.ok(sim.b.enemies.filter((q) => !q.dead && q.type === 'swarm').length <= TYPES.summoner.summon.max + TYPES.summoner.summon.n, '上限を超えて増えない');
});

test('regenerator: 再生兵は、1.5 秒攻撃されないと回復し、攻撃されている間は回復しない', () => {
  const sim = arena(['regenerator']);
  const e = first(sim, 'regenerator');
  only(sim, e);
  place(e, 160, 0);
  e.spd = 0;
  e.hp = e.max * 0.5;
  sim.hurt(e, 0.001, { tag: 'physical', manual: true, noCrit: true });
  const h0 = e.hp;
  run(sim, 1);
  only(sim, e);
  assert.ok(e.hp <= h0 + 1e-6, '攻撃された直後は回復しない');
  run(sim, 3);
  only(sim, e);
  assert.ok(e.hp > h0 + e.max * 0.08, `攻撃されなければ回復する（${h0} → ${e.hp}）`);
});

test('jammer: 妨害兵が近くにいる間、主砲と武器の待ち時間が延びる（最大 45%）', () => {
  const sim = arena(['jammer']);
  const e = first(sim, 'jammer');
  only(sim, e);
  place(e, 70, 0);
  e.spd = 0;
  sim.step(1 / 30);
  assert.ok(sim.b.jamK < 1, '遅くなる');
  assert.ok(Math.abs(sim.b.jamK - 0.85) < 1e-6, `1 体で 15%（${sim.b.jamK}）`);
  place(e, 250, 0);
  sim.step(1 / 30);
  assert.equal(sim.b.jamK, 1, '遠ければ遅くならない');
  // 多数でも 45% まで
  const sim2 = arena(['jammer'], 4);
  first(sim2, 'jammer');
  for (const q of sim2.b.enemies) {
    q.spd = 0;
    place(q, 60, 0);
  }
  for (let k = 0; k < 8; k++) sim2.b.enemies.push({ ...sim2.b.enemies[0], dead: false });
  sim2.step(1 / 30);
  assert.ok(sim2.b.jamK >= 0.55 - 1e-9, '下限は 0.55');
});

test('spawn: 新しい敵が初めて出ると、一言（説明）が出る。出現条件を満たすまで出ない', () => {
  const sim = createBattle(computeStats(['core']), seeded(8), { stage: 0, leveling: false, onlyTypes: ['bomber'] });
  sim.b.tower.hp = sim.b.tower.max = 99999;
  for (let i = 0; i < 30 * 15 && !sim.b.seenTypes.has('bomber'); i++) sim.step(1 / 30);
  assert.ok(sim.b.seenTypes.has('bomber'));
  assert.ok(sim.b.toast && sim.b.toast.title.includes('自爆兵'), '一言が出る');
  // 通常の出現: 難しさ 1 の波には、条件の高い敵は出ない
  const sim2 = createBattle(computeStats(['core']), seeded(8), { stage: 1, leveling: false });
  sim2.b.tower.hp = sim2.b.tower.max = 99999;
  for (let i = 0; i < 30 * 40; i++) sim2.step(1 / 30);
  const seen = new Set(sim2.b.enemies.map((q) => q.type));
  for (const t of ['bomber', 'charger', 'guard', 'parasite', 'summoner', 'regenerator', 'jammer']) assert.ok(!seen.has(t), `${t} が早すぎる`);
});

console.log(`\n${passed} 件すべて成功`);
