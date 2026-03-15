import Phaser from 'phaser';
import { GameState } from '../systems/GameState';
import { createPixelText } from '../ui/PixelText';

interface WorldDef {
  number: number;
  dept: string;
  genre: string;
  sceneKey: string;
  available: boolean;
}

const WORLDS: WorldDef[] = [
  { number: 1, dept: 'TRAFFIC',     genre: 'KART RACER',    sceneKey: 'TrafficScene',    available: true },
  { number: 2, dept: 'VICE',        genre: 'BEAT-EM-UP',    sceneKey: 'ViceScene',       available: true },
  { number: 3, dept: 'SWAT',        genre: 'RUN & GUN',     sceneKey: 'SWATScene',       available: true },
  { number: 4, dept: 'HOMICIDE',    genre: 'STEALTH',       sceneKey: 'HomicideScene',          available: true },
  { number: 5, dept: 'SVU',         genre: 'ADVENTURE',     sceneKey: 'SVUScene',               available: true },
  { number: 6, dept: 'NARCOTICS',   genre: 'TOWER DEF',     sceneKey: 'NarcoticsScene',         available: true },
  { number: 7, dept: 'K-9 UNIT',    genre: 'RUNNER',        sceneKey: 'K9Scene',                available: true },
  { number: 8, dept: 'INT. AFFAIRS',genre: 'INFILTRATION',  sceneKey: 'InternalAffairsScene',   available: true },
  { number: 9, dept: 'PRECINCT',    genre: '★ FINAL ★',     sceneKey: 'PrecinctScene',          available: true },
];

export class WorldSelectScene extends Phaser.Scene {
  private selectedIndex: number = 0;
  private cellGraphics: Phaser.GameObjects.Graphics[] = [];
  private cellTexts: Phaser.GameObjects.Text[][] = [];
  private previewText!: Phaser.GameObjects.Text;
  private state!: GameState;

  constructor() {
    super({ key: 'WorldSelectScene' });
  }

  create(): void {
    const { width, height } = this.scale;
    this.state = GameState.getInstance();
    this.cameras.main.fadeIn(300, 0, 0, 0);

    // Background
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x1a1a2e, 0x1a1a2e, 0x0d0d1f, 0x0d0d1f, 1);
    bg.fillRect(0, 0, width, height);

    // Title
    createPixelText(this, width / 2, 28, 'SELECT MISSION', 26, '#ffdd00');

    // Character display
    const charName = this.state.selectedCharacter?.toUpperCase() ?? '???';
    const charColor = this.state.selectedCharacter === 'zach' ? '#cc2222' : '#2255cc';
    createPixelText(this, width / 2, 54, `OPERATIVE: ${charName}`, 13, charColor);

    // Grid setup
    const gridCols = 3;
    const gridRows = 3;
    const cellW = 210;
    const cellH = 110;
    const gridStartX = (width - gridCols * cellW - (gridCols - 1) * 12) / 2;
    const gridStartY = 80;
    const gap = 12;

    this.cellGraphics = [];
    this.cellTexts = [];

    WORLDS.forEach((world, i) => {
      const col = i % gridCols;
      const row = Math.floor(i / gridRows);
      const cx = gridStartX + col * (cellW + gap);
      const cy = gridStartY + row * (cellH + gap);

      const gfx = this.add.graphics();
      this.cellGraphics.push(gfx);

      const beaten = this.state.worldsBeaten.has(world.number);
      const texts: Phaser.GameObjects.Text[] = [];

      const numText = this.add.text(cx + 12, cy + 12, `${world.number}`, {
        fontFamily: '"Courier New", Courier, monospace',
        fontSize: '22px',
        color: world.available ? '#ffffff' : '#444455',
      });
      texts.push(numText);

      const deptText = this.add.text(cx + cellW / 2, cy + 38, world.dept, {
        fontFamily: '"Courier New", Courier, monospace',
        fontSize: '14px',
        color: world.available ? '#ffdd88' : '#444455',
      }).setOrigin(0.5, 0);
      texts.push(deptText);

      const genreText = this.add.text(cx + cellW / 2, cy + 58, world.genre, {
        fontFamily: '"Courier New", Courier, monospace',
        fontSize: '11px',
        color: world.available ? '#aaaacc' : '#333344',
      }).setOrigin(0.5, 0);
      texts.push(genreText);

      if (!world.available) {
        const csText = this.add.text(cx + cellW / 2, cy + cellH / 2 + 10, 'COMING SOON', {
          fontFamily: '"Courier New", Courier, monospace',
          fontSize: '11px',
          color: '#555566',
        }).setOrigin(0.5, 0.5);
        texts.push(csText);
      }

      if (beaten) {
        const starText = this.add.text(cx + cellW - 16, cy + 12, '★', {
          fontFamily: '"Courier New", Courier, monospace',
          fontSize: '16px',
          color: '#ffdd00',
        }).setOrigin(1, 0);
        texts.push(starText);
      }

      this.cellTexts.push(texts);

      // Click handler
      const zone = this.add.zone(cx, cy, cellW, cellH).setOrigin(0, 0).setInteractive();
      zone.on('pointerdown', () => {
        this.selectedIndex = i;
        this.updateGrid();
      });
      zone.on('pointerup', () => {
        if (this.selectedIndex === i) this.enterWorld(WORLDS[i]);
      });
    });

    // Preview text
    this.previewText = this.add.text(width / 2, height - 44, '', {
      fontFamily: '"Courier New", Courier, monospace',
      fontSize: '13px',
      color: '#aaaacc',
      align: 'center',
    }).setOrigin(0.5, 0.5);

    // Nav hint
    createPixelText(this, width / 2, height - 18, 'ARROWS: navigate  ENTER: play  ESC: back', 10, '#555566');

    // Keys
    const cursors = this.input.keyboard!.createCursorKeys();
    const enterKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    const escKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);

    cursors.left.on('down', () => this.move(-1));
    cursors.right.on('down', () => this.move(1));
    cursors.up.on('down', () => this.move(-3));
    cursors.down.on('down', () => this.move(3));
    enterKey.on('down', () => this.enterWorld(WORLDS[this.selectedIndex]));
    escKey.on('down', () => {
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('CharacterSelectScene');
      });
    });

    this.updateGrid();
  }

  private move(delta: number): void {
    this.selectedIndex = Phaser.Math.Clamp(this.selectedIndex + delta, 0, WORLDS.length - 1);
    this.updateGrid();
  }

  private updateGrid(): void {
    const { width, height } = this.scale;
    const gridCols = 3;
    const cellW = 210;
    const cellH = 110;
    const gridStartX = (width - gridCols * cellW - (gridCols - 1) * 12) / 2;
    const gridStartY = 80;
    const gap = 12;

    WORLDS.forEach((world, i) => {
      const col = i % gridCols;
      const row = Math.floor(i / 3);
      const cx = gridStartX + col * (cellW + gap);
      const cy = gridStartY + row * (cellH + gap);
      const gfx = this.cellGraphics[i];
      gfx.clear();

      const isSelected = i === this.selectedIndex;
      const beaten = this.state.worldsBeaten.has(world.number);

      // Cell background
      if (world.available) {
        gfx.fillStyle(isSelected ? 0x222244 : 0x111122, 1);
      } else {
        gfx.fillStyle(0x0a0a15, 1);
      }
      gfx.fillRect(cx, cy, cellW, cellH);

      // Border
      let borderColor = world.available ? 0x334466 : 0x222233;
      if (isSelected) borderColor = beaten ? 0xffdd00 : 0x4466ff;
      if (beaten) borderColor = 0xffaa00;
      gfx.lineStyle(isSelected ? 3 : 2, borderColor, 1);
      gfx.strokeRect(cx, cy, cellW, cellH);

      // Selected glow
      if (isSelected) {
        gfx.lineStyle(1, borderColor, 0.3);
        gfx.strokeRect(cx + 3, cy + 3, cellW - 6, cellH - 6);
      }

      // Beaten fill overlay
      if (beaten) {
        gfx.fillStyle(0xffaa00, 0.05);
        gfx.fillRect(cx, cy, cellW, cellH);
      }
    });

    // Update preview
    const world = WORLDS[this.selectedIndex];
    if (world.available) {
      const beaten = this.state.worldsBeaten.has(world.number);
      const status = beaten ? '[CLEARED]' : '[AVAILABLE]';
      this.previewText.setText(`WORLD ${world.number}: ${world.dept} — ${world.genre}  ${status}`);
      this.previewText.setColor(beaten ? '#ffaa00' : '#aaaacc');
    } else {
      this.previewText.setText(`WORLD ${world.number}: ${world.dept} — LOCKED`);
      this.previewText.setColor('#444455');
    }
    void height;
  }

  private enterWorld(world: WorldDef): void {
    if (!world.available) return;
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(world.sceneKey);
    });
  }
}
