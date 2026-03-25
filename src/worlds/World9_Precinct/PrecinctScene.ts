import Phaser from 'phaser';
import { GameState } from '../../systems/GameState';
import { UnlockSystem } from '../../systems/UnlockSystem';
import { createPixelText } from '../../ui/PixelText';
import { MobileControls } from '../../ui/MobileControls';

type Phase = 'phase1' | 'cutscene' | 'phase2' | 'choice';

interface Boss {
  x: number;
  y: number;
  health: number;
  maxHealth: number;
  vx: number;
  phase: Phase;
  color: number;
  chargeTimer: number;
  chargeDir: number;
  charging: boolean;
  chargeCooldown: number;
  shootTimer: number;
}

interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alive: boolean;
  friendly: boolean;
  gfx: Phaser.GameObjects.Graphics;
}

interface FloatText {
  obj: Phaser.GameObjects.Text;
  vy: number;
  life: number;
}

const GROUND_Y   = 480;
const WORLD_W    = 800;
const P1_HP      = 24;
const P2_HP      = 18;

export class PrecinctScene extends Phaser.Scene {
  // Player
  private playerX = 150;
  private playerY = GROUND_Y;
  private playerVY = 0;
  private playerFacing = 1;
  private playerColor = 0xcc2222;
  private playerSpeed = 155;
  private playerHealth = 6;
  private playerMaxHp = 6;
  private isAttacking = false;
  private attackTimer = 0;
  private attackCooldown = 0;
  private readonly ATK_DUR = 280;
  private readonly ATK_CD  = 420;

  // Boss
  private boss!: Boss;
  private currentPhase: Phase = 'phase1';
  private cutsceneTimer = 0;
  private cutsceneStep = 0;

  // Invincibility
  private invincible = false;
  private invTimer = 0;
  private readonly INV_DUR = 900;

  // Graphics
  private bgGfx!: Phaser.GameObjects.Graphics;
  private bossGfx!: Phaser.GameObjects.Graphics;
  private playerGfx!: Phaser.GameObjects.Graphics;
  private projectiles: Projectile[] = [];
  private floatTexts: FloatText[] = [];

  // HUD
  private playerHpBar!: Phaser.GameObjects.Graphics;
  private bossHpBar!: Phaser.GameObjects.Graphics;
  private bossHpText!: Phaser.GameObjects.Text;
  private playerHpText!: Phaser.GameObjects.Text;
  private phaseLabel!: Phaser.GameObjects.Text;

  // Cutscene UI
  private cutsceneOverlay?: Phaser.GameObjects.Graphics;
  private cutsceneTexts: Phaser.GameObjects.Text[] = [];

  // Input
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private zKey!: Phaser.Input.Keyboard.Key;
  private xKey!: Phaser.Input.Keyboard.Key;
  private mobileControls?: MobileControls;

  private gameActive = true;
  private state!: GameState;

  constructor() { super({ key: 'PrecinctScene' }); }

  create(): void {
    const { width, height } = this.scale;
    this.state = GameState.getInstance();
    this.cameras.main.fadeIn(400, 0, 0, 0);

    if (this.state.selectedCharacter === 'sean') {
      this.playerColor = 0x2255cc;
      this.playerSpeed = 180;
      this.playerHealth = 5;
      this.playerMaxHp = 5;
    } else {
      this.playerHealth = 7;
      this.playerMaxHp = 7;
    }

    this.bgGfx    = this.add.graphics();
    this.bossGfx  = this.add.graphics();
    this.playerGfx = this.add.graphics();

    this.initBoss1();

    // HUD
    this.playerHpBar = this.add.graphics().setDepth(50).setScrollFactor(0);
    this.bossHpBar   = this.add.graphics().setDepth(50).setScrollFactor(0);
    this.playerHpText = this.add.text(10, 10, '', {
      fontFamily: '"Courier New", Courier, monospace', fontSize: '12px', color: '#ff6666',
    }).setDepth(51).setScrollFactor(0).setOrigin(0, 0.5);
    this.bossHpText = this.add.text(width - 10, 10, '', {
      fontFamily: '"Courier New", Courier, monospace', fontSize: '12px', color: '#ff4444', align: 'right',
    }).setDepth(51).setScrollFactor(0).setOrigin(1, 0.5);
    this.phaseLabel = createPixelText(this, width / 2, 34, 'CHIEF OF POLICE', 14, '#ff4444')
      .setScrollFactor(0).setDepth(51);

    createPixelText(this, width / 2, height - 18, 'Z: ATTACK  X: SHOOT  UP: JUMP', 10, '#555566')
      .setScrollFactor(0).setDepth(50);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.zKey    = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
    this.xKey    = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.X);
    this.mobileControls = new MobileControls(this);

    this.updateHUD();
    void height;
  }

  private initBoss1(): void {
    this.boss = {
      x: 620, y: GROUND_Y,
      health: P1_HP, maxHealth: P1_HP,
      vx: 0, phase: 'phase1',
      color: 0x446688,
      chargeTimer: 2500, chargeDir: -1,
      charging: false, chargeCooldown: 0,
      shootTimer: 3000,
    };
    this.currentPhase = 'phase1';
  }

  private initBoss2(): void {
    const isZach = this.state.selectedCharacter === 'zach';
    this.boss = {
      x: 620, y: GROUND_Y,
      health: P2_HP, maxHealth: P2_HP,
      vx: 0, phase: 'phase2',
      color: isZach ? 0x2255cc : 0xcc2222,   // fight the opposite character
      chargeTimer: 1800, chargeDir: -1,
      charging: false, chargeCooldown: 0,
      shootTimer: 2200,
    };
    this.currentPhase = 'phase2';
    const isZachP = this.state.selectedCharacter === 'zach';
    this.phaseLabel.setText(isZachP ? 'TRAITOR: SEAN' : 'TRAITOR: ZACH');
    this.phaseLabel.setColor('#ff2200');
    this.playerHealth = this.playerMaxHp;  // restore health
    this.updateHUD();
  }

  private updateHUD(): void {
    const { width } = this.scale;
    const pw = 160;
    this.playerHpBar.clear();
    this.playerHpBar.fillStyle(0x331111, 1);
    this.playerHpBar.fillRect(10, 20, pw, 10);
    this.playerHpBar.fillStyle(0xff4444, 1);
    this.playerHpBar.fillRect(10, 20, pw * (this.playerHealth / this.playerMaxHp), 10);
    this.playerHpText.setText(`YOU: ${this.playerHealth}/${this.playerMaxHp}`);

    const bw = 200;
    if (this.boss) {
      this.bossHpBar.clear();
      this.bossHpBar.fillStyle(0x330000, 1);
      this.bossHpBar.fillRect(width - 10 - bw, 20, bw, 10);
      this.bossHpBar.fillStyle(0xff2200, 1);
      this.bossHpBar.fillRect(width - 10 - bw, 20, bw * (this.boss.health / this.boss.maxHealth), 10);
      this.bossHpText.setText(`BOSS: ${this.boss.health}/${this.boss.maxHealth}`);
    }
    void width;
  }

  private shootProjectile(fromPlayer: boolean): void {
    const gfx = this.add.graphics();
    const srcX = fromPlayer ? this.playerX + (this.playerFacing > 0 ? 12 : -12) : this.boss.x;
    const srcY = fromPlayer ? this.playerY - 14 : this.boss.y - 18;
    const vx   = fromPlayer ? (this.playerFacing > 0 ? 380 : -380) : (this.boss.x < this.playerX ? 250 : -250);
    this.projectiles.push({ x: srcX, y: srcY, vx, vy: 0, alive: true, friendly: fromPlayer, gfx });
  }

  private shootSpread(): void {
    const angles = [-0.25, 0, 0.25];
    angles.forEach(a => {
      const gfx = this.add.graphics();
      const dir = this.boss.x < this.playerX ? 1 : -1;
      const speed = 240;
      this.projectiles.push({
        x: this.boss.x, y: this.boss.y - 20,
        vx: Math.cos(a) * speed * dir,
        vy: Math.sin(a) * speed,
        alive: true, friendly: false, gfx,
      });
    });
  }

  private addFloat(text: string, x: number, y: number, color: string): void {
    const obj = createPixelText(this, x, y, text, 14, color).setDepth(80);
    this.floatTexts.push({ obj, vy: -60, life: 700 });
  }

  private tryAttack(): void {
    if (this.attackCooldown > 0 || this.isAttacking) return;
    this.isAttacking = true;
    this.attackTimer = 0;
    this.attackCooldown = this.ATK_CD;
    // Hit check
    if (Math.abs(this.playerX - this.boss.x) < 70 && Math.abs(this.playerY - this.boss.y) < 60) {
      const dmg = this.state.selectedCharacter === 'zach' ? 3 : 2;
      this.boss.health -= dmg;
      this.boss.health = Math.max(0, this.boss.health);
      this.addFloat(`-${dmg}`, this.boss.x, this.boss.y - 40, '#ff4444');
      this.updateHUD();
      if (this.boss.health <= 0) this.onBossDeath();
    }
  }

  private takeDamage(dmg = 1): void {
    if (this.invincible) return;
    this.playerHealth -= dmg;
    this.invincible = true;
    this.invTimer = 0;
    this.cameras.main.shake(150, 0.008);
    this.updateHUD();
    if (this.playerHealth <= 0) {
      this.gameActive = false;
      this.cameras.main.fadeOut(500, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('GameOverScene', {
          worldNumber: 9,
          worldName: 'THE PRECINCT',
          retryScene: 'PrecinctScene',
        });
      });
    }
  }

  private onBossDeath(): void {
    if (this.currentPhase === 'phase1') {
      this.currentPhase = 'cutscene';
      this.cutsceneTimer = 0;
      this.cutsceneStep = 0;
      this.gameActive = false;
      this.time.delayedCall(500, () => this.startCutscene());
    } else if (this.currentPhase === 'phase2') {
      this.currentPhase = 'choice';
      this.time.delayedCall(600, () => this.showChoice());
    }
  }

  private startCutscene(): void {
    const { width, height } = this.scale;
    this.cutsceneOverlay = this.add.graphics().setDepth(200).setScrollFactor(0);
    this.cutsceneOverlay.fillStyle(0x000000, 0.92);
    this.cutsceneOverlay.fillRect(0, 0, width, height);

    const isZach = this.state.selectedCharacter === 'zach';
    const traitor = isZach ? 'SEAN' : 'ZACH';

    const lines = [
      { text: '— THE CHIEF IS DOWN —', color: '#ff4444', size: 22, y: height / 2 - 120 },
      { text: '...', color: '#888888', size: 16, y: height / 2 - 75 },
      { text: `BUT WAIT...`, color: '#ffdd00', size: 20, y: height / 2 - 35 },
      { text: `"${traitor} WAS WORKING FOR THE CHIEF`, color: '#ff2200', size: 14, y: height / 2 + 10 },
      { text: `ALL ALONG!"`, color: '#ff2200', size: 14, y: height / 2 + 32 },
      { text: `— TRAITOR: ${traitor} —`, color: '#ff0000', size: 24, y: height / 2 + 80 },
    ];

    let delay = 0;
    lines.forEach(line => {
      this.time.delayedCall(delay, () => {
        const t = createPixelText(this, width / 2, line.y, line.text, line.size, line.color)
          .setDepth(201).setScrollFactor(0);
        this.cutsceneTexts.push(t);
        if (line.size >= 20) this.cameras.main.shake(200, 0.01);
      });
      delay += 900;
    });

    this.time.delayedCall(delay + 1200, () => {
      this.cameras.main.fadeOut(600, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.cutsceneOverlay?.destroy();
        this.cutsceneTexts.forEach(t => t.destroy());
        this.cutsceneTexts = [];
        this.projectiles.forEach(p => p.gfx.destroy());
        this.projectiles = [];
        this.floatTexts.forEach(f => f.obj.destroy());
        this.floatTexts = [];
        this.initBoss2();
        this.gameActive = true;
        this.cameras.main.fadeIn(400, 0, 0, 0);
      });
    });
  }

  private drawBg(): void {
    const { width, height } = this.scale;
    this.bgGfx.clear();
    // Precinct interior
    this.bgGfx.fillGradientStyle(0x0a0a1e, 0x0a0a1e, 0x14142e, 0x14142e, 1);
    this.bgGfx.fillRect(0, 48, width, height - 48);
    // Floor
    this.bgGfx.fillStyle(0x161626, 1);
    this.bgGfx.fillRect(0, GROUND_Y, width, height - GROUND_Y);
    this.bgGfx.fillStyle(0x1e1e32, 1);
    this.bgGfx.fillRect(0, GROUND_Y, width, 4);
    // Back wall detail
    this.bgGfx.fillStyle(0x11112a, 1);
    this.bgGfx.fillRect(0, 48, width, 10);
    this.bgGfx.fillRect(0, 48, 8, GROUND_Y - 48);
    this.bgGfx.fillRect(width - 8, 48, 8, GROUND_Y - 48);
    // Desk/furniture
    this.bgGfx.fillStyle(0x1a1a30, 1);
    this.bgGfx.fillRect(180, 310, 120, 55);
    this.bgGfx.fillRect(500, 290, 110, 60);
    this.bgGfx.fillRect(330, GROUND_Y - 40, 140, 40);
    // Flag on wall
    this.bgGfx.fillStyle(0x223366, 1);
    this.bgGfx.fillRect(width / 2 - 20, 60, 4, 80);
    this.bgGfx.fillStyle(0x336699, 1);
    this.bgGfx.fillRect(width / 2 - 16, 60, 40, 25);
    this.bgGfx.fillStyle(0x4477bb, 1);
    this.bgGfx.fillRect(width / 2 - 16, 60, 40, 10);
  }

  private drawBoss(): void {
    this.bossGfx.clear();
    const b = this.boss;
    if (b.health <= 0 && this.currentPhase !== 'phase2') return;

    const flash = this.invincible && Math.floor(this.invTimer / 80) % 2 === 0;
    // Boss body
    this.bossGfx.fillStyle(b.color, flash ? 0.3 : 1);
    this.bossGfx.fillRect(b.x - 18, b.y - 50, 36, 56);
    // Boss head
    this.bossGfx.fillStyle(0xffccaa, flash ? 0.3 : 1);
    this.bossGfx.fillCircle(b.x, b.y - 58, 14);
    // Hat (Phase 1 chief wears a big hat)
    if (this.currentPhase === 'phase1' || this.currentPhase === 'cutscene') {
      this.bossGfx.fillStyle(0x223355, flash ? 0.3 : 1);
      this.bossGfx.fillRect(b.x - 20, b.y - 76, 40, 12);
      this.bossGfx.fillRect(b.x - 14, b.y - 90, 28, 16);
    }
    // Charge effect
    if (b.charging) {
      this.bossGfx.lineStyle(3, 0xff4400, 0.8);
      this.bossGfx.strokeRect(b.x - 22, b.y - 54, 44, 60);
    }
  }

  private drawPlayer(): void {
    this.playerGfx.clear();
    if (!this.gameActive && this.currentPhase !== 'phase2') return;
    if (this.invincible && Math.floor(this.invTimer / 80) % 2 === 0) return;

    // Shadow
    this.playerGfx.fillStyle(0x000000, 0.25);
    this.playerGfx.fillEllipse(this.playerX, GROUND_Y + 3, 24, 8);
    // Body
    this.playerGfx.fillStyle(this.playerColor, 1);
    this.playerGfx.fillRect(this.playerX - 9, this.playerY - 32, 18, 32);
    // Head
    this.playerGfx.fillStyle(0xffccaa, 1);
    this.playerGfx.fillCircle(this.playerX, this.playerY - 40, 9);
    // Attack swing
    if (this.isAttacking) {
      const sx = this.playerFacing > 0 ? this.playerX + 8 : this.playerX - 8;
      this.playerGfx.lineStyle(3, 0xffdd00, 0.9);
      this.playerGfx.beginPath();
      this.playerGfx.moveTo(sx, this.playerY - 30);
      this.playerGfx.lineTo(sx + this.playerFacing * 35, this.playerY - 18);
      this.playerGfx.strokePath();
    }
  }

  private showChoice(): void {
    const { width, height } = this.scale;
    UnlockSystem.getInstance();
    GameState.getInstance().beatWorld(9);

    const ov = this.add.graphics().setDepth(100).setScrollFactor(0);
    ov.fillStyle(0x000000, 0.92);
    ov.fillRect(0, 0, width, height);

    createPixelText(this, width / 2, height / 2 - 130, '★ GAME COMPLETE ★', 30, '#ffdd00').setDepth(101).setScrollFactor(0);
    createPixelText(this, width / 2, height / 2 - 88, 'THE PRECINCT HAS FALLEN.', 16, '#ff8844').setDepth(101).setScrollFactor(0);
    createPixelText(this, width / 2, height / 2 - 52, 'All 9 worlds cleared. You are built different.', 13, '#cccccc').setDepth(101).setScrollFactor(0);
    createPixelText(this, width / 2, height / 2 - 18, 'One last choice:', 14, '#aaaacc').setDepth(101).setScrollFactor(0);
    createPixelText(this, width / 2, height / 2 + 78, 'ARROWS: choose  ENTER: confirm', 11, '#555566').setDepth(101).setScrollFactor(0);

    let sel = 0;
    const cg = this.add.graphics().setDepth(102).setScrollFactor(0);
    const labels = ['JUSTICE', 'ESCAPE'];
    const cx = [width / 2 - 110, width / 2 + 110];
    const cy = height / 2 + 26;
    const lt = labels.map((lbl, i) =>
      createPixelText(this, cx[i], cy, lbl, 16, '#aaaacc').setDepth(103).setScrollFactor(0)
    );
    const redraw = () => {
      cg.clear();
      labels.forEach((_, i) => {
        const on = i === sel;
        cg.fillStyle(on ? 0x223355 : 0x111122, 1);
        cg.fillRect(cx[i] - 80, cy - 26, 160, 52);
        cg.lineStyle(2, on ? 0x4488ff : 0x334455, 1);
        cg.strokeRect(cx[i] - 80, cy - 26, 160, 52);
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
      GameState.getInstance().makeChoice(9, sel === 0 ? 'justice' : 'escape');
      this.cameras.main.fadeOut(800, 0, 0, 0);
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
    if (this.currentPhase === 'cutscene') return;

    const dt = delta / 1000;
    const { width, height } = this.scale;

    // Invincibility
    if (this.invincible) {
      this.invTimer += delta;
      if (this.invTimer >= this.INV_DUR) this.invincible = false;
    }

    // Attack cooldown
    if (this.attackCooldown > 0) this.attackCooldown -= delta;
    if (this.isAttacking) {
      this.attackTimer += delta;
      if (this.attackTimer >= this.ATK_DUR) this.isAttacking = false;
    }

    // Player movement
    this.mobileControls?.update();
    const mb = this.mobileControls?.state;
    if (this.cursors.left.isDown  || mb?.left)  { this.playerX -= this.playerSpeed * dt; this.playerFacing = -1; }
    if (this.cursors.right.isDown || mb?.right) { this.playerX += this.playerSpeed * dt; this.playerFacing =  1; }

    // Jump
    const onGround = this.playerY >= GROUND_Y;
    if ((Phaser.Input.Keyboard.JustDown(this.cursors.up) || mb?.upJustDown) && onGround) {
      this.playerVY = -500;
    }
    this.playerVY += 1200 * dt;
    this.playerY += this.playerVY * dt;
    if (this.playerY >= GROUND_Y) { this.playerY = GROUND_Y; this.playerVY = 0; }
    this.playerX = Phaser.Math.Clamp(this.playerX, 20, WORLD_W - 20);

    // Attack
    if (Phaser.Input.Keyboard.JustDown(this.zKey) || mb?.actionJustDown) this.tryAttack();
    if (Phaser.Input.Keyboard.JustDown(this.xKey)) this.shootProjectile(true);

    // Boss AI
    const b = this.boss;
    if (b.chargeCooldown > 0) b.chargeCooldown -= delta;

    if (b.charging) {
      b.x += b.chargeDir * 400 * dt;
      if (b.x < 40 || b.x > WORLD_W - 40) {
        b.charging = false;
        b.chargeCooldown = Phaser.Math.Between(2000, 3500);
      }
      // Hit player during charge
      if (Math.abs(b.x - this.playerX) < 30 && Math.abs(b.y - this.playerY) < 60) {
        this.takeDamage(2);
        if (!this.gameActive) return;
      }
    } else {
      // Drift toward player
      const dx = this.playerX - b.x;
      b.vx = b.vx + (Math.sign(dx) * 80 - b.vx) * 0.04;
      b.x += b.vx * dt;
      b.x = Phaser.Math.Clamp(b.x, 50, WORLD_W - 50);

      // Melee hit
      if (Math.abs(b.x - this.playerX) < 50 && Math.abs(b.y - this.playerY) < 55) {
        this.takeDamage(1);
        if (!this.gameActive) return;
      }

      // Charge trigger
      b.chargeTimer -= delta;
      if (b.chargeTimer <= 0) {
        b.chargeTimer = Phaser.Math.Between(2500, 4000);
        if (b.chargeCooldown <= 0) {
          b.charging = true;
          b.chargeDir = b.x > this.playerX ? -1 : 1;
        }
      }

      // Shoot
      b.shootTimer -= delta;
      if (b.shootTimer <= 0) {
        b.shootTimer = this.currentPhase === 'phase2'
          ? Phaser.Math.Between(1400, 2200)
          : Phaser.Math.Between(2200, 3200);
        if (this.currentPhase === 'phase2') {
          this.shootSpread();
        } else {
          this.shootProjectile(false);
        }
      }
    }

    // Update projectiles
    this.projectiles = this.projectiles.filter(p => {
      if (!p.alive) { p.gfx.destroy(); return false; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.x < -20 || p.x > width + 20 || p.y > height) { p.gfx.destroy(); return false; }

      if (p.friendly) {
        // Hit boss
        if (Math.abs(p.x - b.x) < 22 && Math.abs(p.y - b.y) < 35) {
          b.health -= 1;
          b.health = Math.max(0, b.health);
          p.alive = false;
          this.addFloat('-1', b.x, b.y - 40, '#ff8888');
          this.updateHUD();
          if (b.health <= 0) this.onBossDeath();
        }
      } else {
        // Hit player
        if (Math.abs(p.x - this.playerX) < 16 && Math.abs(p.y - this.playerY) < 30) {
          this.takeDamage(1);
          p.alive = false;
          if (!this.gameActive) return false;
        }
      }

      p.gfx.clear();
      p.gfx.fillStyle(p.friendly ? 0xffff44 : 0xff4400, 1);
      p.gfx.fillCircle(p.x, p.y, p.friendly ? 4 : 5);
      return p.alive;
    });

    // Float texts
    this.floatTexts = this.floatTexts.filter(ft => {
      ft.obj.y += ft.vy * dt;
      ft.life -= delta;
      ft.obj.setAlpha(ft.life / 700);
      if (ft.life <= 0) { ft.obj.destroy(); return false; }
      return true;
    });

    // Draw
    this.drawBg();
    this.drawBoss();
    this.drawPlayer();

    void width; void height;
  }
}
