// 砂浜バレー: 1 対 1。レシーブ → トス → アタックの 3 タッチで相手コートへ返す。
// 操作: ドラッグ／矢印キーで移動、タップ／スペースでジャンプ＋スイング（ボールが近いと打つ）。
// 自分が 3 回ミスすると終了。スコア = 取ったポイント。
import { C, rect, text } from '../core/draw.js';

const GROUND = 270;
const NETX = 120;
const NETTOP = 215;
const G = 500;
const BR = 6;
const REACH = 26;
const LIVES = 3;

export default function create(env) {
  const { W, H, input, sound } = env;

  let ball, me, cpu, points, lives, touches, owner, held, rally, t;

  const mk = (x, team) => ({ x, y: GROUND, vy: 0, team, swing: 0, cool: 0 });

  function serve(team) {
    ball = { x: team === 0 ? 60 : 180, y: 120, vx: 0, vy: 0 };
    touches = 0;
    owner = -1;
    held = 0.9;
    rally = 0;
  }

  function reset() {
    me = mk(60, 0);
    cpu = mk(180, 1);
    points = 0;
    lives = LIVES;
    t = 0;
    serve(0);
  }

  // 現在の位置から (tx, 地面) へ時間 T で落ちる初速を設定
  function launch(tx, T) {
    ball.vx = (tx - ball.x) / T;
    ball.vy = ((GROUND - BR - ball.y) - 0.5 * G * T * T) / T;
  }

  function attack(team, noise) {
    const opp = team === 0 ? cpu : me;
    const dir = team === 0 ? 1 : -1;
    const lo = NETX + dir * 18;
    const hi = NETX + dir * 105;
    const mid = (lo + hi) / 2;
    let tx = opp.x >= mid ? opp.x - 70 : opp.x + 70;
    tx += (Math.random() - 0.5) * noise;
    tx = Math.max(Math.min(lo, hi) + 4, Math.min(Math.max(lo, hi) - 4, tx));
    for (const T of [0.42, 0.5, 0.6, 0.75, 0.9, 1.1]) {
      launch(tx, T);
      const tn = (NETX - ball.x) / ball.vx;
      if (tn > 0 && tn < T) {
        const yn = ball.y + ball.vy * tn + 0.5 * G * tn * tn;
        if (yn < NETTOP - 10) return;
      } else {
        return;
      }
    }
  }

  function hit(p) {
    const team = p.team;
    const dir = team === 0 ? 1 : -1;
    touches = owner === team ? touches + 1 : 1;
    owner = team;
    if (touches === 1) launch(NETX - dir * 70, 1.3);
    else if (touches === 2) launch(NETX - dir * 38, 1.05);
    else attack(team, team === 1 ? 24 : 0);
    sound.beep(touches >= 3 ? 880 : 440, 0.06);
  }

  function point(winner) {
    if (winner === 0) {
      points++;
      sound.beep(1320, 0.12, 'square', 0.06);
    } else {
      lives--;
      if (lives <= 0) {
        env.end();
        return;
      }
    }
    serve(winner);
  }

  function movePlayer(p, tx, speed, dt, minX, maxX) {
    const d = Math.max(-speed * dt, Math.min(speed * dt, tx - p.x));
    p.x = Math.max(minX, Math.min(maxX, p.x + d));
  }

  function swing(p) {
    p.swing = 0.35;
    if (p.y >= GROUND) p.vy = -300;
  }

  function stepBody(p, dt) {
    p.cool -= dt;
    p.swing -= dt;
    if (p.y < GROUND || p.vy < 0) {
      p.vy += 1000 * dt;
      p.y += p.vy * dt;
      if (p.y >= GROUND) { p.y = GROUND; p.vy = 0; }
    }
  }

  function tryHit(p) {
    if (p.swing <= 0 || p.cool > 0 || held > 0) return;
    const hx = p.x + (p.team === 0 ? 5 : -5);
    const hy = p.y - 24;
    if (Math.hypot(ball.x - hx, ball.y - hy) <= REACH) {
      hit(p);
      p.cool = 0.3;
      p.swing = 0;
    }
  }

  function updateCpu(dt) {
    const speed = Math.min(75 + points * 3, 150);
    let target = 180;
    if (ball.x > NETX - 4 && held <= 0) {
      const hh = GROUND - 30;
      const disc = ball.vy * ball.vy + 2 * G * (hh - ball.y);
      const tt = disc > 0 ? (-ball.vy + Math.sqrt(disc)) / G : 0;
      target = ball.x + ball.vx * Math.max(0, tt);
    }
    movePlayer(cpu, target, speed, dt, NETX + 10, W - 12);
    const near = Math.hypot(ball.x - cpu.x, ball.y - (cpu.y - 24)) < 34;
    if (near && cpu.cool <= 0 && cpu.swing <= 0 && ball.x > NETX - 4) {
      // ラリーが長引くほど CPU がミスしやすくなる
      if (Math.random() < Math.min(0.5, 0.01 + rally * 0.01)) cpu.cool = 0.4;
      else swing(cpu);
    }
  }

  function update(dt) {
    t += dt;

    // 自分の操作
    if (input.pointerDown) movePlayer(me, input.x, 170, dt, 12, NETX - 10);
    if (input.left) movePlayer(me, me.x - 100, 170, dt, 12, NETX - 10);
    if (input.right) movePlayer(me, me.x + 100, 170, dt, 12, NETX - 10);
    if (input.pressed && me.swing <= 0) swing(me);

    stepBody(me, dt);
    stepBody(cpu, dt);
    updateCpu(dt);

    if (held > 0) {
      held -= dt;
      return;
    }

    const px = ball.x;
    ball.vy += G * dt;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    if (ball.x < BR) { ball.x = BR; ball.vx = Math.abs(ball.vx); }
    if (ball.x > W - BR) { ball.x = W - BR; ball.vx = -Math.abs(ball.vx); }

    // ネットに当たる
    if (ball.y > NETTOP && Math.sign(px - NETX) !== Math.sign(ball.x - NETX)) {
      ball.x = px;
      ball.vx = -ball.vx * 0.4;
    } else if (Math.sign(px - NETX) !== Math.sign(ball.x - NETX)) {
      touches = 0; // ネットを越えたらタッチ数をリセット
      rally++;
    }

    tryHit(me);
    tryHit(cpu);

    if (ball.y >= GROUND - BR) {
      point(ball.x < NETX ? 1 : 0);
    }
  }

  function person(g, p, color) {
    const x = Math.round(p.x);
    const y = Math.round(p.y);
    const dir = p.team === 0 ? 1 : -1;
    rect(g, x - 4, y - 14, 8, 10, color); // 体
    rect(g, x - 4, y - 24, 8, 8, color); // 頭
    rect(g, x + dir * 1 - 1, y - 21, 2, 2, C.bg); // 目
    rect(g, x - 3, y - 4, 2, 4, color);
    rect(g, x + 1, y - 4, 2, 4, color);
    if (p.swing > 0) rect(g, x + dir * 4, y - 30, 2, 12, color); // 腕を上げる
    else rect(g, x + dir * 4, y - 12, 4, 2, color);
  }

  function draw(g) {
    rect(g, 0, 0, W, GROUND, C.bg);
    rect(g, 0, GROUND, W, H - GROUND, C.light);
    rect(g, 0, GROUND, W, 2, C.mid);
    // ネット
    rect(g, NETX - 1, NETTOP, 3, GROUND - NETTOP, C.dark);
    rect(g, NETX - 1, NETTOP, 3, 2, C.dark);
    for (let yy = NETTOP + 6; yy < GROUND; yy += 8) rect(g, NETX - 1, yy, 3, 1, C.mid);

    person(g, me, C.dark);
    person(g, cpu, C.mid);

    // ボールと落下位置の目印
    if (ball.y < GROUND - 20) rect(g, ball.x - 3, GROUND + 4, 6, 2, C.mid);
    rect(g, ball.x - BR, ball.y - BR, BR * 2, BR * 2, C.dark);
    rect(g, ball.x - 2, ball.y - 2, 3, 3, C.bg);

    // ライフとタッチ数
    text(g, '●'.repeat(Math.max(0, lives)), 6, 4, 12, C.dark);
    text(g, `${Math.min(touches, 3)}/3`, W / 2, 24, 10, C.mid, 'center');
  }

  return { reset, update, draw, get score() { return points; } };
}
