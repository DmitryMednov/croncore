import { Suspense, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useControls } from 'leva';
import * as THREE from 'three/webgpu';
import {
    uTime,
    uDeltaTime,
    uGlobalHueShift,
    uWindDir,
    uWindScale,
    uWindSpeed,
    uWindStrength,
    uWindFacing,
    uTerrainAmp,
    uTerrainFreq,
    uTerrainSeed,
    uTerrainColor,
} from '../core/shaders/uniforms';
import { CosmicSystem } from './cosmic/CosmicSystem';
import { Terrain } from './Terrain';
import { StarrySky } from './background/StarrySky';
import { useGameStore } from '../core/store/gameStore';
import { AsyncCompile } from '@core';
import Rose from './Rose/Rose';
import GrassWebGPU from './grass/GrassWebGPU';
import { Character } from './character';
import { GrassCullingDebug } from '../debug/GrassCullingDebug';
import { CroncoreBlocks } from './CroncoreBlocks';

export function WorldController() {
    const setActiveTargets = useGameStore((state) => state.setActiveTargets);
    const setComponentReady = useGameStore((state) => state.setComponentReady);
    const { scene } = useThree();

    const debugMode = new URLSearchParams(window.location.search).get('debug') === 'true';

    // Some R3F deps (camera-controls debug helpers etc.) silently mount
    // Line2 / LineSegments2 objects that ride on the classic LineMaterial.
    // The WebGPU node renderer can't translate it, warns "Material
    // 'LineMaterial' is not compatible", and then emits drawIndexed with
    // Infinity every frame — black screen + console spam. Walk the scene
    // a few times after mount and hide any such object so the renderer
    // skips it entirely.
    useEffect(() => {
        const sweep = () => {
            let hidden = 0;
            scene.traverse((obj: any) => {
                const isBadLine = obj?.isLine2 || obj?.isLineSegments2;
                const mat = obj?.material;
                const isBadMat = mat && (mat.type === 'LineMaterial' || mat.isLineMaterial);
                if (isBadLine || isBadMat) {
                    if (obj.visible) {
                        obj.visible = false;
                        hidden++;
                    }
                }
            });
            if (hidden > 0) {
                console.info(`[Croncore] hid ${hidden} LineMaterial object(s) the WebGPU pipeline can't render.`);
            }
        };
        sweep();
        const tids = [250, 1000, 3000].map((ms) => setTimeout(sweep, ms));
        return () => tids.forEach(clearTimeout);
    }, [scene]);

    // Enable eruda console only in debug mode (?debug=true)
    useEffect(() => {
        if (!debugMode) return;

        let cancelled = false;

        (async () => {
            try {
                const mod = await import('eruda');
                if (cancelled) return;
                const eruda: any = (mod as any).default ?? mod;
                if (typeof eruda.init === 'function') {
                    eruda.init();
                }
            } catch (e) {
                console.error('Failed to initialize eruda', e);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [debugMode]);

    const { enableEnv, enableRose, enableGrass, enableCharacter, enableGrassDebug, enableCroncore } = useControls('Game.Content', {
        enableEnv: { value: true, label: 'Environment' },
        enableCharacter: { value: true, label: '👤 Character' },
        enableRose: { value: true, label: '🌹 Rose Field' },
        enableGrass: { value: true, label: '🌿 Grass Field' },
        enableGrassDebug: { value: false, label: '🌿 Grass Culling Debug' },
        enableCroncore: { value: true, label: '🏛 Croncore Blocks' },
    }, { collapsed: true });


    const { timeScale, globalHue } = useControls('Game.System', {
        timeScale: { value: 1.0, min: 0.0, max: 2.0, label: 'Game Speed' },
        globalHue: { value: 0.0, min: 0.0, max: 1.0, label: 'Global Hue' },
    });

    const [windParams] = useControls('Game.Wind', () => ({
        windDirX: { value: 1, min: -1, max: 1, step: 0.01 },
        windDirZ: { value: -0.8, min: -1, max: 1, step: 0.01 },
        windSpeed: { value: uWindSpeed.value, min: 0, max: 3, step: 0.01 },
        windStrength: { value: uWindStrength.value, min: 0, max: 10, step: 0.01 },
        windScale: { value: uWindScale.value, min: 0.01, max: 1, step: 0.01 },
        windFacing: { value: uWindFacing.value, min: 0.0, max: 1.0, step: 0.01 },
    }), { collapsed: true });

    const [terrainParams] = useControls('Game.Terrain', () => ({
        amplitude: { value: uTerrainAmp.value, min: 0.1, max: 3.0, step: 0.1 },
        frequency: { value: uTerrainFreq.value, min: 0.01, max: 0.1, step: 0.01 },
        seed: { value: uTerrainSeed.value, min: 0.0, max: 100.0, step: 0.1 },
        color: { value: '#000000' },
    }), { collapsed: true });

    useEffect(() => {
        uWindDir.value.set(windParams.windDirX, windParams.windDirZ);
        uWindScale.value = windParams.windScale;
        uWindSpeed.value = windParams.windSpeed;
        uWindStrength.value = windParams.windStrength;
        uWindFacing.value = windParams.windFacing;
    }, [windParams]);

    useEffect(() => {
        uTerrainAmp.value = terrainParams.amplitude;
        uTerrainFreq.value = terrainParams.frequency;
        uTerrainSeed.value = terrainParams.seed;
        const c = new THREE.Color(terrainParams.color);
        uTerrainColor.value.set(c.r, c.g, c.b);
    }, [terrainParams]);

    useEffect(() => {
        const targets: string[] = [];
        if (enableRose) targets.push('rose');
        if (enableGrass) targets.push('grass');
        if (enableCharacter) targets.push('character');
        setActiveTargets(targets);
    }, [enableRose, enableGrass, enableCharacter, setActiveTargets]);

    useFrame((_state, rawDelta) => {
        const delta = Math.min(rawDelta, 0.1);
        uGlobalHueShift.value = globalHue;

        uTime.value += delta * timeScale;
        uDeltaTime.value = delta * timeScale;
    });

    return <>
        {/* Environment - use group visibility to avoid remounting */}
        <Suspense fallback={null}>
            <group visible={enableEnv}>
                <StarrySky />
                <CosmicSystem />
                <Terrain />
            </group>

            {/* Major components - toggle visibility instead of unmounting */}
            <AsyncCompile id="rose" onReady={setComponentReady} debug={debugMode}>
                <Rose count={2000} visible={enableRose} />
            </AsyncCompile>

            <AsyncCompile id="grass" onReady={setComponentReady} debug={debugMode}>
                {enableGrassDebug && <GrassCullingDebug />}
                {!enableGrassDebug && <GrassWebGPU visible={enableGrass} />}
            </AsyncCompile>


            <AsyncCompile id="character" onReady={setComponentReady} debug={debugMode}>
                <Character position={[0, 0, 0]} scale={1} visible={enableCharacter} />
            </AsyncCompile>

            <CroncoreBlocks visible={enableCroncore} />
        </Suspense>
    </>
}