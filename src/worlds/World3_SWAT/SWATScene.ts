import Phaser from 'phaser';
import { GameState } from '../../systems/GameState';
import { UnlockSystem } from '../../systems/UnlockSystem';
import { createPixelText } from '../../ui/PixelText';
import { MobileControls } from '../../ui/MobileControls';

interface SWATEnemy {
  x: number;
  y: number;
  health: number;
  vx: number;
  vy: number;
  onGround: boolean;
  gfx: Phaser.GameObjects.Graphics;
  alive: boolean;
  shootTimer: number;
  hitTimer: number;
  deathTimer: number; // counts up after death for collapse animation
}

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  friendly: boolean;
  gfx: Phaser.GameObjects.Graphics;
  alive: boolean;
}

interface Platform {
  x: number;
  y: number;
  w: number;
}

export class SWATScene extends Phaser.Scene {
  // Player
  private playerX: number = 80;
  private playerY: number = 0;
  private playerVX: number = 0;
  private playerVY: number = 0;
  private playerOnGround: boolean = false;
  private playerFacing: number = 1;
  private playerHealth: number = 5;
  private playerMaxHealth: number = 5;
  private playerGfx!: Phaser.GameObjects.Graphics;
  private playerColor: number = 0xcc2222;
  private playerSpeed: number = 180;
  private playerDamage: number = 2;
  private playerCanShoot: boolean = true;
  private shootCooldown: number = 0;
  private readonly SHOOT_COOLDOWN: number = 350;

  // World
  private readonly WORLD_WIDTH: number = 5200;
  private readonly GROUND_Y: number = 480;
  private scrollX: number = 0;
  private readonly SCROLL_SPEED: number = 80;
  private autoScroll: boolean = true;

  // Platforms
  private platforms: Platform[] = [];

  // Enemies and bullets
  private enemies: SWATEnemy[] = [];
  private bullets: Bullet[] = [];

  // Graphics layers
  private bgGfx!: Phaser.GameObjects.Graphics;
  private platformGfx!: Phaser.GameObjects.Graphics;

  // HUD
  private healthBar!: Phaser.GameObjects.Graphics;
  private healthText!: Phaser.GameObjects.Text;
  private progressText!: Phaser.GameObjects.Text;

  // State
  private gameActive: boolean = true;
  private state!: GameState;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private zKey!: Phaser.Input.Keyboard.Key;
  private mobileControls?: MobileControls;

  // Invincibility
  private invincible: boolean = false;
  private invincibleTimer: number = 0;
  private readonly INV_DURATION: number = 1200;

  constructor() {
    super({ key: 'SWATScene' });
  }

  init(): void {
    this.enemies = [];
    this.bullets = [];
    this.platforms = [];
    this.scrollX = 0;
    this.playerVX = 0;
    this.playerVY = 0;
    this.playerOnGround = false;
    this.playerFacing = 1;
    this.playerCanShoot = true;
    this.shootCooldown = 0;
    this.gameActive = true;
    this.invincible = false;
    this.invincibleTimer = 0;
  }

  create(): void {
    const { width, height } = this.scale;
    this.state = GameState.getInstance();
    this.cameras.main.fadeIn(400, 0, 0, 0);

    this.playerColor = this.state.selectedCharacter === 'sean' ? 0x2255cc : 0xcc2222;
    this.playerSpeed = this.state.selectedCharacter === 'sean' ? 220 : 180;
    this.playerDamage = this.state.selectedCharacter === 'sean' ? 1 : 2;
    this.playerMaxHealth = this.state.selectedCharacter === 'sean' ? 3 : 5;
    this.playerHealth = this.playerMaxHealth;

    this.playerY = this.GROUND_Y - 40;

    // Build platforms
    this.buildPlatforms();

    // Graphics
    this.bgGfx = this.add.graphics().setScrollFactor(0).setDepth(0);
    this.platformGfx = this.add.graphics().setScrollFactor(0).setDepth(2);
    this.playerGfx = this.add.graphics().setScrollFactor(0).setDepth(10);

    // Spawn enemies
    this.spawnEnemies();

    // HUD
    const hudBg = this.add.graphics().setDepth(50).setScrollFactor(0);
    hudBg.fillStyle(0x000000, 0.7);
    hudBg.fillRect(0, 0, width, 44);

    this.healthBar = this.add.graphics().setDepth(51).setScrollFactor(0);
    this.healthText = this.add.text(10, 22, '', {
      fontFamily: '"Courier New", Courier, monospace',
      fontSize: '13px',
      color: '#ffffff',
    }).setDepth(52).setScrollFactor(0).setOrigin(0, 0.5);

    this.progressText = createPixelText(this, width / 2, 22, 'PROGRESS: 0%', 13, '#ffdd00');
    this.progressText.setDepth(52).setScrollFactor(0);

    createPixelText(this, width - 10, 22, 'Z:SHOOT', 11, '#888888')
      .setDepth(52).setScrollFactor(0).setOrigin(1, 0.5);

    createPixelText(this, width / 2, height - 16, 'BOSS: THE TACTICAL COMMANDER', 10, '#444455')
      .setScrollFactor(0).setDepth(50);

    // Controls hint
    const ctrl = createPixelText(this, width / 2, height / 2 - 20, '← → RUN   ↑ JUMP   Z: SHOOT', 14, '#ffffff');
    ctrl.setScrollFactor(0).setDepth(60);
    this.tweens.add({
      targets: ctrl,
      alpha: 0,
      delay: 2800,
      duration: 500,
      onComplete: () => ctrl.destroy(),
    });

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.zKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
    this.mobileControls = new MobileControls(this);

    this.updateHUD();
  }

  private buildPlatforms(): void {
    // Ground platform
    this.platforms.push({ x: 0, y: this.GROUND_Y, w: this.WORLD_WIDTH });

    // Elevated platforms scattered through the level
    const elevations = [
      { x: 300, y: this.GROUND_Y - 80, w: 120 },
      { x: 600, y: this.GROUND_Y - 120, w: 100 },
      { x: 900, y: this.GROUND_Y - 80, w: 140 },
      { x: 1300, y: this.GROUND_Y - 100, w: 120 },
      { x: 1700, y: this.GROUND_Y - 80, w: 100 },
      { x: 2000, y: this.GROUND_Y - 130, w: 140 },
      { x: 2400, y: this.GROUND_Y - 100, w: 120 },
      { x: 2800, y: this.GROUND_Y - 80, w: 100 },
      { x: 3200, y: this.GROUND_Y - 110, w: 140 },
      { x: 3600, y: this.GROUND_Y - 90, w: 120 },
      { x: 4000, y: this.GROUND_Y - 120, w: 100 },
      { x: 4400, y: this.GROUND_Y - 80, w: 160 },
    ];
    this.platforms.push(...elevations);
  }

  private spawnEnemies(): void {
    const spawnPoints = [400, 700, 1100, 1500, 1900, 2300, 2700, 3100, 3500, 3900, 4300, 4700];
    spawnPoints.forEach(spawnX => {
      const enemy: SWATEnemy = {
        x: spawnX,
        y: this.GROUND_Y - 40,
        health: 2,
        vx: 0,
        vy: 0,
        onGround: true,
        gfx: this.add.graphics().setScrollFactor(0).setDepth(8),
        alive: true,
        shootTimer: Phaser.Math.Between(1000, 3000),
        hitTimer: 0,
        deathTimer: 0,
      };
      this.enemies.push(enemy);
    });
  }

  private drawBackground(): void {
    const { width, height } = this.scale;
    const g = this.bgGfx;
    g.clear();

    const camX = this.scrollX;

    // Sky
    g.fillGradientStyle(0x0d1a33, 0x0d1a33, 0x1a2244, 0x1a2244, 1);
    g.fillRect(0, 0, width, height);

    // Industrial buildings
    const buildingDefs = [
      { lx: 0, w: 180, h: 250, color: 0x1a2233 },
      { lx: 200, w: 120, h: 200, color: 0x112233 },
      { lx: 350, w: 200, h: 280, color: 0x1a2233 },
      { lx: 580, w: 150, h: 220, color: 0x112233 },
      { lx: 760, w: 180, h: 260, color: 0x1a2233 },
    ];

    buildingDefs.forEach(b => {
      const bx = ((b.lx - camX * 0.4) % (width + 300) + width + 300) % (width + 300) - 100;
      const groundY = this.GROUND_Y;
      g.fillStyle(b.color, 1);
      g.fillRect(bx, groundY - b.h, b.w, b.h);

      // Industrial windows
      for (let wy = groundY - b.h + 15; wy < groundY - 20; wy += 30) {
        for (let wx = bx + 10; wx < bx + b.w - 10; wx += 25) {
          g.fillStyle(Math.random() > 0.5 ? 0xffee88 : 0x334455, 0.7);
          g.fillRect(wx, wy, 14, 18);
        }
      }

      // SWAT markings on buildings
      g.fillStyle(0xcc0000, 0.5);
      g.fillRect(bx + b.w / 2 - 15, groundY - b.h + 10, 30, 8);
    });

    // Ground texture
    g.fillStyle(0x2a2a3a, 1);
    g.fillRect(0, this.GROUND_Y, width, height - this.GROUND_Y);

    // Ground cracks/tiles
    g.lineStyle(1, 0x333344, 0.4);
    const tileOffset = -(camX % 50);
    for (let tx = tileOffset; tx < width; tx += 50) {
      g.lineBetween(tx, this.GROUND_Y, tx, height);
    }

    // Draw platforms
    const pg = this.platformGfx;
    pg.clear();
    this.platforms.forEach(plat => {
      const screenX = plat.x - camX;
      if (screenX > width + 50 || screenX + plat.w < -50) return;

      if (plat.y >= this.GROUND_Y) {
        // Ground
        pg.fillStyle(0x333344, 1);
        pg.fillRect(screenX, plat.y, plat.w, 20);
        pg.lineStyle(2, 0x555566, 1);
        pg.lineBetween(screenX, plat.y, screenX + plat.w, plat.y);
      } else {
        // Elevated platform
        pg.fillStyle(0x444455, 1);
        pg.fillRect(screenX, plat.y, plat.w, 14);
        pg.fillStyle(0x555566, 1);
        pg.fillRect(screenX, plat.y, plat.w, 4);
        pg.fillStyle(0x333344, 1);
        pg.fillRect(screenX + 4, plat.y + 14, 6, 20);
        pg.fillRect(screenX + plat.w - 10, plat.y + 14, 6, 20);
      }
    });

    // End-of-level marker
    const endScreenX = this.WORLD_WIDTH - 100 - camX;
    if (endScreenX < width + 100 && endScreenX > -200) {
      pg.fillStyle(0x00ff44, 0.3);
      pg.fillRect(endScreenX, 0, 20, height);
      pg.lineStyle(2, 0x00ff44, 0.8);
      pg.lineBetween(endScreenX, 0, endScreenX, height);

      // "FINISH" text positioning handled separately
    }
  }

  private drawPlayer(): void {
    const g = this.playerGfx;
    g.clear();

    const alpha = this.invincible ? (Math.floor(this.invincibleTimer / 80) % 2 === 0 ? 0.3 : 1) : 1;
    g.setAlpha(alpha);

    const screenX = this.playerX - this.scrollX;
    const screenY = this.playerY;
    const facing = this.playerFacing;
    const color = this.playerColor;

    // Shadow
    g.fillStyle(0x000000, 0.3);
    g.fillEllipse(screenX + 2, screenY + 30, 22, 6);

    // Legs
    g.fillStyle(0x222233, 1);
    g.fillRect(screenX - 5, screenY + 16, 5, 14);
    g.fillRect(screenX + 2, screenY + 16, 5, 14);

    // Boots
    g.fillStyle(0x111122, 1);
    g.fillRect(screenX - 6, screenY + 28, 7, 4);
    g.fillRect(screenX + 1, screenY + 28, 7, 4);

    // Body (running man)
    g.fillStyle(color, 1);
    g.fillRect(screenX - 7, screenY, 14, 18);

    // Body detail
    g.fillStyle(0x000000, 0.3);
    g.fillRect(screenX - 3, screenY + 2, 6, 14);

    // Arms - gun arm
    g.fillStyle(color, 1);
    const gunArmX = facing > 0 ? screenX + 7 : screenX - 12;
    g.fillRect(gunArmX, screenY + 2, 5, 8);
    // Gun
    g.fillStyle(0x222222, 1);
    const gunBarrelX = facing > 0 ? screenX + 10 : screenX - 18;
    g.fillRect(gunBarrelX, screenY + 4, 10 * facing, 4);

    // Other arm
    g.fillStyle(color, 1);
    const otherArmX = facing > 0 ? screenX - 12 : screenX + 7;
    g.fillRect(otherArmX, screenY + 4, 5, 8);

    // Head
    g.fillStyle(0xffaa88, 1);
    g.fillRect(screenX - 5, screenY - 12, 10, 12);

    // Helmet / hat
    g.fillStyle(0x222233, 1);
    g.fillRect(screenX - 6, screenY - 14, 12, 4);
    g.fillRect(screenX - 4, screenY - 17, 8, 4);

    // Eye
    g.fillStyle(0x000000, 1);
    const eyeOff = facing > 0 ? 2 : -3;
    g.fillRect(screenX + eyeOff, screenY - 8, 2, 2);
  }

  private drawEnemy(enemy: SWATEnemy): void {
    if (!enemy.alive) {
      // Draw collapsed corpse — lying flat on the ground
      const g = enemy.gfx;
      g.clear();
      const screenX = enemy.x - this.scrollX;
      const screenY = enemy.y;
      const { width } = this.scale;
      if (screenX < -80 || screenX > width + 80) return;
      // Fade in the collapse over 300ms
      const alpha = Math.min(enemy.deathTimer / 300, 1);
      // Body lying horizontal
      g.fillStyle(0x333344, alpha);
      g.fillRect(screenX - 14, screenY + 22, 28, 8);
      // Head
      g.fillStyle(0xffaa88, alpha);
      g.fillRect(screenX + 14, screenY + 20, 8, 8);
      // Helmet
      g.fillStyle(0x222233, alpha);
      g.fillRect(screenX + 14, screenY + 18, 10, 6);
      return;
    }

    const g = enemy.gfx;
    g.clear();

    const screenX = enemy.x - this.scrollX;
    const screenY = enemy.y;
    const { width } = this.scale;

    if (screenX < -60 || screenX > width + 60) return;

    const hitFlash = enemy.hitTimer > 0;

    // Shadow
    g.fillStyle(0x000000, 0.3);
    g.fillEllipse(screenX, screenY + 28, 20, 6);

    // Legs
    g.fillStyle(0x111122, 1);
    g.fillRect(screenX - 5, screenY + 14, 4, 14);
    g.fillRect(screenX + 2, screenY + 14, 4, 14);

    // Tactical body
    g.fillStyle(hitFlash ? 0xffffff : 0x333344, 1);
    g.fillRect(screenX - 7, screenY, 14, 16);

    // Kevlar straps
    g.fillStyle(hitFlash ? 0xffffff : 0x444455, 1);
    g.fillRect(screenX - 7, screenY + 4, 14, 3);
    g.fillRect(screenX - 7, screenY + 9, 14, 3);

    // Head
    g.fillStyle(hitFlash ? 0xffffff : 0xffaa88, 1);
    g.fillRect(screenX - 4, screenY - 12, 8, 12);

    // SWAT helmet
    g.fillStyle(hitFlash ? 0xffffff : 0x222233, 1);
    g.fillRect(screenX - 6, screenY - 14, 12, 6);
    g.fillRect(screenX - 5, screenY - 18, 10, 5);

    // Visor
    g.fillStyle(hitFlash ? 0xffffff : 0x336688, 0.8);
    g.fillRect(screenX - 4, screenY - 12, 8, 4);

    // Gun
    g.fillStyle(0x222222, 1);
    g.fillRect(screenX - 14, screenY + 2, 10, 3);

    // Health bar
    const barW = 24;
    g.fillStyle(0x330000, 1);
    g.fillRect(screenX - barW / 2, screenY - 24, barW, 3);
    g.fillStyle(0x00cc44, 1);
    g.fillRect(screenX - barW / 2, screenY - 24, barW * (enemy.health / 2), 3);
  }

  private shootBullet(fromX: number, fromY: number, vx: number, friendly: boolean): void {
    const bullet: Bullet = {
      x: fromX,
      y: fromY + (friendly ? -4 : 8),
      vx: vx,
      vy: 0,
      friendly: friendly,
      gfx: this.add.graphics().setScrollFactor(0).setDepth(15),
      alive: true,
    };
    this.bullets.push(bullet);
  }

  private updateHUD(): void {
    this.healthBar.clear();
    this.healthBar.fillStyle(0x330000, 1);
    this.healthBar.fillRect(10, 10, 120, 12);
    const fillRatio = this.playerHealth / this.playerMaxHealth;
    this.healthBar.fillStyle(
      fillRatio > 0.5 ? 0x22cc44 : (fillRatio > 0.25 ? 0xffaa00 : 0xff2200),
      1
    );
    this.healthBar.fillRect(10, 10, 120 * fillRatio, 12);
    this.healthText.setText(`HP: ${this.playerHealth}/${this.playerMaxHealth}`);
  }

  private checkPlatformCollision(x: number, y: number, prevY: number, vy: number): { onGround: boolean; groundY: number } {
    let onGround = false;
    let groundY = y;

    for (const plat of this.platforms) {
      const platBottom = plat.y + (plat.y >= this.GROUND_Y ? 20 : 14);
      const platTop = plat.y;
      const inXRange = x >= plat.x && x <= plat.x + plat.w;

      if (inXRange && vy >= 0 && prevY <= platTop + 2 && y >= platTop - 2) {
        onGround = true;
        groundY = platTop - 1;
        break;
      }
    }

    return { onGround, groundY };
  }

  private winGame(): void {
    if (!this.gameActive) return;
    this.gameActive = false;

    const { width, height } = this.scale;
    const overlay = this.add.graphics().setDepth(100).setScrollFactor(0);
    overlay.fillStyle(0x000000, 0.75);
    overlay.fillRect(0, 0, width, height);

    createPixelText(this, width / 2, height / 2 - 50, 'WORLD CLEARED!', 32, '#ffdd00')
      .setDepth(101).setScrollFactor(0);
    createPixelText(this, width / 2, height / 2, 'ABILITY UNLOCKED:', 16, '#aaaacc')
      .setDepth(101).setScrollFactor(0);
    createPixelText(this, width / 2, height / 2 + 28, 'BODY ARMOR', 22, '#44bbff')
      .setDepth(101).setScrollFactor(0);
    createPixelText(this, width / 2, height / 2 + 56, 'You breached the SWAT perimeter!', 12, '#888888')
      .setDepth(101).setScrollFactor(0);

    const unlockSys = UnlockSystem.getInstance();
    unlockSys.applyWorldUnlocks(3);
    GameState.getInstance().beatWorld(3);

    this.time.delayedCall(3500, () => {
      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('WorldSelectScene');
      });
    });
  }

  shutdown(): void {
    this.mobileControls?.destroy();
  }

  update(_time: number, delta: number): void {
    if (!this.gameActive) return;
    const dt = delta / 1000;
    const { width } = this.scale;

    // Invincibility
    if (this.invincible) {
      this.invincibleTimer += delta;
      if (this.invincibleTimer >= this.INV_DURATION) this.invincible = false;
    }

    // Shoot cooldown
    if (this.shootCooldown > 0) this.shootCooldown -= delta;

    // Player input
    this.mobileControls?.update();
    const mb = this.mobileControls?.state;

    if (this.cursors.left.isDown  || mb?.left)  { this.playerVX = -this.playerSpeed; this.playerFacing = -1; }
    else if (this.cursors.right.isDown || mb?.right) { this.playerVX = this.playerSpeed; this.playerFacing = 1; }
    else { this.playerVX *= 0.7; }

    // Jump
    if ((Phaser.Input.Keyboard.JustDown(this.cursors.up) || mb?.upJustDown) && this.playerOnGround) {
      this.playerVY = -420;
    }

    // Shoot
    if ((Phaser.Input.Keyboard.JustDown(this.zKey) || mb?.actionJustDown) && this.shootCooldown <= 0) {
      this.shootCooldown = this.SHOOT_COOLDOWN;
      const bulletSpeed = 450 * this.playerFacing;
      this.shootBullet(this.playerX + this.playerFacing * 14, this.playerY + 4, bulletSpeed, true);
    }

    // Gravity
    this.playerVY += 700 * dt;

    const prevPlayerY = this.playerY;
    this.playerX += this.playerVX * dt;
    this.playerY += this.playerVY * dt;

    // Platform collision
    const { onGround, groundY } = this.checkPlatformCollision(
      this.playerX, this.playerY, prevPlayerY, this.playerVY
    );
    this.playerOnGround = onGround;
    if (onGround) {
      this.playerY = groundY;
      this.playerVY = 0;
    }

    // Auto-scroll (world moves right)
    const minScroll = this.scrollX;
    this.scrollX += this.SCROLL_SPEED * dt;
    this.scrollX = Math.min(this.scrollX, this.WORLD_WIDTH - width);

    // Player can't go behind camera left edge
    this.playerX = Math.max(this.playerX, this.scrollX + 30);
    // Player can't go too far right
    this.playerX = Math.min(this.playerX, this.scrollX + width - 30);

    void minScroll;

    // Fall death
    if (this.playerY > this.GROUND_Y + 100) {
      this.playerHealth = 0;
      this.gameActive = false;
      this.cameras.main.fadeOut(500, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('GameOverScene', {
          worldNumber: 3,
          worldName: 'SWAT DEPT',
          retryScene: 'SWATScene',
        });
      });
      return;
    }

    // Win condition: reach end
    if (this.playerX >= this.WORLD_WIDTH - 120) {
      this.winGame();
      return;
    }

    // Progress
    const progress = Math.floor((this.playerX / (this.WORLD_WIDTH - 120)) * 100);
    this.progressText.setText(`PROGRESS: ${progress}%`);

    // Update enemies
    this.enemies.forEach(enemy => {
      if (!enemy.alive) {
        enemy.deathTimer += delta;
        this.drawEnemy(enemy);
        return;
      }

      const screenX = enemy.x - this.scrollX;
      if (screenX < -200 || screenX > width + 200) {
        this.drawEnemy(enemy);
        return;
      }

      if (enemy.hitTimer > 0) enemy.hitTimer -= delta;

      // Gravity on enemies
      enemy.vy += 700 * dt;
      const prevEY = enemy.y;
      enemy.y += enemy.vy * dt;
      const { onGround: eGround, groundY: eGroundY } = this.checkPlatformCollision(
        enemy.x, enemy.y, prevEY, enemy.vy
      );
      if (eGround) {
        enemy.y = eGroundY;
        enemy.vy = 0;
        enemy.onGround = true;
      }

      // Shoot at player
      enemy.shootTimer -= delta;
      if (enemy.shootTimer <= 0 && Math.abs(screenX) < width) {
        enemy.shootTimer = Phaser.Math.Between(1500, 3000);
        const shootVX = this.playerX < enemy.x ? -300 : 300;
        this.shootBullet(enemy.x, enemy.y + 4, shootVX, false);
      }

      this.drawEnemy(enemy);
    });

    // Update bullets
    this.bullets = this.bullets.filter(b => {
      if (!b.alive) {
        b.gfx.destroy();
        return false;
      }

      b.x += b.vx * dt;
      b.y += b.vy * dt;

      const screenX = b.x - this.scrollX;
      if (screenX < -20 || screenX > width + 20 || b.y < 0 || b.y > 600) {
        b.gfx.destroy();
        return false;
      }

      // Draw bullet
      b.gfx.clear();
      b.gfx.fillStyle(b.friendly ? 0xffff00 : 0xff4400, 1);
      b.gfx.fillRect(screenX - 4, b.y - 2, 8, 4);

      // Friendly bullet hits enemy
      if (b.friendly) {
        this.enemies.forEach(enemy => {
          if (!enemy.alive) return;
          const eDx = Math.abs(enemy.x - b.x);
          const eDy = Math.abs(enemy.y - b.y);
          if (eDx < 16 && eDy < 20) {
            b.alive = false;
            enemy.health -= this.playerDamage;
            enemy.hitTimer = 150;
            if (enemy.health <= 0) {
              enemy.alive = false;
            }
          }
        });
      } else {
        // Enemy bullet hits player
        if (!this.invincible) {
          const pDx = Math.abs(this.playerX - b.x);
          const pDy = Math.abs(this.playerY - b.y);
          if (pDx < 14 && pDy < 18) {
            b.alive = false;
            this.playerHealth--;
            this.invincible = true;
            this.invincibleTimer = 0;
            this.updateHUD();

            if (this.playerHealth <= 0) {
              this.gameActive = false;
              this.cameras.main.fadeOut(500, 0, 0, 0);
              this.cameras.main.once('camerafadeoutcomplete', () => {
                this.scene.start('GameOverScene', {
                  worldNumber: 3,
                  worldName: 'SWAT DEPT',
                  retryScene: 'SWATScene',
                });
              });
            }
          }
        }
      }

      if (!b.alive) {
        b.gfx.destroy();
        return false;
      }
      return true;
    });

    // Draw background and player
    this.drawBackground();
    this.drawPlayer();
  }
}
