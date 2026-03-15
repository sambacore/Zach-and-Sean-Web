import Phaser from 'phaser';
import { MainMenuScene } from './scenes/MainMenuScene';
import { CharacterSelectScene } from './scenes/CharacterSelectScene';
import { WorldSelectScene } from './scenes/WorldSelectScene';
import { GameOverScene } from './scenes/GameOverScene';
import { TrafficScene } from './worlds/World1_Traffic/TrafficScene';
import { ViceScene } from './worlds/World2_Vice/ViceScene';
import { SWATScene } from './worlds/World3_SWAT/SWATScene';
import { HomicideScene } from './worlds/World4_Homicide/HomicideScene';
import { SVUScene } from './worlds/World5_SVU/SVUScene';
import { NarcoticsScene } from './worlds/World6_Narcotics/NarcoticsScene';
import { K9Scene } from './worlds/World7_K9/K9Scene';
import { InternalAffairsScene } from './worlds/World8_InternalAffairs/InternalAffairsScene';
import { PrecinctScene } from './worlds/World9_Precinct/PrecinctScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  backgroundColor: '#1a1a2e',
  pixelArt: true,
  antialias: false,
  roundPixels: true,
  parent: document.body,
  scene: [
    MainMenuScene,
    CharacterSelectScene,
    WorldSelectScene,
    GameOverScene,
    TrafficScene,
    ViceScene,
    SWATScene,
    HomicideScene,
    SVUScene,
    NarcoticsScene,
    K9Scene,
    InternalAffairsScene,
    PrecinctScene,
  ],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 800,
    height: 600,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
};

new Phaser.Game(config);
