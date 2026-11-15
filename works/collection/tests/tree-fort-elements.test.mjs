// 武器の要素（5 つ × 12 武器）の検証: 式がそろい、レベルとともに強くなり、画面用の値が正しく出る（描画なし）。
// 実行: node works/collection/tests/tree-fort-elements.test.mjs
import assert from 'node:assert/strict';
import { ELEMENTS, EV, MAX_K, weaponElements, upgradeChanges, shown } from '../app/src/games/tree-fort-elements.js';
import { WEAPONS } from '../app/src/games/tree-fort-weapons.js';

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

console.log(`\n${passed} 件すべて成功`);
