import Phaser from 'phaser';
import { mobileInputState, isMobileBrowser } from './MobileInput';

export interface MobileState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  action: boolean;
  upJustDown: boolean;
  actionJustDown: boolean;
}

export class MobileControls {
  readonly isTouch: boolean;

  private _state: MobileState = {
    left: false, right: false, up: false, down: false,
    action: false, upJustDown: false, actionJustDown: false,
  };

  constructor(scene: Phaser.Scene) {
    this.isTouch = scene.sys.game.device.input.touch && isMobileBrowser();
  }

  get state(): Readonly<MobileState> {
    return this._state;
  }

  update(): void {
    if (!this.isTouch) return;

    const prevUp     = this._state.up;
    const prevAction = this._state.action;

    this._state.left   = mobileInputState.left;
    this._state.right  = mobileInputState.right;
    this._state.up     = mobileInputState.up;
    this._state.down   = mobileInputState.down;
    this._state.action = mobileInputState.action;
    this._state.upJustDown     = this._state.up && !prevUp;
    this._state.actionJustDown = this._state.action && !prevAction;
  }

  /** No-op – controls are now HTML elements, nothing to destroy in-scene. */
  destroy(): void {}
}
