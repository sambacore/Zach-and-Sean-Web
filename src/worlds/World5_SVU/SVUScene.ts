import Phaser from 'phaser';
import { GameState } from '../../systems/GameState';
import { UnlockSystem } from '../../systems/UnlockSystem';
import { createPixelText } from '../../ui/PixelText';
import { MobileControls } from '../../ui/MobileControls';

interface Witness {
  x: number;
  y: number;
  name: string;
  clue: string;
  interviewed: boolean;
  gfx: Phaser.GameObjects.Graphics;
}

export class SVUScene extends Phaser.Scene {
  private playerX = 80;
  private playerY = 450;
  private playerFacing = 1;
  private playerColor = 0xcc2222;
  private playerSpeed = 140;
  private playerGfx!: Phaser.GameObjects.Graphics;
  private bgGfx!: Phaser.GameObjects.Graphics;

  private witnesses: Witness[] = [];
  private interviewCount = 0;

  private dialogActive = false;
  private activeWitness: Witness | null = null;
  private dialogGfx?: Phaser.GameObjects.Graphics;
  private dialogTexts: Phaser.GameObjects.Text[] = [];

  private hudText!: Phaser.GameObjects.Text;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private zKey!: Phaser.Input.Keyboard.Key;
  private mobileControls?: MobileControls;
  private gameActive = true;

  constructor() { super({ key: 'SVUScene' }); }

  create(): void {
    const { width, height } = this.scale;
    const state = GameState.getInstance();
    this.cameras.main.fadeIn(300, 0, 0, 0);

    if (state.selectedCharacter === 'sean') {
      this.playerColor = 0x2255cc;
      this.playerSpeed = 165;
    }

    this.bgGfx    = this.add.graphics();
    this.playerGfx = this.add.graphics();

    const defs = [
      { x: 220, y: 450, name: 'WITNESS #1', clue: '"I saw three people in blue\njackets near the east alley."' },
      { x: 460, y: 450, name: 'WITNESS #2', clue: '"One of them had a police\nradio — around midnight."' },
      { x: 680, y: 450, name: 'WITNESS #3', clue: '"They headed north toward\nthe old precinct building."' },
    ];
    defs.forEach(d => {
      const gfx = this.add.graphics();
      this.witnesses.push({ ...d, interviewed: false, gfx });
    });

    this.hudText = this.add.text(10, 10, 'INTERVIEWS: 0 / 3', {
      fontFamily: '"Courier New", Courier, monospace',
      fontSize: '14px', color: '#ffdd00',
    }).setDepth(50).setScrollFactor(0).setOrigin(0, 0.5);

    createPixelText(this, width / 2, 34, 'APPROACH WITNESSES — PRESS Z TO INTERVIEW', 11, '#888888')
      .setScrollFactor(0).setDepth(50);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.zKey    = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
    this.mobileControls = new MobileControls(this);
    void height;
  }

  private openDialog(w: Witness): void {
    if (this.dialogActive) return;
    this.dialogActive = true;
    this.activeWitness = w;
    const { width, height } = this.scale;

    this.dialogGfx = this.add.graphics().setDepth(80).setScrollFactor(0);
    this.dialogGfx.fillStyle(0x0d0d22, 0.95);
    this.dialogGfx.fillRect(55, height - 210, width - 110, 180);
    this.dialogGfx.lineStyle(2, 0x4466ff, 1);
    this.dialogGfx.strokeRect(55, height - 210, width - 110, 180);

    const t1 = createPixelText(this, width / 2, height - 188, w.name, 15, '#ffdd88')
      .setDepth(81).setScrollFactor(0);
    const t2 = this.add.text(width / 2, height - 162, w.clue, {
      fontFamily: '"Courier New", Courier, monospace',
      fontSize: '12px', color: '#cccccc', align: 'center',
    }).setOrigin(0.5, 0).setDepth(81).setScrollFactor(0);
    const t3 = createPixelText(this, width / 2, height - 58, '[PRESS Z TO CLOSE]', 11, '#555566')
      .setDepth(81).setScrollFactor(0);

    this.dialogTexts = [t1, t2, t3];
  }

  private closeDialog(): void {
    if (!this.dialogActive) return;
    this.dialogGfx?.destroy();
    this.dialogGfx = undefined;
    this.dialogTexts.forEach(t => t.destroy());
    this.dialogTexts = [];

    if (this.activeWitness && !this.activeWitness.interviewed) {
      this.activeWitness.interviewed = true;
      this.interviewCount++;
      this.hudText.setText(`INTERVIEWS: ${this.interviewCount} / 3`);
    }
    this.activeWitness = null;
    this.dialogActive = false;

    if (this.interviewCount >= 3) {
      this.time.delayedCall(400, () => this.showChoice());
    }
  }

  private drawBg(): void {
    const { width, height } = this.scale;
    this.bgGfx.clear();

    // Sky/city
    this.bgGfx.fillStyle(0x0e0e1e, 1);
    this.bgGfx.fillRect(0, 50, width, 370);

    // Buildings
    const blds = [
      { x: 0,   w: 150, h: 200 }, { x: 165, w: 110, h: 160 },
      { x: 285, w: 175, h: 230 }, { x: 475, w: 120, h: 175 },
      { x: 608, w: 192, h: 210 },
    ];
    blds.forEach(b => {
      this.bgGfx.fillStyle(0x151525, 1);
      this.bgGfx.fillRect(b.x, 50 + (240 - b.h), b.w, b.h);
      this.bgGfx.fillStyle(0x2a3355, 0.55);
      for (let wy = 10; wy < b.h - 15; wy += 28) {
        for (let wx = 10; wx < b.w - 10; wx += 22) {
          if (Math.sin(b.x * 0.1 + wx + wy) > 0.2)
            this.bgGfx.fillRect(b.x + wx, 50 + (240 - b.h) + wy, 10, 14);
        }
      }
    });

    // Sidewalk
    this.bgGfx.fillStyle(0x222233, 1);
    this.bgGfx.fillRect(0, 420, width, 6);
    this.bgGfx.fillStyle(0x0a0a14, 1);
    this.bgGfx.fillRect(0, 426, width, height - 426);

    // Streetlights
    [130, 380, 620].forEach(sx => {
      this.bgGfx.fillStyle(0x555566, 1);
      this.bgGfx.fillRect(sx - 2, 300, 4, 125);
      this.bgGfx.fillStyle(0xffee88, 0.7);
      this.bgGfx.fillRect(sx - 12, 296, 24, 8);
    });
  }

  private drawWitnesses(): void {
    this.witnesses.forEach(w => {
      w.gfx.clear();
      // Shadow
      w.gfx.fillStyle(0x000000, 0.3);
      w.gfx.fillEllipse(w.x, w.y + 2, 20, 8);
      // Body
      w.gfx.fillStyle(w.interviewed ? 0x336644 : 0x886622, 1);
      w.gfx.fillRect(w.x - 8, w.y - 22, 16, 22);
      // Head
      w.gfx.fillStyle(0xffccaa, 1);
      w.gfx.fillCircle(w.x, w.y - 28, 8);
      // "Talk" indicator
      if (!w.interviewed) {
        w.gfx.fillStyle(0xffdd00, 1);
        w.gfx.fillRect(w.x - 3, w.y - 44, 6, 6);
        w.gfx.fillRect(w.x - 1, w.y - 40, 2, 4);
      } else {
        // Checkmark style dot
        w.gfx.fillStyle(0x44ff88, 1);
        w.gfx.fillCircle(w.x, w.y - 42, 5);
      }
    });
  }

  private drawPlayer(): void {
    this.playerGfx.clear();
    // Shadow
    this.playerGfx.fillStyle(0x000000, 0.3);
    this.playerGfx.fillEllipse(this.playerX, this.playerY + 2, 22, 8);
    // Body
    this.playerGfx.fillStyle(this.playerColor, 1);
    this.playerGfx.fillRect(this.playerX - 8, this.playerY - 22, 16, 22);
    // Head
    this.playerGfx.fillStyle(0xffccaa, 1);
    this.playerGfx.fillCircle(this.playerX, this.playerY - 28, 8);
    // Badge flash
    this.playerGfx.fillStyle(0xffdd00, 1);
    this.playerGfx.fillRect(this.playerX + (this.playerFacing > 0 ? 3 : -7), this.playerY - 16, 4, 4);
  }

  private showChoice(): void {
    if (!this.gameActive) return;
    this.gameActive = false;
    UnlockSystem.getInstance().applyWorldUnlocks(5);
    GameState.getInstance().beatWorld(5);

    const { width, height } = this.scale;
    const ov = this.add.graphics().setDepth(100).setScrollFactor(0);
    ov.fillStyle(0x000000, 0.88);
    ov.fillRect(0, 0, width, height);

    createPixelText(this, width / 2, height / 2 - 110, 'WORLD CLEARED!', 32, '#ffdd00').setDepth(101).setScrollFactor(0);
    createPixelText(this, width / 2, height / 2 - 72, 'ABILITY: WITNESS SHIELD', 16, '#ff8844').setDepth(101).setScrollFactor(0);
    createPixelText(this, width / 2, height / 2 - 38, 'Witnesses know everything. What do you do?', 14, '#cccccc').setDepth(101).setScrollFactor(0);
    createPixelText(this, width / 2, height / 2 + 76, 'ARROWS: choose  ENTER: confirm', 11, '#555566').setDepth(101).setScrollFactor(0);

    let sel = 0;
    const cg = this.add.graphics().setDepth(102).setScrollFactor(0);
    const labels = ['PROTECT THEM', 'INTIMIDATE'];
    const cx = [width / 2 - 120, width / 2 + 120];
    const cy = height / 2 + 22;
    const lt = labels.map((lbl, i) =>
      createPixelText(this, cx[i], cy, lbl, 14, '#aaaacc').setDepth(103).setScrollFactor(0)
    );
    const redraw = () => {
      cg.clear();
      labels.forEach((_, i) => {
        const on = i === sel;
        cg.fillStyle(on ? 0x223355 : 0x111122, 1);
        cg.fillRect(cx[i] - 92, cy - 22, 184, 44);
        cg.lineStyle(2, on ? 0x4488ff : 0x334455, 1);
        cg.strokeRect(cx[i] - 92, cy - 22, 184, 44);
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
      GameState.getInstance().makeChoice(5, sel === 0 ? 'protect' : 'intimidate');
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

  update(_time: number, delta: number): void {
    if (!this.gameActive) return;
    const dt = delta / 1000;
    const { width } = this.scale;

    this.mobileControls?.update();
    const mb = this.mobileControls?.state;

    if (!this.dialogActive) {
      if (this.cursors.left.isDown  || mb?.left)  { this.playerX -= this.playerSpeed * dt; this.playerFacing = -1; }
      if (this.cursors.right.isDown || mb?.right) { this.playerX += this.playerSpeed * dt; this.playerFacing =  1; }
      this.playerX = Phaser.Math.Clamp(this.playerX, 16, width - 16);
      this.playerY = 450;

      if (Phaser.Input.Keyboard.JustDown(this.zKey) || mb?.actionJustDown) {
        const near = this.witnesses.find(w =>
          !w.interviewed && Math.abs(w.x - this.playerX) < 45 && Math.abs(w.y - this.playerY) < 45
        );
        if (near) this.openDialog(near);
      }
    } else {
      if (Phaser.Input.Keyboard.JustDown(this.zKey) || mb?.actionJustDown) this.closeDialog();
    }

    this.drawBg();
    this.drawWitnesses();
    this.drawPlayer();
  }
}
