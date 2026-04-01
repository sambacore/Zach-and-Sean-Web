import Phaser from 'phaser';
import { GameState } from '../../systems/GameState';
import { UnlockSystem } from '../../systems/UnlockSystem';
import { createPixelText } from '../../ui/PixelText';
import { MobileControls } from '../../ui/MobileControls';

interface Enemy {
  x: number;
  y: number;
  health: number;
  maxHealth: number;
  vx: number;
  gfx: Phaser.GameObjects.Graphics;
  hitTimer: number;
  attackTimer: number;
  alive: boolean;
}

interface FloatText {
  text: Phaser.GameObjects.Text;
  vy: number;
  life: number;
}

export class ViceScene extends Phaser.Scene {
  // Player
  private playerX: number = 120;
  private playerY: number = 0;
  private playerGroundY: number = 0;
  private playerVY: number = 0;
  private playerFacing: number = 1;
  private playerHealth: number = 5;
  private playerMaxHealth: number = 5;
  private playerGfx!: Phaser.GameObjects.Graphics;
  private playerColor: number = 0xcc2222;
  private playerSpeed: number = 160;
  private playerDamage: number = 3;
  private isAttacking: boolean = false;
  private attackTimer: number = 0;
  private readonly ATTACK_DURATION: number = 300;
  private attackCooldown: number = 0;
  private readonly ATTACK_COOLDOWN: number = 400;

  // Scroll
  private scrollX: number = 0;
  private readonly WORLD_WIDTH: number = 2000;

  // Enemies
  private enemies: Enemy[] = [];
  private totalEnemies: number = 3;
  private enemiesDefeated: number = 0;

  // HUD
  private healthBar!: Phaser.GameObjects.Graphics;
  private healthText!: Phaser.GameObjects.Text;
  private enemyCountText!: Phaser.GameObjects.Text;

  // Graphics layers
  private bgGfx!: Phaser.GameObjects.Graphics;
  private fgGfx!: Phaser.GameObjects.Graphics;

  // Input
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private zKey!: Phaser.Input.Keyboard.Key;
  private mobileControls?: MobileControls;

  // State
  private gameActive: boolean = true;

  // Ability bonuses
  private comboTimer: number = 0;
  private comboActive: boolean = false;
  private armorUsed: boolean = false;
  private hasDetectiveVision: boolean = false;
  private state!: GameState;
  private floatTexts: FloatText[] = [];

  // Invincibility
  private invincible: boolean = false;
  private invincibleTimer: number = 0;
  private readonly INV_DURATION: number = 1000;

  constructor() {
    super({ key: 'ViceScene' });
  }

  init(): void {
    this.enemies = [];
    this.floatTexts = [];
    this.scrollX = 0;
    this.playerHealth = 5;
    this.enemiesDefeated = 0;
    this.gameActive = true;
    this.invincible = false;
    this.invincibleTimer = 0;
    this.isAttacking = false;
    this.attackTimer = 0;
    this.attackCooldown = 0;
    this.playerVY = 0;
    this.playerFacing = 1;
    this.comboTimer = 0;
    this.comboActive = false;
    this.armorUsed = false;
    this.hasDetectiveVision = false;
  }

  create(): void {
    const { width, height } = this.scale;
    this.state = GameState.getInstance();
    this.cameras.main.fadeIn(400, 0, 0, 0);

    this.playerColor = this.state.selectedCharacter === 'sean' ? 0x2255cc : 0xcc2222;
    this.playerSpeed = this.state.selectedCharacter === 'sean' ? 220 : 160;
    this.playerDamage = this.state.selectedCharacter === 'sean' ? 1 : 3;
    this.playerMaxHealth = this.state.selectedCharacter === 'sean' ? 3 : 5;

    // Apply ability bonuses
    if (this.state.hasAbility('bodyArmor')) {
      this.playerMaxHealth += 1;
      this.armorUsed = false;
    }
    if (this.state.hasAbility('streetCombo')) {
      this.playerDamage += 1;
    }
    this.hasDetectiveVision = this.state.hasAbility('detectiveVision');
    this.playerHealth = this.playerMaxHealth;

    this.playerGroundY = height - 100;
    this.playerY = this.playerGroundY;

    // Graphics layers
    this.bgGfx = this.add.graphics().setScrollFactor(0);
    this.fgGfx = this.add.graphics().setScrollFactor(0);

    // Player gfx
    this.playerGfx = this.add.graphics().setDepth(10).setScrollFactor(0);

    // Spawn enemies
    for (let i = 0; i < this.totalEnemies; i++) {
      const enemy: Enemy = {
        x: 500 + i * 350,
        y: this.playerGroundY,
        health: 4,
        maxHealth: 4,
        vx: 0,
        gfx: this.add.graphics().setDepth(8).setScrollFactor(0),
        hitTimer: 0,
        attackTimer: Phaser.Math.Between(1000, 2000),
        alive: true,
      };
      this.enemies.push(enemy);
    }

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

    this.enemyCountText = createPixelText(this, width / 2, 22, '', 14, '#ffdd00');
    this.enemyCountText.setDepth(52).setScrollFactor(0);

    createPixelText(this, width / 2, height - 16, 'BOSS: THE UNDERCOVER KING', 10, '#444455')
      .setScrollFactor(0).setDepth(50);

    // Controls label
    const ctrl = createPixelText(this, width / 2, height / 2 - 20, '← → MOVE   Z: ATTACK   ↑ JUMP', 14, '#ffffff');
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

  private drawBackground(): void {
    const { width, height } = this.scale;
    const g = this.bgGfx;
    g.clear();

    const camX = this.scrollX;

    // Sky gradient
    g.fillGradientStyle(0x1a0a33, 0x1a0a33, 0x330a22, 0x330a22, 1);
    g.fillRect(0, 0, width, height - 100);

    // Neon signs in background
    const signs = [
      { x: 80, color: 0xff0088 },
      { x: 250, color: 0x00ffff },
      { x: 420, color: 0xffaa00 },
      { x: 600, color: 0xff0044 },
      { x: 750, color: 0x8800ff },
    ];

    signs.forEach(sign => {
      const sx = sign.x - (camX * 0.3) % width;
      const wrappedX = ((sx % width) + width) % width;
      g.fillStyle(sign.color, 0.15);
      g.fillRect(wrappedX - 30, 40, 60, 120);
      g.lineStyle(2, sign.color, 0.6);
      g.strokeRect(wrappedX - 30, 40, 60, 120);
    });

    // Buildings
    const buildings = [
      { localX: 0, w: 120, h: 180, color: 0x1a1a33 },
      { localX: 130, w: 80, h: 140, color: 0x12122a },
      { localX: 220, w: 100, h: 200, color: 0x1a1a33 },
      { localX: 340, w: 60, h: 120, color: 0x12122a },
      { localX: 420, w: 140, h: 170, color: 0x1a1a33 },
      { localX: 580, w: 90, h: 190, color: 0x12122a },
      { localX: 690, w: 110, h: 160, color: 0x1a1a33 },
    ];

    const groundY = height - 100;
    buildings.forEach(b => {
      const bx = ((b.localX - camX * 0.6) % (width + 200) + width + 200) % (width + 200) - 100;
      g.fillStyle(b.color, 1);
      g.fillRect(bx, groundY - b.h, b.w, b.h);

      // Windows
      for (let wy = groundY - b.h + 10; wy < groundY - 10; wy += 16) {
        for (let wx = bx + 8; wx < bx + b.w - 8; wx += 18) {
          if (Math.random() > 0.4) {
            const wc = Math.random() > 0.6 ? 0xffee88 : (Math.random() > 0.5 ? 0x88aaff : 0x334466);
            g.fillStyle(wc, 0.8);
            g.fillRect(wx, wy, 8, 10);
          }
        }
      }
    });

    // Sidewalk
    g.fillStyle(0x555566, 1);
    g.fillRect(0, groundY, width, 30);
    // Sidewalk tiles
    g.lineStyle(1, 0x666677, 0.4);
    for (let tx = -((camX * 0.8) % 40); tx < width; tx += 40) {
      g.lineBetween(tx, groundY, tx, groundY + 30);
    }

    // Road
    g.fillStyle(0x333344, 1);
    g.fillRect(0, groundY + 30, width, 70);

    // Road markings
    const dashOffset = -(camX % 60);
    g.lineStyle(2, 0xffffff, 0.25);
    for (let dx = dashOffset; dx < width; dx += 60) {
      g.lineBetween(dx, groundY + 65, dx + 30, groundY + 65);
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
    const s = 3;

    // Shadow
    g.fillStyle(0x000000, 0.3);
    g.fillEllipse(screenX + 2, screenY + 32, 28, 8);

    // Legs
    g.fillStyle(0x222244, 1);
    if (this.isAttacking) {
      // Attack stance
      g.fillRect(screenX - 6, screenY + 18, 7, 14);
      g.fillRect(screenX + 2 * facing, screenY + 18, 7, 14);
    } else {
      g.fillRect(screenX - 6, screenY + 18, 6, 14);
      g.fillRect(screenX + 2, screenY + 18, 6, 14);
    }

    // Boots
    g.fillStyle(0x111122, 1);
    g.fillRect(screenX - 7 + (facing < 0 ? 2 : 0), screenY + 30, 8, 4);
    g.fillRect(screenX + 1 + (facing < 0 ? 0 : 2), screenY + 30, 8, 4);

    // Body
    g.fillStyle(color, 1);
    g.fillRect(screenX - 8, screenY, 16, 20);

    // Chest detail
    g.fillStyle(Phaser.Display.Color.IntegerToColor(color).lighten(20).color, 1);
    g.fillRect(screenX - 2, screenY + 2, 4, 12);

    // Arms
    g.fillStyle(color, 1);
    if (this.isAttacking) {
      // Punching arm extends
      const punchX = facing > 0 ? screenX + 14 : screenX - 20;
      g.fillRect(punchX, screenY + 2, 8, 6);
      g.fillStyle(0xffaa88, 1);
      g.fillRect(punchX + (facing > 0 ? 6 : -4), screenY + 2, 8, 6);
      // Other arm
      g.fillRect(facing > 0 ? screenX - 14 : screenX + 8, screenY + 4, 6, 10);
    } else {
      g.fillRect(screenX - 14, screenY + 2, 6, 10);
      g.fillRect(screenX + 8, screenY + 2, 6, 10);
      g.fillStyle(0xffaa88, 1);
      g.fillRect(screenX - 14, screenY + 10, 5, 5);
      g.fillRect(screenX + 10, screenY + 10, 5, 5);
    }

    // Head
    g.fillStyle(0xffaa88, 1);
    g.fillRect(screenX - s * 2, screenY - s * 4, s * 4, s * 4);

    // Hair
    g.fillStyle(this.playerColor === 0xcc2222 ? 0x331111 : 0x222244, 1);
    g.fillRect(screenX - s * 2, screenY - s * 4, s * 4, s);

    // Eyes
    g.fillStyle(0x000000, 1);
    const eyeX = facing > 0 ? screenX + 1 : screenX - 3;
    g.fillRect(eyeX, screenY - s * 3, 2, 2);

    void s;
  }

  private drawEnemy(enemy: Enemy): void {
    if (!enemy.alive) {
      enemy.gfx.clear();
      return;
    }

    const g = enemy.gfx;
    g.clear();

    const screenX = enemy.x - this.scrollX;
    const screenY = enemy.y;

    if (screenX < -60 || screenX > this.scale.width + 60) return;

    const hitFlash = enemy.hitTimer > 0;

    // Shadow
    g.fillStyle(0x000000, 0.3);
    g.fillEllipse(screenX, screenY + 30, 24, 7);

    // Legs
    g.fillStyle(0x111122, 1);
    g.fillRect(screenX - 5, screenY + 18, 5, 12);
    g.fillRect(screenX + 2, screenY + 18, 5, 12);

    // Body (cop uniform)
    const bodyColor = hitFlash ? 0xffffff : 0x334488;
    g.fillStyle(bodyColor, 1);
    g.fillRect(screenX - 7, screenY, 14, 20);

    // Badge
    g.fillStyle(0xffdd00, 1);
    g.fillRect(screenX - 2, screenY + 4, 6, 5);

    // Arms
    g.fillStyle(bodyColor, 1);
    g.fillRect(screenX - 12, screenY + 2, 5, 10);
    g.fillRect(screenX + 7, screenY + 2, 5, 10);

    // Head
    g.fillStyle(hitFlash ? 0xffffff : 0xffaa88, 1);
    g.fillRect(screenX - 5, screenY - 14, 10, 14);

    // Cop hat
    g.fillStyle(hitFlash ? 0xffffff : 0x223366, 1);
    g.fillRect(screenX - 7, screenY - 16, 14, 4);
    g.fillRect(screenX - 4, screenY - 20, 8, 5);

    // Eyes
    g.fillStyle(0x000000, 1);
    g.fillRect(screenX - 3, screenY - 10, 2, 2);
    g.fillRect(screenX + 1, screenY - 10, 2, 2);

    // Health bar
    const barW = 30;
    const barH = 4;
    const barX = screenX - barW / 2;
    const barY = screenY - 28;
    g.fillStyle(0x330000, 1);
    g.fillRect(barX, barY, barW, barH);
    g.fillStyle(0x00cc44, 1);
    g.fillRect(barX, barY, barW * (enemy.health / enemy.maxHealth), barH);
  }

  private updateHUD(): void {
    const { width } = this.scale;
    this.healthBar.clear();

    // Health bar background
    this.healthBar.fillStyle(0x330000, 1);
    this.healthBar.fillRect(10, 10, 120, 12);

    // Health fill
    const fillRatio = this.playerHealth / this.playerMaxHealth;
    this.healthBar.fillStyle(
      fillRatio > 0.5 ? 0x22cc44 : (fillRatio > 0.25 ? 0xffaa00 : 0xff2200),
      1
    );
    this.healthBar.fillRect(10, 10, 120 * fillRatio, 12);

    this.healthText.setText(`HP: ${this.playerHealth}/${this.playerMaxHealth}`);

    const remaining = this.totalEnemies - this.enemiesDefeated;
    this.enemyCountText.setText(`ENEMIES: ${remaining}`);

    void width;
  }

  private tryAttack(): void {
    if (this.attackCooldown > 0 || this.isAttacking) return;
    this.isAttacking = true;
    this.attackTimer = 0;
    this.attackCooldown = this.ATTACK_COOLDOWN;

    // Check hit
    const screenX = this.playerX - this.scrollX;
    this.enemies.forEach(enemy => {
      if (!enemy.alive) return;
      const eScreenX = enemy.x - this.scrollX;
      const dx = eScreenX - screenX;
      const dy = enemy.y - this.playerY;
      const reach = 60;
      if (Math.abs(dx) < reach && Math.abs(dy) < 40 && Math.sign(dx) === this.playerFacing) {
                // streetCombo: double damage if combo active
        const comboDmg = (this.state.hasAbility('streetCombo') && this.comboActive)
          ? this.playerDamage * 2 : this.playerDamage;
        enemy.health -= comboDmg;
        enemy.hitTimer = 200;

        // Float damage text
        const ft: FloatText = {
          text: this.add.text(
            eScreenX, enemy.y - 20,
            `-${comboDmg}`,
            {
              fontFamily: '"Courier New", Courier, monospace',
              fontSize: '14px',
              color: '#ff4444',
              stroke: '#000000',
              strokeThickness: 2,
            }
          ).setDepth(20).setScrollFactor(0),
          vy: -60,
          life: 800,
        };
        this.floatTexts.push(ft);

        if (enemy.health <= 0) {
          enemy.alive = false;
          this.enemiesDefeated++;
          this.updateHUD();

          // streetCombo: start/refresh combo window on kill
          if (this.state.hasAbility('streetCombo')) {
            this.comboTimer = 600;
            this.comboActive = true;
            this.floatTexts.push({
              text: this.add.text(eScreenX, enemy.y - 40, 'COMBO!', {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '16px', color: '#ffff00', stroke: '#000000', strokeThickness: 2,
              }).setDepth(22).setScrollFactor(0),
              vy: -80, life: 600,
            });
          }

          if (this.enemiesDefeated >= this.totalEnemies) {
            this.time.delayedCall(500, () => this.winGame());
          }
        }
      }
    });
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
    createPixelText(this, width / 2, height / 2 + 28, 'STREET COMBO', 22, '#ff8844')
      .setDepth(101).setScrollFactor(0);
    createPixelText(this, width / 2, height / 2 + 56, 'The Undercover King is down!', 12, '#888888')
      .setDepth(101).setScrollFactor(0);

    const unlockSys = UnlockSystem.getInstance();
    unlockSys.applyWorldUnlocks(2);
    GameState.getInstance().beatWorld(2);

    this.time.delayedCall(3500, () => {
      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('WorldSelectScene');
      });
    });
  }

  private takeDamage(): void {
    if (this.invincible) return;
    // Body armor absorbs one hit
    if (this.state.hasAbility('bodyArmor') && !this.armorUsed) {
      this.armorUsed = true;
      this.invincible = true;
      this.invincibleTimer = 0;
      this.updateHUD();
      return;
    }
    this.playerHealth--;
    this.invincible = true;
    this.invincibleTimer = 0;
    this.updateHUD();

    if (this.playerHealth <= 0) {
      this.gameActive = false;
      this.cameras.main.fadeOut(500, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('GameOverScene', {
          worldNumber: 2,
          worldName: 'VICE DEPT',
          retryScene: 'ViceScene',
        });
      });
    }
  }

  shutdown(): void {
    this.mobileControls?.destroy();
  }

  update(_time: number, delta: number): void {
    if (!this.gameActive) return;
    const dt = delta / 1000;
    const { width, height } = this.scale;

    // Invincibility
    if (this.invincible) {
      this.invincibleTimer += delta;
      if (this.invincibleTimer >= this.INV_DURATION) this.invincible = false;
    }

    // Combo timer
    if (this.comboTimer > 0) {
      this.comboTimer -= delta;
      if (this.comboTimer <= 0) this.comboActive = false;
    }

    // Attack cooldown
    if (this.attackCooldown > 0) this.attackCooldown -= delta;
    if (this.isAttacking) {
      this.attackTimer += delta;
      if (this.attackTimer >= this.ATTACK_DURATION) this.isAttacking = false;
    }

    // Player movement
    this.mobileControls?.update();
    const mb = this.mobileControls?.state;

    let moving = false;
    if (this.cursors.left.isDown  || mb?.left)  { this.playerX -= this.playerSpeed * dt; this.playerFacing = -1; moving = true; }
    if (this.cursors.right.isDown || mb?.right) { this.playerX += this.playerSpeed * dt; this.playerFacing =  1; moving = true; }

    // Jump
    if ((this.cursors.up.isDown || mb?.up) && this.playerY >= this.playerGroundY) {
      this.playerVY = -350;
    }

    // Gravity
    this.playerVY += 700 * dt;
    this.playerY += this.playerVY * dt;
    if (this.playerY >= this.playerGroundY) {
      this.playerY = this.playerGroundY;
      this.playerVY = 0;
    }

    // Attack
    if (Phaser.Input.Keyboard.JustDown(this.zKey) || mb?.actionJustDown) {
      this.tryAttack();
    }

    // Scroll camera
    const targetScroll = this.playerX - width * 0.35;
    this.scrollX = Phaser.Math.Clamp(targetScroll, 0, this.WORLD_WIDTH - width);

    // Clamp player x
    this.playerX = Phaser.Math.Clamp(this.playerX, this.scrollX + 30, this.scrollX + width - 30);

    void moving;

    // Draw background
    this.drawBackground();

    // Update and draw enemies
    this.enemies.forEach(enemy => {
      if (!enemy.alive) {
        this.drawEnemy(enemy);
        return;
      }
      if (enemy.hitTimer > 0) enemy.hitTimer -= delta;

      // Move toward player
      const dx = (this.playerX - enemy.x);
      if (Math.abs(dx) > 50) {
        enemy.vx = Math.sign(dx) * 60;
      } else {
        enemy.vx = 0;
        // Attack player if close
        enemy.attackTimer -= delta;
        if (enemy.attackTimer <= 0) {
          enemy.attackTimer = Phaser.Math.Between(1200, 2000);
          this.takeDamage();
        }
      }
      enemy.x += enemy.vx * dt;
      this.drawEnemy(enemy);
    });

    // Draw player
    this.drawPlayer();

    // Detective vision: arrows pointing to off-screen enemies
    if (this.hasDetectiveVision) {
      this.fgGfx.lineStyle(2, 0x00ffcc, 0.8);
      this.enemies.forEach(enemy => {
        if (!enemy.alive) return;
        const sx = enemy.x - this.scrollX;
        if (sx >= 0 && sx <= width) return; // on screen, skip
        const dir = sx < 0 ? -1 : 1;
        const arrowX = dir < 0 ? 20 : width - 20;
        const arrowY = Math.min(Math.max(enemy.y, 60), height - 20);
        this.fgGfx.fillStyle(0x00ffcc, 0.8);
        this.fgGfx.fillTriangle(
          arrowX + dir * 12, arrowY,
          arrowX - dir * 4, arrowY - 8,
          arrowX - dir * 4, arrowY + 8
        );
      });
    }

    // Update float texts
    this.floatTexts = this.floatTexts.filter(ft => {
      ft.text.y += ft.vy * dt;
      ft.life -= delta;
      ft.text.setAlpha(ft.life / 800);
      if (ft.life <= 0) {
        ft.text.destroy();
        return false;
      }
      return true;
    });

    void height;
  }
}
