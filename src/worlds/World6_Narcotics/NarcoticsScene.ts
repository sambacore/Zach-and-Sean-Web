import Phaser from 'phaser';
import { GameState } from '../../systems/GameState';
import { UnlockSystem } from '../../systems/UnlockSystem';
import { createPixelText } from '../../ui/PixelText';
import { MobileControls } from '../../ui/MobileControls';

interface Runner {
  x: number;
  y: number;
  speed: number;
  health: number;
  alive: boolean;
  hitTimer: number;
  gfx: Phaser.GameObjects.Graphics;
}

interface Trap {
  x: number;
  y: number;
  active: boolean;
  gfx: Phaser.GameObjects.Graphics;
}

interface Bullet {
  x: number;
  y: number;
  vx: number;
  alive: boolean;
  gfx: Phaser.GameObjects.Graphics;
}

const WAVE_SIZES = [4, 6, 8];
const RUNNER_LANES = [240, 300, 360, 420];

export class NarcoticsScene extends Phaser.Scene {
  private playerX = 80;
  private playerY = 350;
  private playerColor = 0xcc2222;
  private playerSpeed = 140;
  private playerGfx!: Phaser.GameObjects.Graphics;
  private bgGfx!: Phaser.GameObjects.Graphics;

  private runners: Runner[] = [];
  private traps: Trap[] = [];
  private bullets: Bullet[] = [];

  private wave = 1;
  private spawnLeft = 0;
  private spawnTimer = 0;
  private waveCleared = false;
  private waveDelay = 0;
  private readonly MAX_TRAPS = 3;
  private trapsPlaced = 0;

  private lives = 3;
  private escaped = 0;          // runners that crossed left edge
  private readonly MAX_ESCAPED = 5;

  private shootCooldown = 0;
  private readonly SHOOT_CD = 350;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private zKey!: Phaser.Input.Keyboard.Key;
  private xKey!: Phaser.Input.Keyboard.Key;
  private mobileControls?: MobileControls;
  private gameActive = true;

  private hudText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;

  constructor() { super({ key: 'NarcoticsScene' }); }

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

    this.wave = 1;
    this.spawnLeft = WAVE_SIZES[0];
    this.spawnTimer = 1200;

    this.hudText = this.add.text(10, 10, '', {
      fontFamily: '"Courier New", Courier, monospace',
      fontSize: '13px', color: '#ffdd00',
    }).setDepth(50).setScrollFactor(0).setOrigin(0, 0.5);

    this.waveText = createPixelText(this, width / 2, 34, 'WAVE 1 / 3', 18, '#ff8844')
      .setScrollFactor(0).setDepth(50);

    createPixelText(this, width / 2, height - 20,
      'Z: SHOOT  X: PLACE TRAP (max 3)  — stop the runners!', 10, '#555566')
      .setScrollFactor(0).setDepth(50);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.zKey    = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
    this.xKey    = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.X);
    this.mobileControls = new MobileControls(this);

    this.updateHUD();
    void height;
  }

  private updateHUD(): void {
    this.hudText.setText(
      `LIVES: ${this.lives}  TRAPS: ${this.MAX_TRAPS - this.trapsPlaced} left  ESCAPED: ${this.escaped}/${this.MAX_ESCAPED}`
    );
  }

  private spawnRunner(): void {
    const { width } = this.scale;
    const lane = RUNNER_LANES[Phaser.Math.Between(0, RUNNER_LANES.length - 1)];
    const speed = Phaser.Math.Between(70, 110) + (this.wave - 1) * 18;
    const gfx = this.add.graphics();
    this.runners.push({ x: width + 20, y: lane, speed, health: 2, alive: true, hitTimer: 0, gfx });
  }

  private shootBullet(): void {
    const { width } = this.scale;
    const gfx = this.add.graphics();
    this.bullets.push({ x: this.playerX + 12, y: this.playerY - 8, vx: 420, alive: true, gfx });
    void width;
  }

  private placeTrap(): void {
    if (this.trapsPlaced >= this.MAX_TRAPS) return;
    // Don't stack traps
    const close = this.traps.some(t => t.active && Math.abs(t.x - this.playerX) < 30 && Math.abs(t.y - this.playerY) < 30);
    if (close) return;
    const gfx = this.add.graphics();
    this.traps.push({ x: this.playerX, y: this.playerY, active: true, gfx });
    this.trapsPlaced++;
    this.updateHUD();
  }

  private drawBg(): void {
    const { width, height } = this.scale;
    this.bgGfx.clear();
    // Warehouse interior
    this.bgGfx.fillStyle(0x0d0d18, 1);
    this.bgGfx.fillRect(0, 48, width, height - 48);
    // Lane dividers
    this.bgGfx.lineStyle(1, 0x222233, 0.6);
    RUNNER_LANES.forEach(ly => {
      this.bgGfx.beginPath();
      this.bgGfx.moveTo(0, ly);
      this.bgGfx.lineTo(width, ly);
      this.bgGfx.strokePath();
    });
    // Walls/crates decoration
    this.bgGfx.fillStyle(0x1a1a2a, 1);
    this.bgGfx.fillRect(0, 48, width, 10);
    this.bgGfx.fillRect(0, height - 10, width, 10);
    // Supply stash (right side)
    this.bgGfx.fillStyle(0x3a2a10, 1);
    this.bgGfx.fillRect(width - 80, 200, 70, 260);
    this.bgGfx.fillStyle(0x554422, 1);
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 2; col++) {
        this.bgGfx.fillRect(width - 75 + col * 35, 205 + row * 55, 28, 45);
      }
    }
    // Barrier on left
    this.bgGfx.fillStyle(0x1a2a1a, 1);
    this.bgGfx.fillRect(0, 180, 40, 300);
  }

  private loseLife(): void {
    this.lives--;
    this.updateHUD();
    if (this.lives <= 0) this.triggerLose();
  }

  private triggerLose(): void {
    if (!this.gameActive) return;
    this.gameActive = false;
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('GameOverScene', {
        worldNumber: 6,
        worldName: 'NARCOTICS DEPT',
        retryScene: 'NarcoticsScene',
      });
    });
  }

  private showChoice(): void {
    if (!this.gameActive) return;
    this.gameActive = false;
    UnlockSystem.getInstance().applyWorldUnlocks(6);
    GameState.getInstance().beatWorld(6);

    const { width, height } = this.scale;
    const ov = this.add.graphics().setDepth(100).setScrollFactor(0);
    ov.fillStyle(0x000000, 0.88);
    ov.fillRect(0, 0, width, height);

    createPixelText(this, width / 2, height / 2 - 110, 'WORLD CLEARED!', 32, '#ffdd00').setDepth(101).setScrollFactor(0);
    createPixelText(this, width / 2, height / 2 - 72, 'ABILITY: STASH', 16, '#ff8844').setDepth(101).setScrollFactor(0);
    createPixelText(this, width / 2, height / 2 - 38, 'The supply is yours. What do you do?', 15, '#cccccc').setDepth(101).setScrollFactor(0);
    createPixelText(this, width / 2, height / 2 + 76, 'ARROWS: choose  ENTER: confirm', 11, '#555566').setDepth(101).setScrollFactor(0);

    let sel = 0;
    const cg = this.add.graphics().setDepth(102).setScrollFactor(0);
    const labels = ['BURN IT', 'TAKE IT'];
    const cx = [width / 2 - 100, width / 2 + 100];
    const cy = height / 2 + 22;
    const lt = labels.map((lbl, i) =>
      createPixelText(this, cx[i], cy, lbl, 14, '#aaaacc').setDepth(103).setScrollFactor(0)
    );
    const redraw = () => {
      cg.clear();
      labels.forEach((_, i) => {
        const on = i === sel;
        cg.fillStyle(on ? 0x223355 : 0x111122, 1);
        cg.fillRect(cx[i] - 72, cy - 22, 144, 44);
        cg.lineStyle(2, on ? 0x4488ff : 0x334455, 1);
        cg.strokeRect(cx[i] - 72, cy - 22, 144, 44);
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
      GameState.getInstance().makeChoice(6, sel === 0 ? 'burn' : 'take');
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
    const { width, height } = this.scale;

    // Player movement
    this.mobileControls?.update();
    const mb = this.mobileControls?.state;
    if (this.cursors.up.isDown    || mb?.up)    this.playerY -= this.playerSpeed * dt;
    if (this.cursors.down.isDown  || mb?.down)  this.playerY += this.playerSpeed * dt;
    if (this.cursors.left.isDown  || mb?.left)  this.playerX -= this.playerSpeed * dt;
    if (this.cursors.right.isDown || mb?.right) this.playerX += this.playerSpeed * dt;
    this.playerX = Phaser.Math.Clamp(this.playerX, 16, 200);
    this.playerY = Phaser.Math.Clamp(this.playerY, 60, height - 20);

    // Shoot
    if (this.shootCooldown > 0) this.shootCooldown -= delta;
    if ((Phaser.Input.Keyboard.JustDown(this.zKey) || mb?.actionJustDown) && this.shootCooldown <= 0) {
      this.shootBullet();
      this.shootCooldown = this.SHOOT_CD;
    }

    // Place trap
    if (Phaser.Input.Keyboard.JustDown(this.xKey)) this.placeTrap();

    // Spawn
    this.spawnTimer -= delta;
    if (this.spawnTimer <= 0 && this.spawnLeft > 0) {
      this.spawnRunner();
      this.spawnLeft--;
      this.spawnTimer = Phaser.Math.Between(900, 1600);
    }

    // Update runners
    this.runners.forEach(r => {
      if (!r.alive) return;
      if (r.hitTimer > 0) r.hitTimer -= delta;
      r.x -= r.speed * dt;

      // Runner vs trap
      this.traps.forEach(trap => {
        if (!trap.active) return;
        if (Math.abs(r.x - trap.x) < 20 && Math.abs(r.y - trap.y) < 20) {
          r.health -= 2;
          trap.active = false;
          trap.gfx.destroy();
          r.hitTimer = 200;
          if (r.health <= 0) r.alive = false;
        }
      });
      this.traps = this.traps.filter(t => t.active);

      // Runner exits left
      if (r.x < -20) {
        r.alive = false;
        this.escaped++;
        this.updateHUD();
        if (this.escaped >= this.MAX_ESCAPED) { this.loseLife(); }
      }
    });

    // Update bullets
    this.bullets = this.bullets.filter(b => {
      if (!b.alive) { b.gfx.destroy(); return false; }
      b.x += b.vx * dt;
      if (b.x > width + 20) { b.gfx.destroy(); return false; }

      // Bullet vs runner
      this.runners.forEach(r => {
        if (!r.alive) return;
        if (Math.abs(r.x - b.x) < 16 && Math.abs(r.y - b.y) < 16) {
          r.health--;
          r.hitTimer = 150;
          b.alive = false;
          if (r.health <= 0) r.alive = false;
        }
      });

      b.gfx.clear();
      b.gfx.fillStyle(0xffff00, 1);
      b.gfx.fillRect(b.x - 5, b.y - 2, 10, 4);
      return b.alive;
    });

    // Clean dead runners
    this.runners = this.runners.filter(r => {
      if (!r.alive) { r.gfx.destroy(); return false; }
      return true;
    });

    // Wave progression
    const allSpawned = this.spawnLeft <= 0;
    const allDead = this.runners.length === 0;
    if (allSpawned && allDead && !this.waveCleared) {
      this.waveCleared = true;
      this.waveDelay = 2000;
    }
    if (this.waveCleared) {
      this.waveDelay -= delta;
      if (this.waveDelay <= 0) {
        this.waveCleared = false;
        this.wave++;
        if (this.wave > 3) { this.showChoice(); return; }
        this.spawnLeft = WAVE_SIZES[this.wave - 1];
        this.spawnTimer = 1500;
        this.waveText.setText(`WAVE ${this.wave} / 3`);
      }
    }

    // Draw
    this.drawBg();

    // Draw traps
    this.traps.forEach(trap => {
      if (!trap.active) return;
      trap.gfx.clear();
      trap.gfx.fillStyle(0xff6600, 0.7);
      trap.gfx.fillRect(trap.x - 12, trap.y - 6, 24, 12);
      trap.gfx.lineStyle(1, 0xff9900, 1);
      trap.gfx.strokeRect(trap.x - 12, trap.y - 6, 24, 12);
    });

    // Draw runners
    this.runners.forEach(r => {
      r.gfx.clear();
      if (!r.alive) return;
      const col = r.hitTimer > 0 ? 0xffffff : 0xaa3300;
      r.gfx.fillStyle(col, 1);
      r.gfx.fillRect(r.x - 8, r.y - 18, 16, 22);
      r.gfx.fillStyle(0xffccaa, 1);
      r.gfx.fillCircle(r.x, r.y - 24, 7);
    });

    // Draw player
    this.playerGfx.clear();
    this.playerGfx.fillStyle(this.playerColor, 1);
    this.playerGfx.fillRect(this.playerX - 8, this.playerY - 18, 16, 22);
    this.playerGfx.fillStyle(0xffccaa, 1);
    this.playerGfx.fillCircle(this.playerX, this.playerY - 24, 8);

    void width; void height;
  }
}
