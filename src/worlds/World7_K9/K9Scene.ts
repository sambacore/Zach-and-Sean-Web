import Phaser from 'phaser';
import { GameState } from '../../systems/GameState';
import { UnlockSystem } from '../../systems/UnlockSystem';
import { createPixelText } from '../../ui/PixelText';
import { MobileControls } from '../../ui/MobileControls';

interface Enemy {
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: 'handler' | 'dog';
  alive: boolean;
  stunTimer: number;  // >0 = hit/dying, shrinks to 0 then removed
  gfx: Phaser.GameObjects.Graphics;
}

export class K9Scene extends Phaser.Scene {
  // Player
  private playerX = 0;
  private playerY = 0;
  private playerColor = 0xcc2222;
  private playerSpeed = 220;
  private playerGfx!: Phaser.GameObjects.Graphics;

  // Road scroll
  private roadGfx!: Phaser.GameObjects.Graphics;
  private roadLines: Array<{ y: number }> = [];
  private roadScrollSpeed = 90;

  // Enemies
  private enemies: Enemy[] = [];
  private spawnTimer = 0;
  private nextSpawnAt = 1800;

  // Survival timer
  private timeLeft = 35;
  private timerText!: Phaser.GameObjects.Text;
  private timerEvent!: Phaser.Time.TimerEvent;

  // Lives
  private lives = 3;
  private livesText!: Phaser.GameObjects.Text;
  private invincible = false;
  private invTimer = 0;
  private readonly INV_DUR = 1500;

  // Kick attack
  private isKicking = false;
  private kickTimer = 0;
  private kickCooldown = 0;
  private readonly KICK_DUR = 280;
  private readonly KICK_CD = 500;
  private kickFacing = 1;

  // Dog companion
  private dogActive = false;
  private dogX = 0;
  private dogY = 0;
  private dogCooldown = 0;
  private readonly DOG_CD = 8000;
  private dogBarGfx!: Phaser.GameObjects.Graphics;

  // Controls
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private zKey!: Phaser.Input.Keyboard.Key;
  private mobileControls?: MobileControls;
  private gameActive = true;
  private state!: GameState;

  constructor() { super({ key: 'K9Scene' }); }

  init(): void {
    this.enemies = [];
    this.roadLines = [];
    this.spawnTimer = 0;
    this.nextSpawnAt = 1800;
    this.timeLeft = 35;
    this.lives = 3;
    this.invincible = false;
    this.invTimer = 0;
    this.gameActive = true;
    this.isKicking = false;
    this.kickTimer = 0;
    this.kickCooldown = 0;
    this.dogActive = false;
    this.dogCooldown = 0;
  }

  create(): void {
    const { width, height } = this.scale;
    this.state = GameState.getInstance();
    this.cameras.main.fadeIn(300, 0, 0, 0);

    this.playerColor = this.state.selectedCharacter === 'sean' ? 0x2255cc : 0xcc2222;
    this.playerSpeed = this.state.selectedCharacter === 'sean' ? 270 : 220;

    this.playerX = width / 2;
    this.playerY = height * 0.78;
    this.dogX = this.playerX - 36;
    this.dogY = this.playerY;

    // Road
    this.roadGfx = this.add.graphics();
    for (let y = 0; y < height + 60; y += 60) this.roadLines.push({ y });

    // Graphics layers
    this.playerGfx = this.add.graphics().setDepth(10);
    this.dogBarGfx = this.add.graphics().setDepth(51).setScrollFactor(0);

    // HUD
    const hudBg = this.add.graphics();
    hudBg.fillStyle(0x000000, 0.6);
    hudBg.fillRect(0, 0, width, 44);

    this.timerText = createPixelText(this, width / 2, 22, 'TIME: 35', 20, '#ffdd00');
    this.livesText = createPixelText(this, width - 16, 22, '♥♥♥', 18, '#ff4444');
    this.livesText.setOrigin(1, 0.5);

    const charLabel = (this.state.selectedCharacter ?? 'PLAYER').toUpperCase();
    createPixelText(this, 80, 22, charLabel, 14, this.playerColor === 0xcc2222 ? '#cc2222' : '#2255cc');
    createPixelText(this, width / 2, height - 16, 'SURVIVE THE K9 UNIT!  Z/ATK: KICK', 10, '#444455');

    // Ability bonuses
    if (this.state.hasAbility('dogCompanion') && this.state.choices[7] === 'befriend') {
      this.dogActive = true;
      this.dogCooldown = this.DOG_CD;
    }
    if (this.state.choices[7] === 'ignore') {
      this.playerSpeed *= 1.10;
    }

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

    // Instructions (fade out)
    const inst = createPixelText(this, width / 2, height / 2, 'DODGE COPS & DOGS!\nZ/ATK: KICK THEM AWAY', 16, '#ffffff');
    this.tweens.add({ targets: inst, alpha: 0, delay: 2500, duration: 600, onComplete: () => inst.destroy() });

    this.drawRoad();
  }

  private onTick(): void {
    if (!this.gameActive) return;
    this.timeLeft--;
    this.timerText.setText(`TIME: ${this.timeLeft}`);
    if (this.timeLeft <= 10) this.timerText.setColor('#ff4444');
    if (this.timeLeft <= 0) this.winGame();
  }

  private drawRoad(): void {
    const { width, height } = this.scale;
    const g = this.roadGfx;
    g.clear();

    // Sidewalks
    g.fillStyle(0x334433, 1);
    g.fillRect(0, 0, 80, height);
    g.fillRect(width - 80, 0, 80, height);
    g.fillStyle(0x283828, 1);
    for (let y = 0; y < height; y += 20) {
      g.fillRect(0, y, 80, 10);
      g.fillRect(width - 80, y, 80, 10);
    }

    // Road
    g.fillStyle(0x333344, 1);
    g.fillRect(80, 0, width - 160, height);

    // Edge lines
    g.lineStyle(3, 0xffffff, 0.5);
    g.lineBetween(80, 0, 80, height);
    g.lineBetween(width - 80, 0, width - 80, height);

    // Lane dividers scrolling
    const lx1 = 80 + (width - 160) / 3;
    const lx2 = 80 + (width - 160) * 2 / 3;
    g.lineStyle(2, 0xffffff, 0.25);
    this.roadLines.forEach(line => {
      g.lineBetween(lx1, line.y, lx1, line.y + 30);
      g.lineBetween(lx2, line.y, lx2, line.y + 30);
    });
  }

  private spawnEnemy(): void {
    const { width } = this.scale;
    const roll = Phaser.Math.Between(0, 4);
    const type: 'handler' | 'dog' = roll < 3 ? 'handler' : 'dog';
    const x = Phaser.Math.Between(100, width - 100);
    const vy = type === 'dog' ? Phaser.Math.FloatBetween(140, 200) : Phaser.Math.FloatBetween(90, 140);
    const vx = Phaser.Math.FloatBetween(-40, 40);
    const e: Enemy = {
      x, y: -50, vx, vy, type, alive: true, stunTimer: 0,
      gfx: this.add.graphics().setDepth(8),
    };
    this.enemies.push(e);
  }

  private drawEnemy(e: Enemy): void {
    const g = e.gfx;
    g.clear();
    if (!e.alive) {
      // Collapsed
      const alpha = Math.min(e.stunTimer / 300, 1) * 0.8;
      if (e.type === 'dog') {
        g.fillStyle(0x995522, alpha);
        g.fillRect(e.x - 14, e.y + 10, 28, 8);
        g.fillStyle(0xffccaa, alpha);
        g.fillCircle(e.x + 16, e.y + 14, 6);
      } else {
        g.fillStyle(0x224488, alpha);
        g.fillRect(e.x - 14, e.y + 14, 28, 8);
        g.fillStyle(0xffccaa, alpha);
        g.fillCircle(e.x + 16, e.y + 14, 6);
      }
      return;
    }

    if (e.type === 'dog') {
      // Dog enemy — low brown body, red eyes
      g.fillStyle(0x000000, 0.25);
      g.fillEllipse(e.x + 2, e.y + 18, 32, 8);
      g.fillStyle(0x995522, 1);
      g.fillRect(e.x - 14, e.y, 28, 14);   // body
      g.fillRect(e.x - 8,  e.y - 10, 16, 12); // head
      g.fillStyle(0xff3300, 1);
      g.fillRect(e.x - 6, e.y - 8, 4, 4);  // eye
      g.fillStyle(0x775522, 1);
      g.fillRect(e.x + 14, e.y + 4, 8, 5); // tail
    } else {
      // Handler cop
      g.fillStyle(0x000000, 0.25);
      g.fillEllipse(e.x + 2, e.y + 26, 24, 7);
      g.fillStyle(0x224488, 1);
      g.fillRect(e.x - 8, e.y, 16, 20);    // body
      g.fillStyle(0xffccaa, 1);
      g.fillCircle(e.x, e.y - 10, 8);      // head
      g.fillStyle(0x111133, 1);
      g.fillRect(e.x - 10, e.y - 16, 20, 8); // cap
      // Leash line
      g.lineStyle(1, 0x888888, 0.6);
      g.lineBetween(e.x + 6, e.y + 10, e.x + 20, e.y + 20);
    }
  }

  private drawPlayer(): void {
    const g = this.playerGfx;
    g.clear();
    if (this.invincible && Math.floor(this.invTimer / 100) % 2 === 0) return;

    const hw = 12, hh = 18;

    // Shadow
    g.fillStyle(0x000000, 0.3);
    g.fillEllipse(this.playerX + 2, this.playerY + hh + 3, 28, 8);

    // Body
    g.fillStyle(this.playerColor, 1);
    g.fillRect(this.playerX - hw, this.playerY - hh, hw * 2, hh * 2);

    // Head
    g.fillStyle(0xffccaa, 1);
    g.fillCircle(this.playerX, this.playerY - hh - 9, 9);

    // Kick swing
    if (this.isKicking) {
      const prog = this.kickTimer / this.KICK_DUR;
      const reach = 40 * Math.sin(prog * Math.PI) * this.kickFacing;
      g.fillStyle(this.playerColor, 1);
      g.fillRect(
        reach > 0 ? this.playerX + hw : this.playerX + hw + reach - 8,
        this.playerY - 4, Math.abs(reach) + 8, 8
      );
      g.fillStyle(0x222222, 1);
      g.fillRect(
        reach > 0 ? this.playerX + hw + Math.abs(reach) - 2 : this.playerX + hw + reach - 10,
        this.playerY - 6, 12, 12
      );
    }
  }

  private loseLife(): void {
    if (this.invincible) return;
    this.lives--;
    this.invincible = true;
    this.invTimer = 0;
    this.livesText.setText('♥'.repeat(Math.max(0, this.lives)));
    if (this.lives <= 0) this.gameOver();
  }

  private gameOver(): void {
    if (!this.gameActive) return;
    this.gameActive = false;
    this.timerEvent.remove();
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('GameOverScene', { worldNumber: 7, worldName: 'K-9 UNIT', retryScene: 'K9Scene' });
    });
  }

  private winGame(): void {
    if (!this.gameActive) return;
    this.gameActive = false;
    this.timerEvent.remove();
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
    const labels = ['BEFRIEND IT', 'IGNORE IT'];
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
      if (confirmed) return; confirmed = true;
      GameState.getInstance().makeChoice(7, sel === 0 ? 'befriend' : 'ignore');
      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('WorldSelectScene'));
    };
    ek.on('down', confirm);
    if (this.sys.game.device.input.touch) {
      this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
        sel = p.x < width / 2 ? 0 : 1; redraw();
        this.time.delayedCall(80, confirm);
      });
    }
  }

  shutdown(): void { this.mobileControls?.destroy(); }

  update(_time: number, delta: number): void {
    if (!this.gameActive) return;
    const dt = delta / 1000;
    const { width, height } = this.scale;

    // Invincibility
    if (this.invincible) {
      this.invTimer += delta;
      if (this.invTimer >= this.INV_DUR) this.invincible = false;
    }

    // Kick timers
    if (this.kickCooldown > 0) this.kickCooldown -= delta;
    if (this.isKicking) {
      this.kickTimer += delta;
      if (this.kickTimer >= this.KICK_DUR) { this.isKicking = false; this.kickTimer = 0; }
    }

    // Input
    this.mobileControls?.update();
    const mb = this.mobileControls?.state;

    if (this.cursors.left.isDown  || mb?.left)  { this.playerX -= this.playerSpeed * dt; this.kickFacing = -1; }
    if (this.cursors.right.isDown || mb?.right) { this.playerX += this.playerSpeed * dt; this.kickFacing = 1; }
    if (this.cursors.up.isDown    || mb?.up)    this.playerY -= this.playerSpeed * dt;
    if (this.cursors.down.isDown  || mb?.down)  this.playerY += this.playerSpeed * dt;

    this.playerX = Phaser.Math.Clamp(this.playerX, 90, width - 90);
    this.playerY = Phaser.Math.Clamp(this.playerY, 50, height - 50);

    // Kick input
    if ((Phaser.Input.Keyboard.JustDown(this.zKey) || mb?.actionJustDown) && this.kickCooldown <= 0 && !this.isKicking) {
      this.isKicking = true;
      this.kickTimer = 0;
      this.kickCooldown = this.KICK_CD;
    }

    // Scroll road
    this.roadLines.forEach(line => {
      line.y += this.roadScrollSpeed * dt;
      if (line.y > height + 30) line.y -= height + 60;
    });
    this.drawRoad();

    // Spawn enemies
    this.spawnTimer += delta;
    if (this.spawnTimer >= this.nextSpawnAt) {
      this.spawnEnemy();
      this.spawnTimer = 0;
      // Spawn faster as time runs out
      const urgency = Math.max(0, (35 - this.timeLeft) / 35);
      this.nextSpawnAt = Phaser.Math.Between(800, 1800) - Math.floor(urgency * 600);
    }

    // Kick hitbox (forward arc)
    const kickReach = this.isKicking
      ? 44 * Math.sin((this.kickTimer / this.KICK_DUR) * Math.PI) * this.kickFacing
      : 0;

    // Update enemies
    this.enemies.forEach(e => {
      if (!e.alive) {
        e.stunTimer -= delta;
        if (e.stunTimer <= 0) { e.gfx.destroy(); }
        else this.drawEnemy(e);
        return;
      }

      // Chase player slightly
      const dx = this.playerX - e.x;
      e.vx += dx * 0.3 * dt;
      e.vx = Phaser.Math.Clamp(e.vx, -120, 120);
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.x = Phaser.Math.Clamp(e.x, 90, width - 90);

      // Off bottom — wrap to top
      if (e.y > height + 60) {
        e.y = -50;
        e.x = Phaser.Math.Between(100, width - 100);
        e.vx = Phaser.Math.FloatBetween(-40, 40);
      }

      // Kick collision
      if (this.isKicking && kickReach !== 0) {
        const kx = this.playerX + (kickReach > 0 ? 12 : -12 + kickReach);
        const kw = Math.abs(kickReach) + 8;
        const ky = this.playerY - 8;
        const ex = e.x - (e.type === 'dog' ? 14 : 8);
        const ew = e.type === 'dog' ? 28 : 16;
        if (kx < ex + ew && kx + kw > ex && ky < e.y + 20 && ky + 24 > e.y - 14) {
          e.alive = false;
          e.stunTimer = 600;
        }
      }

      // Player collision
      if (e.alive && !this.invincible) {
        const edx = Math.abs(e.x - this.playerX);
        const edy = Math.abs(e.y - this.playerY);
        const hitRadius = e.type === 'dog' ? 22 : 18;
        if (edx < hitRadius && edy < hitRadius) {
          this.loseLife();
        }
      }

      this.drawEnemy(e);
    });

    // Clean destroyed enemies
    this.enemies = this.enemies.filter(e => e.alive || e.stunTimer > 0);

    // Dog companion
    if (this.dogActive) {
      this.dogCooldown -= delta;

      // Smoothly follow player with offset
      this.dogX += (this.playerX - 36 - this.dogX) * 8 * dt;
      this.dogY += (this.playerY - this.dogY) * 8 * dt;

      // Auto-kick nearest enemy every DOG_CD ms
      if (this.dogCooldown <= 0) {
        this.dogCooldown = this.DOG_CD;
        // Find closest alive enemy
        let closest: Enemy | null = null;
        let closestDist = 200;
        this.enemies.forEach(e => {
          if (!e.alive) return;
          const d = Math.hypot(e.x - this.dogX, e.y - this.dogY);
          if (d < closestDist) { closestDist = d; closest = e; }
        });
        if (closest) {
          (closest as Enemy).alive = false;
          (closest as Enemy).stunTimer = 600;
        }
      }

      // Draw dog cooldown bar
      const pct = Math.max(0, 1 - this.dogCooldown / this.DOG_CD);
      this.dogBarGfx.clear();
      this.dogBarGfx.fillStyle(0x222211, 1);
      this.dogBarGfx.fillRect(10, 52, 80, 6);
      this.dogBarGfx.fillStyle(0xcc8800, 1);
      this.dogBarGfx.fillRect(10, 52, 80 * pct, 6);
      createPixelText; // noop ref to avoid unused warning

      // Draw companion dog
      const dg = this.dogBarGfx;
      dg.fillStyle(0x995522, 1);
      dg.fillRect(this.dogX - 12, this.dogY - 4, 24, 12);
      dg.fillRect(this.dogX - 6, this.dogY - 14, 14, 12);
      dg.fillStyle(0xffaa44, 1);
      dg.fillRect(this.dogX - 4, this.dogY - 12, 3, 3);
      const waggle = Math.sin(Date.now() / 100) * 3;
      dg.fillStyle(0x775522, 1);
      dg.fillRect(this.dogX + 12, this.dogY - 2 + waggle, 8, 4);
    }

    // Draw player last (on top)
    this.drawPlayer();

    void height;
  }
}
