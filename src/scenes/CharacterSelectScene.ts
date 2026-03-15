import Phaser from 'phaser';
import { GameState } from '../systems/GameState';
import { ZachCharacter } from '../characters/ZachCharacter';
import { SeanCharacter } from '../characters/SeanCharacter';
import { createPixelText } from '../ui/PixelText';

type CharChoice = 'zach' | 'sean';

export class CharacterSelectScene extends Phaser.Scene {
  private selected: CharChoice = 'zach';
  private zachPanel!: Phaser.GameObjects.Graphics;
  private seanPanel!: Phaser.GameObjects.Graphics;
  private zachChar: ZachCharacter;
  private seanChar: SeanCharacter;
  private zachGraphics!: Phaser.GameObjects.Graphics;
  private seanGraphics!: Phaser.GameObjects.Graphics;
  private confirmText!: Phaser.GameObjects.Text;
  private confirmBlink: number = 0;
  private selectionIndicator!: Phaser.GameObjects.Graphics;

  constructor() {
    super({ key: 'CharacterSelectScene' });
    this.zachChar = new ZachCharacter();
    this.seanChar = new SeanCharacter();
  }

  create(): void {
    const { width, height } = this.scale;

    this.cameras.main.fadeIn(300, 0, 0, 0);

    // Background
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x1a1a2e, 0x1a1a2e, 0x0d0d1f, 0x0d0d1f, 1);
    bg.fillRect(0, 0, width, height);

    // Title
    const titleText = createPixelText(this, width / 2, 40, 'SELECT YOUR FIGHTER', 28, '#ffdd00');
    titleText.setShadow(2, 2, '#554400', 0, true);

    // Decorative line
    const lineGfx = this.add.graphics();
    lineGfx.lineStyle(2, 0x444455, 1);
    lineGfx.lineBetween(50, 68, width - 50, 68);

    const panelY = 90;
    const panelH = height - 130;
    const panelW = width / 2 - 60;
    const zachX = 40;
    const seanX = width / 2 + 20;

    // Panels
    this.zachPanel = this.add.graphics();
    this.seanPanel = this.add.graphics();

    this.drawPanel(this.zachPanel, zachX, panelY, panelW, panelH, 0xcc2222, true);
    this.drawPanel(this.seanPanel, seanX, panelY, panelW, panelH, 0x2255cc, false);

    // Selection indicator arrow
    this.selectionIndicator = this.add.graphics();

    // Character sprites
    this.zachGraphics = this.zachChar.drawCharacterPreview(this, zachX + panelW / 2, panelY + 120, 1.8);
    this.seanGraphics = this.seanChar.drawCharacterPreview(this, seanX + panelW / 2, panelY + 120, 1.8);

    // ZACH stats
    const zachCX = zachX + panelW / 2;
    createPixelText(this, zachCX, panelY + 16, 'ZACH', 22, '#cc2222');
    createPixelText(this, zachCX, panelY + 36, '── THE TANK ──', 10, '#884444');

    this.drawStatBars(zachX + 10, panelY + 220, panelW - 20, this.zachChar);
    this.drawDescription(zachX + 10, panelY + 330, panelW - 20, this.zachChar.getCharacterDescription());
    this.drawPassive(zachCX, panelY + 400, 'PASSIVE: Heavy Hitter', '#ff8888');

    // SEAN stats
    const seanCX = seanX + panelW / 2;
    createPixelText(this, seanCX, panelY + 16, 'SEAN', 22, '#2255cc');
    createPixelText(this, seanCX, panelY + 36, '── THE SPEEDSTER ──', 10, '#445588');

    this.drawStatBars(seanX + 10, panelY + 220, panelW - 20, this.seanChar);
    this.drawDescription(seanX + 10, panelY + 330, panelW - 20, this.seanChar.getCharacterDescription());
    this.drawPassive(seanCX, panelY + 400, 'PASSIVE: Dutch Courage', '#88aaff');
    this.drawPassive(seanCX, panelY + 420, 'SPECIAL: Cloud Cover', '#88ddff');

    // Confirm text
    this.confirmText = createPixelText(this, width / 2, height - 28, 'PRESS ENTER TO CONFIRM', 16, '#ffdd00');

    // Nav hint
    createPixelText(this, width / 2, height - 12, 'A / D  or  ← → to switch', 10, '#666666');

    // Click zones
    this.add.zone(zachX, panelY, panelW, panelH).setOrigin(0, 0).setInteractive()
      .on('pointerdown', () => { this.selected = 'zach'; this.updateSelection(); });
    this.add.zone(seanX, panelY, panelW, panelH).setOrigin(0, 0).setInteractive()
      .on('pointerdown', () => { this.selected = 'sean'; this.updateSelection(); });

    // Double click / tap to confirm
    this.add.zone(zachX, panelY, panelW, panelH).setOrigin(0, 0).setInteractive()
      .on('pointerup', () => { if (this.selected === 'zach') this.confirmSelection(); });
    this.add.zone(seanX, panelY, panelW, panelH).setOrigin(0, 0).setInteractive()
      .on('pointerup', () => { if (this.selected === 'sean') this.confirmSelection(); });

    // Keys
    const cursors = this.input.keyboard!.createCursorKeys();
    const aKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    const dKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    const enterKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    const escKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);

    cursors.left.on('down', () => { this.selected = 'zach'; this.updateSelection(); });
    cursors.right.on('down', () => { this.selected = 'sean'; this.updateSelection(); });
    aKey.on('down', () => { this.selected = 'zach'; this.updateSelection(); });
    dKey.on('down', () => { this.selected = 'sean'; this.updateSelection(); });
    enterKey.on('down', () => this.confirmSelection());
    escKey.on('down', () => this.scene.start('MainMenuScene'));

    this.updateSelection();
  }

  private drawPanel(
    g: Phaser.GameObjects.Graphics,
    x: number, y: number, w: number, h: number,
    color: number, active: boolean
  ): void {
    g.clear();
    // Background
    g.fillStyle(0x111122, 1);
    g.fillRect(x, y, w, h);
    // Border
    g.lineStyle(active ? 3 : 2, active ? color : 0x333355, 1);
    g.strokeRect(x, y, w, h);
    // Inner glow effect
    if (active) {
      g.lineStyle(1, color, 0.3);
      g.strokeRect(x + 3, y + 3, w - 6, h - 6);
    }
  }

  private drawStatBars(
    x: number, y: number, w: number,
    char: ZachCharacter | SeanCharacter
  ): void {
    const barW = w - 60;
    const labels = [
      { label: 'HP   ', value: char.maxHealth, max: 5, color: 0x22cc44 },
      { label: 'SPD  ', value: char.speed / 40, max: 5, color: 0x22aaff },
      { label: 'DMG  ', value: char.damage, max: 5, color: 0xff4422 },
    ];
    labels.forEach((stat, i) => {
      const sy = y + i * 22;
      const statText = this.add.text(x, sy, stat.label, {
        fontFamily: '"Courier New", Courier, monospace',
        fontSize: '11px',
        color: '#aaaaaa',
      });
      statText.setOrigin(0, 0.5);

      // Bar background
      const barX = x + 48;
      const barGfx = this.add.graphics();
      barGfx.fillStyle(0x222233, 1);
      barGfx.fillRect(barX, sy - 5, barW, 10);

      // Filled portion
      const fillRatio = Math.min(stat.value / stat.max, 1);
      barGfx.fillStyle(stat.color, 1);
      barGfx.fillRect(barX, sy - 5, barW * fillRatio, 10);

      // Tick marks
      barGfx.lineStyle(1, 0x444455, 1);
      for (let t = 1; t < stat.max; t++) {
        const tx = barX + (barW / stat.max) * t;
        barGfx.lineBetween(tx, sy - 5, tx, sy + 5);
      }
    });
  }

  private drawDescription(x: number, y: number, w: number, desc: string): void {
    this.add.text(x + w / 2, y, desc, {
      fontFamily: '"Courier New", Courier, monospace',
      fontSize: '11px',
      color: '#888899',
      wordWrap: { width: w },
      align: 'center',
    }).setOrigin(0.5, 0);
  }

  private drawPassive(x: number, y: number, text: string, color: string): void {
    this.add.text(x, y, text, {
      fontFamily: '"Courier New", Courier, monospace',
      fontSize: '11px',
      color: color,
    }).setOrigin(0.5, 0);
  }

  private updateSelection(): void {
    const { width, height } = this.scale;
    const panelY = 90;
    const panelH = height - 130;
    const panelW = width / 2 - 60;
    const zachX = 40;
    const seanX = width / 2 + 20;

    this.drawPanel(this.zachPanel, zachX, panelY, panelW, panelH, 0xcc2222, this.selected === 'zach');
    this.drawPanel(this.seanPanel, seanX, panelY, panelW, panelH, 0x2255cc, this.selected === 'sean');

    // Draw selection arrow
    this.selectionIndicator.clear();
    const arrowX = this.selected === 'zach'
      ? zachX + panelW / 2
      : seanX + panelW / 2;
    const arrowColor = this.selected === 'zach' ? 0xcc2222 : 0x2255cc;
    this.selectionIndicator.fillStyle(arrowColor, 1);
    this.selectionIndicator.fillTriangle(
      arrowX - 8, panelY + 10,
      arrowX + 8, panelY + 10,
      arrowX, panelY + 20
    );
  }

  private confirmSelection(): void {
    const state = GameState.getInstance();
    state.setCharacter(this.selected);
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('WorldSelectScene');
    });
  }

  update(_time: number, delta: number): void {
    this.confirmBlink += delta;
    if (this.confirmBlink > 600) {
      this.confirmBlink = 0;
      this.confirmText.setVisible(!this.confirmText.visible);
    }
  }
}
