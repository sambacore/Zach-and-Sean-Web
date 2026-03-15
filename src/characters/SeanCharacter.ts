import Phaser from 'phaser';
import { PlayerCharacter } from './PlayerCharacter';

export class SeanCharacter extends PlayerCharacter {
  constructor() {
    super('SEAN', 0x2255cc, 200, 3, 1);
  }

  getCharacterDescription(): string {
    return 'Hates cops. Loves chaos. Somehow always gets away.';
  }

  drawCharacterPreview(scene: Phaser.Scene, x: number, y: number, scale: number = 1): Phaser.GameObjects.Graphics {
    const g = scene.add.graphics();
    this.drawSeanSprite(g, x, y, scale);
    return g;
  }

  private drawSeanSprite(g: Phaser.GameObjects.Graphics, x: number, y: number, scale: number): void {
    const s = scale * 4;

    // Shadow
    g.fillStyle(0x000000, 0.3);
    g.fillEllipse(x, y + 9 * s, 8 * s, 2 * s);

    // Boots
    g.fillStyle(0x222244, 1);
    g.fillRect(x - 2.5 * s, y + 7 * s, 2 * s, 2 * s);
    g.fillRect(x + 0.5 * s, y + 7 * s, 2 * s, 2 * s);

    // Legs (slim jeans)
    g.fillStyle(0x334477, 1);
    g.fillRect(x - 2.5 * s, y + 4 * s, 1.5 * s, 4 * s);
    g.fillRect(x + 1 * s, y + 4 * s, 1.5 * s, 4 * s);

    // Slim body (blue hoodie)
    g.fillStyle(0x2255cc, 1);
    g.fillRect(x - 3 * s, y - 2 * s, 6 * s, 7 * s);

    // Hoodie pocket
    g.fillStyle(0x1a44aa, 1);
    g.fillRect(x - 1.5 * s, y + 2 * s, 3 * s, 2 * s);

    // Arms (slim)
    g.fillStyle(0x2255cc, 1);
    g.fillRect(x - 5 * s, y - 2 * s, 2 * s, 4.5 * s);
    g.fillRect(x + 3 * s, y - 2 * s, 2 * s, 4.5 * s);

    // Hands
    g.fillStyle(0xffbb99, 1);
    g.fillRect(x - 5.5 * s, y + 2 * s, 1.5 * s, 1.5 * s);
    g.fillRect(x + 4 * s, y + 2 * s, 1.5 * s, 1.5 * s);

    // Neck
    g.fillStyle(0xffbb99, 1);
    g.fillRect(x - 0.75 * s, y - 3 * s, 1.5 * s, 2 * s);

    // Head (normal size)
    g.fillStyle(0xffbb99, 1);
    g.fillRect(x - 2.5 * s, y - 9 * s, 5 * s, 7 * s);

    // Hair (messy, dark)
    g.fillStyle(0x222222, 1);
    g.fillRect(x - 2.5 * s, y - 9 * s, 5 * s, 2.5 * s);
    // Messy tufts
    g.fillRect(x - 3 * s, y - 9 * s, 1 * s, 1 * s);
    g.fillRect(x + 2 * s, y - 9 * s, 1 * s, 1.5 * s);
    g.fillRect(x - 0.5 * s, y - 9.5 * s, 1 * s, 1 * s);

    // Glasses (rectangular)
    g.fillStyle(0x111111, 1);
    g.fillRect(x - 2.5 * s, y - 6 * s, 2 * s, 0.5 * s); // left frame top
    g.fillRect(x - 2.5 * s, y - 4.5 * s, 2 * s, 0.5 * s); // left frame bottom
    g.fillRect(x - 2.5 * s, y - 6 * s, 0.5 * s, 1.5 * s); // left side
    g.fillRect(x - 1 * s, y - 6 * s, 0.5 * s, 1.5 * s); // left inner
    g.fillRect(x + 0.5 * s, y - 6 * s, 2 * s, 0.5 * s); // right frame top
    g.fillRect(x + 0.5 * s, y - 4.5 * s, 2 * s, 0.5 * s); // right frame bottom
    g.fillRect(x + 0.5 * s, y - 6 * s, 0.5 * s, 1.5 * s); // right inner
    g.fillRect(x + 2 * s, y - 6 * s, 0.5 * s, 1.5 * s); // right side
    // Bridge
    g.fillRect(x - 0.5 * s, y - 5.5 * s, 1 * s, 0.5 * s);

    // Eyes behind glasses
    g.fillStyle(0x000000, 1);
    g.fillRect(x - 2 * s, y - 5.5 * s, 0.75 * s, 0.75 * s);
    g.fillRect(x + 1 * s, y - 5.5 * s, 0.75 * s, 0.75 * s);

    // Beard (scruffy)
    g.fillStyle(0x333333, 1);
    g.fillRect(x - 2 * s, y - 3.5 * s, 4 * s, 1.5 * s);
    // Mustache
    g.fillRect(x - 1.5 * s, y - 4 * s, 3 * s, 0.75 * s);
    // Sideburn stubble
    g.fillRect(x - 2.5 * s, y - 5 * s, 0.75 * s, 2 * s);
    g.fillRect(x + 1.75 * s, y - 5 * s, 0.75 * s, 2 * s);

    // Nose
    g.fillStyle(0xee9977, 1);
    g.fillRect(x - 0.5 * s, y - 4.5 * s, 1 * s, 1 * s);
  }
}
