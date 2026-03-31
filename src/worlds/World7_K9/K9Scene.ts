import Phaser from 'phaser';
import { GameState } from '../../systems/GameState';
import { UnlockSystem } from '../../systems/UnlockSystem';
import { createPixelText } from '../../ui/PixelText';
import { MobileControls } from '../../ui/MobileControls';

interface Obstacle {
  x: number;
  y: number;
  w: number;
  h: number;
  type: 'crate' | 'barrier' | 'dog';
  hit: boolean;
}

const GROUND_Y = 480;
const WIN_DIST = 3200;

export class K9Scene extends Phaser.Scene {
  private playerX = 160;
  private playerY = GROUND_Y;
  private playerVY = 0;
  private playerColor = 0xcc2222;
  private isCrouching = false;
  private jumpHeld = false;
  private readonly JUMP_FORCE = -560;
  private readonly GRAVITY = 1400;
  private readonly PLAYER_H_STAND = 32;
  private readonly PLAYER_H_CROUCH = 18;

  private scrollX = 0;
  private scrollSpeed = 220;
  private distance = 0;

  private obstacles: Obstacle[] = [];
  private spawnTimer = 0;
  private nextSpawnAt = 1500;

  private lives = 3;
  private invincible = false;
  private invTimer = 0;
  private readonly INV_DUR = 1200;

  private bgGfx!: Phaser.GameObjects.Graphics;
  private fgGfx!: Phaser.GameObjects.Graphics;
  private playerGfx!: Phaser.GameObjects.Graphics;

  private hudText!: Phaser.GameObjects.Text;
  private distText!: Phaser.GameObjects.Text;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private zKey!: Phaser.Input.Keyboard.Key;
  private mobileControls?: MobileControls;
  private gameActive = true;

  // Kick attack
  private isKicking = false;
  private kickTimer = 0;
  private kickCooldown = 0;
  private readonly KICK_DUR = 250;
  private readonly KICK_CD = 600;

  constructor() { super({ key: 'K9Scene' }); }

  init(): void {
    this.obstacles = [];
    this.scrollX = 0;
    this.scrollSpeed = 220;
    this.distance = 0;
    this.spawnTimer = 0;
    this.nextSpawnAt = 1500;
    this.lives = 3;
    this.invincible = false;
    this.invTimer = 0;
    this.gameActive = true;
    this.playerX = 160;
    this.playerY = GROUND_Y;
    this.playerVY = 0;
    this.isCrouching = false;
    this.jumpHeld = false;
    this.isKicking = false;
    this.kickTimer = 0;
    this.kickCooldown = 0;
  }

  create(): void {
    const { width, height } = this.scale;
    const state = GameState.getInstance();
    this.cameras.main.fadeIn(300, 0, 0, 0);

    if (state.selectedCharacter === 'sean') {
      this.playerColor = 0x2255cc;
      this.scrollSpeed = 250;
    }

    this.bgGfx    = this.add.graphics();
    this.fgGfx    = this.add.graphics();
    this.playerGfx = this.add.graphics();

    this.hudText = this.add.text(10, 10, `LIVES: ${this.lives}`, {
      fontFamily: '"Courier New", Courier, monospace',
      fontSize: '14px', color: '#ffdd00',
    }).setDepth(50).setScrollFactor(0).setOrigin(0, 0.5);

    this.distText = this.add.text(width - 10, 10, '', {
      fontFamily: '"Courier New", Courier, monospace',
      fontSize: '13px', color: '#aaaacc', align: 'right',
    }).setDepth(50).setScrollFactor(0).setOrigin(1, 0.5);

    createPixelText(this, width / 2, 34, 'UP: JUMP  DOWN: DUCK  Z/ATK: KICK  — reach the end!', 11, '#888888')
      .setScrollFactor(0).setDepth(50);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.zKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
    this.mobileControls = new MobileControls(this);
    void height;
  }

  private spawnObstacle(): void {
    const { width } = this.scale;
    const roll = Phaser.Math.Between(0, 9);
    let obs: Obstacle;
    if (roll < 4) {
      // Crate: low, jump over
      obs = { x: width + 40, y: GROUND_Y - 24, w: 32, h: 32, type: 'crate', hit: false };
    } else if (roll < 7) {
      // Barrier: tall, duck under
      obs = { x: width + 40, y: GROUND_Y - 52, w: 24, h: 60, type: 'barrier', hit: false };
    } else {
      // Dog: medium, jump over (or gets stopped by dog companion ability)
      obs = { x: width + 40, y: GROUND_Y - 28, w: 36, h: 28, type: 'dog', hit: false };
    }
    this.obstacles.push(obs);
  }

  private getPlayerRect() {
    const ph = this.isCrouching ? this.PLAYER_H_CROUCH : this.PLAYER_H_STAND;
    return {
      x: this.playerX - 10,
      y: this.playerY - ph,
      w: 20,
      h: ph,
    };
  }

  private rectsOverlap(ax: number, ay: number, aw: number, ah: number,
                        bx: number, by: number, bw: number, bh: number): boolean {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  private takeDamage(): void {
    if (this.invincible) return;
    this.lives--;
    this.invincible = true;
    this.invTimer = 0;
    this.hudText.setText(`LIVES: ${this.lives}`);
    if (this.lives <= 0) {
      this.gameActive = false;
      this.cameras.main.fadeOut(500, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('GameOverScene', {
          worldNumber: 7,
          worldName: 'K-9 UNIT',
          retryScene: 'K9Scene',
        });
      });
    }
  }

  private drawBg(): void {
    const { width, height } = this.scale;
    this.bgGfx.clear();
    // Sky
    this.bgGfx.fillGradientStyle(0x111122, 0x111122, 0x1a1a3a, 0x1a1a3a, 1);
    this.bgGfx.fillRect(0, 48, width, 400);
    // Parallax city silhouettes
    const bx = (-(this.scrollX * 0.3) % (width + 200));
    [0, width + 200].forEach(offset => {
      const sx = bx + offset;
      [{ x: 0, w: 90, h: 140 }, { x: 100, w: 70, h: 100 }, { x: 180, w: 110, h: 180 },
       { x: 300, w: 80, h: 120 }, { x: 390, w: 130, h: 160 }, { x: 530, w: 75, h: 95 },
       { x: 615, w: 100, h: 155 }, { x: 725, w: 85, h: 135 }].forEach(b => {
        this.bgGfx.fillStyle(0x151528, 1);
        this.bgGfx.fillRect(sx + b.x, GROUND_Y - b.h, b.w, b.h);
      });
    });
    // Ground
    this.bgGfx.fillStyle(0x222234, 1);
    this.bgGfx.fillRect(0, GROUND_Y, width, height - GROUND_Y);
    // Ground line
    this.bgGfx.fillStyle(0x33334a, 1);
    this.bgGfx.fillRect(0, GROUND_Y, width, 3);
    // Scroll marks on ground
    const markOff = (-(this.scrollX * 0.9) % 80 + 80) % 80;
    this.bgGfx.fillStyle(0x2a2a3a, 1);
    for (let mx = markOff; mx < width; mx += 80) {
      this.bgGfx.fillRect(mx, GROUND_Y + 6, 40, 2);
    }
    void height;
  }

  private drawObstacles(): void {
    this.fgGfx.clear();
    this.obstacles.forEach(obs => {
      if (obs.hit) return;
      const sx = obs.x - this.scrollX;
      if (sx < -80 || sx > 900) return;
      if (obs.type === 'crate') {
        this.fgGfx.fillStyle(0x885533, 1);
        this.fgGfx.fillRect(sx, obs.y, obs.w, obs.h);
        this.fgGfx.lineStyle(2, 0xaa7744, 1);
        this.fgGfx.strokeRect(sx, obs.y, obs.w, obs.h);
        // Cross board
        this.fgGfx.lineStyle(1, 0x6a3a1a, 0.6);
        this.fgGfx.beginPath();
        this.fgGfx.moveTo(sx, obs.y);
        this.fgGfx.lineTo(sx + obs.w, obs.y + obs.h);
        this.fgGfx.strokePath();
        this.fgGfx.beginPath();
        this.fgGfx.moveTo(sx + obs.w, obs.y);
        this.fgGfx.lineTo(sx, obs.y + obs.h);
        this.fgGfx.strokePath();
      } else if (obs.type === 'barrier') {
        this.fgGfx.fillStyle(0x224488, 1);
        this.fgGfx.fillRect(sx, obs.y, obs.w, obs.h);
        this.fgGfx.fillStyle(0xffffff, 1);
        this.fgGfx.fillRect(sx + 3, obs.y + 6, obs.w - 6, 4);
        this.fgGfx.fillRect(sx + 3, obs.y + 22, obs.w - 6, 4);
        this.fgGfx.fillRect(sx + 3, obs.y + 38, obs.w - 6, 4);
      } else {
        // Dog
        this.fgGfx.fillStyle(0x995522, 1);
        this.fgGfx.fillRect(sx, obs.y + 8, obs.w, obs.h - 8);
        this.fgGfx.fillRect(sx + 2, obs.y, 20, 16);
        // Eyes
        this.fgGfx.fillStyle(0xff4400, 1);
        this.fgGfx.fillRect(sx + 4, obs.y + 4, 4, 4);
        // Tail
        this.fgGfx.fillStyle(0x775522, 1);
        this.fgGfx.fillRect(sx + obs.w - 2, obs.y + 6, 8, 6);
      }
    });
  }

  private drawPlayer(): void {
    this.playerGfx.clear();
    const ph = this.isCrouching ? this.PLAYER_H_CROUCH : this.PLAYER_H_STAND;
    const py = this.playerY - ph;

    if (this.invincible && Math.floor(this.invTimer / 80) % 2 === 0) return;

    // Shadow
    this.playerGfx.fillStyle(0x000000, 0.25);
    this.playerGfx.fillEllipse(this.playerX, GROUND_Y + 3, 24, 8);
    // Body
    this.playerGfx.fillStyle(this.playerColor, 1);
    this.playerGfx.fillRect(this.playerX - 10, py, 20, ph);
    // Head (only when standing)
    if (!this.isCrouching) {
      this.playerGfx.fillStyle(0xffccaa, 1);
      this.playerGfx.fillCircle(this.playerX, py - 10, 9);
    }
    // Kick leg swing
    if (this.isKicking) {
      const progress = this.kickTimer / this.KICK_DUR;
      const kickReach = 38 * Math.sin(progress * Math.PI);
      this.playerGfx.fillStyle(this.playerColor, 1);
      this.playerGfx.fillRect(this.playerX + 10, py + ph - 10, kickReach, 8);
      // Boot
      this.playerGfx.fillStyle(0x333333, 1);
      this.playerGfx.fillRect(this.playerX + 10 + kickReach - 4, py + ph - 12, 10, 10);
    }
  }

  private showChoice(): void {
    if (!this.gameActive) return;
    this.gameActive = false;
    UnlockSystem.getInstance().applyWorldUnlocks(7);
    GameState.getInstance().beatWorld(7);

    const { width, height } = this.scale;
    const ov = this.add.graphics().setDepth(100).setScrollFactor(0);
    ov.fillStyle(0x000000, 0.88);
    ov.fillRect(0, 0, width, height);

    createPixelText(this, width / 2, height / 2 - 110, 'WORLD CLEARED!', 32, '#ffdd00').setDepth(101).setScrollFactor(0);
    createPixelText(this, width / 2, height / 2 - 72, 'ABILITY: DOG COMPANION', 16, '#ff8844').setDepth(101).setScrollFactor(0);
    createPixelText(this, width / 2, height / 2 - 38, 'The K9 is watching you. What do you do?', 14, '#cccccc').setDepth(101).setScrollFactor(0);
    createPixelText(this, width / 2, height / 2 + 76, 'ARROWS: choose  ENTER: confirm', 11, '#555566').setDepth(101).setScrollFactor(0);

    let sel = 0;
    const cg = this.add.graphics().setDepth(102).setScrollFactor(0);
    const labels = ['BEFRIEND IT', "IGNORE IT"];
    const cx = [width / 2 - 110, width / 2 + 110];
    const cy = height / 2 + 22;
    const lt = labels.map((lbl, i) =>
      createPixelText(this, cx[i], cy, lbl, 14, '#aaaacc').setDepth(103).setScrollFactor(0)
    );
    const redraw = () => {
      cg.clear();
      labels.forEach((_, i) => {
        const on = i === sel;
        cg.fillStyle(on ? 0x223355 : 0x111122, 1);
        cg.fillRect(cx[i] - 84, cy - 22, 168, 44);
        cg.lineStyle(2, on ? 0x4488ff : 0x334455, 1);
        cg.strokeRect(cx[i] - 84, cy - 22, 168, 44);
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
      GameState.getInstance().makeChoice(7, sel === 0 ? 'befriend' : 'ignore');
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

  shutdown(): void {
    this.mobileControls?.destroy();
  }

  update(_time: number, delta: number): void {
    if (!this.gameActive) return;
    const dt = delta / 1000;
    const { width } = this.scale;

    // Scroll world
    this.scrollX += this.scrollSpeed * dt;
    this.distance = Math.floor(this.scrollX);
    this.distText.setText(`DIST: ${Math.floor(this.distance / 32)}m / ${WIN_DIST / 32}m`);

    if (this.distance >= WIN_DIST) { this.showChoice(); return; }

    // Slowly increase speed
    this.scrollSpeed = Math.min(340, this.scrollSpeed + 2 * dt);

    // Invincibility
    if (this.invincible) {
      this.invTimer += delta;
      if (this.invTimer >= this.INV_DUR) this.invincible = false;
    }

    // Kick timers
    if (this.kickCooldown > 0) this.kickCooldown -= delta;
    if (this.isKicking) {
      this.kickTimer += delta;
      if (this.kickTimer >= this.KICK_DUR) {
        this.isKicking = false;
        this.kickTimer = 0;
      }
    }

    this.mobileControls?.update();
    const mb = this.mobileControls?.state;

    // Kick input
    if ((Phaser.Input.Keyboard.JustDown(this.zKey) || mb?.actionJustDown) && this.kickCooldown <= 0 && !this.isKicking) {
      this.isKicking = true;
      this.kickTimer = 0;
      this.kickCooldown = this.KICK_CD;
    }

    // Jump
    const onGround = this.playerY >= GROUND_Y;
    if ((Phaser.Input.Keyboard.JustDown(this.cursors.up) || mb?.upJustDown) && onGround) {
      this.playerVY = this.JUMP_FORCE;
      this.jumpHeld = true;
    }
    if (this.cursors.up.isUp && !mb?.up) this.jumpHeld = false;
    // Variable jump height
    const gravity = (this.jumpHeld && this.playerVY < 0) ? this.GRAVITY * 0.6 : this.GRAVITY;
    this.playerVY += gravity * dt;
    this.playerY += this.playerVY * dt;
    if (this.playerY >= GROUND_Y) {
      this.playerY = GROUND_Y;
      this.playerVY = 0;
    }

    // Duck
    this.isCrouching = (this.cursors.down.isDown || (mb?.down ?? false)) && onGround;

    // Spawn obstacles
    this.spawnTimer += delta;
    if (this.spawnTimer >= this.nextSpawnAt) {
      this.spawnObstacle();
      this.spawnTimer = 0;
      this.nextSpawnAt = Phaser.Math.Between(1000, 2200);
    }

    // Update obstacles (convert world x → screen x for collision)
    const pr = this.getPlayerRect();
    this.obstacles.forEach(obs => {
      if (obs.hit) return;
      const sx = obs.x - this.scrollX;

      // Kick hitbox: extends 45px forward from player
      if (this.isKicking) {
        const kickProgress = this.kickTimer / this.KICK_DUR;
        const kickReach = 45 * Math.sin(kickProgress * Math.PI);
        if (this.rectsOverlap(
          this.playerX + 10, pr.y, kickReach, pr.h,
          sx, obs.y, obs.w, obs.h
        )) {
          obs.hit = true;
          return;
        }
      }

      // Normal collision check
      if (this.rectsOverlap(
        pr.x, pr.y, pr.w, pr.h,
        sx, obs.y, obs.w, obs.h
      )) {
        obs.hit = true;
        this.takeDamage();
      }
    });

    // Remove off-screen obstacles
    this.obstacles = this.obstacles.filter(obs => (obs.x - this.scrollX) > -100);

    // Draw
    this.drawBg();
    this.drawObstacles();
    this.drawPlayer();

    void width;
  }
}
