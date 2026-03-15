import Phaser from 'phaser';
import { createPixelText } from '../ui/PixelText';

interface GameOverData {
  worldNumber?: number;
  worldName?: string;
  retryScene?: string;
}

export class GameOverScene extends Phaser.Scene {
  private selectedOption: number = 0;
  private options: Phaser.GameObjects.Text[] = [];
  private retrySceneKey: string = 'WorldSelectScene';
  private worldNumber: number = 1;
  private worldName: string = '';
  private blinkTimer: number = 0;

  constructor() {
    super({ key: 'GameOverScene' });
  }

  init(data: GameOverData): void {
    this.worldNumber = data.worldNumber ?? 1;
    this.worldName = data.worldName ?? 'UNKNOWN';
    this.retrySceneKey = data.retryScene ?? 'WorldSelectScene';
  }

  create(): void {
    const { width, height } = this.scale;

    this.cameras.main.fadeIn(400, 0, 0, 0);

    // Background
    const bg = this.add.graphics();
    bg.fillStyle(0x0a0005, 1);
    bg.fillRect(0, 0, width, height);

    // Red scanlines
    const scan = this.add.graphics();
    scan.setAlpha(0.06);
    for (let y = 0; y < height; y += 4) {
      scan.fillStyle(0xff0000, 1);
      scan.fillRect(0, y, width, 2);
    }

    // GAME OVER
    const goText = this.add.text(width / 2, height * 0.28, 'GAME OVER', {
      fontFamily: '"Courier New", Courier, monospace',
      fontSize: '64px',
      color: '#cc0000',
      stroke: '#000000',
      strokeThickness: 8,
      shadow: { offsetX: 4, offsetY: 4, color: '#440000', blur: 0, fill: true },
    });
    goText.setOrigin(0.5, 0.5);

    // Flash animation
    this.tweens.add({
      targets: goText,
      alpha: 0.6,
      duration: 400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // World info
    createPixelText(
      this,
      width / 2,
      height * 0.47,
      `BUSTED ON: WORLD ${this.worldNumber} — ${this.worldName}`,
      14,
      '#884444'
    );

    createPixelText(this, width / 2, height * 0.54, 'YOU WERE NOT BUILT DIFFERENT', 12, '#663333');

    // Divider
    const lineGfx = this.add.graphics();
    lineGfx.lineStyle(1, 0x440000, 1);
    lineGfx.lineBetween(width * 0.2, height * 0.62, width * 0.8, height * 0.62);

    // Options
    const optionLabels = [
      `[R] RETRY WORLD ${this.worldNumber}`,
      '[W] WORLD SELECT',
      '[M] MAIN MENU',
    ];

    this.options = optionLabels.map((label, i) => {
      return createPixelText(
        this,
        width / 2,
        height * 0.68 + i * 36,
        label,
        18,
        '#888888'
      );
    });

    // Keys
    const rKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    const wKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    const mKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.M);
    const cursors = this.input.keyboard!.createCursorKeys();
    const enterKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);

    rKey.on('down', () => this.retry());
    wKey.on('down', () => this.goToWorldSelect());
    mKey.on('down', () => this.goToMainMenu());

    cursors.up.on('down', () => {
      this.selectedOption = Math.max(0, this.selectedOption - 1);
    });
    cursors.down.on('down', () => {
      this.selectedOption = Math.min(this.options.length - 1, this.selectedOption + 1);
    });
    enterKey.on('down', () => {
      if (this.selectedOption === 0) this.retry();
      else if (this.selectedOption === 1) this.goToWorldSelect();
      else this.goToMainMenu();
    });

    // Click handlers
    this.options.forEach((opt, i) => {
      opt.setInteractive({ useHandCursor: true });
      opt.on('pointerdown', () => {
        this.selectedOption = i;
        if (i === 0) this.retry();
        else if (i === 1) this.goToWorldSelect();
        else this.goToMainMenu();
      });
      opt.on('pointerover', () => { this.selectedOption = i; });
    });

    // Credits line
    createPixelText(this, width / 2, height - 16, '"You Can\'t Win" — Zach & Sean', 10, '#333333');
  }

  private retry(): void {
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(this.retrySceneKey);
    });
  }

  private goToWorldSelect(): void {
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('WorldSelectScene');
    });
  }

  private goToMainMenu(): void {
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('MainMenuScene');
    });
  }

  update(_time: number, delta: number): void {
    this.blinkTimer += delta;
    if (this.blinkTimer > 300) {
      this.blinkTimer = 0;
      this.options.forEach((opt, i) => {
        if (i === this.selectedOption) {
          opt.setColor('#ffdd00');
          opt.setScale(1.05);
        } else {
          opt.setColor('#888888');
          opt.setScale(1);
        }
      });
    }
  }
}
