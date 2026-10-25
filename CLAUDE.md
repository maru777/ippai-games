# ケータイゲーム集（2000 年代リバイバル）

## 概要
2000 年代半ばのガラケー（i アプリ）・Flash ゲーム風のミニゲームを多数収録した Web アプリ。
スマホ（タッチ）優先、PC はキーボード対応。仕様・収録リストは [docs/design-notes.md](docs/design-notes.md)。

## 設計原則
- 面倒になる機能は入れない。小さく作って完成させる。
- ゲームは 1 ファイル 1 モジュール。`src/games/registry.js` に 1 行足せば追加できる。
- 名称・キャラ・画像・音は既存作品を流用しない（ゲーム性だけを参考にしたオリジナル）。
- 依存パッケージなし（素の HTML + JS + Canvas）。追加する場合は事前確認。

## 構成
- `docs/`: 設計メモ
- `works/collection/app/`: 本体（`index.html` が入口。`src/core/` 共通、`src/games/` 各ゲーム）
- `works/<セッション名>/scratch/`: 実験・一時ファイル（Git 管理外）

## 環境・実行
- ビルド不要。`works/collection/app/` で `python serve.py`（Windows で .js が text/plain になるのを補正）→ http://localhost:8000
- ES Modules を使うため、`file://` 直開きでは動かない。
- 画面は論理 240×320（縦長）。配色は 4 色パレット（`src/core/draw.js` の `C`）。
- テスト: `node works/collection/tests/rules.test.mjs`（ボードゲーム 3 本のルール・CPU。描画なし）。
  `node works/collection/tests/tree-fort.test.mjs`（ツリー砦のデータ・戦闘・バランス） / `tree-fort-weapons.test.mjs`（武器 12 種・組み合わせ効果）/ `tree-fort-run.test.mjs`（レベルアップ・敵種）/ `tree-fort-meta.test.mjs`（ステージ・遺物・契約・実績）/ `tree-fort-save.test.mjs`（保存の移行）/ `portal.test.mjs`（ポータルのタップ・スクロール・世界タブ）/ `music.test.mjs`（BGM の全チャンネル）/ `boardgames.test.mjs`（対戦ボード 6 本のルールと CPU）/ `boardgames.smoke.mjs`（対戦ボード全部の画面の煙テスト）/ `tree-fort-ui.smoke.mjs`（スキン × 演出の描画の煙テスト）。lint は未整備。検証は構文チェック（`node --check`）とブラウザでの動作確認。

## ゲーム追加の手順
1. `src/games/<id>.js` を作り、`export default function create(env)` で
   `{ reset(), update(dt), draw(g), get score() }` を返す。終了時は `env.end()` を呼ぶ。
2. `src/games/registry.js` の該当行の `load` を設定する。

## 作業の分け方
- 共通シェル（`main.js` / `portal.js` / `core/`）と各ゲーム（`games/`）は、別セッションで作業する。
- 各セッションは専用の worktree を使い、共通ファイルを触ったら速やかに main へ取り込む（同じ作業フォルダ・ブランチを共有しない）。
- ゲームが BGM を持つときは `bgm`（チャンネル名の後ろ半分。例: スキン名）を返す。シェルが `game-<bgm>` の曲を鳴らす（曲は `core/music.js` の SONGS / CHANNELS）。
