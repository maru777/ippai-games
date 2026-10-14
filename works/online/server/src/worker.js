// Cloudflare Workers の入口と、ルーム 1 つ = Durable Object 1 つ。
// ルーム処理そのものは relay-core.js（サーバー非依存）にある。
import { DurableObject } from 'cloudflare:workers';
import {
  ROOM_PATH, assignSeat, parse, welcome, peerJoin, peerLeave, relayed, originAllowed,
} from './relay-core.js';

export class Room extends DurableObject {
  async fetch(request) {
    const sockets = this.ctx.getWebSockets();
    const used = sockets.map((ws) => ws.deserializeAttachment()?.seat);
    const seat = assignSeat(used);

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    if (seat < 0) {
      // 満席: 接続は受けるが即座に閉じて、理由をクライアントへ伝える
      server.accept();
      server.close(1008, 'room-full');
      return new Response(null, { status: 101, webSocket: client });
    }
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ seat });
    server.send(welcome(seat, sockets.length));
    for (const ws of sockets) ws.send(peerJoin(seat));
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(ws, raw) {
    const m = parse(raw);
    if (!m) return; // 不正なメッセージは無視
    const from = ws.deserializeAttachment()?.seat;
    for (const other of this.ctx.getWebSockets()) {
      if (other !== ws) other.send(relayed(from, m.d));
    }
  }

  webSocketClose(ws, code, reason) {
    this.#left(ws);
    ws.close(code, reason);
  }

  webSocketError(ws) {
    this.#left(ws);
  }

  #left(ws) {
    const seat = ws.deserializeAttachment()?.seat;
    for (const other of this.ctx.getWebSockets()) {
      if (other !== ws) other.send(peerLeave(seat));
    }
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const m = ROOM_PATH.exec(url.pathname);
    if (!m) return new Response('not found', { status: 404 });
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('expected websocket', { status: 426 });
    }
    if (!originAllowed(request.headers.get('Origin') || '', env.ALLOWED_ORIGINS)) {
      return new Response('forbidden', { status: 403 });
    }
    const id = env.ROOM.idFromName(m[1]);
    return env.ROOM.get(id).fetch(request);
  },
};
