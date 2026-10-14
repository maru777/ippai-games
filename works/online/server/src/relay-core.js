// 汎用中継のルーム処理。サーバー環境（Cloudflare / Node）に依存しない純粋な関数だけを置く。
// メッセージ形式（v=1）:
//   クライアント → サーバー: { v:1, t:'msg', d:<任意の JSON> }
//   サーバー → クライアント: { v:1, t:'welcome', seat, peers } / { v:1, t:'peer-join', seat }
//                            / { v:1, t:'peer-leave', seat } / { v:1, t:'msg', from, d }
//   サーバーは d の中身を解釈しない（ゲームの判定はクライアント側）。
export const PROTOCOL = 1;
export const MAX_SEATS = 2;
export const MAX_BYTES = 2048;

// 空いている座席番号の最小値。満席なら -1。
export function assignSeat(used) {
  for (let s = 0; s < MAX_SEATS; s++) {
    if (!used.includes(s)) return s;
  }
  return -1;
}

// 受信文字列をメッセージに変換する。不正・過大なら null。
export function parse(raw) {
  if (typeof raw !== 'string' || raw.length > MAX_BYTES) return null;
  let m;
  try {
    m = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!m || m.v !== PROTOCOL || m.t !== 'msg' || !('d' in m)) return null;
  return m;
}

export const welcome = (seat, peers) => JSON.stringify({ v: PROTOCOL, t: 'welcome', seat, peers });
export const peerJoin = (seat) => JSON.stringify({ v: PROTOCOL, t: 'peer-join', seat });
export const peerLeave = (seat) => JSON.stringify({ v: PROTOCOL, t: 'peer-leave', seat });
export const relayed = (from, d) => JSON.stringify({ v: PROTOCOL, t: 'msg', from, d });

// ルームコード（4 桁の数字）
export const ROOM_PATH = /^\/room\/(\d{4})$/;

// Origin の許可判定。allowed は「,」区切りの文字列。空なら制限しない（ローカル開発用）。
export function originAllowed(origin, allowed) {
  const list = (allowed || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (list.length === 0) return true;
  return list.includes(origin);
}
