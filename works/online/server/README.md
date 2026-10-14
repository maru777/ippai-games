# オンライン対戦の中継サーバー（Cloudflare Workers + Durable Objects）

2 人 1 組のルームを中継するだけの汎用サーバー。ゲームの判定は各ブラウザ側で行う（`works/collection/app/src/games/wall-race*.js`）。

## 構成
- `src/relay-core.js`: ルーム処理（座席割り当て・メッセージ検証・Origin 判定）。サーバー環境に依存しない純粋な関数。
- `src/worker.js`: Cloudflare 用の入口と、ルーム 1 つ = Durable Object 1 つ（Hibernation API）。
- `wrangler.toml`: 設定。`ALLOWED_ORIGINS` で接続を許可するページを制限する。

## プロトコル（v=1、WebSocket `wss://<host>/room/<4 桁の数字>`）
- クライアント → サーバー: `{v:1, t:'msg', d:<任意の JSON>}`（2KB まで）
- サーバー → クライアント: `welcome {seat, peers}` / `peer-join {seat}` / `peer-leave {seat}` / `msg {from, d}`
- 3 人目の接続は `room-full` で閉じる。

## 使い方（事前に利用者の操作が必要）
1. Cloudflare アカウントと API トークン（Workers の編集権限）を用意し、`.env`（Git に入れない）に `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` を置く。雛形は `.env.example`。
2. `npm install`（wrangler の導入。事前に確認）。
3. `npx wrangler whoami` で対象アカウントを確認してから `npx wrangler deploy`。
4. 払い出された `wss://...workers.dev` を `works/collection/app/src/core/config.js` の `RELAY_URL` に設定する。

## ローカル確認
`npx wrangler dev` で `ws://localhost:8787` に起動する。アプリは `?relay=ws://localhost:8787` を付けて開くと接続先を一時的に上書きできる。
