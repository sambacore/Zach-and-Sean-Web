import Phaser from 'phaser';
import { GameState } from '../../systems/GameState';
import { UnlockSystem } from '../../systems/UnlockSystem';
import { createPixelText } from '../../ui/PixelText';
import { MobileControls } from '../../ui/MobileControls';

type Approach = 'pressure' | 'sympathize' | 'bluff';

interface WitnessDef {
  x: number;
  name: string;
  tag: string;
  stages: string[];
  correct: Approach[];
  clue: string;
  bodyColor: number;
  skinColor: number;
  elderly: boolean;
}

interface WitnessState {
  def: WitnessDef;
  trust: number;
  done: boolean;
  gfx: Phaser.GameObjects.Graphics;
}

interface PatrolCop {
  x: number;
  y: number;
  dir: number;
  minX: number;
  maxX: number;
  speed: number;
  chasing: boolean;
  chaseTimer: number;
  gfx: Phaser.GameObjects.Graphics;
}

export class SVUScene extends Phaser.Scene {
  private playerX = 80;
  private playerY = 450;
  private playerFacing = 1;
  private playerColor = 0xcc2222;
  private playerSpeed = 140;
  private isSean = false;
  private playerGfx!: Phaser.GameObjects.Graphics;
  private bgGfx!: Phaser.GameObjects.Graphics;

  private witnesses: WitnessState[] = [];
  private cluesFound = 0;
  private clueTexts: string[] = [];

  private cops: PatrolCop[] = [];

  private dialogActive = false;
  private activeWitness: WitnessState | null = null;
  private dialogObjects: Phaser.GameObjects.GameObject[] = [];
  private dialogGfx?: Phaser.GameObjects.Graphics;
  private dialogFeedback = '';
  private feedbackActive = false;

  private copWarningActive = false;
  private copWarningTimer = 0;
  private warningBarGfx!: Phaser.GameObjects.Graphics;
  private warningLabelText!: Phaser.GameObjects.Text;

  private hudClueText!: Phaser.GameObjects.Text;
  private notesGfx!: Phaser.GameObjects.Graphics;
  private notesTexts: Phaser.GameObjects.Text[] = [];

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private key1!: Phaser.Input.Keyboard.Key;
  private key2!: Phaser.Input.Keyboard.Key;
  private key3!: Phaser.Input.Keyboard.Key;
  private zKey!: Phaser.Input.Keyboard.Key;
  private mobileControls?: MobileControls;
  private gameActive = true;

  constructor() { super({ key: 'SVUScene' }); }

  init(): void {
    this.witnesses = [];
    this.cops = [];
    this.cluesFound = 0;
    this.clueTexts = [];
    this.dialogActive = false;
    this.activeWitness = null;
    this.dialogObjects = [];
    this.dialogFeedback = '';
    this.feedbackActive = false;
    this.copWarningActive = false;
    this.copWarningTimer = 0;
    this.gameActive = true;
    this.playerX = 80;
    this.playerY = 450;
    this.playerFacing = 1;
    this.isSean = false;
  }

  create(): void {
    const { width, height } = this.scale;
    void height;
    const state = GameState.getInstance();
    this.cameras.main.fadeIn(300, 0, 0, 0);

    this.isSean = state.selectedCharacter === 'sean';
    if (this.isSean) {
      this.playerColor = 0x2255cc;
      this.playerSpeed = 165;
    }

    this.bgGfx    = this.add.graphics();
    this.playerGfx = this.add.graphics();

    const defs: WitnessDef[] = [
      {
        x: 200, name: 'MRS. CHEN', tag: '— Nervous | Elderly —',
        stages: [
          '"Please... I don\'t want any trouble."',
          '"You seem... kinder than the others."',
          '"You remind me of my grandson..."',
        ],
        correct: ['sympathize', 'sympathize', 'sympathize'],
        clue: 'Blue sedan parked here\nevery Thursday night.',
        bodyColor: 0x8855aa, skinColor: 0xffccaa, elderly: true,
      },
      {
        x: 460, name: 'DARNELL', tag: '— Streetwise | Young —',
        stages: [
          '"Man, I don\'t know nothing."',
          '"Aight... you got game. I see you."',
          '"For real though, I seen some things."',
        ],
        correct: ['bluff', 'bluff', 'bluff'],
        clue: 'Radio guy talked to\nDetective Walsh first.',
        bodyColor: 0x3388cc, skinColor: 0xcc9966, elderly: false,
      },
      {
        x: 700, name: 'CIVILIAN (?)', tag: '— Evasive | Watching —',
        stages: [
          '"Nothing to see here, officer."',
          '"You think you know something? Prove it."',
          '"...Alright. You got me figured out."',
        ],
        correct: ['pressure', 'bluff', 'bluff'],
        clue: 'Walsh is dirty —\nhe set this whole thing up.',
        bodyColor: 0x556677, skinColor: 0xffbbaa, elderly: false,
      },
    ];

    defs.forEach(def => {
      this.witnesses.push({ def, trust: 0, done: false, gfx: this.add.graphics() });
    });

    this.cops = [
      { x: 150, y: 450, dir:  1, minX:  50, maxX: 360, speed: 58, chasing: false, chaseTimer: 0, gfx: this.add.graphics() },
      { x: 560, y: 450, dir: -1, minX: 380, maxX: 740, speed: 72, chasing: false, chaseTimer: 0, gfx: this.add.graphics() },
    ];

    // Persistent warning bar (updated every frame, not rebuilt with dialog)
    this.warningBarGfx = this.add.graphics().setDepth(88).setScrollFactor(0);
    this.warningLabelText = this.add.text(width / 2, 0, '! COP APPROACHING !', {
      fontFamily: '"Courier New", Courier, monospace',
      fontSize: '11px', color: '#ff3333',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5, 0.5).setDepth(89).setScrollFactor(0).setVisible(false);

    // HUD
    this.hudClueText = this.add.text(width / 2, 14, 'CLUES: 0 / 3', {
      fontFamily: '"Courier New", Courier, monospace',
      fontSize: '15px', color: '#ffdd00',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5, 0.5).setDepth(50).setScrollFactor(0);

    createPixelText(this, width / 2, 34, 'APPROACH WITNESSES — PRESS Z', 10, '#667788')
      .setScrollFactor(0).setDepth(50);

    if (this.isSean) {
      createPixelText(this, 10, 14, '[STREET CRED]', 10, '#44aaff')
        .setScrollFactor(0).setDepth(50).setOrigin(0, 0.5);
    }

    this.notesGfx = this.add.graphics().setDepth(50).setScrollFactor(0);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.zKey    = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
    this.key1    = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ONE);
    this.key2    = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.TWO);
    this.key3    = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.THREE);
    this.mobileControls = new MobileControls(this);
  }

  // ── Dialog ───────────────────────────────────────────────────────────────

  private openDialog(w: WitnessState): void {
    if (this.dialogActive) return;
    this.dialogActive = true;
    this.activeWitness = w;
    this.feedbackActive = false;
    this.dialogFeedback = '';
    this.copWarningTimer = 0;
    this.rebuildDialog();
  }

  private rebuildDialog(): void {
    this.clearDialogObjects();
    if (!this.activeWitness || !this.dialogActive) return;

    const w = this.activeWitness;
    const { width, height } = this.scale;
    const dlgY = height - 240;
    const dlgH = 230;

    const gfx = this.add.graphics().setDepth(80).setScrollFactor(0);
    gfx.fillStyle(0x060610, 0.97);
    gfx.fillRect(40, dlgY, width - 80, dlgH);
    gfx.lineStyle(2, w.done ? 0x44ff88 : 0x4466ff, 1);
    gfx.strokeRect(40, dlgY, width - 80, dlgH);

    // Trust bar — 3 segments
    const segW = Math.floor((width - 106) / 3);
    for (let i = 0; i < 3; i++) {
      gfx.fillStyle(i < w.trust ? 0x44aaff : 0x0c1825, 1);
      gfx.fillRect(50 + i * (segW + 3), dlgY + 7, segW, 7);
      gfx.lineStyle(1, 0x1a3a55, 1);
      gfx.strokeRect(50 + i * (segW + 3), dlgY + 7, segW, 7);
    }

    const objs: Phaser.GameObjects.GameObject[] = [gfx];

    objs.push(
      createPixelText(this, width / 2, dlgY + 26, w.def.name, 14, '#ffdd88')
        .setDepth(81).setScrollFactor(0)
    );
    objs.push(
      createPixelText(this, width / 2, dlgY + 44, w.def.tag, 10, '#7788aa')
        .setDepth(81).setScrollFactor(0)
    );

    // Body text — feedback, clue, or stage dialogue
    let bodyLine: string;
    let bodyColor = '#cccccc';
    if (w.done) {
      bodyLine = '[ ' + w.def.clue.replace('\n', ' ') + ' ]';
      bodyColor = '#88ffaa';
    } else if (this.dialogFeedback) {
      bodyLine = this.dialogFeedback;
      bodyColor = this.dialogFeedback.startsWith('+') ? '#44ff88' : '#ff5555';
    } else {
      bodyLine = w.def.stages[Math.min(w.trust, 2)];
    }
    objs.push(
      this.add.text(width / 2, dlgY + 65, bodyLine, {
        fontFamily: '"Courier New", Courier, monospace',
        fontSize: '12px', color: bodyColor, align: 'center',
        stroke: '#000000', strokeThickness: 2,
        wordWrap: { width: width - 120 },
      }).setOrigin(0.5, 0).setDepth(81).setScrollFactor(0)
    );

    if (!w.done) {
      // Three approach buttons
      const approaches: Approach[] = ['pressure', 'sympathize', 'bluff'];
      const labels  = ['[1] PRESSURE', '[2] SYMPATHIZE', '[3] BLUFF'];
      const fills   = [0x3a0808, 0x08281a, 0x08102e];
      const borders = [0x993333,  0x33aa66,  0x3355cc];
      const bW = Math.floor((width - 106) / 3);
      const bH = 44;
      const bY = dlgY + 112;

      approaches.forEach((ap, i) => {
        const bX = 50 + i * (bW + 3);
        gfx.fillStyle(fills[i], 1);
        gfx.fillRect(bX, bY, bW, bH);
        gfx.lineStyle(2, borders[i], 1);
        gfx.strokeRect(bX, bY, bW, bH);
        objs.push(
          createPixelText(this, bX + bW / 2, bY + bH / 2, labels[i], 11, '#ffffff')
            .setDepth(82).setScrollFactor(0)
        );
        const zone = this.add.zone(bX, bY, bW, bH)
          .setOrigin(0, 0).setInteractive().setDepth(83).setScrollFactor(0);
        zone.on('pointerup', () => this.pickApproach(ap));
        objs.push(zone);
      });

      objs.push(
        createPixelText(this, width / 2, dlgY + 170, '1 / 2 / 3 to choose  |  Z to close', 9, '#333355')
          .setDepth(81).setScrollFactor(0)
      );
    } else {
      objs.push(
        createPixelText(this, width / 2, dlgY + 140, '[ Z ] CLOSE', 13, '#445566')
          .setDepth(81).setScrollFactor(0)
      );
    }

    this.dialogGfx = gfx;
    this.dialogObjects = objs;
  }

  private clearDialogObjects(): void {
    this.dialogObjects.forEach(o => o.destroy());
    this.dialogObjects = [];
    this.dialogGfx = undefined;
  }

  private closeDialog(): void {
    if (!this.dialogActive) return;
    this.clearDialogObjects();
    this.activeWitness = null;
    this.dialogActive = false;
    this.feedbackActive = false;
    this.copWarningActive = false;
    this.copWarningTimer = 0;
  }

  private pickApproach(approach: Approach): void {
    if (!this.activeWitness || this.activeWitness.done || this.feedbackActive) return;
    const w = this.activeWitness;
    const stage = Math.min(w.trust, 2);
    const correct = w.def.correct[stage] === approach;

    if (correct) {
      w.trust++;
      if (w.trust >= 3) {
        w.done = true;
        this.cluesFound++;
        this.clueTexts.push(w.def.clue);
        this.hudClueText.setText(`CLUES: ${this.cluesFound} / 3`);
        this.updateNotes();
        this.dialogFeedback = '+ WITNESS OPENS UP';
        this.feedbackActive = true;
        this.rebuildDialog();
        this.time.delayedCall(1400, () => {
          if (!this.dialogActive) return;
          this.feedbackActive = false;
          this.dialogFeedback = '';
          this.rebuildDialog();
          if (this.cluesFound >= 3) {
            this.closeDialog();
            this.time.delayedCall(500, () => this.showChoice());
          }
        });
      } else {
        this.dialogFeedback = '+ TRUST GAINED';
        this.feedbackActive = true;
        this.rebuildDialog();
        this.time.delayedCall(900, () => {
          if (!this.dialogActive) return;
          this.feedbackActive = false;
          this.dialogFeedback = '';
          this.rebuildDialog();
        });
      }
    } else {
      const penalty = this.isSean ? 1 : w.trust;
      w.trust = Math.max(0, w.trust - penalty);
      this.dialogFeedback = this.isSean ? '- TRUST -1 (Street Cred)' : '- WITNESS CLAMS UP';
      this.feedbackActive = true;
      this.rebuildDialog();
      this.time.delayedCall(900, () => {
        if (!this.dialogActive) return;
        this.feedbackActive = false;
        this.dialogFeedback = '';
        this.rebuildDialog();
      });
    }
  }

  // ── Case notes ───────────────────────────────────────────────────────────

  private updateNotes(): void {
    const { width, height } = this.scale;
    this.notesTexts.forEach(t => t.destroy());
    this.notesTexts = [];
    this.notesGfx.clear();
    if (this.clueTexts.length === 0) return;

    const panelW = 200;
    const lineH  = 30;
    const panelH = 22 + this.clueTexts.length * lineH + 6;
    const px = width - panelW - 8;
    const py = height - panelH - 8;

    this.notesGfx.fillStyle(0x06060f, 0.92);
    this.notesGfx.fillRect(px, py, panelW, panelH);
    this.notesGfx.lineStyle(1, 0x224466, 1);
    this.notesGfx.strokeRect(px, py, panelW, panelH);

    this.notesTexts.push(
      createPixelText(this, px + panelW / 2, py + 11, 'CASE NOTES', 9, '#ffdd00')
        .setDepth(52).setScrollFactor(0)
    );
    this.clueTexts.forEach((clue, i) => {
      this.notesTexts.push(
        this.add.text(px + 6, py + 22 + i * lineH, clue, {
          fontFamily: '"Courier New", Courier, monospace',
          fontSize: '9px', color: '#88ffaa',
          stroke: '#000000', strokeThickness: 1,
          wordWrap: { width: panelW - 12 },
        }).setOrigin(0, 0).setDepth(52).setScrollFactor(0)
      );
    });
  }

  // ── Background ───────────────────────────────────────────────────────────

  private drawBg(): void {
    const { width, height } = this.scale;
    this.bgGfx.clear();

    // Night sky
    this.bgGfx.fillStyle(0x03030a, 1);
    this.bgGfx.fillRect(0, 0, width, height);

    // Stars
    ([
      [35,18],[115,42],[195,16],[305,36],[415,21],[528,38],[638,14],[722,33],
      [78,58],[275,53],[448,60],[598,55],[748,50],[158,73],[378,68],[678,70],
    ] as [number,number][]).forEach(([sx, sy]) => {
      this.bgGfx.fillStyle(0xffffff, 0.55);
      this.bgGfx.fillRect(sx, sy, 2, 2);
    });

    // Buildings
    const blds = [
      { x:   0, w: 130, h: 200 }, { x: 140, w: 100, h: 155 },
      { x: 250, w: 160, h: 215 }, { x: 420, w: 110, h: 175 },
      { x: 542, w: 145, h: 200 }, { x: 698, w: 102, h: 165 },
    ];
    blds.forEach(b => {
      this.bgGfx.fillStyle(0x09091a, 1);
      this.bgGfx.fillRect(b.x, 295 - b.h, b.w, b.h);
      for (let wy = 8; wy < b.h - 12; wy += 24) {
        for (let wx = 8; wx < b.w - 8; wx += 18) {
          if (Math.sin(b.x * 0.11 + wx * 0.37 + wy * 0.29) > 0.12) {
            this.bgGfx.fillStyle(0xffee88, 0.32);
            this.bgGfx.fillRect(b.x + wx, 295 - b.h + wy, 8, 12);
          }
        }
      }
    });

    // Sidewalk / road
    this.bgGfx.fillStyle(0x14142a, 1);
    this.bgGfx.fillRect(0, 415, width, 8);
    this.bgGfx.fillStyle(0x07070e, 1);
    this.bgGfx.fillRect(0, 423, width, height - 423);

    // Pavement seams
    [90, 220, 350, 490, 620, 730].forEach(cx => {
      this.bgGfx.fillStyle(0x0c0c1a, 1);
      this.bgGfx.fillRect(cx, 417, 2, 4);
    });

    // Streetlights
    [100, 360, 610].forEach(sx => {
      this.bgGfx.fillStyle(0x383850, 1);
      this.bgGfx.fillRect(sx - 2, 285, 4, 135);
      this.bgGfx.fillRect(sx - 2, 285, 22, 3);
      this.bgGfx.fillStyle(0xffee99, 1);
      this.bgGfx.fillRect(sx + 12, 278, 16, 10);
      this.bgGfx.fillStyle(0xffee44, 0.06);
      this.bgGfx.fillTriangle(sx + 10, 288, sx + 30, 288, sx + 20, 415);
    });
  }

  // ── Witnesses ────────────────────────────────────────────────────────────

  private drawWitnesses(): void {
    this.witnesses.forEach(w => {
      w.gfx.clear();
      const x = w.def.x;
      const y = 450;

      w.gfx.fillStyle(0x000000, 0.22);
      w.gfx.fillEllipse(x, y + 2, 22, 7);

      w.gfx.fillStyle(w.done ? 0x2a5c3a : w.def.bodyColor, 1);
      w.gfx.fillRect(x - 8, y - 22, 16, 22);

      w.gfx.fillStyle(w.def.skinColor, 1);
      w.gfx.fillCircle(x, y - 28, 8);

      if (w.def.elderly) {
        w.gfx.fillStyle(0xe0e0e0, 1);
        w.gfx.fillRect(x - 10, y - 36, 20, 4);
        w.gfx.fillRect(x - 7,  y - 39, 14, 3);
      }

      if (!w.done) {
        // Three pip trust bar
        const pipW = 8;
        const gap  = 3;
        const totalW = 3 * pipW + 2 * gap;
        for (let i = 0; i < 3; i++) {
          w.gfx.fillStyle(i < w.trust ? 0x44aaff : 0x172030, 1);
          w.gfx.fillRect(x - totalW / 2 + i * (pipW + gap), y - 54, pipW, 5);
        }
        // Talk bubble dot
        w.gfx.fillStyle(0xffdd00, 1);
        w.gfx.fillRect(x - 3, y - 46, 6, 6);
        w.gfx.fillRect(x - 1, y - 41, 2, 3);
      } else {
        // Done glow
        w.gfx.fillStyle(0x44ff88, 1);
        w.gfx.fillCircle(x, y - 48, 5);
      }
    });
  }

  // ── Patrol cops ──────────────────────────────────────────────────────────

  private drawCops(): void {
    this.cops.forEach(cop => {
      cop.gfx.clear();
      const { x, y } = cop;

      cop.gfx.fillStyle(0x000000, 0.18);
      cop.gfx.fillEllipse(x, y + 2, 20, 6);

      cop.gfx.fillStyle(cop.chasing ? 0x445566 : 0x556677, 1);
      cop.gfx.fillRect(x - 7, y - 22, 14, 22);

      cop.gfx.fillStyle(0xffccaa, 1);
      cop.gfx.fillCircle(x, y - 28, 7);

      // Fedora
      cop.gfx.fillStyle(0x283848, 1);
      cop.gfx.fillRect(x - 10, y - 36, 20, 4); // brim
      cop.gfx.fillRect(x - 7,  y - 40, 14, 5); // crown

      // Badge glint
      cop.gfx.fillStyle(0xccbb33, 0.75);
      cop.gfx.fillRect(x + 2, y - 16, 3, 3);

      if (cop.chasing) {
        cop.gfx.fillStyle(0xff2222, 1);
        cop.gfx.fillRect(x - 3, y - 31, 2, 2);
        cop.gfx.fillRect(x + 1, y - 31, 2, 2);
      }
    });
  }

  // ── Player ───────────────────────────────────────────────────────────────

  private drawPlayer(): void {
    this.playerGfx.clear();
    this.playerGfx.fillStyle(0x000000, 0.28);
    this.playerGfx.fillEllipse(this.playerX, this.playerY + 2, 22, 8);
    this.playerGfx.fillStyle(this.playerColor, 1);
    this.playerGfx.fillRect(this.playerX - 8, this.playerY - 22, 16, 22);
    this.playerGfx.fillStyle(0xffccaa, 1);
    this.playerGfx.fillCircle(this.playerX, this.playerY - 28, 8);
    this.playerGfx.fillStyle(0xffdd00, 1);
    this.playerGfx.fillRect(
      this.playerX + (this.playerFacing > 0 ? 3 : -7),
      this.playerY - 16, 4, 4
    );
  }

  // ── showChoice (structure preserved exactly) ──────────────────────────────

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

  shutdown(): void {
    this.mobileControls?.destroy();
  }

  // ── Update ───────────────────────────────────────────────────────────────

  update(_time: number, delta: number): void {
    if (!this.gameActive) return;
    const dt = delta / 1000;
    const { width, height } = this.scale;

    this.mobileControls?.update();
    const mb = this.mobileControls?.state;

    // Player movement
    if (!this.dialogActive) {
      if (this.cursors.left.isDown  || mb?.left)  { this.playerX -= this.playerSpeed * dt; this.playerFacing = -1; }
      if (this.cursors.right.isDown || mb?.right) { this.playerX += this.playerSpeed * dt; this.playerFacing =  1; }
      this.playerX = Phaser.Math.Clamp(this.playerX, 16, width - 16);
      this.playerY = 450;

      if (Phaser.Input.Keyboard.JustDown(this.zKey) || mb?.actionJustDown) {
        const near = this.witnesses.find(w =>
          !w.done && Math.abs(w.def.x - this.playerX) < 48
        );
        if (near) this.openDialog(near);
      }
    } else {
      // Close with Z (only when not mid-feedback)
      if ((Phaser.Input.Keyboard.JustDown(this.zKey) || mb?.actionJustDown) && !this.feedbackActive) {
        this.closeDialog();
      }
      // Approach keys 1/2/3
      if (!this.feedbackActive && this.activeWitness && !this.activeWitness.done) {
        if (Phaser.Input.Keyboard.JustDown(this.key1)) this.pickApproach('pressure');
        if (Phaser.Input.Keyboard.JustDown(this.key2)) this.pickApproach('sympathize');
        if (Phaser.Input.Keyboard.JustDown(this.key3)) this.pickApproach('bluff');
      }
    }

    // Patrol cop movement
    this.cops.forEach(cop => {
      if (cop.chasing) {
        cop.chaseTimer -= delta;
        if (cop.chaseTimer <= 0) {
          cop.chasing = false;
          cop.chaseTimer = 0;
        } else {
          const dx = this.playerX - cop.x;
          cop.x += Math.sign(dx) * 115 * dt;
          cop.x = Phaser.Math.Clamp(cop.x, 10, width - 10);
        }
      } else {
        cop.x += cop.dir * cop.speed * dt;
        if (cop.x >= cop.maxX) { cop.x = cop.maxX; cop.dir = -1; }
        if (cop.x <= cop.minX) { cop.x = cop.minX; cop.dir =  1; }
        // Player can lure by getting close
        if (!this.dialogActive && Math.abs(cop.x - this.playerX) < 60) {
          cop.chasing = true;
          cop.chaseTimer = 3000;
        }
      }
    });

    // Cop proximity check during dialog
    if (this.dialogActive && this.activeWitness && !this.activeWitness.done) {
      const wX = this.activeWitness.def.x;
      const closest = Math.min(...this.cops.map(c => Math.abs(c.x - wX)));
      const nowWarning = closest < 80;

      if (nowWarning !== this.copWarningActive) {
        this.copWarningActive = nowWarning;
        if (!nowWarning) this.copWarningTimer = 0;
      }

      if (this.copWarningActive) {
        this.copWarningTimer += delta;
        if (this.copWarningTimer >= 2000) {
          // Cop interrupts — lawyer up the witness
          this.activeWitness.trust = 0;
          this.closeDialog();
        }
      }
    } else if (!this.dialogActive) {
      this.copWarningActive = false;
      this.copWarningTimer = 0;
    }

    // Warning bar — drawn every frame without rebuilding dialog
    this.warningBarGfx.clear();
    if (this.dialogActive && this.copWarningActive) {
      const dlgY = height - 240;
      const pct  = Math.min(this.copWarningTimer / 2000, 1);
      this.warningBarGfx.fillStyle(0x1a0000, 0.9);
      this.warningBarGfx.fillRect(40, dlgY - 12, width - 80, 8);
      this.warningBarGfx.fillStyle(0xff2222, 1);
      this.warningBarGfx.fillRect(40, dlgY - 12, (width - 80) * pct, 8);
      this.warningLabelText.setPosition(width / 2, dlgY - 8).setVisible(true);
    } else {
      this.warningLabelText.setVisible(false);
    }

    this.drawBg();
    this.drawWitnesses();
    this.drawCops();
    this.drawPlayer();
  }
}
