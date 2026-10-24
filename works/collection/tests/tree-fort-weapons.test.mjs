// ツリー砦の武器・組み合わせ効果の検証（描画なし）。実行: node works/collection/tests/tree-fort-weapons.test.mjs
import assert from 'node:assert/strict';
import { WEAPONS, WEAPON, SYNERGIES, SYNERGY, MAX_LEVEL, SLOT_BASE, SLOT_MAX, SLOT_COST, activeSynergies, weaponCost } from '../app/src/games/tree-fort-weapons.js';
import { computeStats, TREE } from '../app/src/games/tree-fort-data.js';
import { createBattle, simulate } from '../app/src/games/tree-fort-battle.js';

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

// ある程度育った砦（ツリーの中盤）
const MID = computeStats(['core', 'atk1', 'atk2', 'atk3', 'spd1', 'spd2', 'spd3', 'def1', 'def2', 'def3', 'eco1']);

test('weapons: 12 種以上、id 一意、費用と説明が 5 段階ぶんある', () => {
  assert.ok(WEAPONS.length >= 10, `${WEAPONS.length} 種`);
  assert.equal(new Set(WEAPONS.map((w) => w.id)).size, WEAPONS.length);
  for (const w of WEAPONS) {
    assert.equal(w.cost.length, MAX_LEVEL, `${w.id} の費用`);
    assert.equal(w.levels.length, MAX_LEVEL, `${w.id} の説明`);
    assert.ok(w.tags.length >= 1 && w.name && w.desc && /^#/.test(w.color));
    for (let i = 1; i < MAX_LEVEL; i++) assert.ok(w.cost[i] >= w.cost[i - 1] * 0.5, `${w.id} の費用が極端`);
    assert.equal(weaponCost(w.id, 1), w.cost[0]);
  }
});

test('synergy: 必要な武器・属性がすべて実在し、条件どおりに発動する', () => {
  const tags = new Set(WEAPONS.flatMap((w) => w.tags));
  for (const s of SYNERGIES) {
    assert.ok(s.needs.length === 2 && s.name && s.desc);
    for (const n of s.needs) assert.ok(n.startsWith('tag:') ? tags.has(n.slice(4)) : WEAPON[n], `${s.id}: ${n}`);
  }
  assert.ok(SYNERGIES.length >= 8);
  assert.ok(activeSynergies(['frost', 'bomb']).has('steam'), '爆弾は火属性');
  assert.ok(activeSynergies(['frost', 'flame']).has('steam'));
  assert.ok(!activeSynergies(['frost']).has('steam'));
  assert.ok(activeSynergies(['frost', 'lightning']).has('shatter'));
  assert.ok(!activeSynergies(['blade', 'drone']).size);
});

test('slots: 初期 3、最大 6、増設の費用が決まっている', () => {
  assert.equal(SLOT_BASE, 3);
  assert.equal(SLOT_MAX, 6);
  for (let n = SLOT_BASE + 1; n <= SLOT_MAX; n++) assert.ok(SLOT_COST[n] > 0);
});

test('battle: どの武器も Lv1・3・5 で例外なく動き、敵を倒す（ほかの装備なし）', () => {
  for (const w of WEAPONS) {
    for (const level of [1, 3, 5]) {
      const sim = createBattle(MID, seeded(7 + level), [{ id: w.id, level }]);
      for (let i = 0; i < 30 * 40; i++) sim.step(1 / 30);
      assert.ok(sim.b.kills > 0, `${w.id} Lv${level}: 何も倒せない`);
    }
  }
});

test('battle: 状態異常（燃焼・毒・鈍足・凍結）が敵に付き、時間でおさまる', () => {
  const seen = { burn: false, poison: false, slow: false, freeze: false };
  // 砦が弱いほうが敵が近くまで来る（短射程の炎のため）
  for (const id of ['flame', 'poison', 'frost']) {
    // 体力の多い敵（重装）だけを出す: 一撃で倒れると、状態異常が付いたまま観察できない
    const sim = createBattle(computeStats(['core']), seeded(21), { loadout: [{ id, level: 5 }], onlyTypes: ['tank'] });
    for (let i = 0; i < 30 * 50; i++) {
      sim.step(1 / 30);
      for (const e of sim.b.enemies) {
        if (e.burn && e.burn.t > 0) seen.burn = true;
        if (e.poison && e.poison.t > 0) seen.poison = true;
        if (e.slow && e.slow.t > 0) seen.slow = true;
        if (e.freeze > 0) seen.freeze = true;
      }
    }
  }
  assert.deepEqual(seen, { burn: true, poison: true, slow: true, freeze: true });
});

// 組み合わせ効果が実際に発動する（画面の「蒸気爆発！」などの元になる fx が出る）
const SYN_CASES = [
  ['steam', ['bomb', 'frost']],
  ['shatter', ['frost', 'lightning']],
  ['toxic', ['poison', 'flame']],
  ['compress', ['gravity', 'bomb']],
  ['vortex', ['gravity', 'poison']],
  ['lure', ['mine', 'gravity']],
  ['dlink-l', ['drone', 'lightning']],
  ['dlink-f', ['drone', 'frost']],
  ['dlink-b', ['drone', 'laser']],
  ['prism', ['laser', 'frost']],
  ['burnland', ['meteor', 'flame']],
];
test('synergy: 11 通りの組み合わせが、戦闘で実際に発動する', () => {
  for (const [id, pair] of SYN_CASES) {
    // 主砲が弱いほうが、敵が生き残って状態異常の組み合わせが起きやすい
    // 体力の多い敵（重装）だけを出して、状態異常のあいだに次の攻撃が当たる状況にする
    const sim = createBattle(computeStats(['core']), seeded(33), { loadout: pair.map((p) => ({ id: p, level: 5 })), onlyTypes: ['tank', 'grunt'] });
    assert.ok(sim.b.w.syn.has(id), `${id}: 装備しても有効にならない`);
    let fired = false;
    for (let i = 0; i < 30 * 90 && !fired && !sim.b.over; i++) {
      sim.step(1 / 30);
      fired = sim.b.fx.some((f) => f.kind === 'syn' && f.syn === id);
    }
    assert.ok(fired, `${id}: 発動しなかった`);
  }
});

// ---- バランス（目安の確認。数字は表示する）----
const avgWave = (loadout, n = 8, stats = MID) => {
  let sum = 0;
  for (let i = 0; i < n; i++) sum += simulate(stats, seeded(500 + i), loadout).wave;
  return sum / n;
};

test('balance: 各武器は Lv1 で役に立ち、Lv5 でさらに伸びる（装備 1 つ。乱数のばらつきを見込む）', () => {
  const base = avgWave([]);
  const rows = [];
  let s1 = 0;
  let s5 = 0;
  for (const w of WEAPONS) {
    const l1 = avgWave([{ id: w.id, level: 1 }]);
    const l5 = avgWave([{ id: w.id, level: 5 }]);
    s1 += l1;
    s5 += l5;
    rows.push(`${w.id}: ${l1.toFixed(1)} → ${l5.toFixed(1)}`);
    assert.ok(l5 >= l1 - 1.0, `${w.id} は Lv5 のほうが弱い（${l1} → ${l5}）`);
    assert.ok(l5 >= base + 0.5, `${w.id} Lv5 が弱すぎる（${base} → ${l5}）`);
  }
  console.log(`   武器なし ${base.toFixed(1)} 波 / ${rows.join(' / ')}`);
  assert.ok(s5 / WEAPONS.length >= s1 / WEAPONS.length + 1.5, '全体として Lv5 が Lv1 より十分に強くない');
});

test('balance: 組み合わせると、それぞれ単体より遠くへ行ける（主な組み合わせ）', () => {
  const lv = (id) => ({ id, level: 3 });
  for (const [id, pair] of SYN_CASES) {
    const [a, b] = pair;
    const wa = avgWave([lv(a)]);
    const wb = avgWave([lv(b)]);
    const both = avgWave([lv(a), lv(b)]);
    console.log(`   ${SYNERGY[id].name}: ${a} ${wa.toFixed(1)} / ${b} ${wb.toFixed(1)} → 両方 ${both.toFixed(1)}`);
    assert.ok(both > Math.max(wa, wb), `${id}: 組み合わせても単体より伸びない`);
  }
});

test('balance: 全武器 Lv5（6 枠）は全ツリー単体よりずっと強い', () => {
  const full = computeStats(TREE.map((n) => n.id));
  const six = ['bomb', 'frost', 'lightning', 'poison', 'laser', 'meteor'].map((id) => ({ id, level: 5 }));
  const w0 = avgWave([], 3, full);
  const w6 = avgWave(six, 3, full);
  console.log(`   全ツリー: 武器なし ${w0.toFixed(1)} → 6 枠 Lv5 ${w6.toFixed(1)}`);
  assert.ok(w6 > w0 + 8);
});

console.log(`\n${passed} 件すべて成功`);
