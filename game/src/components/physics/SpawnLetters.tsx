import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three/webgpu';
import {
    Physics,
    RigidBody,
    CuboidCollider,
    CapsuleCollider,
    RapierRigidBody,
} from '@react-three/rapier';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { useGameStore } from '../../core/store/gameStore';

/**
 * Bruno-Simon-style physics playground at spawn: the word CRONCORE built
 * from chunky "pixel" letters the astronaut can shove around. Each letter
 * is one dynamic rapier body with a cuboid collider; the character pushes
 * them via a kinematic capsule that follows its world position (the
 * character itself is not physics-driven, so this is a one-way coupling —
 * exactly what we want: letters can never block the player).
 */

/* 5x7 pixel glyphs — only the letters we need for "CRONCORE". */
const GLYPHS: Record<string, string[]> = {
    C: [
        '.###.',
        '#...#',
        '#....',
        '#....',
        '#....',
        '#...#',
        '.###.',
    ],
    R: [
        '####.',
        '#...#',
        '#...#',
        '####.',
        '#.#..',
        '#..#.',
        '#...#',
    ],
    O: [
        '.###.',
        '#...#',
        '#...#',
        '#...#',
        '#...#',
        '#...#',
        '.###.',
    ],
    N: [
        '#...#',
        '##..#',
        '#.#.#',
        '#..##',
        '#...#',
        '#...#',
        '#...#',
    ],
    E: [
        '#####',
        '#....',
        '####.',
        '#....',
        '#....',
        '#....',
        '#####',
    ],
};

const WORD = 'CRONCORE';
const CELL = 0.17;          // size of one "pixel" cube
const DEPTH = 0.34;         // letter thickness
const LETTER_H = 7 * CELL;  // 1.19
const SPACING = 1.15;       // gap between letter centres along the line
const LINE_X = 5.5;         // in front of spawn, in view of the intro camera
const IMPULSE_LIMIT = 40;   // keep stray physics explosions in check

function buildLetterGeometry(char: string): THREE.BufferGeometry | null {
    const rows = GLYPHS[char];
    if (!rows) return null;
    const parts: THREE.BufferGeometry[] = [];
    for (let r = 0; r < rows.length; r++) {
        for (let c = 0; c < rows[r].length; c++) {
            if (rows[r][c] !== '#') continue;
            const box = new THREE.BoxGeometry(CELL, CELL, DEPTH);
            box.translate(
                (c - 2) * CELL,            // centre the 5 columns
                (3 - r) * CELL,            // row 0 is the top
                0
            );
            parts.push(box);
        }
    }
    const merged = mergeGeometries(parts, false);
    parts.forEach((p) => p.dispose());
    return merged;
}

/** Kinematic capsule glued to the astronaut so it can shove the letters. */
function CharacterPusher() {
    const characterRef = useGameStore((state) => state.characterRef);
    const bodyRef = useRef<RapierRigidBody>(null);

    useFrame(() => {
        const char = characterRef?.current;
        const body = bodyRef.current;
        if (!char || !body) return;
        body.setNextKinematicTranslation({
            x: char.position.x,
            y: char.position.y + 0.9,
            z: char.position.z,
        });
    });

    return (
        <RigidBody ref={bodyRef} type="kinematicPosition" colliders={false}>
            <CapsuleCollider args={[0.5, 0.38]} />
        </RigidBody>
    );
}

function Letter({ char, index, material }: { char: string; index: number; material: THREE.Material }) {
    const geometry = useMemo(() => buildLetterGeometry(char), [char]);
    const bodyRef = useRef<RapierRigidBody>(null);
    if (!geometry) return null;

    const z = (index - (WORD.length - 1) / 2) * SPACING;

    return (
        <RigidBody
            ref={bodyRef}
            colliders="cuboid"
            position={[LINE_X, LETTER_H / 2 + 0.02, z]}
            rotation={[0, -Math.PI / 2, 0]}
            friction={0.9}
            restitution={0.15}
            linearDamping={0.35}
            angularDamping={0.7}
            onContactForce={(payload) => {
                // Safety valve: clamp runaway velocities from deep-penetration frames.
                const body = bodyRef.current;
                if (!body) return;
                const v = body.linvel();
                const speed = Math.hypot(v.x, v.y, v.z);
                if (speed > IMPULSE_LIMIT) {
                    const s = IMPULSE_LIMIT / speed;
                    body.setLinvel({ x: v.x * s, y: v.y * s, z: v.z * s }, true);
                }
                void payload;
            }}
        >
            <mesh geometry={geometry} material={material} />
        </RigidBody>
    );
}

export function SpawnLetters({ visible = true }: { visible?: boolean }) {
    const isControlEnabled = useGameStore((state) => state.isControlEnabled);

    const material = useMemo(
        () =>
            new THREE.MeshStandardMaterial({
                color: '#10241a',
                emissive: '#2c6c4e',
                emissiveIntensity: 0.7,
                metalness: 0.2,
                roughness: 0.35,
            }),
        []
    );

    if (!visible) return null;

    return (
        <Physics gravity={[0, -14, 0]} timeStep="vary" paused={!isControlEnabled}>
            {/* Invisible flat ground under the spawn plain (character walks at y=0). */}
            <RigidBody type="fixed" colliders={false}>
                <CuboidCollider args={[40, 0.5, 40]} position={[0, -0.5, 0]} />
            </RigidBody>

            <CharacterPusher />

            {WORD.split('').map((char, i) => (
                <Letter key={`${char}-${i}`} char={char} index={i} material={material} />
            ))}
        </Physics>
    );
}
