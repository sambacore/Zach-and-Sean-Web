import Phaser from 'phaser';
import { PlayerCharacter } from './PlayerCharacter';

export class ZachCharacter extends PlayerCharacter {
  constructor() {
    super('ZACH', 0xcc2222, 120, 5, 3);
  }

  getCharacterDescription(): string {
    return "Built different. Hits different. Has a plan you won't like.";
  }

  drawCharacterPreview(scene: Phaser.Scene, x: number, y: number, scale: number = 1): Phaser.GameObjects.Graphics {
    const g = scene.add.graphics();
    this.drawZachSprite(g, x, y, scale);
    return g;
  }

  private drawZachSprite(g: Phaser.GameObjects.Graphics, x: number, y: number, scale: number): void {
    const s = scale * 4;

    // Shadow
    g.fillStyle(0x000000, 0.3);
    g.fillEllipse(x, y + 9 * s, 10 * s, 2 * s);

    // Boots (dark)
    g.fillStyle(0x333333, 1);
    g.fillRect(x - 3 * s, y + 7 * s, 2.5 * s, 2 * s);
    g.fillRect(x + 0.5 * s, y + 7 * s, 2.5 * s, 2 * s);

    // Legs (dark pants)
    g.fillStyle(0x551111, 1);
    g.fillRect(x - 3 * s, y + 4 * s, 2 * s, 4 * s);
    g.fillRect(x + 1 * s, y + 4 * s, 2 * s, 4 * s);

    // Chunky body (red jacket)
    g.fillStyle(0xcc2222, 1);
    g.fillRect(x - 4 * s, y - 2 * s, 8 * s, 7 * s);

    // Chest detail stripe
    g.fillStyle(0xff4444, 1);
    g.fillRect(x - 0.5 * s, y - 1.5 * s, 1 * s, 5 * s);

    // Arms (chunky)
    g.fillStyle(0xcc2222, 1);
    g.fillRect(x - 6 * s, y - 2 * s, 2.5 * s, 5 * s);
    g.fillRect(x + 3.5 * s, y - 2 * s, 2.5 * s, 5 * s);

    // Fists
    g.fillStyle(0xffaa88, 1);
    g.fillRect(x - 6.5 * s, y + 2.5 * s, 2 * s, 2 * s);
    g.fillRect(x + 4.5 * s, y + 2.5 * s, 2 * s, 2 * s);

    // Neck
    g.fillStyle(0xffaa88, 1);
    g.fillRect(x - 1 * s, y - 3 * s, 2 * s, 2 * s);

    // Head (wide)
    g.fillStyle(0xffaa88, 1);
    g.fillRect(x - 3.5 * s, y - 9 * s, 7 * s, 7 * s);

    // Hair (dark, buzz cut)
    g.fillStyle(0x331111, 1);
    g.fillRect(x - 3.5 * s, y - 9 * s, 7 * s, 2 * s);

    // Eyes
    g.fillStyle(0x000000, 1);
    g.fillRect(x - 2 * s, y - 5.5 * s, 1 * s, 1 * s);
    g.fillRect(x + 1 * s, y - 5.5 * s, 1 * s, 1 * s);

    // Nose
    g.fillStyle(0xee8866, 1);
    g.fillRect(x - 0.5 * s, y - 4 * s, 1 * s, 1 * s);

    // Mouth (stern)
    g.fillStyle(0x884444, 1);
    g.fillRect(x - 2 * s, y - 3 * s, 4 * s, 0.5 * s);

    // Stubble
    g.fillStyle(0x662222, 1);
    g.fillRect(x - 2 * s, y - 3.5 * s, 1 * s, 0.5 * s);
    g.fillRect(x + 1 * s, y - 3.5 * s, 1 * s, 0.5 * s);
  }
}
