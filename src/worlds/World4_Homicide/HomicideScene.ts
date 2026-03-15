import Phaser from 'phaser';
import { GameState } from '../../systems/GameState';
import { UnlockSystem } from '../../systems/UnlockSystem';
import { createPixelText } from '../../ui/PixelText';

interface Guard {
  x: number;
  y: number;
  angle: number;
  patrolMin: number;
  patrolMax: number;
  patrolDir: number;
  patrolAxis: 'x' | 'y';
}

interface Evidence {
  x: number;
  y: number;
  collected: boolean;
  gfx: Phaser.GameObjects.Graphics;
}

export class HomicideScene extends Phaser.Scene {
  private playerX = 80;
  private playerY = 300;
  private playerColor = 0xcc2222;
  private playerSpeed = 120;

  private playerGfx!: Phaser.GameObjects.Graphics;
  private bgGfx!: Phaser.GameObjects.Graphics;
  private guardGfx!: Phaser.GameObjects.Graphics;
  private hudText!: Phaser.GameObjects.Text;
  private alertText!: Phaser.GameObjects.Text;

  private guards: Guard[] = [];
  private evidence: Evidence[] = [];
  private collected = 0;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private gameActive = true;
  private alertFlash = 0;

  private readonly CONE_RANGE = 125;
  private readonly CONE_HALF = 0.55;
  private readonly GUARD_SPD = 52;

  constructor() { super({ key: 'HomicideScene' }); }

  create(): void {
    const { width, height } = this.scale;
    const state = GameState.getInstance();
    this.cameras.main.fadeIn(300, 0, 0, 0);

    if (state.selectedCharacter === 'sean') {
      this.playerColor = 0x2255cc;
      this.playerSpeed = 145;
    }

    this.bgGfx    = this.add.graphics();
    this.guardGfx = this.add.graphics();
    this.playerGfx = this.add.graphics();

    this.guards = [
      { x: 320, y: 200, angle: 0,            patrolMin: 180, patrolMax: 520, patrolDir: 1, patrolAxis: 'x' },
      { x: 580, y: 150, angle: Math.PI / 2,  patrolMin: 110, patrolMax: 430, patrolDir: 1, patrolAxis: 'y' },
      { x: 480, y: 460, angle: Math.PI,       patrolMin: 280, patrolMax: 680, patrolDir: 1, patrolAxis: 'x' },
    ];

    [{ x: 460, y: 180 }, { x: 195, y: 455 }, { x: 660, y: 370 }].forEach(pos => {
      const gfx = this.add.graphics();
      this.evidence.push({ ...pos, collected: false, gfx });
    });

    this.hudText = this.add.text(10, 10, 'EVIDENCE: 0 / 3', {
      fontFamily: '"Courier New", Courier, monospace',
      fontSize: '14px', color: '#ffdd00',
    }).setDepth(50).setScrollFactor(0).setOrigin(0, 0.5);

    this.alertText = createPixelText(this, width / 2, height / 2, '! DETECTED !', 28, '#ff2200')
      .setDepth(60).setScrollFactor(0).setAlpha(0);

    createPixelText(this, width / 2, 34, 'COLLECT 3 CLUES — AVOID SIGHT CONES', 11, '#888888')
      .setScrollFactor(0).setDepth(50);

    this.cursors = this.input.keyboard!.createCursorKeys();
    void height;
  }

  private inCone(g: Guard): boolean {
    const dx = this.playerX - g.x;
    const dy = this.playerY - g.y;
    if (dx * dx + dy * dy > this.CONE_RANGE * this.CONE_RANGE) return false;
    let diff = Math.atan2(dy, dx) - g.angle;
    while (diff > Math.PI)  diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    return Math.abs(diff) < this.CONE_HALF;
  }

  private drawScene(): void {
    const { width, height } = this.scale;

    this.bgGfx.clear();
    this.bgGfx.fillStyle(0x0d0d18, 1);
    this.bgGfx.fillRect(0, 48, width, height - 48);
    // Walls
    this.bgGfx.fillStyle(0x1c1c2e, 1);
    this.bgGfx.fillRect(0, 48, width, 10);
    this.bgGfx.fillRect(0, height - 10, width, 10);
    this.bgGfx.fillRect(0, 48, 10, height - 48);
    this.bgGfx.fillRect(width - 10, 48, 10, height - 48);
    // Room objects
    this.bgGfx.fillStyle(0x16162a, 1);
    this.bgGfx.fillRect(90, 90, 110, 60);
    this.bgGfx.fillRect(570, 260, 80, 90);
    this.bgGfx.fillRect(290, 490, 130, 38);
    this.bgGfx.fillRect(410, 88, 70, 85);
    this.bgGfx.fillRect(620, 88, 90, 55);

    this.guardGfx.clear();
    this.guards.forEach(g => {
      const hot = this.inCone(g);
      this.guardGfx.fillStyle(hot ? 0xff2200 : 0xffee44, hot ? 0.5 : 0.2);
      this.guardGfx.beginPath();
      this.guardGfx.moveTo(g.x, g.y);
      for (let s = 0; s <= 18; s++) {
        const a = g.angle - this.CONE_HALF + (s / 18) * this.CONE_HALF * 2;
        this.guardGfx.lineTo(g.x + Math.cos(a) * this.CONE_RANGE, g.y + Math.sin(a) * this.CONE_RANGE);
      }
      this.guardGfx.closePath();
      this.guardGfx.fillPath();
      // Guard sprite
      this.guardGfx.fillStyle(0x2244aa, 1);
      this.guardGfx.fillRect(g.x - 8, g.y - 8, 16, 20);
      this.guardGfx.fillStyle(0xffccaa, 1);
      this.guardGfx.fillCircle(g.x, g.y - 14, 7);
    });

    // Evidence icons
    this.evidence.forEach(ev => {
      ev.gfx.clear();
      if (ev.collected) return;
      ev.gfx.fillStyle(0xffffff, 0.85);
      ev.gfx.fillRect(ev.x - 7, ev.y - 7, 14, 14);
      ev.gfx.lineStyle(2, 0xffdd00, 1);
      ev.gfx.strokeRect(ev.x - 7, ev.y - 7, 14, 14);
      ev.gfx.fillStyle(0xffdd00, 1);
      ev.gfx.fillRect(ev.x - 2, ev.y - 4, 4, 9);
    });

    // Player
    this.playerGfx.clear();
    this.playerGfx.fillStyle(this.playerColor, 1);
    this.playerGfx.fillRect(this.playerX - 8, this.playerY - 10, 16, 22);
    this.playerGfx.fillStyle(0xffccaa, 1);
    this.playerGfx.fillCircle(this.playerX, this.playerY - 17, 8);
  }

  private triggerCaught(): void {
    if (!this.gameActive) return;
    this.gameActive = false;
    this.cameras.main.fadeOut(600, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('GameOverScene', {
        worldNumber: 4,
        worldName: 'HOMICIDE DEPT',
        retryScene: 'HomicideScene',
      });
    });
  }

  private showChoice(): void {
    if (!this.gameActive) return;
    this.gameActive = false;
    UnlockSystem.getInstance().applyWorldUnlocks(4);
    GameState.getInstance().beatWorld(4);

    const { width, height } = this.scale;
    const ov = this.add.graphics().setDepth(100).setScrollFactor(0);
    ov.fillStyle(0x000000, 0.88);
    ov.fillRect(0, 0, width, height);

    createPixelText(this, width / 2, height / 2 - 110, 'WORLD CLEARED!', 32, '#ffdd00').setDepth(101).setScrollFactor(0);
    createPixelText(this, width / 2, height / 2 - 72, 'ABILITY: DETECTIVE VISION', 16, '#ff8844').setDepth(101).setScrollFactor(0);
    createPixelText(this, width / 2, height / 2 - 38, 'Evidence in hand. Your call.', 15, '#cccccc').setDepth(101).setScrollFactor(0);
    createPixelText(this, width / 2, height / 2 + 76, 'ARROWS: choose  ENTER: confirm', 11, '#555566').setDepth(101).setScrollFactor(0);

    let sel = 0;
    const cg = this.add.graphics().setDepth(102).setScrollFactor(0);
    const labels = ['DESTROY IT', 'KEEP IT'];
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
        cg.fillRect(cx[i] - 85, cy - 22, 170, 44);
        cg.lineStyle(2, on ? 0x4488ff : 0x334455, 1);
        cg.strokeRect(cx[i] - 85, cy - 22, 170, 44);
        lt[i].setColor(on ? '#ffffff' : '#666677');
      });
    };
    redraw();

    const lk = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
    const rk = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
    const ek = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    lk.on('down', () => { sel = 0; redraw(); });
    rk.on('down', () => { sel = 1; redraw(); });
    ek.on('down', () => {
      GameState.getInstance().makeChoice(4, sel === 0 ? 'destroy' : 'keep');
      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('WorldSelectScene'));
    });
  }

  update(_time: number, delta: number): void {
    if (!this.gameActive) return;
    const dt = delta / 1000;
    const { width, height } = this.scale;

    if (this.cursors.left.isDown)  this.playerX -= this.playerSpeed * dt;
    if (this.cursors.right.isDown) this.playerX += this.playerSpeed * dt;
    if (this.cursors.up.isDown)    this.playerY -= this.playerSpeed * dt;
    if (this.cursors.down.isDown)  this.playerY += this.playerSpeed * dt;

    this.playerX = Phaser.Math.Clamp(this.playerX, 18, width - 18);
    this.playerY = Phaser.Math.Clamp(this.playerY, 60, height - 18);

    const SPD = this.GUARD_SPD;
    this.guards.forEach(g => {
      if (g.patrolAxis === 'x') {
        g.x += SPD * g.patrolDir * dt;
        if (g.x >= g.patrolMax) { g.x = g.patrolMax; g.patrolDir = -1; g.angle = Math.PI; }
        if (g.x <= g.patrolMin) { g.x = g.patrolMin; g.patrolDir =  1; g.angle = 0; }
      } else {
        g.y += SPD * g.patrolDir * dt;
        if (g.y >= g.patrolMax) { g.y = g.patrolMax; g.patrolDir = -1; g.angle = -Math.PI / 2; }
        if (g.y <= g.patrolMin) { g.y = g.patrolMin; g.patrolDir =  1; g.angle =  Math.PI / 2; }
      }
    });

    // Detection check
    let detected = false;
    for (const g of this.guards) {
      if (this.inCone(g)) { detected = true; break; }
    }
    if (detected) {
      this.alertFlash += delta;
      this.alertText.setAlpha(Math.sin(this.alertFlash / 80) * 0.5 + 0.5);
      if (this.alertFlash > 800) { this.triggerCaught(); return; }
    } else {
      this.alertFlash = 0;
      this.alertText.setAlpha(0);
    }

    // Collect evidence
    this.evidence.forEach(ev => {
      if (ev.collected) return;
      if (Math.abs(ev.x - this.playerX) < 22 && Math.abs(ev.y - this.playerY) < 22) {
        ev.collected = true;
        this.collected++;
        this.hudText.setText(`EVIDENCE: ${this.collected} / 3`);
      }
    });

    if (this.collected >= 3) { this.showChoice(); return; }

    this.drawScene();
    void width; void height;
  }
}
