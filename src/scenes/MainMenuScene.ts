import Phaser from 'phaser';
import { createPixelText } from '../ui/PixelText';

export class MainMenuScene extends Phaser.Scene {
  private blinkText!: Phaser.GameObjects.Text;
  private blinkTimer: number = 0;
  private stars: Array<{ x: number; y: number; size: number; speed: number }> = [];
  private starGraphics!: Phaser.GameObjects.Graphics;
  private scanlineGraphics!: Phaser.GameObjects.Graphics;

  constructor() {
    super({ key: 'MainMenuScene' });
  }

  create(): void {
    const { width, height } = this.scale;

    // Deep background gradient effect
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x1a1a2e, 0x1a1a2e, 0x0d0d1f, 0x0d0d1f, 1);
    bg.fillRect(0, 0, width, height);

    // Generate stars
    this.starGraphics = this.add.graphics();
    for (let i = 0; i < 80; i++) {
      this.stars.push({
        x: Phaser.Math.Between(0, width),
        y: Phaser.Math.Between(0, height * 0.6),
        size: Math.random() < 0.2 ? 2 : 1,
        speed: 0.1 + Math.random() * 0.3,
      });
    }

    // Pixel-art cityscape
    this.drawCityscape(width, height);

    // Scanline overlay
    this.scanlineGraphics = this.add.graphics();
    this.scanlineGraphics.setAlpha(0.08);
    for (let y = 0; y < height; y += 4) {
      this.scanlineGraphics.fillStyle(0x000000, 1);
      this.scanlineGraphics.fillRect(0, y, width, 2);
    }
    this.scanlineGraphics.setDepth(100);

    // Title — "ZACH AND SEAN" split color
    const titleY = height * 0.22;

    // Red part: "ZACH"
    const zachText = this.add.text(width * 0.5 - 10, titleY, 'ZACH', {
      fontFamily: '"Courier New", Courier, monospace',
      fontSize: '52px',
      color: '#cc2222',
      stroke: '#000000',
      strokeThickness: 6,
      shadow: { offsetX: 3, offsetY: 3, color: '#440000', blur: 0, fill: true },
    });
    zachText.setOrigin(1, 0.5);

    const andText = createPixelText(this, width * 0.5, titleY + 30, 'AND', 18, '#aaaaaa');

    // Blue part: "SEAN"
    const seanText = this.add.text(width * 0.5 + 10, titleY, 'SEAN', {
      fontFamily: '"Courier New", Courier, monospace',
      fontSize: '52px',
      color: '#2255cc',
      stroke: '#000000',
      strokeThickness: 6,
      shadow: { offsetX: 3, offsetY: 3, color: '#000044', blur: 0, fill: true },
    });
    seanText.setOrigin(0, 0.5);

    void andText;

    // "VS COPS" subtitle
    const vsText = this.add.text(width * 0.5, titleY + 72, 'VS COPS', {
      fontFamily: '"Courier New", Courier, monospace',
      fontSize: '36px',
      color: '#ffdd00',
      stroke: '#000000',
      strokeThickness: 5,
      shadow: { offsetX: 2, offsetY: 2, color: '#554400', blur: 0, fill: true },
    });
    vsText.setOrigin(0.5, 0.5);

    // Decorative line
    const lineGfx = this.add.graphics();
    lineGfx.lineStyle(2, 0x555555, 1);
    lineGfx.lineBetween(width * 0.15, titleY + 110, width * 0.85, titleY + 110);

    // Blinking start text
    this.blinkText = createPixelText(
      this,
      width * 0.5,
      height * 0.72,
      'PRESS ENTER TO START',
      20,
      '#ffffff'
    );

    // Controls hint
    createPixelText(this, width * 0.5, height * 0.8, 'ALSO: TAP OR CLICK', 12, '#888888');

    // Credits
    createPixelText(
      this,
      width * 0.5,
      height - 20,
      'ZACH AND SEAN PRODUCTIONS  2024',
      10,
      '#555555'
    );

    // Keyboard input
    const enterKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    const spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    enterKey.on('down', () => this.startGame());
    spaceKey.on('down', () => this.startGame());

    // Touch/click input
    this.input.on('pointerdown', () => this.startGame());

    // Title bounce animation
    this.tweens.add({
      targets: [zachText, seanText],
      y: titleY - 5,
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.tweens.add({
      targets: vsText,
      scaleX: 1.05,
      scaleY: 1.05,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private drawCityscape(width: number, height: number): void {
    const g = this.add.graphics();
    const groundY = height * 0.88;

    // Moon
    g.fillStyle(0xddddaa, 1);
    g.fillCircle(width * 0.85, height * 0.12, 28);
    g.fillStyle(0x0d0d1f, 1);
    g.fillCircle(width * 0.87, height * 0.10, 22);

    // Background buildings (dark, far)
    const bgBuildings = [
      { x: 20, w: 60, h: 140 },
      { x: 90, w: 45, h: 100 },
      { x: 145, w: 70, h: 170 },
      { x: 225, w: 50, h: 120 },
      { x: 285, w: 80, h: 190 },
      { x: 375, w: 55, h: 150 },
      { x: 440, w: 65, h: 110 },
      { x: 515, w: 90, h: 200 },
      { x: 615, w: 60, h: 160 },
      { x: 685, w: 50, h: 130 },
      { x: 745, w: 55, h: 180 },
    ];

    bgBuildings.forEach(b => {
      g.fillStyle(0x1a1a33, 1);
      g.fillRect(b.x, groundY - b.h, b.w, b.h);
      // Windows
      g.fillStyle(0x334466, 1);
      for (let wy = groundY - b.h + 10; wy < groundY - 10; wy += 14) {
        for (let wx = b.x + 5; wx < b.x + b.w - 5; wx += 12) {
          if (Math.random() > 0.4) {
            const winColor = Math.random() > 0.7 ? 0xffee88 : (Math.random() > 0.5 ? 0x88aaff : 0x334466);
            g.fillStyle(winColor, 1);
            g.fillRect(wx, wy, 6, 8);
          }
        }
      }
    });

    // Foreground buildings (silhouette)
    const fgBuildings = [
      { x: 0, w: 80, h: 220 },
      { x: 90, w: 60, h: 180 },
      { x: 160, w: 100, h: 260 },
      { x: 270, w: 70, h: 200 },
      { x: 350, w: 120, h: 280 },
      { x: 480, w: 80, h: 220 },
      { x: 570, w: 60, h: 190 },
      { x: 640, w: 90, h: 250 },
      { x: 740, w: 60, h: 210 },
    ];

    fgBuildings.forEach(b => {
      g.fillStyle(0x0a0a18, 1);
      g.fillRect(b.x, groundY - b.h, b.w, b.h);
      // Lit windows
      for (let wy = groundY - b.h + 12; wy < groundY - 8; wy += 16) {
        for (let wx = b.x + 6; wx < b.x + b.w - 6; wx += 14) {
          if (Math.random() > 0.5) {
            const c = Math.random() > 0.6 ? 0xffee99 : (Math.random() > 0.5 ? 0x88bbff : 0x334455);
            g.fillStyle(c, 1);
            g.fillRect(wx, wy, 7, 9);
          }
        }
      }
    });

    // Ground / street
    g.fillStyle(0x111122, 1);
    g.fillRect(0, groundY, width, height - groundY);

    // Street lines
    g.fillStyle(0x222233, 1);
    g.fillRect(0, groundY, width, 3);

    // Street light
    g.fillStyle(0x444455, 1);
    g.fillRect(width * 0.3 - 2, groundY - 80, 4, 80);
    g.fillStyle(0x333344, 1);
    g.fillRect(width * 0.3 - 15, groundY - 80, 17, 5);
    g.fillStyle(0xffee88, 0.8);
    g.fillCircle(width * 0.3 - 8, groundY - 82, 5);

    g.fillStyle(0x444455, 1);
    g.fillRect(width * 0.7 - 2, groundY - 80, 4, 80);
    g.fillStyle(0x333344, 1);
    g.fillRect(width * 0.7 - 2, groundY - 80, 17, 5);
    g.fillStyle(0xffee88, 0.8);
    g.fillCircle(width * 0.7 + 10, groundY - 82, 5);
  }

  private startGame(): void {
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('CharacterSelectScene');
    });
  }

  update(time: number, delta: number): void {
    // Blink effect
    this.blinkTimer += delta;
    if (this.blinkTimer > 600) {
      this.blinkTimer = 0;
      this.blinkText.setVisible(!this.blinkText.visible);
    }

    // Twinkle stars
    this.starGraphics.clear();
    this.stars.forEach(star => {
      star.x -= star.speed;
      if (star.x < 0) star.x = this.scale.width;
      const alpha = 0.5 + Math.sin(time * 0.001 * star.speed * 10 + star.x) * 0.5;
      this.starGraphics.fillStyle(0xffffff, alpha);
      this.starGraphics.fillRect(star.x, star.y, star.size, star.size);
    });
  }
}
