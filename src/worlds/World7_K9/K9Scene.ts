import Phaser from 'phaser';
import { GameState } from '../../systems/GameState';
import { UnlockSystem } from '../../systems/UnlockSystem';
import { createPixelText } from '../../ui/PixelText';
import { MobileControls } from '../../ui/MobileControls';

// ─── Constants ────────────────────────────────────────────────────────────────
const NUM_LANES     = 3;
const WIN_DISTANCE  = 500;   // meters
const BASE_SPEED    = 220;   // px / sec
const MAX_SPEED     = 480;   // px / sec
const M_PER_PX      = 0.033; // metres per scrolled pixel  → ~75 s to 500 m
const JUMP_DUR      = 550;   // ms player is airborne
const CROUCH_DUR    = 480;   // ms player is crouching
const LANE_CHG_DUR  = 140;   // ms slide to new lane
const SPAWN_START   = 2000;  // ms between obstacle waves (start)
const SPAWN_MIN     = 800;   // ms (fastest)
const DOG_PASSIVE   = 0.002; // dog-progress / sec (background creep)
const DOG_HIT       = 0.22;  // dog-progress added per hit

// ─── Types ────────────────────────────────────────────────────────────────────
interface Obstacle {
  lane:   number;
  type:   'jump' | 'duck';
  y:      number;
  passed: boolean;
  gfx:    Phaser.GameObjects.Graphics;
}

// ─── Scene ────────────────────────────────────────────────────────────────────
export class K9Scene extends Phaser.Scene {

  // ── Lane layout ──────────────────────────────────────────────────────────
  private laneX: number[] = [];      // centre-X of each lane
  private laneW = 0;                 // full width of one lane

  // ── Player ───────────────────────────────────────────────────────────────
  private playerX    = 0;
  private playerY    = 0;
  private playerColor = 0xcc2222;
  private playerGfx!: Phaser.GameObjects.Graphics;

  private curLane  = 1;              // logical lane index
  private fromLane = 1;              // lane we started moving from
  private laneChanging  = false;
  private laneChangeT   = 0;

  private isJumping  = false;
  private jumpT      = 0;
  private isCrouching = false;
  private crouchT    = 0;

  // ── Road ─────────────────────────────────────────────────────────────────
  private roadGfx!:  Phaser.GameObjects.Graphics;
  private dashLines: Array<{ y: number }> = [];

  // ── Obstacles ─────────────────────────────────────────────────────────────
  private obstacles: Obstacle[] = [];
  private spawnTimer = 0;
  private spawnInterval = SPAWN_START;

  // ── Distance / speed ──────────────────────────────────────────────────────
  private distanceM    = 0;
  private scrollSpeed  = BASE_SPEED;
  private distText!: Phaser.GameObjects.Text;

  // ── Dog chase ─────────────────────────────────────────────────────────────
  private dogProgress = 0;           // 0 = distant, 1 = caught
  private hitFlashT   = 0;
  private dogGfx!:    Phaser.GameObjects.Graphics;
  private dogBarGfx!: Phaser.GameObjects.Graphics;

  // ── Controls ─────────────────────────────────────────────────────────────
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private mobileControls?: MobileControls;
  private prevMbLeft  = false;
  private prevMbRight = false;
  private prevMbDown  = false;

  private gameActive = true;

  // ── Sean-specific ─────────────────────────────────────────────────────────
  private laneChangeDur = LANE_CHG_DUR;  // may be shortened for Sean
  private dutchCourage  = false;          // Sean passive: first dog-hit ignored
  private state!: GameState;

  // ─────────────────────────────────────────────────────────────────────────
  constructor() { super({ key: 'K9Scene' }); }

  init(): void {
    this.laneX         = [];
    this.dashLines     = [];
    this.obstacles     = [];
    this.spawnTimer    = 0;
    this.spawnInterval = SPAWN_START;
    this.distanceM     = 0;
    this.scrollSpeed   = BASE_SPEED;
    this.curLane       = 1;
    this.fromLane      = 1;
    this.laneChanging  = false;
    this.laneChangeT   = 0;
    this.isJumping     = false;
    this.jumpT         = 0;
    this.isCrouching   = false;
    this.crouchT       = 0;
    this.dogProgress   = 0;
    this.hitFlashT     = 0;
    this.prevMbLeft    = false;
    this.prevMbRight   = false;
    this.prevMbDown    = false;
    this.gameActive    = true;
    this.laneChangeDur = LANE_CHG_DUR;
    this.dutchCourage  = false;
  }

  // ─── create ───────────────────────────────────────────────────────────────
  create(): void {
    const { width, height } = this.scale;
    this.state = GameState.getInstance();
    this.cameras.main.fadeIn(300, 0, 0, 0);

    this.playerColor = this.state.selectedCharacter === 'sean' ? 0x2255cc : 0xcc2222;

    // Sean is the runner — faster, snappier lane changes, Dutch Courage passive
    if (this.state.selectedCharacter === 'sean') {
      this.scrollSpeed    = BASE_SPEED * 1.18;  // starts 18% faster
      this.laneChangeDur  = 85;                 // snappier lane switch (vs 140ms)
      this.dutchCourage   = true;               // absorbs first dog-progress hit
    }

    // Lane geometry  (road between x=80 and x=width-80)
    const roadL = 80;
    const roadW = width - 160;
    this.laneW   = roadW / NUM_LANES;
    for (let i = 0; i < NUM_LANES; i++) {
      this.laneX.push(roadL + this.laneW * i + this.laneW / 2);
    }

    this.playerY = height * 0.76;
    this.playerX = this.laneX[this.curLane];

    // Ability from prior choice
    if (this.state.choices[7] === 'befriend') {
      // dog companion slows the chase pack slightly
      this.dogProgress = -0.1; // starts further back
    }
    if (this.state.choices[7] === 'ignore') {
      this.scrollSpeed *= 1.08; // runs faster = reaches 500 m sooner
    }

    // Road dash lines (scrolling)
    for (let y = 0; y < height + 60; y += 60) this.dashLines.push({ y });

    // Graphics objects (z-order: road < dogs < obstacles < player < HUD)
    this.roadGfx  = this.add.graphics().setDepth(1);
    this.dogGfx   = this.add.graphics().setDepth(4);
    this.playerGfx = this.add.graphics().setDepth(10);
    this.dogBarGfx = this.add.graphics().setDepth(51).setScrollFactor(0);

    // HUD background
    const hudBg = this.add.graphics().setDepth(50).setScrollFactor(0);
    hudBg.fillStyle(0x000000, 0.65);
    hudBg.fillRect(0, 0, width, 44);

    this.distText = createPixelText(this, width / 2, 22, `0m / ${WIN_DISTANCE}m`, 18, '#ffdd00')
      .setDepth(51).setScrollFactor(0);

    const charLabel = (this.state.selectedCharacter ?? 'PLAYER').toUpperCase();
    const charColor = this.playerColor === 0xcc2222 ? '#cc2222' : '#2255cc';
    createPixelText(this, 80, 22, charLabel, 14, charColor).setDepth(51).setScrollFactor(0);

    createPixelText(this, width - 12, 22, 'DOGS:', 11, '#ff6644')
      .setDepth(51).setScrollFactor(0).setOrigin(1, 0.5);

    // Sean HUD: Dutch Courage indicator
    if (this.state.selectedCharacter === 'sean') {
      createPixelText(this, 80, 36, '🍺 DUTCH COURAGE', 9, '#88ccff')
        .setDepth(51).setScrollFactor(0);
    }

    // Instructions overlay
    const seanBonus = this.state.selectedCharacter === 'sean'
      ? '\nSEAN: +SPEED  +FAST LANES  🍺 FREE HIT' : '';
    const inst = createPixelText(
      this, width / 2, height / 2,
      `← → CHANGE LANE\n↑ / SPACE  JUMP over barriers\n↓ DUCK under tape\nSURVIVE 500 m!${seanBonus}`,
      15, '#ffffff'
    ).setDepth(60).setScrollFactor(0);
    this.tweens.add({ targets: inst, alpha: 0, delay: 3000, duration: 700,
                      onComplete: () => inst.destroy() });

    // Controls
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.mobileControls = new MobileControls(this);

    this.drawRoad();
  }

  // ─── Road ─────────────────────────────────────────────────────────────────
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

    // Road surface
    g.fillStyle(0x2c2c3c, 1);
    g.fillRect(80, 0, width - 160, height);

    // Shoulder lines
    g.lineStyle(3, 0xffffff, 0.55);
    g.lineBetween(80, 0, 80, height);
    g.lineBetween(width - 80, 0, width - 80, height);

    // Lane dividers (scrolling dashes)
    g.lineStyle(2, 0xffffff, 0.22);
    for (let i = 1; i < NUM_LANES; i++) {
      const lx = 80 + this.laneW * i;
      this.dashLines.forEach(d => {
        g.lineBetween(lx, d.y, lx, d.y + 30);
      });
    }
  }

  // ─── Obstacle spawn ───────────────────────────────────────────────────────
  private spawnWave(): void {
    // Always leave at least one lane clear
    const maxObs = NUM_LANES - 1;
    const count  = Phaser.Math.Between(1, maxObs);
    const lanes  = Phaser.Utils.Array.Shuffle([0, 1, 2]) as number[];

    for (let i = 0; i < count; i++) {
      const type: 'jump' | 'duck' = Math.random() < 0.5 ? 'jump' : 'duck';
      const obs: Obstacle = {
        lane:   lanes[i],
        type,
        y:      -50,
        passed: false,
        gfx:    this.add.graphics().setDepth(7),
      };
      this.obstacles.push(obs);
      this.drawObstacle(obs);
    }
  }

  private drawObstacle(obs: Obstacle): void {
    const g    = obs.gfx;
    const half = this.laneW / 2 - 8;
    const cx   = this.laneX[obs.lane];
    g.clear();

    if (obs.type === 'jump') {
      // ── Blocky red barrier (ground level) ──────────────────────────────
      // Drop shadow
      g.fillStyle(0x000000, 0.35);
      g.fillRect(cx - half + 3, obs.y + 6, half * 2 - 6, 22);
      // Main block body
      g.fillStyle(0xcc2222, 1);
      g.fillRect(cx - half, obs.y - 8, half * 2, 24);
      // Top highlight
      g.fillStyle(0xff5555, 1);
      g.fillRect(cx - half, obs.y - 8, half * 2, 5);
      // Bottom shadow strip
      g.fillStyle(0x882222, 1);
      g.fillRect(cx - half, obs.y + 11, half * 2, 5);
      // White "hazard" stripe
      g.fillStyle(0xffffff, 0.55);
      g.fillRect(cx - 12, obs.y - 5, 24, 3);
    } else {
      // ── Yellow caution-tape boom barrier (upper level) ─────────────────
      const poleH = 30;
      // Support poles
      g.fillStyle(0x777777, 1);
      g.fillRect(cx - half,     obs.y - poleH, 5, poleH + 4);
      g.fillRect(cx + half - 5, obs.y - poleH, 5, poleH + 4);
      // Tape bar (top)
      g.fillStyle(0xffcc00, 1);
      g.fillRect(cx - half, obs.y - poleH + 2, half * 2, 11);
      // Black hazard stripes on tape
      g.fillStyle(0x222200, 0.55);
      for (let sx = cx - half; sx < cx + half; sx += 14) {
        g.fillRect(sx, obs.y - poleH + 2, 7, 11);
      }
      // Second lower tape strip
      g.fillStyle(0xffcc00, 0.7);
      g.fillRect(cx - half, obs.y - poleH + 18, half * 2, 6);
    }
  }

  // ─── Player drawing ───────────────────────────────────────────────────────
  private drawPlayer(): void {
    const g = this.playerGfx;
    g.clear();

    // Hit-flash blink
    if (this.hitFlashT > 0 && Math.floor(this.hitFlashT / 75) % 2 === 0) return;

    const x = this.playerX;
    const y = this.playerY;
    const hw = 12;

    if (this.isJumping) {
      const lift = Math.sin((this.jumpT / JUMP_DUR) * Math.PI) * 32;
      const jy   = y - lift;
      // Shadow (shrinks as player rises)
      const ss = 1 - lift / 40;
      g.fillStyle(0x000000, 0.3 * ss);
      g.fillEllipse(x + 2, y + 18, 30 * ss, 8 * ss);
      // Body (lifted)
      g.fillStyle(this.playerColor, 1);
      g.fillRect(x - hw, jy - 18, hw * 2, 34);
      g.fillStyle(0xffccaa, 1);
      g.fillCircle(x, jy - 27, 9);
      // Legs tucked
      g.fillStyle(0x222222, 1);
      g.fillRect(x - 9, jy + 10, 8, 10);
      g.fillRect(x + 1, jy + 10, 8, 10);

    } else if (this.isCrouching) {
      // Slide — wide, squat silhouette
      g.fillStyle(0x000000, 0.3);
      g.fillEllipse(x + 2, y + 10, 36, 8);
      g.fillStyle(this.playerColor, 1);
      g.fillRect(x - hw - 4, y - 7, (hw + 4) * 2, 14);
      g.fillStyle(0xffccaa, 1);
      g.fillCircle(x + hw + 2, y - 1, 8);

    } else {
      // Running — alternate legs
      const leg = Math.floor(Date.now() / 90) % 2;
      g.fillStyle(0x000000, 0.3);
      g.fillEllipse(x + 2, y + 20, 28, 8);
      g.fillStyle(this.playerColor, 1);
      g.fillRect(x - hw, y - 18, hw * 2, 36);
      g.fillStyle(0xffccaa, 1);
      g.fillCircle(x, y - 27, 9);
      g.fillStyle(0x222222, 1);
      if (leg === 0) {
        g.fillRect(x - 9, y + 14, 8, 14);
        g.fillRect(x + 1, y + 10, 8, 10);
      } else {
        g.fillRect(x - 9, y + 10, 8, 10);
        g.fillRect(x + 1, y + 14, 8, 14);
      }
    }
  }

  // ─── Dog pack drawing ─────────────────────────────────────────────────────
  private drawDogs(): void {
    const { width, height } = this.scale;
    const g = this.dogGfx;
    g.clear();

    const prog = Math.max(0, this.dogProgress);
    if (prog < 0.03) return;

    // Dogs live at the bottom, scaling up as they close in
    const baseY  = height + 60;
    const topY   = this.playerY + 70;          // where they'd be at prog=1
    const dogY   = Phaser.Math.Linear(baseY, topY, prog);
    const s      = 0.25 + prog * 0.85;         // scale factor
    const alpha  = Math.min(1, prog * 2.5);

    for (let lane = 0; lane < NUM_LANES; lane++) {
      const dx = this.laneX[lane];

      // Body
      g.fillStyle(0x8b4513, alpha);
      g.fillRect(dx - 16 * s, dogY - 10 * s, 32 * s, 16 * s);
      // Head
      g.fillRect(dx - 9 * s, dogY - 22 * s, 18 * s, 14 * s);
      // Ears
      g.fillStyle(0x6b3413, alpha);
      g.fillRect(dx - 11 * s, dogY - 26 * s, 6 * s, 7 * s);
      g.fillRect(dx + 5 * s,  dogY - 26 * s, 6 * s, 7 * s);
      // Menacing red eyes
      g.fillStyle(0xff2200, alpha);
      g.fillRect(dx - 7 * s, dogY - 20 * s, 4 * s, 4 * s);
      g.fillRect(dx + 3 * s, dogY - 20 * s, 4 * s, 4 * s);
      // Teeth
      g.fillStyle(0xffffff, alpha * 0.9);
      g.fillRect(dx - 6 * s, dogY - 12 * s, 3 * s, 4 * s);
      g.fillRect(dx - 1 * s, dogY - 12 * s, 3 * s, 4 * s);
      g.fillRect(dx + 4 * s, dogY - 12 * s, 3 * s, 4 * s);
      // Animated legs
      const legOff = Math.sin(Date.now() / 70 + lane) * 5 * s;
      g.fillStyle(0x6b3413, alpha);
      g.fillRect(dx - 14 * s, dogY + 6 * s, 6 * s, 10 * s + legOff);
      g.fillRect(dx - 5 * s,  dogY + 6 * s, 6 * s, 10 * s - legOff);
      g.fillRect(dx + 3 * s,  dogY + 6 * s, 6 * s, 10 * s + legOff);
      g.fillRect(dx + 11 * s, dogY + 6 * s, 6 * s, 10 * s - legOff);
    }

    // Red danger glow at high proximity
    if (prog > 0.65) {
      const pulse = Math.sin(Date.now() / 130) * 0.15 + 0.18;
      g.fillStyle(0xff2200, pulse * Math.min(1, (prog - 0.65) / 0.35));
      g.fillRect(0, height - 90, width, 90);
    }
  }

  private drawDogBar(): void {
    const { width } = this.scale;
    const g = this.dogBarGfx;
    g.clear();

    const barX = width - 120;
    const barY = 22;
    const barW = 100;
    const barH = 9;

    // Background
    g.fillStyle(0x111111, 0.85);
    g.fillRect(barX, barY - barH / 2, barW, barH);

    // Fill colour: green → yellow → red
    const p = Math.max(0, this.dogProgress);
    let fillColor: number;
    if (p < 0.5) {
      const t = p * 2;
      fillColor = Phaser.Display.Color.GetColor(Math.floor(220 * t), 200, 0);
    } else {
      const t = (p - 0.5) * 2;
      fillColor = Phaser.Display.Color.GetColor(220, Math.floor(200 * (1 - t)), 0);
    }
    g.fillStyle(fillColor, 1);
    g.fillRect(barX, barY - barH / 2, barW * Math.min(1, p), barH);

    // Border
    g.lineStyle(1, 0xffffff, 0.3);
    g.strokeRect(barX, barY - barH / 2, barW, barH);

    // Pulsing "!!" warning when high
    if (p > 0.75) {
      const blink = Math.floor(Date.now() / 250) % 2 === 0;
      if (blink) {
        g.fillStyle(0xff2200, 0.9);
        g.fillRect(barX + barW + 4, barY - 7, 14, 14);
        g.fillStyle(0xffffff, 1);
        g.fillRect(barX + barW + 9, barY - 6, 4, 8);
        g.fillRect(barX + barW + 9, barY + 3, 4, 4);
      }
    }
  }

  // ─── Hit & game-over logic ────────────────────────────────────────────────
  private onHit(): void {
    // Dutch Courage (Sean passive): absorb the first hit entirely
    if (this.dutchCourage) {
      this.dutchCourage = false;
      this.hitFlashT = 600;
      this.cameras.main.shake(120, 0.006);
      // Brief "shrug" flash but dogs don't advance
      return;
    }
    this.dogProgress += DOG_HIT;
    this.hitFlashT    = 900;
    this.cameras.main.shake(200, 0.012);
    if (this.dogProgress >= 1.0) this.gameOver();
  }

  private gameOver(): void {
    if (!this.gameActive) return;
    this.gameActive = false;
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('GameOverScene', {
        worldNumber: 7, worldName: 'K-9 UNIT', retryScene: 'K9Scene',
      });
    });
  }

  // ─── Win screen (unchanged logic from original) ────────────────────────
  private winGame(): void {
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
    const cg  = this.add.graphics().setDepth(102).setScrollFactor(0);
    const labels = ['BEFRIEND IT', 'IGNORE IT'];
    const cx     = [width / 2 - 110, width / 2 + 110];
    const cy     = height / 2 + 22;
    const lt     = labels.map((lbl, i) =>
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

  shutdown(): void { this.mobileControls?.destroy(); }

  // ─── update ───────────────────────────────────────────────────────────────
  update(_time: number, delta: number): void {
    if (!this.gameActive) return;
    const dt = delta / 1000;
    const { height } = this.scale;

    // ── Action timers ──────────────────────────────────────────────────────
    if (this.hitFlashT > 0) this.hitFlashT -= delta;

    if (this.isJumping) {
      this.jumpT += delta;
      if (this.jumpT >= JUMP_DUR) { this.isJumping = false; this.jumpT = 0; }
    }

    if (this.isCrouching) {
      this.crouchT += delta;
      if (this.crouchT >= CROUCH_DUR) { this.isCrouching = false; this.crouchT = 0; }
    }

    // ── Lane-change interpolation ──────────────────────────────────────────
    if (this.laneChanging) {
      this.laneChangeT += delta;
      const prog = Math.min(1, this.laneChangeT / this.laneChangeDur);
      this.playerX = Phaser.Math.Linear(
        this.laneX[this.fromLane],
        this.laneX[this.curLane],
        prog
      );
      if (prog >= 1) {
        this.playerX    = this.laneX[this.curLane];
        this.laneChanging = false;
        this.laneChangeT  = 0;
      }
    }

    // ── Input ──────────────────────────────────────────────────────────────
    this.mobileControls?.update();
    const mb = this.mobileControls?.state;

    // Compute mobile just-down edges
    const mbLeftJD  = !!(mb?.left  && !this.prevMbLeft);
    const mbRightJD = !!(mb?.right && !this.prevMbRight);
    const mbDownJD  = !!(mb?.down  && !this.prevMbDown);
    this.prevMbLeft  = mb?.left  ?? false;
    this.prevMbRight = mb?.right ?? false;
    this.prevMbDown  = mb?.down  ?? false;

    const spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    const leftJD  = Phaser.Input.Keyboard.JustDown(this.cursors.left)  || mbLeftJD;
    const rightJD = Phaser.Input.Keyboard.JustDown(this.cursors.right) || mbRightJD;
    const upJD    = Phaser.Input.Keyboard.JustDown(this.cursors.up)    ||
                    Phaser.Input.Keyboard.JustDown(spaceKey)            ||
                    !!(mb?.upJustDown);
    const downJD  = Phaser.Input.Keyboard.JustDown(this.cursors.down)  || mbDownJD;

    // Lane change
    if (!this.laneChanging) {
      if (leftJD  && this.curLane > 0) {
        this.fromLane  = this.curLane;
        this.curLane--;
        this.laneChanging = true;
        this.laneChangeT  = 0;
      } else if (rightJD && this.curLane < NUM_LANES - 1) {
        this.fromLane  = this.curLane;
        this.curLane++;
        this.laneChanging = true;
        this.laneChangeT  = 0;
      }
    }

    // Jump (can trigger while mid-lane-change)
    if (upJD && !this.isJumping && !this.isCrouching) {
      this.isJumping = true;
      this.jumpT     = 0;
    }

    // Crouch
    if (downJD && !this.isCrouching && !this.isJumping) {
      this.isCrouching = true;
      this.crouchT     = 0;
    }

    // ── Distance & speed progression ──────────────────────────────────────
    const scrollPx    = this.scrollSpeed * dt;
    this.distanceM   += scrollPx * M_PER_PX;
    const progress    = Math.min(1, this.distanceM / WIN_DISTANCE);
    this.scrollSpeed  = Phaser.Math.Linear(BASE_SPEED, MAX_SPEED, progress);
    this.spawnInterval = Phaser.Math.Linear(SPAWN_START, SPAWN_MIN, progress);
    this.distText.setText(`${Math.floor(this.distanceM)}m / ${WIN_DISTANCE}m`);

    if (this.distanceM >= WIN_DISTANCE) { this.winGame(); return; }

    // ── Dog passive encroach ───────────────────────────────────────────────
    this.dogProgress += DOG_PASSIVE * dt;
    if (this.dogProgress >= 1.0) { this.gameOver(); return; }

    // ── Scroll road ───────────────────────────────────────────────────────
    this.dashLines.forEach(d => {
      d.y += scrollPx;
      if (d.y > height + 30) d.y -= height + 60;
    });
    this.drawRoad();

    // ── Spawn obstacles ───────────────────────────────────────────────────
    this.spawnTimer += delta;
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0;
      this.spawnWave();
    }

    // ── Update & collide obstacles ────────────────────────────────────────
    this.obstacles.forEach(obs => {
      obs.y += scrollPx;
      this.drawObstacle(obs);

      // Collision window: obstacle Y within ±28 px of player Y
      if (!obs.passed && Math.abs(obs.y - this.playerY) < 28) {
        obs.passed = true;
        if (obs.lane === this.curLane) {
          const safe = (obs.type === 'jump'  && this.isJumping) ||
                       (obs.type === 'duck'  && this.isCrouching);
          if (!safe) this.onHit();
        }
      }
    });

    // Clean off-screen obstacles
    this.obstacles = this.obstacles.filter(obs => {
      if (obs.y > height + 80) { obs.gfx.destroy(); return false; }
      return true;
    });

    // ── Draw everything ───────────────────────────────────────────────────
    this.drawDogs();
    this.drawDogBar();
    this.drawPlayer();
  }
}
