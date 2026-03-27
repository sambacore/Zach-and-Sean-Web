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
    this.roadLines = [];
    this.collisions = 0;
    this.timeLeft = 30;
    this.gameActive = true;
    this.invincible = false;
    this.invincibleTimer = 0;
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
    createPixelText(this, width / 2, height - 16, 'BOSS: THE SPEED TRAP CAPTAIN', 10, '#444455');

    // Timer
    this.timerEvent = this.time.addEvent({
      delay: 1000,
      callback: this.onTick,
      callbackScope: this,
      repeat: this.timeLeft - 1,
    });

    // Controls
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.mobileControls = new MobileControls(this);

    // Instruction text (fades out)
    const instructions = createPixelText(
      this,
      width / 2,
      height / 2,
      'DODGE THE COPS FOR 30 SECONDS!\nARROW KEYS TO DRIVE',
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

    // Taillights
    g.fillStyle(0xff2200, 1);
    g.fillRect(x - hw + 2, y + hh - 6, 6, 4);
    g.fillRect(x + hw - 8, y + hh - 6, 6, 4);
  }

  private drawCopKart(x: number, y: number): void {
    const g = this.copCars.find(c => c.x === x && c.y === y)?.gfx;
    if (!g) return;
    g.clear();

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

    // Overlay
    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.7);
    overlay.fillRect(0, 0, width, height);

    createPixelText(this, width / 2, height / 2 - 50, 'WORLD CLEARED!', 32, '#ffdd00');
    createPixelText(this, width / 2, height / 2, 'ABILITY UNLOCKED:', 16, '#aaaacc');
    createPixelText(this, width / 2, height / 2 + 28, 'NITRO BOOST', 22, '#00ffaa');
    createPixelText(this, width / 2, height / 2 + 56, 'You outran the Speed Trap Captain!', 12, '#888888');

    // Unlock
    const unlockSys = UnlockSystem.getInstance();
    unlockSys.applyWorldUnlocks(1);
    GameState.getInstance().beatWorld(1);

    // Return after delay
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

    // Update hearts
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

    // Player movement
    this.mobileControls?.update();
    const mb = this.mobileControls?.state;
    if (this.cursors.left.isDown  || mb?.left)  { this.playerX -= this.playerSpeed * dt; }
    if (this.cursors.right.isDown || mb?.right) { this.playerX += this.playerSpeed * dt; }
    if (this.cursors.up.isDown    || mb?.up)    { this.playerY -= this.playerSpeed * dt; }
    if (this.cursors.down.isDown  || mb?.down)  { this.playerY += this.playerSpeed * dt; }

    // Clamp player to road
    this.playerX = Phaser.Math.Clamp(this.playerX, 110, width - 110);
    this.playerY = Phaser.Math.Clamp(this.playerY, 50, height - 50);

    // Scroll road lines
    this.roadLines.forEach(line => {
      line.y += this.roadScrollSpeed * dt;
      if (line.y > height + 30) {
        line.y -= height + 60;
      }
    });
    this.drawRoad();

    // Move cop cars
    this.copCars.forEach(cop => {
      // Chase player roughly
      const dx = this.playerX - cop.x;
      const chaseStrength = 0.4;
      cop.vx += dx * chaseStrength * dt;
      cop.vx = Phaser.Math.Clamp(cop.vx, -100, 100);
      cop.vy = Phaser.Math.Clamp(cop.vy + 5 * dt, 60, 160);

      cop.x += cop.vx * dt;
      cop.y += cop.vy * dt;

      // Wrap around
      if (cop.y > height + 60) {
        cop.y = -60;
        cop.x = Phaser.Math.Between(120, width - 120);
        cop.vx = Phaser.Math.FloatBetween(-30, 30);
        cop.vy = Phaser.Math.FloatBetween(80, 140);
      }

      // Clamp to road
      cop.x = Phaser.Math.Clamp(cop.x, 115, width - 115);

      // Draw
      this.drawCopKart(cop.x, cop.y);

      // Collision check
      if (!this.invincible) {
        const dx2 = Math.abs(cop.x - this.playerX);
        const dy2 = Math.abs(cop.y - this.playerY);
        if (dx2 < 28 && dy2 < 36) {
          this.loseLife();
        }
      }
    });

    // Draw player
    const playerAlpha = this.invincible ? (Math.floor(this.invincibleTimer / 100) % 2 === 0 ? 0.3 : 1) : 1;
    this.drawPlayerKart(this.playerX, this.playerY, this.playerColor, playerAlpha);
  }
}
