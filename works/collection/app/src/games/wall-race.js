// かべレース: 2 人のオンライン対戦。9×9 の盤で、先に向かい側の端へ着いた方の勝ち。
// 自分の番に「コマを 1 マス動かす」か「壁を 1 枚置いて相手の進路を伸ばす」（壁で道を完全に塞ぐのは禁止）。
// 部屋コード（4 桁）で入室する。CPU と対戦（3 段階）もできる。
// ルールは wall-race-rules.js、CPU は wall-race-cpu.js、通信は core/net.js。
import { inside } from '../core/draw.js';
import {
  T, alpha, rr, ntext, drawBg, panel, nbutton, pips, drawPawn, measure, Particles,
} from './wall-race-theme.js';
import { Room, newCode, relayUrl } from '../core/net.js';
import { Store } from '../core/storage.js';
import { chooseAction, LEVELS } from './wall-race-cpu.js';
import { N, newState, legalMoves, canPlaceWall, apply } from './wall-race-rules.js';

const CELL = 20;
const GAP = 4;
const PITCH = CELL + GAP;
const X0 = 14;
const Y0 = 68; // 盤面の上端（上部にステータスとチャットログを置くため下げている）

const BTN_CPU = { x: 30, y: 92, w: 180, h: 34 };
const BTN_CREATE = { x: 30, y: 136, w: 180, h: 34 };
const BTN_JOIN = { x: 30, y: 180, w: 180, h: 34 };
const LEVEL_BTNS = LEVELS.map((_, i) => ({ x: 30, y: 90 + i * 48, w: 180, h: 40 }));
const CPU_THINK = 0.6; // CPU が指すまでの間（秒）

// チャット: 定型スタンプ（絵文字）+ 自由入力。ログは上部に常時表示（上下ドラッグ・ホイールでスクロール）。
const STAMPS = [
  { e: '\u{1F44B}', t: 'よろしく' }, { e: '\u{1F44D}', t: 'ナイス' }, { e: '\u{1F605}', t: 'うっかり' }, { e: '\u{1F647}', t: 'まいった' },
  { e: '\u{1F501}', t: 'もう一回' }, { e: '\u23F0', t: 'はやく' }, { e: '\u{1F525}', t: '勝負！' }, { e: '\u{1F64F}', t: 'ありがと' },
];
const STAMP_BTNS = STAMPS.map((_, i) => ({ x: 34 + (i % 4) * 44, y: 96 + Math.floor(i / 4) * 48, w: 40, h: 42 }));
const BTN_FREE = { x: 28, y: 200, w: 90, h: 24 };
const BTN_MUTE = { x: 122, y: 200, w: 90, h: 24 };
const BTN_CHAT_CLOSE = { x: 60, y: 232, w: 120, h: 22 };
const LOG_BOX = { x: 4, y: 29, w: 196, h: 31 }; // ログ 3 行
const STAMP_BOX = { x: 204, y: 29, w: 32, h: 31 }; // 直近のスタンプ（3 秒）
const LOG_LINES = 3;
const LOG_PITCH = 10;
const LOG_WRAP = 19; // 1 行の最大文字数
const LOG_KEEP = 120; // 保持する行数（約 50 件）
const CHAT_MAX = 30;
const SEND_GAP = 1000; // 送信の間隔（ミリ秒）。連打・荒らし防止
const RECV_GAP = 300;
const BTN_CANCEL = { x: 60, y: 250, w: 120, h: 30 };
const BTN_MOVE = { x: 2, y: 288, w: 36, h: 26 };
const BTN_WALL = { x: 42, y: 288, w: 36, h: 26 };
const BTN_ROT = { x: 82, y: 288, w: 36, h: 26 };
const BTN_PUT = { x: 122, y: 288, w: 36, h: 26 };
const BTN_CHAT = { x: 162, y: 288, w: 36, h: 26 };
const BTN_RESIGN = { x: 202, y: 288, w: 36, h: 26 };
const RESIGN_BOX = { x: 30, y: 120, w: 180, h: 112 };
const BTN_RESIGN_YES = { x: 40, y: 182, w: 76, h: 36 };
const BTN_RESIGN_NO = { x: 124, y: 182, w: 76, h: 36 };

const KEYS = [];
for (let i = 0; i < 12; i++) {
  const col = i % 3;
  const row = Math.floor(i / 3);
  const label = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '消す', '0', '入室'][i];
  KEYS.push({ label, x: 30 + col * 66, y: 100 + row * 42, w: 60, h: 36 });
}

const REASONS = {
  'no-server': 'サーバー未設定です',
  'room-full': 'その部屋は満員です',
  lost: '接続が切れました',
  closed: '接続が閉じました',
};

export default function create(env) {
  const { W, H, input, sound } = env;

  // menu | level | join | wait | play | done
  let mode, room, code, entered, notice, seat, s, tool, cand, wins, award, ended;
  let vsCpu, level, thinkT, first;
  let resignOpen;
  let chatOpen, logLines, logOff, stampShow, muteOpp, lastSent, lastRecv, chatBox, dragY;
  let clock = 0; // 演出用の時計（秒）
  let fxWalls, trails, disp, parts; // 壁の出現演出・コマの残像と表示位置・粒

  function disposeRoom() {
    if (room) {
      room.close();
      room = null;
    }
  }

  function reset() {
    disposeRoom();
    mode = 'menu';
    code = '';
    entered = '';
    notice = '';
    seat = -1;
    s = null;
    tool = 'move';
    cand = null;
    wins = 0;
    award = '';
    ended = false;
    vsCpu = false;
    level = 'normal';
    thinkT = 0;
    first = 0;
    chatOpen = false;
    resignOpen = false;
    logLines = [];
    logOff = 0;
    stampShow = null;
    dragY = null;
    fxWalls = [];
    trails = [[], []];
    disp = null;
    parts = new Particles();
    muteOpp = false;
    lastSent = 0;
    lastRecv = 0;
    closeInput();
  }

  // 先手・後手はランダム（座席 0 / 1 のどちらが先に指すか）
  const randomFirst = () => (Math.random() < 0.5 ? 0 : 1);

  function startCpu(lv) {
    disposeRoom();
    vsCpu = true;
    level = lv;
    seat = 0;
    first = randomFirst();
    s = newState(first);
    thinkT = CPU_THINK;
    begin();
  }

  function connect(c) {
    disposeRoom();
    code = c;
    notice = '';
    room = new Room(c);
    room.onwelcome = (mySeat, peers) => {
      seat = mySeat;
      mode = 'wait';
      if (peers === 1 && seat === 1) notice = '相手の開始を待っています';
    };
    room.onpeerjoin = () => {
      // 先に入室していた側（座席 0）が盤面を作って開始を知らせる
      if (seat === 0 && mode === 'wait') {
        first = randomFirst();
        s = newState(first);
        room.send({ k: 'start', first });
        begin();
      }
    };
    room.onpeerleave = () => {
      if (mode === 'play') {
        finish(seat, '相手が退出しました');
      } else if (mode === 'wait') {
        notice = '';
      }
    };
    room.onmessage = (d) => {
      if (!d) return;
      if (d.k === 'start' && mode === 'wait') {
        first = d.first === 1 ? 1 : 0;
        s = newState(first);
        begin();
      } else if (d.k === 'chat') {
        receiveChat(d);
      } else if (d.k === 'resign' && mode === 'play') {
        finish(seat, '相手が投了しました');
      } else if (d.k === 'act' && mode === 'play') {
        const next = apply(s, 1 - seat, d.a);
        if (next) commit(next, 1 - seat, d.a);
      }
    };
    room.onclose = (reason) => {
      room = null;
      if (mode === 'play') {
        finish(seat, '接続が切れました');
      } else if (mode !== 'done') {
        mode = 'menu';
        notice = REASONS[reason] || '接続できませんでした';
      }
    };
  }

  function begin() {
    mode = 'play';
    resignOpen = false;
    tool = 'move';
    cand = null;
    notice = '';
    fxWalls = [];
    trails = [[], []];
    disp = [null, null];
    sound.beep(660, 0.08, 'sine', 0.07);
    sound.beep(990, 0.1, 'sine', 0.05);
  }

  function finish(winner, why) {
    if (mode === 'done') return;
    mode = 'done';
    wins = winner === seat ? 1 : 0;
    chatOpen = false;
    resignOpen = false;
    closeInput();
    if (vsCpu && winner === seat) {
      const id = `wall-race-${level}`;
      Store.submit(id, Store.best(id) + 1); // CPU 戦は難易度別の勝ち数をベストとして残す
    }
    award = `${winner === seat ? '勝ち！' : '負け…'} ${why || ''}`.trim();
    const won = winner === seat;
    parts.burst(W / 2, 120, won ? [T.me, T.gold, T.white] : [T.op, T.dim], won ? 70 : 24, won ? 120 : 60, 60);
    (won ? [523, 659, 784, 1047] : [330, 262, 196]).forEach((f, i) => {
      setTimeout(() => sound.beep(f, 0.16, won ? 'sine' : 'sawtooth', 0.07), i * 130);
    });
    disposeRoom();
    if (!ended) {
      ended = true;
      env.end();
    }
  }

  function checkWin() {
    if (s && s.winner !== -1) finish(s.winner, '');
  }

  // 手を確定する共通処理（状態更新・演出・音）。who は手を指した座席。
  function commit(next, who, action) {
    s = next;
    if (action.k === 'wall') {
      fxWalls.push({ who, t: 0 });
      const r = wallRect(vw(action.x), vw(action.y), action.o);
      parts.burst(r.x + r.w / 2, r.y + r.h / 2, [who === seat ? T.me : T.op, T.white], 12, 60);
      sound.beep(who === seat ? 200 : 170, 0.14, 'sawtooth', 0.05);
      sound.beep(who === seat ? 520 : 440, 0.07, 'square', 0.035);
    } else {
      sound.beep(who === seat ? 620 : 480, 0.06, 'sine', 0.08);
    }
    checkWin();
  }

  // 盤面の向き: 座席 1 は 180 度回して、自分のコマが常に下に見えるようにする
  const vc = (v) => (seat === 1 ? N - 1 - v : v);
  const vw = (v) => (seat === 1 ? N - 2 - v : v);

  function submit(action) {
    const next = apply(s, seat, action);
    if (!next) return;
    if (room) room.send({ k: 'act', a: action });
    tool = 'move';
    cand = null;
    thinkT = CPU_THINK;
    commit(next, seat, action);
  }

  function myTurn() {
    return mode === 'play' && s.turn === seat;
  }

  function candFromPoint(px, py, prevO) {
    const gx = (px - X0 + GAP / 2) / PITCH - 1;
    const gy = (py - Y0 + GAP / 2) / PITCH - 1;
    const ix = Math.max(0, Math.min(N - 2, Math.round(gx)));
    const iy = Math.max(0, Math.min(N - 2, Math.round(gy)));
    const cx = X0 + (ix + 1) * PITCH - GAP / 2;
    const cy = Y0 + (iy + 1) * PITCH - GAP / 2;
    const dx = Math.abs(px - cx);
    const dy = Math.abs(py - cy);
    const o = dx > dy ? 'h' : dx < dy ? 'v' : prevO || 'h';
    return { x: ix, y: iy, o };
  }

  // ---- チャット（オンライン対戦のみ）----
  const clean = (str) => String(str).replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, CHAT_MAX);

  function closeInput() {
    if (chatBox) {
      chatBox.remove();
      chatBox = null;
    }
  }

  // ログに 1 件足す（長い文は折り返して複数行にする。最新が下）
  function pushLog(who, msg) {
    const mark = who === 'op' ? '▶' : '◀';
    const chars = Array.from(msg);
    for (let i = 0; i < chars.length || i === 0; i += LOG_WRAP) {
      logLines.push({ who, line: `${i === 0 ? mark : '　'}${chars.slice(i, i + LOG_WRAP).join('')}` });
    }
    if (logLines.length > LOG_KEEP) logLines.splice(0, logLines.length - LOG_KEEP);
    logOff = 0; // 新着に合わせて最下行へ
  }

  function sendChat(payload, label) {
    const now = performance.now();
    if (!room || now - lastSent < SEND_GAP) return false;
    lastSent = now;
    room.send({ k: 'chat', ...payload });
    pushLog('me', label);
    if (payload.s !== undefined) stampShow = { e: STAMPS[payload.s].e, who: 'me', t: 3 };
    return true;
  }

  function receiveChat(d) {
    const now = performance.now();
    if (now - lastRecv < RECV_GAP) return;
    if (Number.isInteger(d.s) && STAMPS[d.s]) {
      lastRecv = now;
      pushLog('op', `${STAMPS[d.s].e} ${STAMPS[d.s].t}`);
      stampShow = { e: STAMPS[d.s].e, who: 'op', t: 3 };
    } else if (typeof d.t === 'string') {
      lastRecv = now;
      pushLog('op', muteOpp ? '（発言を非表示にしています）' : clean(d.t));
    } else {
      return;
    }
    sound.beep(520, 0.04);
  }

  function openInput() {
    closeInput();
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;left:0;right:0;bottom:0;display:flex;gap:6px;padding:8px;background:#0f380f;z-index:10';
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.maxLength = CHAT_MAX;
    inp.placeholder = `メッセージ（${CHAT_MAX} 文字まで）`;
    inp.style.cssText = 'flex:1;min-width:0;font-size:16px;padding:6px;border:2px solid #9bbc0f;background:#8bac0f;color:#0f380f';
    const mk = (label) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.style.cssText = 'font-size:16px;padding:6px 10px;border:2px solid #9bbc0f;background:#306230;color:#9bbc0f';
      return b;
    };
    const send = mk('送信');
    const cancel = mk('×');
    const submit = () => {
      const msg = clean(inp.value);
      if (!msg) closeInput();
      else if (sendChat({ t: msg }, msg)) closeInput();
    };
    send.addEventListener('click', submit);
    cancel.addEventListener('click', closeInput);
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.isComposing) submit();
      else if (e.key === 'Escape') closeInput();
    });
    box.append(inp, send, cancel);
    document.body.appendChild(box);
    chatBox = box;
    inp.focus();
  }

  function maxLogOff() {
    return Math.max(0, logLines.length - LOG_LINES);
  }

  function scrollLog(lines) {
    logOff = Math.max(0, Math.min(maxLogOff(), logOff + lines));
  }

  // ログ領域の上下ドラッグでスクロール（指を下へ動かすと古い方へ）
  function updateLogDrag() {
    if (vsCpu) return;
    if (!input.pointerDown) {
      dragY = null;
      return;
    }
    if (input.pressed && inside(input.x, input.y, LOG_BOX)) dragY = input.y;
    if (dragY === null) return;
    const dy = input.y - dragY;
    if (Math.abs(dy) >= LOG_PITCH) {
      const n = Math.trunc(dy / LOG_PITCH);
      scrollLog(n);
      dragY += n * LOG_PITCH;
    }
  }

  function onWheel(e) {
    if (mode !== 'play' && mode !== 'done') return;
    if (vsCpu || !inside(input.x, input.y, LOG_BOX)) return;
    e.preventDefault();
    scrollLog(e.deltaY < 0 ? 1 : -1);
  }
  input.canvas.addEventListener('wheel', onWheel, { passive: false });

  function updateChatPanel() {
    if (!input.pressed) return;
    const px = input.x;
    const py = input.y;
    if (inside(px, py, BTN_CHAT_CLOSE)) {
      chatOpen = false;
      return;
    }
    if (inside(px, py, BTN_MUTE)) {
      muteOpp = !muteOpp;
      return;
    }
    if (inside(px, py, BTN_FREE)) {
      chatOpen = false;
      openInput();
      return;
    }
    STAMP_BTNS.forEach((b, i) => {
      if (inside(px, py, b) && sendChat({ s: i }, `${STAMPS[i].e} ${STAMPS[i].t}`)) chatOpen = false;
    });
  }

  function drawChat(g) {
    if (vsCpu) return;
    nbutton(g, BTN_CHAT, '話す', { on: mode === 'play', color: T.op });
    // ログ（上部。新しい行が下）
    panel(g, LOG_BOX, { radius: 4 });
    const end = logLines.length - logOff;
    const shown = logLines.slice(Math.max(0, end - LOG_LINES), end);
    shown.forEach((ln, i) => {
      ntext(g, ln.line, LOG_BOX.x + 4, LOG_BOX.y + 1 + i * LOG_PITCH, 9, ln.who === 'op' ? T.op : T.me);
    });
    if (logLines.length === 0) ntext(g, 'チャット（「話す」で送信）', LOG_BOX.x + 4, LOG_BOX.y + 11, 9, T.dim);
    if (logOff < maxLogOff()) ntext(g, '▲', LOG_BOX.x + LOG_BOX.w - 4, LOG_BOX.y + 1, 8, T.gold, 'right');
    if (logOff > 0) ntext(g, '▼', LOG_BOX.x + LOG_BOX.w - 4, LOG_BOX.y + LOG_BOX.h - 10, 8, T.gold, 'right');
    // 直近のスタンプ枠
    const sc = stampShow ? (stampShow.who === 'op' ? T.op : T.me) : T.line;
    panel(g, STAMP_BOX, { stroke: sc, glow: stampShow ? sc : null, blur: 8, radius: 4 });
    if (stampShow) {
      ntext(g, stampShow.e, STAMP_BOX.x + STAMP_BOX.w / 2, STAMP_BOX.y + 2, 20, T.white, 'center');
      ntext(g, stampShow.who === 'op' ? 'あいて' : 'あなた', STAMP_BOX.x + STAMP_BOX.w / 2, STAMP_BOX.y + 23, 8, sc, 'center');
    }
    if (chatOpen) {
      g.fillStyle = 'rgba(2, 4, 16, 0.65)';
      g.fillRect(0, 0, W, H);
      panel(g, { x: 20, y: 70, w: 200, h: 190 }, { stroke: T.me, glow: T.me, blur: 12, radius: 8, lw: 1.5 });
      ntext(g, 'スタンプ', W / 2, 78, 12, T.me, 'center', 6);
      STAMP_BTNS.forEach((b, i) => {
        panel(g, b, { fill: alpha(T.me, 0.08), stroke: alpha(T.me, 0.7), radius: 5 });
        ntext(g, STAMPS[i].e, b.x + b.w / 2, b.y + 4, 20, T.white, 'center');
        ntext(g, STAMPS[i].t, b.x + b.w / 2, b.y + 30, 8, T.dim, 'center');
      });
      nbutton(g, BTN_FREE, '自由入力', { color: T.gold });
      nbutton(g, BTN_MUTE, muteOpp ? '文字:非表示' : '文字:表示', { color: muteOpp ? T.bad : T.dim });
      nbutton(g, BTN_CHAT_CLOSE, 'とじる', { color: T.dim });
    }
  }

  // 投了する（自分の負け）。オンラインでは相手に知らせる。
  function resign() {
    if (mode !== 'play' || s.winner !== -1) return;
    if (room) room.send({ k: 'resign' });
    finish(1 - seat, '投了');
  }

  function updatePlay() {
    if (resignOpen) {
      if (!input.pressed) return;
      if (inside(input.x, input.y, BTN_RESIGN_YES)) resign();
      else if (inside(input.x, input.y, BTN_RESIGN_NO) || !inside(input.x, input.y, RESIGN_BOX)) resignOpen = false;
      return;
    }
    if (chatOpen) {
      updateChatPanel();
      return;
    }
    updateLogDrag();
    if (!input.pressed) return;
    const px = input.x;
    const py = input.y;
    if (!vsCpu && inside(px, py, BTN_CHAT)) {
      chatOpen = true;
      return;
    }
    if (inside(px, py, BTN_RESIGN) && s.winner === -1) {
      resignOpen = true;
      return;
    }
    if (inside(px, py, BTN_MOVE)) {
      tool = 'move';
      cand = null;
      return;
    }
    if (inside(px, py, BTN_WALL)) {
      tool = 'wall';
      return;
    }
    if (!myTurn()) return;
    if (tool === 'wall' && inside(px, py, BTN_ROT) && cand) {
      cand = { ...cand, o: cand.o === 'h' ? 'v' : 'h' };
      return;
    }
    if (tool === 'wall' && inside(px, py, BTN_PUT) && cand) {
      const w = { k: 'wall', x: vw(cand.x), y: vw(cand.y), o: cand.o };
      if (canPlaceWall(s, seat, w).ok) submit(w);
      return;
    }
    if (py < Y0 - 6 || py > Y0 + N * PITCH + 2) return;
    if (tool === 'move') {
      const col = Math.floor((px - X0) / PITCH);
      const row = Math.floor((py - Y0) / PITCH);
      const x = vc(col);
      const y = vc(row);
      if (legalMoves(s, seat).some((m) => m.x === x && m.y === y)) {
        submit({ k: 'move', x, y });
      }
    } else if (s.left[seat] > 0) {
      cand = candFromPoint(px, py, cand && cand.o);
    }
  }

  function updateMenu() {
    if (!input.pressed) return;
    const px = input.x;
    const py = input.y;
    if (inside(px, py, BTN_CPU)) {
      notice = '';
      mode = 'level';
    } else if (inside(px, py, BTN_CREATE)) {
      if (!relayUrl()) {
        notice = REASONS['no-server'];
        return;
      }
      connect(newCode());
      mode = 'wait';
    } else if (inside(px, py, BTN_JOIN)) {
      if (!relayUrl()) {
        notice = REASONS['no-server'];
        return;
      }
      entered = '';
      notice = '';
      mode = 'join';
    }
  }

  function updateJoin() {
    if (!input.pressed) return;
    if (inside(input.x, input.y, BTN_CANCEL)) {
      mode = 'menu';
      return;
    }
    for (const k of KEYS) {
      if (!inside(input.x, input.y, k)) continue;
      if (k.label === '消す') entered = entered.slice(0, -1);
      else if (k.label === '入室') {
        if (entered.length === 4) {
          connect(entered);
          mode = 'wait';
        } else notice = '4 桁の数字を入れてください';
      } else if (entered.length < 4) entered += k.label;
    }
  }

  function updateWait() {
    if (input.pressed && inside(input.x, input.y, BTN_CANCEL)) {
      disposeRoom();
      mode = 'menu';
      notice = '';
    }
  }

  function updateLevel() {
    if (!input.pressed) return;
    if (inside(input.x, input.y, BTN_CANCEL)) {
      mode = 'menu';
      return;
    }
    LEVEL_BTNS.forEach((b, i) => {
      if (inside(input.x, input.y, b)) startCpu(LEVELS[i].id);
    });
  }

  function updateCpu(dt) {
    if (!vsCpu || s.winner !== -1 || s.turn !== 1) return;
    thinkT -= dt;
    if (thinkT > 0) return;
    const act = chooseAction(s, 1, level);
    const next = apply(s, 1, act);
    if (next) commit(next, 1, act);
  }

  // 演出の時間を進める（結果画面でもシェルから呼ばれる）
  function tick(dt) {
    clock += dt;
    parts.update(dt);
    for (const f of fxWalls) f.t += dt;
    if (!s || !disp || (mode !== 'play' && mode !== 'done')) return;
    for (const who of [0, 1]) {
      const c = cellCenter(vc(s.pawns[who].x), vc(s.pawns[who].y));
      if (!disp[who]) disp[who] = { x: c.x, y: c.y };
      const d = disp[who];
      const k = Math.min(1, dt * 16);
      const x0 = d.x;
      const y0 = d.y;
      d.x += (c.x - d.x) * k;
      d.y += (c.y - d.y) * k;
      if (Math.hypot(d.x - x0, d.y - y0) > 0.4) trails[who].push({ x: d.x, y: d.y, life: 0.25, max: 0.25 });
      for (const p of trails[who]) p.life -= dt;
      trails[who] = trails[who].filter((p) => p.life > 0);
    }
  }

  function update(dt) {
    tick(dt);
    if (stampShow) {
      stampShow.t -= dt;
      if (stampShow.t <= 0) stampShow = null;
    }
    if (mode === 'menu') updateMenu();
    else if (mode === 'level') updateLevel();
    else if (mode === 'join') updateJoin();
    else if (mode === 'wait') updateWait();
    else if (mode === 'play') {
      updatePlay();
      if (mode === 'play') updateCpu(dt);
    }
  }

  // ---- 描画（ネオン調）----
  function cellXY(col, row) {
    return { x: X0 + col * PITCH, y: Y0 + row * PITCH };
  }

  function cellCenter(col, row) {
    return { x: X0 + col * PITCH + CELL / 2, y: Y0 + row * PITCH + CELL / 2 };
  }

  function wallRect(x, y, o) {
    const a = x * PITCH + X0;
    const b = y * PITCH + Y0;
    return o === 'h'
      ? { x: a, y: b + PITCH - GAP, w: PITCH * 2 - GAP, h: GAP }
      : { x: a + PITCH - GAP, y: b, w: GAP, h: PITCH * 2 - GAP };
  }

  function drawBoard(g) {
    const mine = myTurn();
    const pulse = 0.5 + 0.5 * Math.sin(clock * 5);
    const edge = s.winner !== -1 ? T.gold : mine ? T.me : T.op;
    const span = N * PITCH - GAP;
    panel(g, { x: X0 - 6, y: Y0 - 6, w: span + 12, h: span + 12 }, {
      fill: 'rgba(6, 10, 32, 0.9)',
      stroke: alpha(edge, mine ? 0.55 + 0.45 * pulse : 0.4),
      glow: edge,
      blur: mine ? 6 + 8 * pulse : 3,
      radius: 8,
      lw: 1.5,
    });
    // マス（上段 = 自分のゴール、下段 = 相手のゴール）
    for (let row = 0; row < N; row++) {
      for (let col = 0; col < N; col++) {
        const p = cellXY(col, row);
        rr(g, p.x, p.y, CELL, CELL, 3);
        g.fillStyle = row === 0 ? alpha(T.me, 0.16) : row === N - 1 ? alpha(T.op, 0.16) : 'rgba(90, 120, 255, 0.08)';
        g.fill();
        g.lineWidth = 0.8;
        g.strokeStyle = 'rgba(110, 140, 255, 0.25)';
        g.stroke();
      }
    }
    // ゴールライン
    g.save();
    g.lineWidth = 2;
    for (const [y, c] of [[Y0 - 6, T.me], [Y0 + span + 6, T.op]]) {
      g.shadowColor = c;
      g.shadowBlur = 10;
      g.strokeStyle = c;
      g.beginPath();
      g.moveTo(X0 - 2, y);
      g.lineTo(X0 + span + 2, y);
      g.stroke();
    }
    g.restore();
    // 動ける升
    if (mine && tool === 'move') {
      for (const m of legalMoves(s, seat)) {
        const c = cellCenter(vc(m.x), vc(m.y));
        g.save();
        g.shadowColor = T.me;
        g.shadowBlur = 8;
        g.strokeStyle = alpha(T.me, 0.45 + 0.5 * pulse);
        g.lineWidth = 1.3;
        g.beginPath();
        g.arc(c.x, c.y, 4 + pulse * 1.5, 0, Math.PI * 2);
        g.stroke();
        g.restore();
      }
    }
    // 壁（置いた側の色。出現時は上から落ちて波紋が広がる）
    s.walls.forEach((w, i) => {
      const fx = fxWalls[i] || { who: 0, t: 1 };
      const col = fx.who === seat ? T.me : T.op;
      const r = wallRect(vw(w.x), vw(w.y), w.o);
      const pr = Math.min(1, fx.t / 0.22);
      const dy = -(1 - pr) * (1 - pr) * 16;
      g.save();
      g.globalAlpha = 0.3 + 0.7 * pr;
      g.shadowColor = col;
      g.shadowBlur = 10;
      rr(g, r.x, r.y + dy, r.w, r.h, 1.5);
      g.fillStyle = col;
      g.fill();
      g.shadowBlur = 0;
      g.fillStyle = 'rgba(255, 255, 255, 0.75)';
      if (w.o === 'h') g.fillRect(r.x + 1.5, r.y + dy + 1.5, r.w - 3, 1);
      else g.fillRect(r.x + 1.5, r.y + dy + 1.5, 1, r.h - 3);
      g.restore();
      if (fx.t < 0.6) {
        g.save();
        g.strokeStyle = alpha(col, 0.8 * (1 - fx.t / 0.6));
        g.lineWidth = 1.2;
        g.beginPath();
        g.arc(r.x + r.w / 2, r.y + r.h / 2, 5 + fx.t * 70, 0, Math.PI * 2);
        g.stroke();
        g.restore();
      }
    });
    // 置く場所の候補
    if (cand && tool === 'wall' && mine) {
      const ok = canPlaceWall(s, seat, { x: vw(cand.x), y: vw(cand.y), o: cand.o }).ok;
      const r = wallRect(cand.x, cand.y, cand.o);
      const c = ok ? T.me : T.bad;
      g.save();
      g.shadowColor = c;
      g.shadowBlur = 8;
      rr(g, r.x, r.y, r.w, r.h, 1.5);
      g.fillStyle = alpha(c, 0.3 + 0.3 * pulse);
      g.fill();
      g.setLineDash([2, 2]);
      g.lineWidth = 1;
      g.strokeStyle = c;
      g.stroke();
      g.restore();
    }
    // コマ
    for (const who of [0, 1]) {
      const d = disp && disp[who];
      if (!d) continue;
      drawPawn(g, d.x, d.y, who === seat ? T.me : T.op, clock, s.winner === -1 && s.turn === who, trails[who]);
    }
  }

  function drawPlay(g) {
    drawBg(g, W, H, clock);
    const lv = LEVELS.find((l) => l.id === level);
    const head = vsCpu ? `CPU・${lv.label}` : `ROOM ${code}`;
    ntext(g, head, 6, 3, 9, T.dim);
    ntext(g, first === seat ? '先手' : '後手', 10 + measure(g, head, 9), 3, 9, T.gold, 'left', 4);
    if (s.winner !== -1) ntext(g, '決着', W - 6, 2, 11, T.gold, 'right', 8);
    else if (myTurn()) ntext(g, 'あなたの番', W - 6, 2, 11, T.me, 'right', 8);
    else ntext(g, 'あいての番', W - 6, 2, 11, T.op, 'right', 8);
    ntext(g, 'YOU', 6, 14, 9, T.me);
    pips(g, 28, 15, s.left[seat], 10, T.me);
    ntext(g, vsCpu ? 'CPU' : 'OPP', W - 6, 14, 9, T.op, 'right');
    pips(g, W - 30, 15, s.left[1 - seat], 10, T.op, 'right');
    drawBoard(g);
    const turn = myTurn();
    nbutton(g, BTN_MOVE, '動く', { on: turn, active: tool === 'move' });
    nbutton(g, BTN_WALL, '壁', { on: turn && s.left[seat] > 0, active: tool === 'wall' });
    nbutton(g, BTN_ROT, '回転', { on: turn && tool === 'wall' && !!cand });
    nbutton(g, BTN_PUT, '置く', { on: turn && tool === 'wall' && !!cand, color: T.gold });
    nbutton(g, BTN_RESIGN, '投了', { on: mode === 'play' && s.winner === -1, color: T.bad });
    drawChat(g);
    if (resignOpen) {
      g.fillStyle = 'rgba(2, 4, 16, 0.7)';
      g.fillRect(0, 0, W, H);
      panel(g, RESIGN_BOX, { stroke: T.bad, glow: T.bad, blur: 12, radius: 8, lw: 1.5 });
      ntext(g, '投了しますか？', W / 2, RESIGN_BOX.y + 16, 14, T.white, 'center', 6);
      ntext(g, vsCpu ? '負けになります' : '相手の勝ちになります', W / 2, RESIGN_BOX.y + 44, 10, T.dim, 'center');
      nbutton(g, BTN_RESIGN_YES, '投了する', { color: T.bad, size: 13 });
      nbutton(g, BTN_RESIGN_NO, '続ける', { color: T.me, size: 13 });
    }
    parts.draw(g);
  }

  function drawMenu(g) {
    drawBg(g, W, H, clock);
    const a = Math.sin(clock * 1.6) * 12;
    drawPawn(g, 62 + a, 74, T.me, clock, true);
    drawPawn(g, 178 - a, 74, T.op, clock, true);
    ntext(g, 'WALL RACE', W / 2 + 1.5, 22.5, 26, T.op, 'center', 8);
    ntext(g, 'WALL RACE', W / 2 - 1, 21.5, 26, T.me, 'center', 10);
    ntext(g, 'かべレース', W / 2, 52, 11, T.dim, 'center');
    nbutton(g, BTN_CPU, 'CPU と対戦', { color: T.me, size: 13 });
    nbutton(g, BTN_CREATE, '部屋をつくる（2 人）', { color: T.op, size: 13 });
    nbutton(g, BTN_JOIN, '部屋に入る（2 人）', { color: T.op, size: 13 });
    if (notice) ntext(g, notice, W / 2, 226, 11, T.bad, 'center', 4);
    ntext(g, '先に向こう側へ着いたら勝ち', W / 2, 262, 10, T.dim, 'center');
    ntext(g, '※ 2 人とも同じページを開いて遊びます', W / 2, 290, 9, alpha(T.dim, 0.8), 'center');
  }

  function drawLevel(g) {
    drawBg(g, W, H, clock);
    ntext(g, 'CPU の強さ', W / 2, 20, 15, T.me, 'center', 8);
    ntext(g, '勝ち = その強さに勝った回数', W / 2, 46, 10, T.dim, 'center');
    const cols = [T.me, T.gold, T.op];
    LEVEL_BTNS.forEach((b, i) => {
      nbutton(g, b, LEVELS[i].label, { color: cols[i], size: 14 });
      ntext(g, `勝ち ${Store.best(`wall-race-${LEVELS[i].id}`)}`, b.x + b.w - 8, b.y + b.h - 14, 9, alpha(cols[i], 0.8), 'right');
    });
    nbutton(g, BTN_CANCEL, 'もどる', { color: T.dim });
  }

  function drawJoin(g) {
    drawBg(g, W, H, clock);
    ntext(g, '部屋コードを入力', W / 2, 20, 14, T.me, 'center', 8);
    const shown = entered.padEnd(4, '・').split('').join(' ');
    ntext(g, shown, W / 2, 48, 22, T.white, 'center', 10);
    for (const k of KEYS) {
      const color = k.label === '消す' ? T.bad : k.label === '入室' ? T.gold : T.me;
      nbutton(g, k, k.label, { color, size: 14 });
    }
    nbutton(g, BTN_CANCEL, 'もどる', { color: T.dim });
    if (notice) ntext(g, notice, W / 2, 232, 10, T.bad, 'center', 4);
  }

  function drawWait(g) {
    drawBg(g, W, H, clock);
    for (let i = 0; i < 3; i++) {
      const ph = (clock * 0.7 + i / 3) % 1;
      g.save();
      g.strokeStyle = alpha(T.me, 0.5 * (1 - ph));
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(W / 2, 112, 20 + ph * 70, 0, Math.PI * 2);
      g.stroke();
      g.restore();
    }
    ntext(g, 'ROOM CODE', W / 2, 62, 11, T.dim, 'center');
    ntext(g, code.split('').join(' '), W / 2, 90, 28, T.white, 'center', 14);
    const msg = seat === 0 ? '相手を待っています…' : seat === 1 ? '接続しました。開始を待っています…' : '接続中…';
    ntext(g, msg, W / 2, 168, 12, T.me, 'center', 6);
    if (seat === 0) ntext(g, 'このコードを相手に伝えてください', W / 2, 192, 10, T.dim, 'center');
    nbutton(g, BTN_CANCEL, 'やめる', { color: T.dim });
  }

  function draw(g) {
    if (mode === 'menu') drawMenu(g);
    else if (mode === 'level') drawLevel(g);
    else if (mode === 'join') drawJoin(g);
    else if (mode === 'wait') drawWait(g);
    else if (s) drawPlay(g);
  }

  // 結果画面（シェルから呼ばれる）。ボタンの位置はシェルの当たり判定に合わせる。
  function drawOver(g, ui) {
    g.fillStyle = 'rgba(3, 5, 20, 0.74)';
    g.fillRect(0, 0, W, H);
    const won = wins === 1;
    const c = won ? T.gold : T.op;
    ntext(g, won ? 'VICTORY' : 'DEFEAT', W / 2, 78, 32, c, 'center', 16);
    ntext(g, award, W / 2, 126, 11, T.white, 'center');
    if (vsCpu) {
      const lv = LEVELS.find((l) => l.id === level);
      ntext(g, `${lv.label} 勝ち数 ${Store.best(`wall-race-${level}`)}`, W / 2, 150, 10, T.dim, 'center');
    }
    nbutton(g, ui.retry, 'もう一度', { color: T.me, size: 14 });
    nbutton(g, ui.menu, 'メニュー', { color: T.dim, size: 14 });
    parts.draw(g);
  }

  reset();

  return {
    reset,
    update,
    draw,
    dispose() {
      disposeRoom();
      closeInput();
      input.canvas.removeEventListener('wheel', onWheel);
    },
    tick,
    drawOver,
    hiRes: 2, // 高解像度で描く（光の表現を滑らかにする）
    noHud: true, // シェルのスコア表示を出さない
    skipReady: true, // 「タップでスタート」を挟まない（最初の画面がメニューのため）
    silentOver: true, // 終了音はゲーム側で鳴らす
    get score() { return wins; },
    get award() { return award; },
  };
}
