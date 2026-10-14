// ポインタ（タッチ・マウス）とキーボードを 1 つの入力状態にまとめる。
// ゲームは毎フレーム input.down / input.pressed / input.x / input.y を読むだけでよい。
// 複数ボタンの同時押し用に、押している全ポインタを input.pointers（配列）で参照できる。
const ACTION_KEYS = new Set([' ', 'Enter', 'ArrowUp', 'z', 'Z']);

export class Input {
  constructor(canvas, W, H) {
    this.canvas = canvas;
    this.W = W;
    this.H = H;
    this.x = W / 2;
    this.y = H / 2;
    this._pointers = new Map(); // pointerId -> {x, y}
    this.keyAction = false;
    this.pressed = false; // このフレームで押された（1 フレームだけ true）
    this.keys = new Set();
    this.onFirstGesture = null;

    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      const p = this._pos(e);
      this._pointers.set(e.pointerId, p);
      this.x = p.x;
      this.y = p.y;
      this.pressed = true;
      this._gesture();
    });
    canvas.addEventListener('pointermove', (e) => {
      const p = this._pos(e);
      if (this._pointers.has(e.pointerId)) this._pointers.set(e.pointerId, p);
      this.x = p.x;
      this.y = p.y;
    });
    const up = (e) => { this._pointers.delete(e.pointerId); };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    window.addEventListener('blur', () => {
      this._pointers.clear();
      this.keys.clear();
      this.keyAction = false;
    });

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (e.target && e.target.tagName === 'INPUT') return; // チャット入力中はゲーム操作にしない
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

  get pointerDown() { return this._pointers.size > 0; }
  get pointers() { return Array.from(this._pointers.values()); }
  get down() { return this.pointerDown || this.keyAction; }
  get left() { return this.keys.has('ArrowLeft') || this.keys.has('a'); }
  get right() { return this.keys.has('ArrowRight') || this.keys.has('d'); }

  _pos(e) {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) * this.W) / r.width,
      y: ((e.clientY - r.top) * this.H) / r.height,
    };
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
