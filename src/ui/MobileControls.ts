import Phaser from 'phaser';

export interface MobileState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  action: boolean;
  upJustDown: boolean;
  actionJustDown: boolean;
}

interface BtnRect { x: number; y: number; w: number; h: number; }

export class MobileControls {
  readonly isTouch: boolean;

  private _state: MobileState = {
    left: false, right: false, up: false, down: false,
    action: false, upJustDown: false, actionJustDown: false,
  };

  private scene: Phaser.Scene;
  private gfx!: Phaser.GameObjects.Graphics;
  private labelTexts: Phaser.GameObjects.Text[] = [];

  private rects!: {
    left: BtnRect; right: BtnRect; up: BtnRect; down: BtnRect; action: BtnRect;
  };

  /** Returns true only when running in a real mobile browser. */
  private static isMobileBrowser(): boolean {
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  }

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.isTouch = scene.sys.game.device.input.touch && MobileControls.isMobileBrowser();
    if (!this.isTouch) return;

    // Support up to 10 simultaneous touch points
    scene.input.addPointer(8);

    this.buildLayout();
    this.drawButtons(false, false, false, false, false);
  }

  get state(): Readonly<MobileState> {
    return this._state;
  }

  private buildLayout(): void {
    const { width, height } = this.scene.scale;
    const S = 80;   // button size
    const G = 18;   // gap between adjacent d-pad buttons (wider for easier tapping)
    const M = 24;   // margin from screen edge

    // D-pad centre point (bottom-left region)
    const dcx = M + S + G + Math.floor(S / 2);
    const dcy = height - M - S - G - Math.floor(S / 2);

    this.rects = {
      left:   { x: dcx - S - G,      y: dcy - Math.floor(S / 2), w: S, h: S },
      right:  { x: dcx + G,          y: dcy - Math.floor(S / 2), w: S, h: S },
      up:     { x: dcx - Math.floor(S / 2), y: dcy - S - G,      w: S, h: S },
      down:   { x: dcx - Math.floor(S / 2), y: dcy + G,          w: S, h: S },
      action: { x: width - M - S,    y: height - M - S,           w: S, h: S },
    };

    // Create graphics layer (button backgrounds — redrawn each frame)
    this.gfx = this.scene.add.graphics().setScrollFactor(0).setDepth(200);

    // Create text labels once
    const addLabel = (rect: BtnRect, label: string) => {
      const t = this.scene.add.text(
        rect.x + Math.floor(rect.w / 2),
        rect.y + Math.floor(rect.h / 2),
        label,
        { fontFamily: 'Arial, sans-serif', fontSize: '28px', color: '#ffffff', resolution: 2 }
      ).setOrigin(0.5).setScrollFactor(0).setDepth(201).setAlpha(0.9);
      this.labelTexts.push(t);
    };

    addLabel(this.rects.left,   '◀');
    addLabel(this.rects.right,  '▶');
    addLabel(this.rects.up,     '▲');
    addLabel(this.rects.down,   '▼');
    addLabel(this.rects.action, 'ATK');
  }

  private drawButtons(l: boolean, r: boolean, u: boolean, d: boolean, a: boolean): void {
    const g = this.gfx;
    g.clear();

    const drawBtn = (rect: BtnRect, color: number, active: boolean) => {
      g.fillStyle(color, active ? 0.72 : 0.38);
      g.fillRoundedRect(rect.x, rect.y, rect.w, rect.h, 10);
      g.lineStyle(2, color, active ? 1.0 : 0.6);
      g.strokeRoundedRect(rect.x, rect.y, rect.w, rect.h, 10);
    };

    drawBtn(this.rects.left,   0x4488cc, l);
    drawBtn(this.rects.right,  0x4488cc, r);
    drawBtn(this.rects.up,     0x4488cc, u);
    drawBtn(this.rects.down,   0x4488cc, d);
    drawBtn(this.rects.action, 0xcc4422, a);
  }

  update(): void {
    if (!this.isTouch) return;

    const prevUp     = this._state.up;
    const prevAction = this._state.action;

    let l = false, r = false, u = false, d = false, a = false;

    const check = (p: Phaser.Input.Pointer | undefined) => {
      if (!p?.isDown) return;
      const { x, y } = p;
      if (this.hit(x, y, this.rects.left))   l = true;
      if (this.hit(x, y, this.rects.right))  r = true;
      if (this.hit(x, y, this.rects.up))     u = true;
      if (this.hit(x, y, this.rects.down))   d = true;
      if (this.hit(x, y, this.rects.action)) a = true;
    };

    const inp = this.scene.input;
    // Phaser exposes pointer1 – pointer10 after addPointer
    check(inp.pointer1);
    check(inp.pointer2);
    check(inp.pointer3);
    check(inp.pointer4);
    check(inp.pointer5);
    check(inp.pointer6);
    check(inp.pointer7);
    check(inp.pointer8);
    check(inp.pointer9);
    check(inp.pointer10);

    this._state.left   = l;
    this._state.right  = r;
    this._state.up     = u;
    this._state.down   = d;
    this._state.action = a;
    this._state.upJustDown     = u && !prevUp;
    this._state.actionJustDown = a && !prevAction;

    this.drawButtons(l, r, u, d, a);
  }

  private hit(x: number, y: number, r: BtnRect): boolean {
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }

  /** Destroy all graphics/text owned by this controls instance. */
  destroy(): void {
    this.gfx?.destroy();
    this.labelTexts.forEach(t => t.destroy());
    this.labelTexts = [];
  }
}
