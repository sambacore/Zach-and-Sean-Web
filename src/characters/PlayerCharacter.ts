import Phaser from 'phaser';

export abstract class PlayerCharacter {
  name: string;
  color: number;
  speed: number;
  health: number;
  maxHealth: number;
  damage: number;

  protected graphics: Phaser.GameObjects.Graphics | null = null;
  protected scene: Phaser.Scene | null = null;

  constructor(
    name: string,
    color: number,
    speed: number,
    health: number,
    damage: number
  ) {
    this.name = name;
    this.color = color;
    this.speed = speed;
    this.health = health;
    this.maxHealth = health;
    this.damage = damage;
  }

  takeDamage(n: number): void {
    this.health = Math.max(0, this.health - n);
  }

  heal(n: number): void {
    this.health = Math.min(this.maxHealth, this.health + n);
  }

  isAlive(): boolean {
    return this.health > 0;
  }

  applyAbility(name: string): void {
    switch (name) {
      case 'nitroBoost':
        this.speed *= 1.5;
        break;
      case 'bodyArmor':
        this.maxHealth += 2;
        this.health += 2;
        break;
      case 'streetCombo':
        this.damage += 1;
        break;
      default:
        break;
    }
  }

  abstract getCharacterDescription(): string;

  drawCharacterPreview(scene: Phaser.Scene, x: number, y: number, scale: number = 1): Phaser.GameObjects.Graphics {
    const g = scene.add.graphics();
    this.drawPixelBody(g, x, y, scale);
    return g;
  }

  protected drawPixelBody(g: Phaser.GameObjects.Graphics, x: number, y: number, scale: number): void {
    const s = scale * 4;
    // Default blocky pixel body
    g.fillStyle(this.color, 1);
    // Head
    g.fillRect(x - 3 * s, y - 8 * s, 6 * s, 6 * s);
    // Body
    g.fillRect(x - 4 * s, y - 2 * s, 8 * s, 6 * s);
    // Legs
    g.fillRect(x - 3 * s, y + 4 * s, 2 * s, 4 * s);
    g.fillRect(x + 1 * s, y + 4 * s, 2 * s, 4 * s);
    // Arms
    g.fillRect(x - 6 * s, y - 2 * s, 2 * s, 5 * s);
    g.fillRect(x + 4 * s, y - 2 * s, 2 * s, 5 * s);
  }
}
