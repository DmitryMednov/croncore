import { InputSystem } from '@core';

export type GameAction = 'MoveForward' | 'MoveBackward' | 'RotateLeft' | 'RotateRight' | 'Run' | 'Jump';

export const input = new InputSystem<GameAction>();

export const keyBindings: Record<string, GameAction> = {
  KeyW: 'MoveForward', ArrowUp: 'MoveForward',
  KeyS: 'MoveBackward', ArrowDown: 'MoveBackward',
  KeyA: 'RotateLeft', ArrowLeft: 'RotateLeft',
  KeyD: 'RotateRight', ArrowRight: 'RotateRight',
  ShiftLeft: 'Run', ShiftRight: 'Run',
  Space: 'Jump'
};