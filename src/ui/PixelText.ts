import Phaser from 'phaser';

export interface PixelTextStyle {
  fontSize?: number;
  color?: string;
  strokeColor?: string;
  strokeWidth?: number;
  shadow?: boolean;
}

export function createPixelText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  size: number = 16,
  color: string = '#ffffff'
): Phaser.GameObjects.Text {
  const textObj = scene.add.text(x, y, text, {
    fontFamily: '"Courier New", Courier, monospace',
    fontSize: `${size}px`,
    color: color,
    stroke: '#000000',
    strokeThickness: Math.max(2, Math.floor(size / 8)),
    shadow: {
      offsetX: 2,
      offsetY: 2,
      color: '#000000',
      blur: 0,
      fill: true,
    },
    resolution: 1,
  });
  textObj.setOrigin(0.5, 0.5);
  return textObj;
}

export function createPixelTextLeft(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  size: number = 16,
  color: string = '#ffffff'
): Phaser.GameObjects.Text {
  const textObj = scene.add.text(x, y, text, {
    fontFamily: '"Courier New", Courier, monospace',
    fontSize: `${size}px`,
    color: color,
    stroke: '#000000',
    strokeThickness: Math.max(2, Math.floor(size / 8)),
    resolution: 1,
  });
  textObj.setOrigin(0, 0.5);
  return textObj;
}

export function createPixelTextWrapped(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  size: number = 12,
  color: string = '#ffffff',
  wordWrapWidth: number = 200
): Phaser.GameObjects.Text {
  const textObj = scene.add.text(x, y, text, {
    fontFamily: '"Courier New", Courier, monospace',
    fontSize: `${size}px`,
    color: color,
    stroke: '#000000',
    strokeThickness: Math.max(1, Math.floor(size / 10)),
    wordWrap: { width: wordWrapWidth },
    align: 'center',
    resolution: 1,
  });
  textObj.setOrigin(0.5, 0);
  return textObj;
}
