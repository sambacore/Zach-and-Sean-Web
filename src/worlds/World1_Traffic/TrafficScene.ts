import Phaser from 'phaser';
import { GameState } from '../../systems/GameState';
import { UnlockSystem } from '../../systems/UnlockSystem';
import { createPixelText } from '../../ui/PixelText';
import { MobileControls } from '../../ui/MobileControls';

interface CopCar {
  x: number;
  y: number;
  vx: number;
  vy: number;
  gfx: Phaser.GameObjects.Graphics;
  isWreckage: boolean;
  wreckageTimer: number; // counts down from 3000ms, then respawn
  smokePhase: number;    // for smoke animation
}

interface Missile {
  x: number;
  y: number;
  gfx: Phaser.GameObjects.Graphics;
  alive: boolean;
}

export class TrafficScene extends Phaser.Scene {
  // Player
  private playerX: number = 400;
  private playerY: number = 300;
  private playerW: number = 28;
  private playerH: number = 40;
  private playerColor: number = 0xcc2222;
  private playerGfx!: Phaser.GameObjects.Graphics;
  private playerSpeed: number = 220;

  // Cops
  private copCars: CopCar[] = [];
  private collisions: number = 0;
  private maxCollisions: number = 3;

  // Missiles
  private missiles: Missile[] = [];
  private missileCooldown: number = 0;
  private readonly MISSILE_COOLDOWN = 800;
  private readonly MISSILE_SPEED = 500;
  private zKey!: Phaser.Input.Keyboard.Key;

  // Nitro boost (NG+ ability)
  private hasNitro: boolean = false;
  private nitroActive: boolean = false;
  private nitroTimer: number = 0;
  private readonly NITRO_DURATION: number = 2000;
  private nitroCooldown: number = 0;
  private readonly NITRO_COOLDOWN: number = 6000;
  private nitroText?: Phaser.GameObjects.Text;

  // Timer
  private timeLeft: number = 30;
  private timerText!: Phaser.GameObjects.Text;
  private collisionText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private timerEvent!: Phaser.Time.TimerEvent;

  // Road
  private roadGfx!: Phaser.GameObjects.Graphics;
  private roadLines: Array<{ y: number }> = [];
  private roadScrollSpeed: number = 80;

  // State
  private gameActive: boolean = true;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private mobileControls?: MobileControls;
  private state!: GameState;

  // Invincibility flash after hit
  private invincible: boolean = false;
  private invincibleTimer: number = 0;
  private readonly INVINCIBLE_DURATION: number = 1500;

  constructor() {
    super({ key: 'TrafficScene' });
  }

  init(): void {
    this.copCars = [];
    this.missiles = [];
    this.roadLines = [];
    this.collisions = 0;
    this.timeLeft = 30;
    this.gameActive = true;
    this.invincible = false;
    this.invincibleTimer = 0;
    this.missileCooldown = 0;
    this.hasNitro = false;
    this.nitroActive = false;
    this.nitroTimer = 0;
    this.nitroCooldown = 0;
  }

  create(): void {
    const { width, height } = this.scale;
    this.state = GameState.getInstance();
    this.cameras.main.fadeIn(400, 0, 0, 0);

    // Set player color from character
    this.playerColor = this.state.selectedCharacter === 'sean' ? 0x2255cc : 0xcc2222;
    this.playerSpeed = this.state.selectedCharacter === 'sean' ? 280 : 220;

    // Road graphics
    this.roadGfx = this.add.graphics();

    // Init road lines
    for (let y = 0; y < height + 60; y += 60) {
      this.roadLines.push({ y });
    }

    // Player graphics
    this.playerGfx = this.add.graphics();
    this.playerX = width / 2;
    this.playerY = height * 0.75;

    // Cop cars
    for (let i = 0; i < 3; i++) {
      const cop: CopCar = {
        x: Phaser.Math.Between(120, width - 120),
        y: Phaser.Math.Between(-200, -50) - i * 120,
        vx: Phaser.Math.FloatBetween(-30, 30),
        vy: Phaser.Math.FloatBetween(80, 140),
        gfx: this.add.graphics(),
        isWreckage: false,
        wreckageTimer: 0,
        smokePhase: 0,
      };
      this.copCars.push(cop);
    }

    // HUD
    const hudBg = this.add.graphics();
    hudBg.fillStyle(0x000000, 0.6);
    hudBg.fillRect(0, 0, width, 44);

    this.timerText = createPixelText(this, width / 2, 22, 'TIME: 30', 20, '#ffdd00');

    const heartStr = '♥'.repeat(this.maxCollisions);
    this.collisionText = createPixelText(this, width - 16, 22, heartStr, 18, '#ff4444');
    this.collisionText.setOrigin(1, 0.5);

    const charLabel = (this.state.selectedCharacter ?? 'PLAYER').toUpperCase();
    createPixelText(this, 80, 22, charLabel, 14, this.playerColor === 0xcc2222 ? '#cc2222' : '#2255cc');

    // Status text (middle screen)
    this.statusText = createPixelText(this, width / 2, height / 2 - 20, '', 18, '#ffffff');
    this.statusText.setVisible(false);

    // Boss sign
    createPixelText(this, width / 2, height - 16, 'BOSS: THE SPEED TRAP CAPTAIN  |  Z: SHOOT MISSILE', 10, '#444455');

    // Timer
    this.timerEvent = this.time.addEvent({
      delay: 1000,
      callback: this.onTick,
      callbackScope: this,
      repeat: this.timeLeft - 1,
    });

    // Controls
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.zKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
    this.mobileControls = new MobileControls(this);

    // Apply NG+ bonuses
    this.applyBonuses();

    // Instruction text (fades out)
    const instructions = createPixelText(
      this,
      width / 2,
      height / 2,
      'DODGE THE COPS FOR 30 SECONDS!\nARROWS: DRIVE  Z/ATK: MISSILE',
      16,
      '#ffffff'
    );
    this.tweens.add({
      targets: instructions,
      alpha: 0,
      delay: 2500,
      duration: 600,
      onComplete: () => instructions.destroy(),
    });

    this.drawRoad();
  }

  private applyBonuses(): void {
    const { width } = this.scale;
    this.hasNitro = this.state.hasAbility('nitroBoost');
    if (this.hasNitro) {
      this.nitroText = createPixelText(this, 190, 22, 'NITRO: READY', 10, '#00ffaa');
      this.nitroText.setOrigin(0.5, 0.5);
    }
    void width;
  }

  private drawRoad(): void {
    const { width, height } = this.scale;
    const g = this.roadGfx;
    g.clear();

    // Grass borders
    g.fillStyle(0x1a4a1a, 1);
    g.fillRect(0, 0, 100, height);
    g.fillRect(width - 100, 0, 100, height);

    // Grass texture stripes
    g.fillStyle(0x154015, 1);
    for (let y = 0; y < height; y += 20) {
      g.fillRect(0, y, 100, 10);
      g.fillRect(width - 100, y, 100, 10);
    }

    // Road
    g.fillStyle(0x444455, 1);
    g.fillRect(100, 0, width - 200, height);

    // Road edge lines
    g.lineStyle(3, 0xffffff, 0.6);
    g.lineBetween(100, 0, 100, height);
    g.lineBetween(width - 100, 0, width - 100, height);

    // Lane dividers (dashed, scrolling)
    const laneX1 = 100 + (width - 200) / 3;
    const laneX2 = 100 + (width - 200) * 2 / 3;
    g.lineStyle(2, 0xffffff, 0.3);

    this.roadLines.forEach(line => {
      g.lineBetween(laneX1, line.y, laneX1, line.y + 30);
      g.lineBetween(laneX2, line.y, laneX2, line.y + 30);
    });

    // Shoulder markings
    g.fillStyle(0xffaa00, 0.4);
    for (let y = 0; y < height; y += 40) {
      g.fillRect(100, y, 8, 20);
      g.fillRect(width - 108, y, 8, 20);
    }
  }

  private drawPlayerKart(x: number, y: number, color: number, alpha: number): void {
    const g = this.playerGfx;
    g.clear();

    if (alpha < 1) g.setAlpha(alpha);
    else g.setAlpha(1);

    const hw = this.playerW / 2;
    const hh = this.playerH / 2;

    // Nitro glow
    if (this.nitroActive) {
      g.fillStyle(0x00ffaa, 0.3);
      g.fillEllipse(x, y, this.playerW + 20, this.playerH + 20);
    }

    // Car shadow
    g.fillStyle(0x000000, 0.3);
    g.fillEllipse(x + 3, y + hh + 4, this.playerW + 6, 10);

    // Tires
    g.fillStyle(0x111111, 1);
    g.fillRect(x - hw - 4, y - hh + 4, 7, 10);
    g.fillRect(x + hw - 3, y - hh + 4, 7, 10);
    g.fillRect(x - hw - 4, y + hh - 14, 7, 10);
    g.fillRect(x + hw - 3, y + hh - 14, 7, 10);

    // Car body
    g.fillStyle(color, 1);
    g.fillRect(x - hw, y - hh, this.playerW, this.playerH);

    // Windshield
    g.fillStyle(0x88ccff, 0.8);
    g.fillRect(x - hw + 4, y - hh + 6, this.playerW - 8, 10);

    // Rear window
    g.fillStyle(0x88ccff, 0.5);
    g.fillRect(x - hw + 4, y + hh - 16, this.playerW - 8, 8);

    // Racing stripe
    g.fillStyle(0xffffff, 0.4);
    g.fillRect(x - 2, y - hh, 4, this.playerH);

    // Headlights
    g.fillStyle(0xffffaa, 1);
    g.fillRect(x - hw + 2, y - hh + 2, 6, 4);
    g.fillRect(x + hw - 8, y - hh + 2, 6, 4);

    // Taillights (extra bright when nitro active)
    g.fillStyle(this.nitroActive ? 0x00ffaa : 0xff2200, 1);
    g.fillRect(x - hw + 2, y + hh - 6, 6, 4);
    g.fillRect(x + hw - 8, y + hh - 6, 6, 4);
  }

  private drawCopKart(cop: CopCar): void {
    const g = cop.gfx;
    g.clear();
    const { x, y } = cop;

    if (cop.isWreckage) {
      // Wreckage — mangled dark grey heap with animated smoke
      cop.smokePhase += 0.08;
      const s = cop.smokePhase;

      // Shadow
      g.fillStyle(0x000000, 0.4);
      g.fillEllipse(x, y + 22, 40, 10);

      // Twisted body chunks
      g.fillStyle(0x222222, 1);
      g.fillRect(x - 16, y - 10, 32, 22);
      g.fillStyle(0x333333, 1);
      g.fillRect(x - 10, y - 18, 20, 12);
      g.fillRect(x + 8,  y - 8,  12, 8);
      g.fillRect(x - 18, y,      10, 10);

      // Broken glass glints
      g.fillStyle(0x88ccff, 0.5);
      g.fillRect(x - 4, y - 14, 8, 4);

      // Smoke puffs (animated)
      const smoke = [
        { ox: 0,   oy: -20, r: 7  + Math.sin(s) * 2 },
        { ox: -8,  oy: -28, r: 5  + Math.cos(s * 1.3) * 2 },
        { ox: 8,   oy: -26, r: 6  + Math.sin(s * 0.9) * 2 },
      ];
      smoke.forEach(({ ox, oy, r }) => {
        g.fillStyle(0xee6600, 0.5 + Math.sin(s) * 0.2);
        g.fillCircle(x + ox, y + oy, r);
        g.fillStyle(0x333333, 0.5);
        g.fillCircle(x + ox, y + oy - 4, r * 0.7);
      });
      return;
    }

    const hw = 14;
    const hh = 20;

    // Shadow
    g.fillStyle(0x000000, 0.3);
    g.fillEllipse(x + 2, y + hh + 3, 32, 8);

    // Tires
    g.fillStyle(0x111111, 1);
    g.fillRect(x - hw - 3, y - hh + 3, 6, 8);
    g.fillRect(x + hw - 3, y - hh + 3, 6, 8);
    g.fillRect(x - hw - 3, y + hh - 11, 6, 8);
    g.fillRect(x + hw - 3, y + hh - 11, 6, 8);

    // Car body (black/white cop car)
    g.fillStyle(0xffffff, 1);
    g.fillRect(x - hw, y - hh, hw * 2, hh * 2);

    // Black door panel
    g.fillStyle(0x000000, 1);
    g.fillRect(x - hw, y - 4, hw * 2, 8);

    // Windshield
    g.fillStyle(0x88ccff, 0.7);
    g.fillRect(x - hw + 3, y - hh + 5, hw * 2 - 6, 8);

    // Light bar
    g.fillStyle(0x0000ff, 1);
    g.fillRect(x - hw + 2, y - hh - 5, hw - 2, 5);
    g.fillStyle(0xff0000, 1);
    g.fillRect(x + 2, y - hh - 5, hw - 2, 5);

    // "POLICE" text placeholder
    g.fillStyle(0x0000cc, 1);
    g.fillRect(x - hw + 4, y - 2, hw * 2 - 8, 4);
  }

  private fireMissile(): void {
    if (this.missileCooldown > 0) return;
    this.missileCooldown = this.MISSILE_COOLDOWN;
    const m: Missile = {
      x: this.playerX,
      y: this.playerY - this.playerH / 2,
      gfx: this.add.graphics().setDepth(20),
      alive: true,
    };
    this.missiles.push(m);
  }

  private onTick(): void {
    if (!this.gameActive) return;
    this.timeLeft--;
    this.timerText.setText(`TIME: ${this.timeLeft}`);

    if (this.timeLeft <= 0) {
      this.winGame();
    } else if (this.timeLeft <= 10) {
      this.timerText.setColor('#ff4444');
    }
  }

  private winGame(): void {
    if (!this.gameActive) return;
    this.gameActive = false;
    this.timerEvent.remove();

    const { width, height } = this.scale;

    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.7);
    overlay.fillRect(0, 0, width, height);

    createPixelText(this, width / 2, height / 2 - 50, 'WORLD CLEARED!', 32, '#ffdd00');
    createPixelText(this, width / 2, height / 2, 'ABILITY UNLOCKED:', 16, '#aaaacc');
    createPixelText(this, width / 2, height / 2 + 28, 'NITRO BOOST', 22, '#00ffaa');
    createPixelText(this, width / 2, height / 2 + 56, 'You outran the Speed Trap Captain!', 12, '#888888');

    const unlockSys = UnlockSystem.getInstance();
    unlockSys.applyWorldUnlocks(1);
    GameState.getInstance().beatWorld(1);

    this.time.delayedCall(3500, () => {
      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('WorldSelectScene');
      });
    });
  }

  private loseLife(): void {
    if (this.invincible) return;
    this.collisions++;
    this.invincible = true;
    this.invincibleTimer = 0;

    const remaining = this.maxCollisions - this.collisions;
    this.collisionText.setText('♥'.repeat(remaining));

    if (this.collisions >= this.maxCollisions) {
      this.gameOver();
    }
  }

  private gameOver(): void {
    if (!this.gameActive) return;
    this.gameActive = false;
    this.timerEvent.remove();

    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('GameOverScene', {
        worldNumber: 1,
        worldName: 'TRAFFIC DEPT',
        retryScene: 'TrafficScene',
      });
    });
  }

  shutdown(): void {
    this.mobileControls?.destroy();
  }

  update(_time: number, delta: number): void {
    if (!this.gameActive) return;

    const dt = delta / 1000;
    const { width, height } = this.scale;

    // Invincibility timer
    if (this.invincible) {
      this.invincibleTimer += delta;
      if (this.invincibleTimer >= this.INVINCIBLE_DURATION) {
        this.invincible = false;
      }
    }

    // Missile cooldown
    if (this.missileCooldown > 0) this.missileCooldown -= delta;

    // Nitro boost tracking
    if (this.hasNitro) {
      if (this.nitroActive) {
        this.nitroTimer += delta;
        if (this.nitroTimer >= this.NITRO_DURATION) {
          this.nitroActive = false;
          this.nitroCooldown = this.NITRO_COOLDOWN;
          if (this.nitroText) this.nitroText.setText('NITRO: COOLING').setColor('#888888');
        }
      } else if (this.nitroCooldown > 0) {
        this.nitroCooldown -= delta;
        if (this.nitroCooldown <= 0 && this.nitroText) {
          this.nitroText.setText('NITRO: READY').setColor('#00ffaa');
        }
      }
    }

    // Player movement
    this.mobileControls?.update();
    const mb = this.mobileControls?.state;
    const currentSpeed = this.nitroActive ? this.playerSpeed * 2.2 : this.playerSpeed;
    if (this.cursors.left.isDown  || mb?.left)  { this.playerX -= currentSpeed * dt; }
    if (this.cursors.right.isDown || mb?.right) { this.playerX += currentSpeed * dt; }
    if (this.cursors.up.isDown    || mb?.up)    { this.playerY -= currentSpeed * dt; }
    if (this.cursors.down.isDown  || mb?.down)  { this.playerY += currentSpeed * dt; }

    // Fire missile (Z alone) or activate nitro (DOWN + Z)
    if (Phaser.Input.Keyboard.JustDown(this.zKey) || mb?.actionJustDown) {
      const downHeld = this.cursors.down.isDown;
      if (this.hasNitro && downHeld && !this.nitroActive && this.nitroCooldown <= 0) {
        this.nitroActive = true;
        this.nitroTimer = 0;
        if (this.nitroText) this.nitroText.setText('NITRO: ACTIVE').setColor('#ffff00');
      } else if (!this.hasNitro || !downHeld) {
        this.fireMissile();
      }
    }

    // Clamp player to road
    this.playerX = Phaser.Math.Clamp(this.playerX, 110, width - 110);
    this.playerY = Phaser.Math.Clamp(this.playerY, 50, height - 50);

    // Scroll road lines
    this.roadLines.forEach(line => {
      line.y += this.roadScrollSpeed * dt;
      if (line.y > height + 30) line.y -= height + 60;
    });
    this.drawRoad();

    // Update missiles
    this.missiles = this.missiles.filter(m => {
      if (!m.alive) { m.gfx.destroy(); return false; }

      m.y -= this.MISSILE_SPEED * dt;

      // Off screen
      if (m.y < -20) { m.gfx.destroy(); return false; }

      // Draw missile
      m.gfx.clear();
      m.gfx.fillStyle(0xff8800, 1);
      m.gfx.fillRect(m.x - 3, m.y - 10, 6, 12);
      m.gfx.fillStyle(0xffff00, 1);
      m.gfx.fillRect(m.x - 2, m.y - 14, 4, 6);
      // Exhaust flame
      m.gfx.fillStyle(0xff4400, 0.8);
      m.gfx.fillRect(m.x - 2, m.y, 4, 6);

      // Hit cop cars
      this.copCars.forEach(cop => {
        if (!m.alive) return;
        if (cop.isWreckage) return;
        const dx = Math.abs(cop.x - m.x);
        const dy = Math.abs(cop.y - m.y);
        if (dx < 18 && dy < 24) {
          m.alive = false;
          cop.isWreckage = true;
          cop.wreckageTimer = 3000;
          cop.vx = 0;
          cop.vy = this.roadScrollSpeed;
        }
      });

      if (!m.alive) { m.gfx.destroy(); return false; }
      return true;
    });

    // Update cop cars
    this.copCars.forEach(cop => {
      if (cop.isWreckage) {
        // Count down wreckage timer
        cop.wreckageTimer -= delta;

        // Drift down with road scroll
        cop.vy = this.roadScrollSpeed;
        cop.y += cop.vy * dt;

        // Player hits wreckage
        if (!this.invincible) {
          const dx = Math.abs(cop.x - this.playerX);
          const dy = Math.abs(cop.y - this.playerY);
          if (dx < 26 && dy < 30) {
            this.loseLife();
          }
        }

        // Other cop cars hit wreckage — chain explosion
        this.copCars.forEach(other => {
          if (other === cop || other.isWreckage) return;
          const dx = Math.abs(other.x - cop.x);
          const dy = Math.abs(other.y - cop.y);
          if (dx < 30 && dy < 40) {
            other.isWreckage = true;
            other.wreckageTimer = 3000;
            other.vx = 0;
            other.vy = this.roadScrollSpeed;
          }
        });

        // Respawn after timer
        if (cop.wreckageTimer <= 0) {
          cop.isWreckage = false;
          cop.smokePhase = 0;
          cop.y = -80;
          cop.x = Phaser.Math.Between(120, width - 120);
          cop.vx = Phaser.Math.FloatBetween(-30, 30);
          cop.vy = Phaser.Math.FloatBetween(80, 140);
        }

        this.drawCopKart(cop);
        return;
      }

      // Normal cop car movement
      const dx = this.playerX - cop.x;
      const chaseStrength = 0.4;
      cop.vx += dx * chaseStrength * dt;
      cop.vx = Phaser.Math.Clamp(cop.vx, -100, 100);
      cop.vy = Phaser.Math.Clamp(cop.vy + 5 * dt, 60, 160);

      cop.x += cop.vx * dt;
      cop.y += cop.vy * dt;

      // Wrap around (only if not wreckage)
      if (cop.y > height + 60) {
        cop.y = -60;
        cop.x = Phaser.Math.Between(120, width - 120);
        cop.vx = Phaser.Math.FloatBetween(-30, 30);
        cop.vy = Phaser.Math.FloatBetween(80, 140);
      }

      cop.x = Phaser.Math.Clamp(cop.x, 115, width - 115);

      this.drawCopKart(cop);

      // Collision with player
      if (!this.invincible) {
        const dx2 = Math.abs(cop.x - this.playerX);
        const dy2 = Math.abs(cop.y - this.playerY);
        if (dx2 < 28 && dy2 < 36) {
          this.loseLife();
        }
      }
    });

    // Draw player on top
    const playerAlpha = this.invincible ? (Math.floor(this.invincibleTimer / 100) % 2 === 0 ? 0.3 : 1) : 1;
    this.drawPlayerKart(this.playerX, this.playerY, this.playerColor, playerAlpha);
  }
}
