// ポインタ（タッチ・マウス）とキーボードを 1 つの入力状態にまとめる。
// ゲームは毎フレーム input.down / input.pressed / input.x / input.y を読むだけでよい。
const ACTION_KEYS = new Set([' ', 'Enter', 'ArrowUp', 'z', 'Z']);

export class Input {
  constructor(canvas, W, H) {
    this.canvas = canvas;
    this.W = W;
    this.H = H;
    this.x = W / 2;
    this.y = H / 2;
    this.pointerDown = false;
    this.keyAction = false;
    this.pressed = false; // このフレームで押された（1 フレームだけ true）
    this.keys = new Set();
    this.onFirstGesture = null;

    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      this._move(e);
      this.pointerDown = true;
      this.pressed = true;
      this._gesture();
    });
    canvas.addEventListener('pointermove', (e) => this._move(e));
    const up = () => { this.pointerDown = false; };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.key);
      if (ACTION_KEYS.has(e.key)) {
        e.preventDefault();
        this.keyAction = true;
        this.pressed = true;
      }
      this._gesture();
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.key);
      if (ACTION_KEYS.has(e.key)) this.keyAction = false;
    });
  }

  get down() { return this.pointerDown || this.keyAction; }
  get left() { return this.keys.has('ArrowLeft') || this.keys.has('a'); }
  get right() { return this.keys.has('ArrowRight') || this.keys.has('d'); }

  _move(e) {
    const r = this.canvas.getBoundingClientRect();
    this.x = ((e.clientX - r.left) * this.W) / r.width;
    this.y = ((e.clientY - r.top) * this.H) / r.height;
  }

  _gesture() {
    if (this.onFirstGesture) {
      const f = this.onFirstGesture;
      this.onFirstGesture = null;
      f();
    }
  }

  endFrame() { this.pressed = false; }
}
