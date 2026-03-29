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
import { mobileInputState, isMobileBrowser } from './ui/MobileInput';

// ── HTML mobile controls ──────────────────────────────────────────────────────
// Only injected for real mobile browsers; desktop never sees them.
if (isMobileBrowser()) {
  const controls = document.createElement('div');
  controls.id = 'mobile-controls';
  controls.innerHTML = `
    <div id="dpad">
      <button data-key="up"    class="dpad-btn" style="grid-area:up">▲</button>
      <button data-key="left"  class="dpad-btn" style="grid-area:left">◀</button>
      <button data-key="down"  class="dpad-btn" style="grid-area:down">▼</button>
      <button data-key="right" class="dpad-btn" style="grid-area:right">▶</button>
    </div>
    <button id="action-btn">ATK</button>
  `;
  document.body.appendChild(controls);
  controls.style.display = 'flex';

  // Map button key → mobileInputState field
  type InputKey = 'left' | 'right' | 'up' | 'down' | 'action';
  const keyMap: Record<string, InputKey> = {
    left: 'left', right: 'right', up: 'up', down: 'down', action: 'action',
  };

  const setKey = (key: InputKey, val: boolean) => { mobileInputState[key] = val; };

  // D-pad buttons
  controls.querySelectorAll<HTMLButtonElement>('.dpad-btn').forEach(btn => {
    const key = btn.dataset.key as InputKey;
    btn.addEventListener('touchstart', e => { e.preventDefault(); setKey(key, true);  }, { passive: false });
    btn.addEventListener('touchend',   e => { e.preventDefault(); setKey(key, false); }, { passive: false });
    btn.addEventListener('touchcancel',e => { e.preventDefault(); setKey(key, false); }, { passive: false });
  });

  // Action button
  const atk = document.getElementById('action-btn')!;
  atk.addEventListener('touchstart', e => { e.preventDefault(); setKey('action', true);  }, { passive: false });
  atk.addEventListener('touchend',   e => { e.preventDefault(); setKey('action', false); }, { passive: false });
  atk.addEventListener('touchcancel',e => { e.preventDefault(); setKey('action', false); }, { passive: false });
}

// ── Phaser config ─────────────────────────────────────────────────────────────
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  backgroundColor: '#1a1a2e',
  pixelArt: true,
  antialias: false,
  roundPixels: true,
  parent: document.getElementById('game-container') ?? document.body,
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
    autoCenter: Phaser.Scale.NO_CENTER,
    width: 800,
    height: 600,
    expandParent: false,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
};

const game = new Phaser.Game(config);

// Phaser injects inline margin-top/margin-left on the canvas to "center" it.
// We use a MutationObserver to continuously strip those out so the canvas
// stays pinned to the top-left of its container.
function stripPhaserCentering() {
  const container = document.getElementById('game-container');
  const canvas = container?.querySelector<HTMLCanvasElement>('canvas');

  const forceTop = (el: HTMLElement | null) => {
    if (!el) return;
    el.style.setProperty('margin-top', '0', 'important');
    el.style.setProperty('margin-left', '0', 'important');
    el.style.setProperty('margin', '0', 'important');
    el.style.setProperty('top', '0', 'important');
    el.style.setProperty('left', '0', 'important');
    el.style.setProperty('position', 'relative', 'important');
  };

  forceTop(canvas);

  if (canvas) {
    new MutationObserver(() => forceTop(canvas)).observe(canvas, {
      attributes: true,
      attributeFilter: ['style'],
    });
  }
}

game.events.once('ready', stripPhaserCentering);
// Also re-run on scale change (window resize)
game.scale.on('resize', stripPhaserCentering);
