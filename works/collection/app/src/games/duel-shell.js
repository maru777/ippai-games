// 2 人対戦ボードゲームの共通の画面（ネオン調）。メニュー / CPU の強さ / 部屋コード入力 / 待機 / 対局 / 投了 / 結果。
// 新しいゲームは「ルール（apply など）+ 盤の描画と操作」を定義した spec を渡すだけでよい。
//   createDuel(env, makeSpec)   makeSpec(env) が spec（ゲームごとの状態を閉じ込めたオブジェクト）を返す
//
// spec に必要なもの:
//   id, en（英字の題）, jp（日本語の題）, rules（遊び方の短い説明 配列）
//   newState(first, seed) / turn(s) / winner(s)（-1 続行・0・1・2 引き分け）/ apply(s, seat, action) → 次の状態か null
//   ai(s, seat, level) → action / legalMoves(s) → action[]（CPU の保険）/ score(s, seat) → 数字か null
//   newUi() → 操作中の一時状態 / reset() / onPress(ctx, x, y) → action か null / drawBoard(g, ctx)
//   省略可: confirm { label, enabled(ctx), action(ctx) } / onApplied(ctx, prev, next, action, who) / tick(ctx, dt)
// ctx = { s, seat, acting, canAct, ui, clock, vsCpu, local2, W, H }
// 通信は core/net.js（手 {k:'act', a} / 開始 {k:'start', first} / 投了 {k:'resign'} を送り合う）。
import { inside } from '../core/draw.js';
import {
  T, alpha, ntext, drawBg, panel, nbutton, measure, drawPawn, Particles,
} from './wall-race-theme.js';
import { Room, newCode, relayUrl } from '../core/net.js';
import { Store } from '../core/storage.js';
import { createHelp } from './game-help.js';

export const LEVELS = [
  { id: 'easy', label: 'かんたん' },
  { id: 'normal', label: 'ふつう' },
  { id: 'hard', label: 'つよい' },
];
export const SEAT_COLOR = [T.me, T.op];
export const SEAT_NAME = ['シアン', 'マゼンタ'];

const BTN_CPU = { x: 30, y: 84, w: 180, h: 34 };
const BTN_LOCAL = { x: 30, y: 124, w: 180, h: 34 };
const BTN_CREATE = { x: 30, y: 164, w: 180, h: 34 };
const BTN_JOIN = { x: 30, y: 204, w: 180, h: 34 };
const LEVEL_BTNS = LEVELS.map((_, i) => ({ x: 30, y: 90 + i * 48, w: 180, h: 40 }));
const BTN_CANCEL = { x: 60, y: 250, w: 120, h: 30 };
const BTN_ACT = { x: 4, y: 288, w: 150, h: 26 };
const BTN_RESIGN = { x: 178, y: 288, w: 58, h: 26 };
const RESIGN_BOX = { x: 30, y: 120, w: 180, h: 112 };
const BTN_RESIGN_YES = { x: 40, y: 182, w: 76, h: 36 };
const BTN_RESIGN_NO = { x: 124, y: 182, w: 76, h: 36 };
const CPU_THINK = 0.6; // CPU が指すまでの間（秒）

const KEYS = [];
for (let i = 0; i < 12; i++) {
  const label = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '消す', '0', '入室'][i];
  KEYS.push({ label, x: 30 + (i % 3) * 66, y: 100 + Math.floor(i / 3) * 42, w: 60, h: 36 });
}

const REASONS = {
  'no-server': 'サーバー未設定です',
  'room-full': 'その部屋は満員です',
  lost: '接続が切れました',
  closed: '接続が閉じました',
};

export function createDuel(env, makeSpec) {
  const { W, input, sound } = env;
  let H = env.H; // 縦長の端末では 320 より高くなる
  // 縦長のとき: ヘッダーは上端、ボタンは下端に固定し、盤などの中身は縦の中央に置く（中央寄せのずれ = dy）。
  const dy = () => (H - 320) / 2;
  const iy = () => input.y - dy(); // 中央寄せの中身の座標に直した、タップの y
  const spec = makeSpec(env);
  const help = createHelp(spec.id, spec.jp); // 右上の「？」（遊び方）

  // menu | level | join | wait | play | done
  let mode, room, code, entered, notice, seat, s, ui, wins, award, ended, kind;
  let vsCpu, local2, level, thinkT, first, seed, resignOpen;
  let clock = 0;
  let parts = new Particles();

  const ctx = () => ({
    s, seat, acting: local2 ? s.turn : seat, canAct: canAct(), ui, clock, vsCpu, local2, W, H,
  });

  function canAct() {
    return mode === 'play' && s.winner === -1 && (local2 || s.turn === seat);
  }

  function disposeRoom() {
    if (room) {
      room.close();
      room = null;
    }
  }

  function reset() {
    disposeRoom();
    help.close();
    mode = 'menu';
    code = '';
    entered = '';
    notice = '';
    seat = -1;
    s = null;
    ui = spec.newUi();
    wins = 0;
    award = '';
    kind = '';
    ended = false;
    vsCpu = false;
    local2 = false;
    level = 'normal';
    thinkT = 0;
    first = 0;
    resignOpen = false;
    parts = new Particles();
    spec.reset();
  }

  const randomFirst = () => (Math.random() < 0.5 ? 0 : 1);
  const randomSeed = () => Math.floor(Math.random() * 2 ** 31); // 配札などの乱数（オンラインでは開始の知らせで共有する）

  function begin() {
    mode = 'play';
    resignOpen = false;
    notice = '';
    ui = spec.newUi();
    spec.reset();
    sound.beep(660, 0.08, 'sine', 0.07);
    sound.beep(990, 0.1, 'sine', 0.05);
  }

  function startCpu(lv) {
    disposeRoom();
    vsCpu = true;
    local2 = false;
    level = lv;
    seat = 0;
    first = randomFirst();
    seed = randomSeed();
    s = spec.newState(first, seed);
    thinkT = CPU_THINK;
    begin();
  }

  function startLocal() {
    disposeRoom();
    vsCpu = false;
    local2 = true;
    seat = 0;
    first = randomFirst();
    seed = randomSeed();
    s = spec.newState(first, seed);
    begin();
  }

  function connect(c) {
    disposeRoom();
    vsCpu = false;
    local2 = false;
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
        seed = randomSeed();
        s = spec.newState(first, seed);
        room.send({ k: 'start', first, seed });
        begin();
      }
    };
    room.onpeerleave = () => {
      if (mode === 'play') finish(seat, '相手が退出しました');
      else if (mode === 'wait') notice = '';
    };
    room.onmessage = (d) => {
      if (!d) return;
      if (d.k === 'start' && mode === 'wait') {
        first = d.first === 1 ? 1 : 0;
        seed = Number.isInteger(d.seed) ? d.seed : 0;
        s = spec.newState(first, seed);
        begin();
      } else if (d.k === 'act' && mode === 'play') {
        if (s.turn !== 1 - seat) return; // 相手の番でない手は無視
        const next = spec.apply(s, 1 - seat, d.a);
        if (next) commit(next, 1 - seat, d.a);
      } else if (d.k === 'resign' && mode === 'play') {
        finish(seat, '相手が投了しました');
      }
    };
    room.onclose = (reason) => {
      room = null;
      if (mode === 'play') finish(seat, '接続が切れました');
      else if (mode !== 'done') {
        mode = 'menu';
        notice = REASONS[reason] || '接続できませんでした';
      }
    };
  }

  function finish(winner, why) {
    if (mode === 'done') return;
    mode = 'done';
    resignOpen = false;
    if (winner === 2) kind = 'draw';
    else if (local2) kind = `seat${winner}`;
    else kind = winner === seat ? 'win' : 'lose';
    wins = kind === 'win' ? 1 : 0;
    if (vsCpu && kind === 'win') {
      const id = `${spec.id}-${level}`;
      Store.submit(id, Store.best(id) + 1); // CPU 戦は難易度別の勝ち数をベストとして残す
    }
    if (kind === 'win') award = `勝ち！ ${why || ''}`.trim();
    else if (kind === 'lose') award = `負け… ${why || ''}`.trim();
    else if (kind === 'draw') award = '引き分け';
    else award = `${SEAT_NAME[winner]}の勝ち ${why || ''}`.trim();
    const good = kind !== 'lose';
    const col = winner === 2 || local2 ? [T.me, T.op, T.gold] : good ? [T.me, T.gold, T.white] : [T.op, T.dim];
    parts.burst(W / 2, 120, col, good ? 70 : 24, good ? 120 : 60, 60);
    (good ? [523, 659, 784, 1047] : [330, 262, 196]).forEach((f, i) => {
      setTimeout(() => sound.beep(f, 0.16, good ? 'sine' : 'sawtooth', 0.07), i * 130);
    });
    disposeRoom();
    if (!ended) {
      ended = true;
      env.end();
    }
  }

  // 手を確定する共通処理。who は手を指した座席。
  function commit(next, who, action) {
    const prev = s;
    s = next;
    ui = spec.newUi();
    thinkT = CPU_THINK;
    spec.onApplied?.(ctx(), prev, next, action, who);
    if (s.winner !== -1) finish(s.winner, '');
  }

  function submit(action) {
    const who = local2 ? s.turn : seat;
    const next = spec.apply(s, who, action);
    if (!next) return false;
    if (room) room.send({ k: 'act', a: action });
    commit(next, who, action);
    return true;
  }

  function resign() {
    if (mode !== 'play' || s.winner !== -1) return;
    const loser = local2 ? s.turn : seat;
    if (room) room.send({ k: 'resign' });
    finish(1 - loser, '投了');
  }

  // ---- 入力 ----
  function updateMenu() {
    if (!input.pressed) return;
    const x = input.x;
    const y = iy();
    if (help.press(x, y)) return;
    if (inside(x, y, BTN_CPU)) {
      notice = '';
      mode = 'level';
    } else if (inside(x, y, BTN_LOCAL)) {
      startLocal();
    } else if (inside(x, y, BTN_CREATE)) {
      if (!relayUrl()) {
        notice = REASONS['no-server'];
        return;
      }
      connect(newCode());
      mode = 'wait';
    } else if (inside(x, y, BTN_JOIN)) {
      if (!relayUrl()) {
        notice = REASONS['no-server'];
        return;
      }
      entered = '';
      notice = '';
      mode = 'join';
    }
  }

  function updateLevel() {
    if (!input.pressed) return;
    if (inside(input.x, iy(), BTN_CANCEL)) {
      mode = 'menu';
      return;
    }
    LEVEL_BTNS.forEach((b, i) => {
      if (inside(input.x, iy(), b)) startCpu(LEVELS[i].id);
    });
  }

  function updateJoin() {
    if (!input.pressed) return;
    if (inside(input.x, iy(), BTN_CANCEL)) {
      mode = 'menu';
      return;
    }
    for (const k of KEYS) {
      if (!inside(input.x, iy(), k)) continue;
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
    if (input.pressed && inside(input.x, iy(), BTN_CANCEL)) {
      disposeRoom();
      mode = 'menu';
      notice = '';
    }
  }

  function updatePlay() {
    if (!input.pressed) return;
    const x = input.x;
    const y = iy(); // 中央寄せの中身の座標
    const by = input.y - 2 * dy(); // 下端に固定したボタンの座標
    if (resignOpen) {
      if (inside(x, y, BTN_RESIGN_YES)) resign();
      else if (inside(x, y, BTN_RESIGN_NO) || !inside(x, y, RESIGN_BOX)) resignOpen = false;
      return;
    }
    if (inside(x, by, BTN_RESIGN) && s.winner === -1) {
      resignOpen = true;
      return;
    }
    if (!canAct()) return;
    const c = ctx();
    if (spec.confirm && inside(x, by, BTN_ACT)) {
      if (spec.confirm.enabled(c)) {
        const a = spec.confirm.action(c);
        if (a) submit(a);
      }
      return;
    }
    const a = spec.onPress(c, x, y);
    if (a) submit(a);
  }

  function updateCpu(dt) {
    if (!vsCpu || s.winner !== -1 || s.turn !== 1) return;
    thinkT -= dt;
    if (thinkT > 0) return;
    let act = spec.ai(s, 1, level);
    let next = act && spec.apply(s, 1, act);
    if (!next) {
      // 保険: 想定外で打てない手を返したら、打てる手のどれかを指す
      act = spec.legalMoves(s).find((m) => spec.apply(s, 1, m));
      next = act && spec.apply(s, 1, act);
    }
    if (next) commit(next, 1, act);
  }

  function tick(dt) {
    clock += dt;
    parts.update(dt);
    if (s) spec.tick?.(ctx(), dt);
  }

  function update(dt) {
    tick(dt);
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
  function names() {
    if (local2) return [SEAT_NAME[0], SEAT_NAME[1]];
    const opp = vsCpu ? 'CPU' : 'OPP';
    return seat === 0 ? ['YOU', opp] : [opp, 'YOU'];
  }

  function drawHeader(g) {
    const lv = LEVELS.find((l) => l.id === level);
    const head = vsCpu ? `CPU・${lv.label}` : local2 ? '1台で2人' : `ROOM ${code}`;
    ntext(g, head, 6, 3, 9, T.dim);
    const tag = local2 ? `${SEAT_NAME[first]}が先手` : first === seat ? '先手' : '後手';
    ntext(g, tag, 10 + measure(g, head, 9), 3, 9, T.gold, 'left', 4);
    if (s.winner !== -1) ntext(g, '決着', W - 6, 2, 11, T.gold, 'right', 8);
    else if (local2) ntext(g, `${SEAT_NAME[s.turn]}の番`, W - 6, 2, 11, SEAT_COLOR[s.turn], 'right', 8);
    else if (s.turn === seat) ntext(g, 'あなたの番', W - 6, 2, 11, SEAT_COLOR[seat], 'right', 8);
    else ntext(g, 'あいての番', W - 6, 2, 11, SEAT_COLOR[1 - seat], 'right', 8);
    const nm = names();
    for (const who of [0, 1]) {
      const sc = spec.score(s, who);
      const label = sc === null ? nm[who] : `${nm[who]} ${sc}`;
      const live = s.winner === -1 && s.turn === who;
      const col = SEAT_COLOR[who];
      const pulse = 0.55 + 0.45 * Math.sin(clock * 6);
      const dot = live ? alpha(col, pulse) : alpha(col, 0.25);
      if (who === 0) {
        g.save(); g.fillStyle = dot; g.shadowColor = col; g.shadowBlur = live ? 8 : 0;
        g.beginPath(); g.arc(10, 20, 3.5, 0, Math.PI * 2); g.fill(); g.restore();
        ntext(g, label, 18, 14, 11, col, 'left', live ? 6 : 0);
      } else {
        g.save(); g.fillStyle = dot; g.shadowColor = col; g.shadowBlur = live ? 8 : 0;
        g.beginPath(); g.arc(W - 10, 20, 3.5, 0, Math.PI * 2); g.fill(); g.restore();
        ntext(g, label, W - 18, 14, 11, col, 'right', live ? 6 : 0);
      }
    }
  }

  function drawPlay(g) {
    drawHeader(g);
    const c = ctx();
    g.save();
    g.translate(0, dy());
    spec.drawBoard(g, c);
    g.restore();
    // 下端に固定したボタン
    g.save();
    g.translate(0, 2 * dy());
    if (spec.confirm) {
      nbutton(g, BTN_ACT, spec.confirm.label, { on: c.canAct && spec.confirm.enabled(c), color: T.gold });
    }
    nbutton(g, BTN_RESIGN, '投了', { on: mode === 'play' && s.winner === -1, color: T.bad });
    g.restore();
    g.save();
    g.translate(0, dy());
    if (resignOpen) {
      g.fillStyle = 'rgba(2, 4, 16, 0.7)';
      g.fillRect(0, -dy(), W, H);
      panel(g, RESIGN_BOX, { stroke: T.bad, glow: T.bad, blur: 12, radius: 8, lw: 1.5 });
      ntext(g, '投了しますか？', W / 2, RESIGN_BOX.y + 16, 14, T.white, 'center', 6);
      const who = local2 ? `${SEAT_NAME[s.turn]}の負けになります` : vsCpu ? '負けになります' : '相手の勝ちになります';
      ntext(g, who, W / 2, RESIGN_BOX.y + 44, 10, T.dim, 'center');
      nbutton(g, BTN_RESIGN_YES, '投了する', { color: T.bad, size: 13 });
      nbutton(g, BTN_RESIGN_NO, '続ける', { color: T.me, size: 13 });
    }
    parts.draw(g);
    g.restore();
  }

  function drawMenu(g) {
    const a = Math.sin(clock * 1.6) * 12;
    drawPawn(g, 62 + a, 56, T.me, clock, true);
    drawPawn(g, 178 - a, 56, T.op, clock, true);
    ntext(g, spec.en, W / 2 + 1.5, 18.5, 22, T.op, 'center', 8);
    ntext(g, spec.en, W / 2 - 1, 17.5, 22, T.me, 'center', 10);
    ntext(g, spec.jp, W / 2, 46, 11, T.dim, 'center');
    nbutton(g, BTN_CPU, 'CPU と対戦', { color: T.me, size: 13 });
    nbutton(g, BTN_LOCAL, '1台で2人（交代）', { color: T.gold, size: 13 });
    nbutton(g, BTN_CREATE, '部屋をつくる（2 人）', { color: T.op, size: 13 });
    nbutton(g, BTN_JOIN, '部屋に入る（2 人）', { color: T.op, size: 13 });
    if (notice) ntext(g, notice, W / 2, 246, 11, T.bad, 'center', 4);
    spec.rules.forEach((line, i) => ntext(g, line, W / 2, 268 + i * 14, 10, T.dim, 'center'));
    help.drawButton(g);
    help.drawOverlay(g);
  }

  function drawLevel(g) {
    ntext(g, 'CPU の強さ', W / 2, 20, 15, T.me, 'center', 8);
    ntext(g, '勝ち = その強さに勝った回数', W / 2, 46, 10, T.dim, 'center');
    const cols = [T.me, T.gold, T.op];
    LEVEL_BTNS.forEach((b, i) => {
      nbutton(g, b, LEVELS[i].label, { color: cols[i], size: 14 });
      ntext(g, `勝ち ${Store.best(`${spec.id}-${LEVELS[i].id}`)}`, b.x + b.w - 8, b.y + b.h - 14, 9, alpha(cols[i], 0.8), 'right');
    });
    nbutton(g, BTN_CANCEL, 'もどる', { color: T.dim });
  }

  function drawJoin(g) {
    ntext(g, '部屋コードを入力', W / 2, 20, 14, T.me, 'center', 8);
    ntext(g, entered.padEnd(4, '・').split('').join(' '), W / 2, 48, 22, T.white, 'center', 10);
    for (const k of KEYS) {
      const color = k.label === '消す' ? T.bad : k.label === '入室' ? T.gold : T.me;
      nbutton(g, k, k.label, { color, size: 14 });
    }
    nbutton(g, BTN_CANCEL, 'もどる', { color: T.dim });
    if (notice) ntext(g, notice, W / 2, 232, 10, T.bad, 'center', 4);
  }

  function drawWait(g) {
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
    drawBg(g, W, H, clock); // 背景は画面全体
    if (mode === 'play' || mode === 'done') {
      if (s) drawPlay(g);
      return;
    }
    g.save();
    g.translate(0, dy()); // メニューなどの中身は縦の中央に置く
    if (mode === 'menu') drawMenu(g);
    else if (mode === 'level') drawLevel(g);
    else if (mode === 'join') drawJoin(g);
    else if (mode === 'wait') drawWait(g);
    g.restore();
  }

  // 結果画面（シェルから呼ばれる）
  function drawOver(g, uiBtns) {
    g.fillStyle = 'rgba(3, 5, 20, 0.74)';
    g.fillRect(0, 0, W, H);
    g.save();
    g.translate(0, dy());
    let title = 'VICTORY';
    let c = T.gold;
    if (kind === 'lose') {
      title = 'DEFEAT';
      c = T.op;
    } else if (kind === 'draw') {
      title = 'DRAW';
      c = T.white;
    } else if (kind.startsWith('seat')) {
      const w = Number(kind.slice(4));
      title = 'WIN';
      c = SEAT_COLOR[w];
    }
    ntext(g, title, W / 2, 78, 32, c, 'center', 16);
    ntext(g, award, W / 2, 126, 11, T.white, 'center');
    if (vsCpu) {
      const lv = LEVELS.find((l) => l.id === level);
      ntext(g, `${lv.label} 勝ち数 ${Store.best(`${spec.id}-${level}`)}`, W / 2, 150, 10, T.dim, 'center');
    }
    parts.draw(g);
    g.restore();
    nbutton(g, uiBtns.retry, 'もう一度', { color: T.me, size: 14 }); // ボタンはシェルが決めた位置（下寄せ）
    nbutton(g, uiBtns.menu, 'メニュー', { color: T.dim, size: 14 });
  }

  reset();

  return {
    reset,
    update,
    draw,
    dispose() {
      disposeRoom();
    },
    tick,
    drawOver,
    hiRes: 2,
    viewMode: 'tall', // 縦長の端末では、全画面で使う
    resize(w, h) { H = h; },
    noHud: true,
    skipReady: true,
    silentOver: true,
    get score() { return wins; },
    get award() { return award; },
  };
}
