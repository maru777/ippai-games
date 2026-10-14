// かべレース: 2 人のオンライン対戦。9×9 の盤で、先に向かい側の端へ着いた方の勝ち。
// 自分の番に「コマを 1 マス動かす」か「壁を 1 枚置いて相手の進路を伸ばす」（壁で道を完全に塞ぐのは禁止）。
// 部屋コード（4 桁）で入室する。CPU と対戦（3 段階）もできる。
// ルールは wall-race-rules.js、CPU は wall-race-cpu.js、通信は core/net.js。
import { C, rect, text, frame, inside } from '../core/draw.js';
import { Room, newCode, relayUrl } from '../core/net.js';
import { Store } from '../core/storage.js';
import { chooseAction, LEVELS } from './wall-race-cpu.js';
import { N, newState, legalMoves, canPlaceWall, apply } from './wall-race-rules.js';

const CELL = 20;
const GAP = 4;
const PITCH = CELL + GAP;
const X0 = 14;
const Y0 = 46;

const BTN_CPU = { x: 30, y: 92, w: 180, h: 34 };
const BTN_CREATE = { x: 30, y: 136, w: 180, h: 34 };
const BTN_JOIN = { x: 30, y: 180, w: 180, h: 34 };
const LEVEL_BTNS = LEVELS.map((_, i) => ({ x: 30, y: 90 + i * 48, w: 180, h: 40 }));
const CPU_THINK = 0.6; // CPU が指すまでの間（秒）
const BTN_CANCEL = { x: 60, y: 250, w: 120, h: 30 };
const BTN_MOVE = { x: 6, y: 288, w: 52, h: 26 };
const BTN_WALL = { x: 62, y: 288, w: 52, h: 26 };
const BTN_ROT = { x: 118, y: 288, w: 52, h: 26 };
const BTN_PUT = { x: 174, y: 288, w: 60, h: 26 };

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
      } else if (d.k === 'act' && mode === 'play') {
        const next = apply(s, 1 - seat, d.a);
        if (next) {
          s = next;
          sound.beep(330, 0.05);
          checkWin();
        }
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
    tool = 'move';
    cand = null;
    notice = '';
    sound.beep(660, 0.08);
  }

  function finish(winner, why) {
    if (mode === 'done') return;
    mode = 'done';
    wins = winner === seat ? 1 : 0;
    if (vsCpu && winner === seat) {
      const id = `wall-race-${level}`;
      Store.submit(id, Store.best(id) + 1); // CPU 戦は難易度別の勝ち数をベストとして残す
    }
    award = winner === seat ? `勝ち！ ${why || ''}`.trim() : '負け…';
    disposeRoom();
    if (!ended) {
      ended = true;
      env.end();
    }
  }

  function checkWin() {
    if (s && s.winner !== -1) finish(s.winner, '');
  }

  // 盤面の向き: 座席 1 は 180 度回して、自分のコマが常に下に見えるようにする
  const vc = (v) => (seat === 1 ? N - 1 - v : v);
  const vw = (v) => (seat === 1 ? N - 2 - v : v);

  function submit(action) {
    const next = apply(s, seat, action);
    if (!next) return;
    s = next;
    if (room) room.send({ k: 'act', a: action });
    sound.beep(action.k === 'wall' ? 220 : 440, 0.05);
    tool = 'move';
    cand = null;
    thinkT = CPU_THINK;
    checkWin();
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

  function updatePlay() {
    if (!input.pressed) return;
    const px = input.x;
    const py = input.y;
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
    const next = apply(s, 1, chooseAction(s, 1, level));
    if (next) {
      s = next;
      sound.beep(330, 0.05);
    }
    checkWin();
  }

  function update(dt) {
    if (mode === 'menu') updateMenu();
    else if (mode === 'level') updateLevel();
    else if (mode === 'join') updateJoin();
    else if (mode === 'wait') updateWait();
    else if (mode === 'play') {
      updatePlay();
      if (mode === 'play') updateCpu(dt);
    }
  }

  // ---- 描画 ----
  function button(g, r, label, on = true, active = false) {
    rect(g, r.x, r.y, r.w, r.h, active ? C.dark : on ? C.light : C.bg);
    frame(g, r.x, r.y, r.w, r.h, on ? C.dark : C.mid);
    text(g, label, r.x + r.w / 2, r.y + r.h / 2 - 6, 12, active ? C.bg : on ? C.dark : C.mid, 'center');
  }

  function cellXY(col, row) {
    return { x: X0 + col * PITCH, y: Y0 + row * PITCH };
  }

  function wallRect(x, y, o) {
    const a = x * PITCH + X0;
    const b = y * PITCH + Y0;
    return o === 'h'
      ? { x: a, y: b + PITCH - GAP, w: PITCH * 2 - GAP, h: GAP }
      : { x: a + PITCH - GAP, y: b, w: GAP, h: PITCH * 2 - GAP };
  }

  function drawBoard(g) {
    const moves = myTurn() && tool === 'move' ? legalMoves(s, seat) : [];
    for (let row = 0; row < N; row++) {
      for (let col = 0; col < N; col++) {
        const p = cellXY(col, row);
        rect(g, p.x, p.y, CELL, CELL, C.light);
        if (row === 0) frame(g, p.x, p.y, CELL, CELL, C.dark);
        else if (row === N - 1) frame(g, p.x, p.y, CELL, CELL, C.mid);
      }
    }
    for (const m of moves) {
      const p = cellXY(vc(m.x), vc(m.y));
      rect(g, p.x + 6, p.y + 6, CELL - 12, CELL - 12, C.mid);
    }
    for (const w of s.walls) {
      const r = wallRect(vw(w.x), vw(w.y), w.o);
      rect(g, r.x, r.y, r.w, r.h, C.dark);
    }
    if (cand && tool === 'wall' && myTurn()) {
      const ok = canPlaceWall(s, seat, { x: vw(cand.x), y: vw(cand.y), o: cand.o }).ok;
      const r = wallRect(cand.x, cand.y, cand.o);
      rect(g, r.x, r.y, r.w, r.h, ok ? C.mid : C.bg);
      frame(g, r.x - 1, r.y - 1, r.w + 2, r.h + 2, C.dark);
    }
    for (const who of [0, 1]) {
      const pw = s.pawns[who];
      const p = cellXY(vc(pw.x), vc(pw.y));
      if (who === seat) {
        rect(g, p.x + 3, p.y + 3, CELL - 6, CELL - 6, C.dark);
      } else {
        rect(g, p.x + 3, p.y + 3, CELL - 6, CELL - 6, C.bg);
        frame(g, p.x + 3, p.y + 3, CELL - 6, CELL - 6, C.dark);
        rect(g, p.x + 8, p.y + 8, CELL - 16, CELL - 16, C.mid);
      }
    }
  }

  function drawPlay(g) {
    rect(g, 0, 0, W, H, C.bg);
    const lv = LEVELS.find((l) => l.id === level);
    const order = first === seat ? '先手' : '後手';
    text(g, `${vsCpu ? `CPU（${lv.label}）` : `部屋 ${code}`}  あなたは${order}`, 6, 4, 10, C.mid);
    text(g, `${vsCpu ? 'CPU' : 'あいて'} 壁 ${s.left[1 - seat]}`, 6, 18, 11, C.dark);
    const turnTxt = s.winner !== -1 ? '決着' : myTurn() ? 'あなたの番' : 'あいての番';
    text(g, turnTxt, W - 6, 18, 11, C.dark, 'right');
    drawBoard(g);
    text(g, `のこり壁 ${s.left[seat]}`, 6, 266, 11, C.dark);
    if (tool === 'wall' && myTurn()) {
      const hint = !cand ? '壁を置く場所をタップ' : '回転・置く で決定';
      text(g, hint, W - 6, 266, 10, C.mid, 'right');
    }
    const turn = myTurn();
    button(g, BTN_MOVE, '動く', turn, tool === 'move');
    button(g, BTN_WALL, '壁', turn && s.left[seat] > 0, tool === 'wall');
    button(g, BTN_ROT, '回転', turn && tool === 'wall' && !!cand);
    button(g, BTN_PUT, '置く', turn && tool === 'wall' && !!cand);
  }

  function drawMenu(g) {
    rect(g, 0, 0, W, H, C.bg);
    rect(g, 0, 0, W, 38, C.dark);
    text(g, 'かべレース', W / 2, 11, 16, C.bg, 'center');
    text(g, '先に向こう側へ着いたら勝ち', W / 2, 60, 11, C.mid, 'center');
    button(g, BTN_CPU, 'CPU と対戦');
    button(g, BTN_CREATE, '部屋をつくる（2 人）');
    button(g, BTN_JOIN, '部屋に入る（2 人）');
    if (notice) text(g, notice, W / 2, 226, 11, C.dark, 'center');
    text(g, '※ 2 人とも同じページを開いて遊びます', W / 2, 290, 9, C.mid, 'center');
  }

  function drawLevel(g) {
    rect(g, 0, 0, W, H, C.bg);
    text(g, 'CPU の強さ', W / 2, 20, 14, C.dark, 'center');
    text(g, 'ベスト = その強さに勝った回数', W / 2, 44, 10, C.mid, 'center');
    LEVEL_BTNS.forEach((b, i) => {
      button(g, b, LEVELS[i].label);
      text(g, `勝ち ${Store.best(`wall-race-${LEVELS[i].id}`)}`, b.x + b.w - 6, b.y + b.h - 13, 9, C.mid, 'right');
    });
    button(g, BTN_CANCEL, 'もどる');
  }

  function drawJoin(g) {
    rect(g, 0, 0, W, H, C.bg);
    text(g, '部屋コードを入力', W / 2, 20, 14, C.dark, 'center');
    const shown = entered.padEnd(4, '・').split('').join(' ');
    text(g, shown, W / 2, 50, 20, C.dark, 'center');
    for (const k of KEYS) button(g, k, k.label);
    button(g, BTN_CANCEL, 'もどる');
    if (notice) text(g, notice, W / 2, 232, 10, C.dark, 'center');
  }

  function drawWait(g) {
    rect(g, 0, 0, W, H, C.bg);
    text(g, '部屋コード', W / 2, 70, 12, C.mid, 'center');
    text(g, code.split('').join(' '), W / 2, 94, 24, C.dark, 'center');
    const msg = seat === 0 ? '相手を待っています…' : seat === 1 ? '接続しました。開始を待っています…' : '接続中…';
    text(g, msg, W / 2, 150, 12, C.dark, 'center');
    if (seat === 0) text(g, 'このコードを相手に伝えてください', W / 2, 176, 10, C.mid, 'center');
    button(g, BTN_CANCEL, 'やめる');
  }

  function draw(g) {
    if (mode === 'menu') drawMenu(g);
    else if (mode === 'level') drawLevel(g);
    else if (mode === 'join') drawJoin(g);
    else if (mode === 'wait') drawWait(g);
    else if (s) drawPlay(g);
  }

  reset();

  return {
    reset,
    update,
    draw,
    dispose: disposeRoom,
    get score() { return wins; },
    get award() { return award; },
  };
}
