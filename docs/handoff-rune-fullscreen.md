# 引き継ぎ: ルーンタワーの戦闘画面を、縦長スマホで全画面にする

## 目的
縦長スマホ（約 9:19.5）で、ルーンタワーの**戦闘画面（実ゲーム）だけ**を、上下の黒帯なく画面いっぱいに表示する。
ツリー・ショップ・図鑑・ステージ選択・結果は、今までどおり 3:4（240×320）のままでよい（今回の対象外）。ほかのゲームも対象外。

## 現状（2026-10-25 時点・`main` = `885fe31` 以降）
- 画面は論理サイズ 240×320 固定。`canvas` を 3:4 のまま CSS で画面に収めている（`app/style.css`）。縦長の端末では上下に余白ができる。
- 余白の色は、シェルが canvas の最上部・最下部の色を読んで合わせている（`app/src/main.js` の `syncBars`）。点滅しないよう中央値＋ゆるやかな追従にしてある。
- シェル（`main.js`）: `setRes(scale)` で canvas の解像度を決める。ゲームは `hiRes` を返す（ルーンタワーは 2）。`Input`（`core/input.js`）は生成時の W・H で座標を換算する（`_pos`）。
- 戦闘の座標系: `ARENA = { W: 240, H: 320, cx: 120, cy: 172, towerR: 11 }`（`tree-fort-battle.js`）。塔は画面中央よりやや下（cy=172）。敵は塔からの距離で出現する。
- 戦闘の描画: `tree-fort-view.js` の `drawBattle`（背景 `kit.bg(g, W, H)`、射程・敵・弾・演出）と、HUD の `drawBattleHud`（`tree-fort-rview.js`）。
- 戦闘の操作ボタンは固定座標: `BTN_SPEED`(198,288)、`BTN_OD`(6,288)、`BTN_RETREAT`(192,4)、`BTN_REROLL`(50,276)、選択カード `cardRects`（`tree-fort-rview.js`）。
- 戦闘のロジック（`createBattle` ほか）は描画に依存しない。テストは `works/collection/tests/` にある（下記）。

## 設計案（推奨）
1. **シェル**: ゲームが `viewMode`（`'fixed'`｜`'tall'`）を返せるようにする。`'tall'` のときは、論理幅 240 のまま、論理高さを `clamp(240 × innerHeight / innerWidth, 320, 520)` にして、canvas を画面いっぱいに広げる。`env.H` と `Input` の高さを、そのつど更新する。画面を切り替える（戦闘に入る・出る）ときに、サイズを変える。
2. **ルーンタワー**: 戦闘中だけ `viewMode = 'tall'`。戦闘の描画・HUD・ボタンを、`H` を使った配置に直す（上は y=0 起点、下は `H - 32` 起点）。塔の位置は、画面の縦中央（`H / 2` 付近）に置く。
3. **ゲームバランスは変えない**: 敵の出現距離・速度・射程は今のまま。広がった上下の領域は見た目だけで、敵は塔から同じ距離で出現する（横は 240 のまま）。
4. 選択画面（レベルアップ・宝箱・契約）は、広くなっても読めるよう、カードは画面中央付近に置く。

## 注意
- `ARENA.H` と `ARENA.cy` は、`tree-fort-battle.js`（ロジック）と `tree-fort-view.js`（描画）の両方が使っている。ロジックの値は変えず、描画側で `sc.H` から中心を計算し直すのが安全（テストが `ARENA` に依存している）。
- スキンごとの背景（`kit.bg`）が、可変高さで足りるか確認する（和・モダンの装飾の位置）。
- 余白の色合わせ（`syncBars`）は、全画面のときは不要になるが、固定表示の画面では必要なので残す。
- ブラウザの隠れたペインは描画が遅い（約 1.4fps）。見た目の確認は、`mcp__ccd_view__show_pane` でペインを出し、`resize_window` で 375×812 にして行う。見た目の最終確認はスマホ実機。

## 作業の進め方
- 作業ブランチを `main` から切り（例: `feat/rune-fullscreen`）、専用の worktree で作業する。同じ作業フォルダ・ブランチを、ほかのセッションと共有しない（`CLAUDE.md` の「作業の分け方」）。
- 共通シェル（`main.js` / `core/`）を触るので、変更が小さいうちに `main` へ取り込む。ほかのゲームの動作を変えないこと。
- 公開（`main` への push）は、確認してから。

## 検証（完了条件）
- `works/collection/` で、次をすべて実行して成功すること。
  `node tests/rules.test.mjs` / `tree-fort.test.mjs` / `tree-fort-weapons.test.mjs` / `tree-fort-run.test.mjs` / `tree-fort-meta.test.mjs` / `tree-fort-save.test.mjs` / `portal.test.mjs` / `music.test.mjs` / `tree-fort-ui.smoke.mjs`
- 煙テスト（`tree-fort-ui.smoke.mjs`）に、可変高さ（`H` を 320 と 520 に変えて）の戦闘描画を追加する。
- ブラウザで、375×812 の戦闘画面が上下の帯なしで、HUD・ボタン・選択カードが画面内に収まり、タップできること。ほかのゲームとほかのルーンタワー画面が、今までどおり表示されること。
