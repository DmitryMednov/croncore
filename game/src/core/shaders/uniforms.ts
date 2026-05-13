import { uniform, vec2, vec3 } from "three/tsl";
import type { StorageBufferAttribute } from "three/webgpu";

export const uTime = uniform(0.0);
export const uDeltaTime = uniform(0.016);
export const uGlobalHueShift = uniform(0.0);

// Wind
const WIND_DEFAULT_DIR = vec2(1.0, -0.8);
const WIND_DEFAULT_SCALE = 0.1;
const WIND_DEFAULT_SPEED = 0.35;
const WIND_DEFAULT_STRENGTH = 4.5;
const WIND_DEFAULT_FACING = 1.0;

export const uWindDir = uniform(WIND_DEFAULT_DIR);
export const uWindScale = uniform(WIND_DEFAULT_SCALE);
export const uWindSpeed = uniform(WIND_DEFAULT_SPEED);
export const uWindStrength = uniform(WIND_DEFAULT_STRENGTH);
export const uWindFacing = uniform(WIND_DEFAULT_FACING);

// Terrain
const TERRAIN_DEFAULT_AMP = 1.5;
const TERRAIN_DEFAULT_FREQ = 0.05;
const TERRAIN_DEFAULT_SEED = 0.0;

export const uTerrainAmp = uniform(TERRAIN_DEFAULT_AMP);
export const uTerrainFreq = uniform(TERRAIN_DEFAULT_FREQ);
export const uTerrainSeed = uniform(TERRAIN_DEFAULT_SEED);
export const uTerrainColor = uniform(vec3(0, 0, 0));


// Cosmic Wave System
export const uActiveWaveCount = uniform(0);
export const GlobalWaveState = {
  buffer: null as StorageBufferAttribute | null,
};