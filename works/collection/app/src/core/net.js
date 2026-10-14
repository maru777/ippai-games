// オンライン対戦の通信層（中継サーバーへの WebSocket）。ゲームは Room だけを使う。
// 接続先は config.js の RELAY_URL（または URL の ?relay=wss://... で一時的に上書き）。
import { RELAY_URL } from './config.js';

const PROTOCOL = 1;

export function relayUrl() {
  const q = new URLSearchParams(window.location.search).get('relay');
  const url = q || RELAY_URL;
  return /^wss?:\/\//.test(url) ? url.replace(/\/$/, '') : '';
}

// 4 桁の数字のルームコードを作る
export function newCode() {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return String(a[0] % 10000).padStart(4, '0');
}

// 使い方:
//   const room = new Room(code);
//   room.onwelcome = (seat, peers) => {}; room.onpeerjoin = () => {}; room.onpeerleave = () => {};
//   room.onmessage = (d) => {}; room.onclose = (reason) => {};
//   room.send({...}); room.close();
export class Room {
  constructor(code) {
    this.code = code;
    this.seat = -1;
    this.open = false;
    this.onwelcome = null;
    this.onpeerjoin = null;
    this.onpeerleave = null;
    this.onmessage = null;
    this.onclose = null;
    const base = relayUrl();
    if (!base) {
      queueMicrotask(() => this.onclose && this.onclose('no-server'));
      return;
    }
    this.ws = new WebSocket(`${base}/room/${code}`);
    this.ws.onmessage = (e) => this._recv(e.data);
    this.ws.onclose = (e) => {
      this.open = false;
      if (this.onclose) this.onclose(e.reason || (e.wasClean ? 'closed' : 'lost'));
    };
    this.ws.onerror = () => {}; // 詳細は onclose で受ける
  }

  _recv(raw) {
    let m;
    try {
      m = JSON.parse(raw);
    } catch (err) {
      console.warn('不正なメッセージを無視しました:', err);
      return;
    }
    if (!m || m.v !== PROTOCOL) return;
    if (m.t === 'welcome') {
      this.seat = m.seat;
      this.open = true;
      if (this.onwelcome) this.onwelcome(m.seat, m.peers);
    } else if (m.t === 'peer-join') {
      if (this.onpeerjoin) this.onpeerjoin(m.seat);
    } else if (m.t === 'peer-leave') {
      if (this.onpeerleave) this.onpeerleave(m.seat);
    } else if (m.t === 'msg') {
      if (this.onmessage) this.onmessage(m.d);
    }
  }

  send(d) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ v: PROTOCOL, t: 'msg', d }));
    }
  }

  close() {
    this.onclose = null;
    this.open = false;
    if (this.ws) this.ws.close();
  }
}
