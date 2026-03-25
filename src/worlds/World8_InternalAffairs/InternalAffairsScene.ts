import Phaser from 'phaser';
import { GameState } from '../../systems/GameState';
import { UnlockSystem } from '../../systems/UnlockSystem';
import { createPixelText } from '../../ui/PixelText';
import { MobileControls } from '../../ui/MobileControls';

interface Camera {
  x: number;
  y: number;
  baseAngle: number;
  angle: number;
  sweepRange: number;
  sweepSpeed: number;
  sweepPhase: number;
  wallSide: 'top' | 'bottom' | 'left' | 'right';
}

interface Terminal {
  x: number;
  y: number;
  hacked: boolean;
  hackProgress: number;
  gfx: Phaser.GameObjects.Graphics;
}

const CONE_RANGE = 140;
const CONE_HALF  = 0.5;

export class InternalAffairsScene extends Phaser.Scene {
  private playerX = 100;
  private playerY = 300;
  private playerColor = 0xcc2222;
  private playerSpeed = 115;
  private playerGfx!: Phaser.GameObjects.Graphics;
  private bgGfx!: Phaser.GameObjects.Graphics;
  private camGfx!: Phaser.GameObjects.Graphics;

  private cameras_: Camera[] = [];
  private terminals: Terminal[] = [];
  private hackedCount = 0;

  private hackingTerminal: Terminal | null = null;
  private hackBar!: Phaser.GameObjects.Graphics;
  private hackBarBg!: Phaser.GameObjects.Graphics;

  private strikes = 0;
  private readonly MAX_STRIKES = 3;
  private strikeCooldown = 0;
  private readonly STRIKE_CD = 3000;
  private alertFlash = 0;
  private wasAlerted = false;

  private hudText!: Phaser.GameObjects.Text;
  private strikeText!: Phaser.GameObjects.Text;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private zKey!: Phaser.Input.Keyboard.Key;
  private mobileControls?: MobileControls;
  private gameActive = true;

  constructor() { super({ key: 'InternalAffairsScene' }); }

  create(): void {
    const { width, height } = this.scale;
    const state = GameState.getInstance();
    this.cameras.main.fadeIn(300, 0, 0, 0);

    if (state.selectedCharacter === 'sean') {
      this.playerColor = 0x2255cc;
      this.playerSpeed = 138;
    }

    this.bgGfx  = this.add.graphics();
    this.camGfx = this.add.graphics();
    this.playerGfx = this.add.graphics();
    this.hackBarBg = this.add.graphics().setDepth(60).setScrollFactor(0);
    this.hackBar   = this.add.graphics().setDepth(61).setScrollFactor(0);

    // Cameras on walls
    this.cameras_ = [
      { x: width * 0.25, y: 58,        baseAngle: Math.PI / 2, angle: Math.PI / 2, sweepRange: 0.65, sweepSpeed: 0.8, sweepPhase: 0,    wallSide: 'top' },
      { x: width - 10,   y: height * 0.3, baseAngle: Math.PI, angle: Math.PI,      sweepRange: 0.7,  sweepSpeed: 0.6, sweepPhase: 1.5,  wallSide: 'right' },
      { x: width * 0.65, y: height - 10,  baseAngle: -Math.PI / 2, angle: -Math.PI / 2, sweepRange: 0.6, sweepSpeed: 0.9, sweepPhase: 0.8, wallSide: 'bottom' },
      { x: 10,            y: height * 0.7, baseAngle: 0, angle: 0, sweepRange: 0.65, sweepSpeed: 0.75, sweepPhase: 2.2, wallSide: 'left' },
    ];

    // Terminals
    [{ x: 650, y: 180 }, { x: 380, y: 380 }, { x: 140, y: 500 }].forEach(pos => {
      const gfx = this.add.graphics();
      this.terminals.push({ ...pos, hacked: false, hackProgress: 0, gfx });
    });

    this.hudText = this.add.text(10, 10, 'TERMINALS: 0 / 3', {
      fontFamily: '"Courier New", Courier, monospace',
      fontSize: '14px', color: '#ffdd00',
    }).setDepth(50).setScrollFactor(0).setOrigin(0, 0.5);

    this.strikeText = this.add.text(width - 10, 10, 'STRIKES: 0 / 3', {
      fontFamily: '"Courier New", Courier, monospace',
      fontSize: '14px', color: '#ff4444',
    }).setDepth(50).setScrollFactor(0).setOrigin(1, 0.5);

    createPixelText(this, width / 2, 34, 'HOLD Z NEAR TERMINALS — AVOID CAMERAS', 11, '#888888')
      .setScrollFactor(0).setDepth(50);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.zKey    = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
    this.mobileControls = new MobileControls(this);
    void height;
  }

  private inCone(cam: Camera): boolean {
    const dx = this.playerX - cam.x;
    const dy = this.playerY - cam.y;
    if (dx * dx + dy * dy > CONE_RANGE * CONE_RANGE) return false;
    let diff = Math.atan2(dy, dx) - cam.angle;
    while (diff > Math.PI)  diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    return Math.abs(diff) < CONE_HALF;
  }

  private addStrike(): void {
    if (this.strikeCooldown > 0) return;
    this.strikes++;
    this.strikeCooldown = this.STRIKE_CD;
    this.strikeText.setText(`STRIKES: ${this.strikes} / 3`);
    this.alertFlash = 600;
    if (this.strikes >= this.MAX_STRIKES) {
      this.gameActive = false;
      this.cameras.main.fadeOut(500, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('GameOverScene', {
          worldNumber: 8,
          worldName: 'INT. AFFAIRS',
          retryScene: 'InternalAffairsScene',
        });
      });
    }
  }

  private drawScene(time: number): void {
    const { width, height } = this.scale;
    this.bgGfx.clear();
    // Floor
    this.bgGfx.fillStyle(0x0e0e1e, 1);
    this.bgGfx.fillRect(0, 48, width, height - 48);
    // Grid pattern
    this.bgGfx.lineStyle(1, 0x151528, 0.5);
    for (let gx = 0; gx < width; gx += 40) {
      this.bgGfx.beginPath();
      this.bgGfx.moveTo(gx, 48);
      this.bgGfx.lineTo(gx, height);
      this.bgGfx.strokePath();
    }
    for (let gy = 48; gy < height; gy += 40) {
      this.bgGfx.beginPath();
      this.bgGfx.moveTo(0, gy);
      this.bgGfx.lineTo(width, gy);
      this.bgGfx.strokePath();
    }
    // Walls
    this.bgGfx.fillStyle(0x1a1a2e, 1);
    this.bgGfx.fillRect(0, 48, width, 10);
    this.bgGfx.fillRect(0, height - 10, width, 10);
    this.bgGfx.fillRect(0, 48, 10, height - 48);
    this.bgGfx.fillRect(width - 10, 48, 10, height - 48);
    // Office furniture
    this.bgGfx.fillStyle(0x151525, 1);
    this.bgGfx.fillRect(200, 80, 140, 60);
    this.bgGfx.fillRect(480, 260, 110, 80);
    this.bgGfx.fillRect(60, 290, 80, 110);
    this.bgGfx.fillRect(580, 440, 130, 70);

    // Cameras
    this.camGfx.clear();
    this.cameras_.forEach(cam => {
      const detected = this.inCone(cam);
      const alerting = this.alertFlash > 0;
      const coneCol = detected ? (alerting ? 0xff0000 : 0xff4400) : 0x00ccff;
      const coneAlpha = detected ? 0.55 : 0.18;

      this.camGfx.fillStyle(coneCol, coneAlpha);
      this.camGfx.beginPath();
      this.camGfx.moveTo(cam.x, cam.y);
      for (let s = 0; s <= 18; s++) {
        const a = cam.angle - CONE_HALF + (s / 18) * CONE_HALF * 2;
        this.camGfx.lineTo(cam.x + Math.cos(a) * CONE_RANGE, cam.y + Math.sin(a) * CONE_RANGE);
      }
      this.camGfx.closePath();
      this.camGfx.fillPath();

      // Camera body
      this.camGfx.fillStyle(0x334455, 1);
      this.camGfx.fillRect(cam.x - 8, cam.y - 8, 16, 16);
      // Lens blink
      const blink = Math.sin(time / 500) > 0;
      this.camGfx.fillStyle(blink ? 0xff2200 : 0x440000, 1);
      this.camGfx.fillCircle(cam.x, cam.y, 5);
    });

    // Terminals
    this.terminals.forEach(t => {
      t.gfx.clear();
      const col = t.hacked ? 0x44ff44 : 0x4488ff;
      t.gfx.fillStyle(t.hacked ? 0x1a3a1a : 0x0d1a30, 1);
      t.gfx.fillRect(t.x - 18, t.y - 22, 36, 36);
      t.gfx.lineStyle(2, col, 1);
      t.gfx.strokeRect(t.x - 18, t.y - 22, 36, 36);
      // Screen
      t.gfx.fillStyle(col, 0.7);
      t.gfx.fillRect(t.x - 12, t.y - 16, 24, 18);
      if (!t.hacked) {
        // Indicator
        t.gfx.fillStyle(0xffdd00, 1);
        t.gfx.fillRect(t.x - 3, t.y - 32, 6, 6);
      }
    });

    // Player
    this.playerGfx.clear();
    this.playerGfx.fillStyle(this.playerColor, 1);
    this.playerGfx.fillRect(this.playerX - 8, this.playerY - 20, 16, 24);
    this.playerGfx.fillStyle(0xffccaa, 1);
    this.playerGfx.fillCircle(this.playerX, this.playerY - 26, 8);
  }

  private updateHackBar(active: boolean, progress: number): void {
    this.hackBarBg.clear();
    this.hackBar.clear();
    if (!active) return;
    const bw = 140, bh = 14;
    const bx = this.playerX - bw / 2, by = this.playerY - 55;
    this.hackBarBg.fillStyle(0x111122, 0.9);
    this.hackBarBg.fillRect(bx, by, bw, bh);
    this.hackBarBg.lineStyle(1, 0x4488ff, 1);
    this.hackBarBg.strokeRect(bx, by, bw, bh);
    this.hackBar.fillStyle(0x44ff88, 1);
    this.hackBar.fillRect(bx + 1, by + 1, (bw - 2) * progress, bh - 2);
  }

  private showChoice(): void {
    if (!this.gameActive) return;
    this.gameActive = false;
    UnlockSystem.getInstance().applyWorldUnlocks(8);
    GameState.getInstance().beatWorld(8);

    const { width, height } = this.scale;
    const ov = this.add.graphics().setDepth(100).setScrollFactor(0);
    ov.fillStyle(0x000000, 0.88);
    ov.fillRect(0, 0, width, height);

    createPixelText(this, width / 2, height / 2 - 110, 'WORLD CLEARED!', 32, '#ffdd00').setDepth(101).setScrollFactor(0);
    createPixelText(this, width / 2, height / 2 - 72, 'ABILITY: BADGE', 16, '#ff8844').setDepth(101).setScrollFactor(0);
    createPixelText(this, width / 2, height / 2 - 38, 'Files downloaded. The truth is in your hands.', 14, '#cccccc').setDepth(101).setScrollFactor(0);
    createPixelText(this, width / 2, height / 2 + 76, 'ARROWS: choose  ENTER: confirm', 11, '#555566').setDepth(101).setScrollFactor(0);

    let sel = 0;
    const cg = this.add.graphics().setDepth(102).setScrollFactor(0);
    const labels = ['EXPOSE THEM', 'COVER IT UP'];
    const cx = [width / 2 - 115, width / 2 + 115];
    const cy = height / 2 + 22;
    const lt = labels.map((lbl, i) =>
      createPixelText(this, cx[i], cy, lbl, 14, '#aaaacc').setDepth(103).setScrollFactor(0)
    );
    const redraw = () => {
      cg.clear();
      labels.forEach((_, i) => {
        const on = i === sel;
        cg.fillStyle(on ? 0x223355 : 0x111122, 1);
        cg.fillRect(cx[i] - 88, cy - 22, 176, 44);
        cg.lineStyle(2, on ? 0x4488ff : 0x334455, 1);
        cg.strokeRect(cx[i] - 88, cy - 22, 176, 44);
        lt[i].setColor(on ? '#ffffff' : '#666677');
      });
    };
    redraw();

    const lk = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
    const rk = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
    const ek = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    lk.on('down', () => { sel = 0; redraw(); });
    rk.on('down', () => { sel = 1; redraw(); });
    let confirmed = false;
    const confirm = () => {
      if (confirmed) return;
      confirmed = true;
      GameState.getInstance().makeChoice(8, sel === 0 ? 'expose' : 'cover');
      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('WorldSelectScene'));
    };
    ek.on('down', confirm);
    if (this.sys.game.device.input.touch) {
      this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
        sel = p.x < width / 2 ? 0 : 1;
        redraw();
        this.time.delayedCall(80, confirm);
      });
    }
  }

  update(time: number, delta: number): void {
    if (!this.gameActive) return;
    const dt = delta / 1000;
    const { width, height } = this.scale;

    // Move player
    this.mobileControls?.update();
    const mb = this.mobileControls?.state;
    if (this.cursors.left.isDown  || mb?.left)  this.playerX -= this.playerSpeed * dt;
    if (this.cursors.right.isDown || mb?.right) this.playerX += this.playerSpeed * dt;
    if (this.cursors.up.isDown    || mb?.up)    this.playerY -= this.playerSpeed * dt;
    if (this.cursors.down.isDown  || mb?.down)  this.playerY += this.playerSpeed * dt;
    this.playerX = Phaser.Math.Clamp(this.playerX, 18, width - 18);
    this.playerY = Phaser.Math.Clamp(this.playerY, 60, height - 18);

    // Rotate cameras
    const t = time / 1000;
    this.cameras_.forEach(cam => {
      cam.angle = cam.baseAngle + Math.sin(t * cam.sweepSpeed + cam.sweepPhase) * cam.sweepRange;
    });

    // Strike cooldown
    if (this.strikeCooldown > 0) this.strikeCooldown -= delta;
    if (this.alertFlash > 0)     this.alertFlash -= delta;

    // Camera detection
    const detected = this.cameras_.some(cam => this.inCone(cam));
    if (detected && !this.wasAlerted) {
      this.addStrike();
      if (!this.gameActive) return;
    }
    this.wasAlerted = detected;

    // Hacking
    const nearTerminal = this.terminals.find(t2 =>
      !t2.hacked && Math.abs(t2.x - this.playerX) < 38 && Math.abs(t2.y - this.playerY) < 38
    );

    if ((this.zKey.isDown || mb?.action) && nearTerminal) {
      this.hackingTerminal = nearTerminal;
      nearTerminal.hackProgress += dt / 1.8;  // ~1.8s to hack
      if (nearTerminal.hackProgress >= 1) {
        nearTerminal.hackProgress = 1;
        nearTerminal.hacked = true;
        this.hackingTerminal = null;
        this.hackedCount++;
        this.hudText.setText(`TERMINALS: ${this.hackedCount} / 3`);
        if (this.hackedCount >= 3) { this.showChoice(); return; }
      }
      this.updateHackBar(true, nearTerminal.hackProgress);
    } else {
      if (this.hackingTerminal) {
        this.hackingTerminal.hackProgress = Math.max(0, this.hackingTerminal.hackProgress - dt * 0.5);
        this.updateHackBar(true, this.hackingTerminal.hackProgress);
      } else {
        this.updateHackBar(false, 0);
      }
      this.hackingTerminal = null;
    }

    this.drawScene(time);
    void width; void height;
  }
}
