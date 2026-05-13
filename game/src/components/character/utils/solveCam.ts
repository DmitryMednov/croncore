import * as THREE from 'three/webgpu';
import { Group, Camera, Euler } from 'three';
import { PhysicsState } from '../config';
import { input } from '../../../core/input/controls';

const getShortestAngleDifference = (from: number, to: number) => {
  const delta = to - from;
  return Math.atan2(Math.sin(delta), Math.cos(delta));
};

const tempEuler = new Euler(0, 0, 0, 'YXZ');

/**
 * SOLVER: CAMERA MODE (Camera Relative)
 * Input Vector determines Target Angle relative to Camera.
 * Always moves "Forward" relative to the character model.
 */
export const solveCam = (
  group: Group,
  camera: Camera,
  s: PhysicsState,
  delta: number
) => {

  const moveForward = input.isPressed('MoveForward')
  const moveBackward = input.isPressed('MoveBackward')
  const rotateLeft = input.isPressed('RotateLeft')
  const rotateRight = input.isPressed('RotateRight')
  const run = input.isPressed('Run')
  const joyX = input.getAxis('horizontal');
  const joyY = input.getAxis('vertical');

  // 1. Calculate Input Vector (ix, iy)
  let ix = 0;
  let iy = 0;

  // Priority: Joystick > Keyboard
  if (Math.abs(joyX) > 0.01 || Math.abs(joyY) > 0.01) {
    ix = joyX;
    iy = joyY;
  } else {
    // Map WASD to Vector
    if (rotateLeft) ix -= 1;
    if (rotateRight) ix += 1;
    if (moveForward) iy += 1;
    if (moveBackward) iy -= 1;
  }

  const inputLen = Math.sqrt(ix * ix + iy * iy);

  // 2. Logic
  let targetSpeed = 0;

  if (inputLen > 0.1) {
    // A. Calculate Target Angle relative to Camera
    // FIX: Using (ix, iy) maps Forward Input to Forward Angle (0 rads).
    // (Previous version used -iy which reversed controls)
    const inputAngle = Math.atan2(ix, -iy);

    tempEuler.setFromQuaternion(camera.quaternion);
    const camAngle = tempEuler.y;

    const targetRotation = camAngle + inputAngle;

    // B. Smooth Rotate
    const currentRotation = group.rotation.y;
    const diff = getShortestAngleDifference(currentRotation, targetRotation);

    // Use a multiplier for TPV to make it snappier than FPV
    // 4.0 feels good for 3rd person control
    const tpvRotateMultiplier = 3.0; 
    group.rotation.y += diff * delta * tpvRotateMultiplier;

    // C. Move Forward
    // In TPV, we always move positive Z (Forward) relative to the model
    const maxSpeed = run ? s.runSpeed : s.walkSpeed;
    targetSpeed = maxSpeed * Math.min(inputLen, 1.0);
  }

  // D. Apply Speed
  s.speed = THREE.MathUtils.lerp(s.speed, targetSpeed, s.speedLerpFactor);

  if (Math.abs(s.speed) > 0.01) {
    group.translateZ(s.speed * delta);
  }

  // Reset Rotation Velocity (Clean up state from FPV mode)
  s.rotationVelocity = 0;
};