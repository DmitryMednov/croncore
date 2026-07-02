import { Billboard, Html } from '@react-three/drei';
import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, MeshStandardMaterial, Vector3 } from 'three';
import { MathUtils } from 'three';
import { useGameStore } from '../core/store/gameStore';

/**
 * Croncore "Investor's Circle" blocks — six floating monoliths arranged in
 * a ring around spawn. Each block is the 3D analogue of a section on the
 * marketing site.
 *
 * Bruno-Simon-style proximity: walk the astronaut close to a monolith and
 * it wakes up — glow ramps in, the label panel unfolds. Walk away and it
 * goes quiet again. Hover (desktop) does the same; click opens the section.
 */

const BASE_URL: string =
    ((import.meta as any).env?.VITE_CRONCORE_URL as string | undefined) ?? '..';

type Block = {
    key: string;
    title: string;
    sub: string;
    href: string;
};

const BLOCKS: Block[] = [
    { key: 'services', title: 'Services',     sub: 'Six private directions',            href: '/#services' },
    { key: 'advisor',  title: 'Advisor',      sub: 'Start with a question',             href: '/#advisor'  },
    { key: 'how',      title: 'How it works', sub: 'From a message to the right room',  href: '/#how'      },
    { key: 'access',   title: 'Access',       sub: "Enter The Investor's Circle",       href: '/#access'   },
    { key: 'payments', title: 'Payments',     sub: '01 · Infrastructure',               href: '/#services' },
    { key: 'spv',      title: 'SPV',          sub: '03 · Structure',                    href: '/#services' },
];

const RADIUS = 22;
const Y_OFFSET = 4;

/* Proximity thresholds (hysteresis so the panel doesn't flicker at the edge). */
const NEAR_ENTER = 8.5;
const NEAR_EXIT = 10.5;

export function CroncoreBlocks({ visible = true }: { visible?: boolean }) {
    return (
        <group name="croncore-blocks" visible={visible}>
            {BLOCKS.map((b, i) => {
                const a = (i / BLOCKS.length) * Math.PI * 2;
                const x = Math.cos(a) * RADIUS;
                const z = Math.sin(a) * RADIUS;
                // Face inwards so the labels look at the centre / spawn.
                const rotY = -a + Math.PI / 2;
                return (
                    <Monolith
                        key={b.key}
                        index={i}
                        position={[x, Y_OFFSET, z]}
                        rotationY={rotY}
                        title={b.title}
                        sub={b.sub}
                        href={resolveHref(b.href)}
                    />
                );
            })}
        </group>
    );
}

function resolveHref(suffix: string): string {
    const base = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL;
    return base + suffix;
}

type MonolithProps = {
    index: number;
    position: [number, number, number];
    rotationY: number;
    title: string;
    sub: string;
    href: string;
};

function Monolith({ index, position, rotationY, title, sub, href }: MonolithProps) {
    const [hovered, setHovered] = useState(false);
    const [near, setNear] = useState(false);

    const characterRef = useGameStore((state) => state.characterRef);

    const groupRef = useRef<Group>(null);
    const matRef = useRef<MeshStandardMaterial>(null);
    const worldPos = useMemo(() => new Vector3(), []);
    const phase = index * 1.7; // desync the float bob per monolith

    const awake = near || hovered;

    useFrame(({ clock }, delta) => {
        const group = groupRef.current;
        if (!group) return;

        // Slow idle float, slightly livelier when awake.
        const t = clock.getElapsedTime();
        const bobAmp = awake ? 0.34 : 0.22;
        group.position.y = position[1] + Math.sin(t * 0.6 + phase) * bobAmp;

        // Proximity check against the astronaut (hysteresis band).
        const char = characterRef?.current;
        if (char) {
            group.getWorldPosition(worldPos);
            const d = worldPos.distanceTo(char.position);
            if (!near && d < NEAR_ENTER) setNear(true);
            else if (near && d > NEAR_EXIT) setNear(false);
        }

        // Glow ramps smoothly instead of snapping.
        const mat = matRef.current;
        if (mat) {
            const target = awake ? 1.45 : 0.55;
            mat.emissiveIntensity = MathUtils.lerp(
                mat.emissiveIntensity,
                target,
                Math.min(1, delta * 6)
            );
        }
    });

    return (
        <group ref={groupRef} position={position} rotation={[0, rotationY, 0]}>
            <mesh
                onPointerOver={(e) => {
                    e.stopPropagation();
                    setHovered(true);
                    document.body.style.cursor = 'pointer';
                }}
                onPointerOut={() => {
                    setHovered(false);
                    document.body.style.cursor = 'auto';
                }}
                onClick={(e) => {
                    e.stopPropagation();
                    window.open(href, '_blank', 'noopener');
                }}
            >
                <boxGeometry args={[2.4, 6, 0.4]} />
                <meshStandardMaterial
                    ref={matRef}
                    color="#0a1d14"
                    emissive={awake ? '#9deec0' : '#2c6c4e'}
                    emissiveIntensity={0.55}
                    metalness={0.25}
                    roughness={0.30}
                    transparent
                    opacity={0.92}
                />
            </mesh>

            {/* HTML label hovering just off the front face, always facing the camera. */}
            <Billboard follow position={[0, 0, 0.4]}>
                <Html
                    transform
                    center
                    scale={0.012}
                    pointerEvents="none"
                    style={{
                        pointerEvents: 'none',
                        userSelect: 'none',
                        width: 320,
                        textAlign: 'center',
                    }}
                >
                    <div
                        style={{
                            fontFamily: '"Geist", ui-sans-serif, system-ui, sans-serif',
                            color: '#e6fff0',
                            textShadow: '0 2px 18px rgba(0,0,0,.85)',
                            letterSpacing: '-0.02em',
                        }}
                    >
                        <div
                            style={{
                                fontFamily: '"Newsreader", Georgia, serif',
                                fontStyle: 'italic',
                                fontWeight: 400,
                                fontSize: 38,
                                lineHeight: 1,
                                color: '#dffbe9',
                                marginBottom: 8,
                                opacity: awake ? 1 : 0.55,
                                transform: awake ? 'translateY(0)' : 'translateY(6px)',
                                transition: 'opacity .45s ease, transform .45s ease',
                            }}
                        >
                            {title}
                        </div>

                        {/* Details unfold only when the astronaut is close (or hover). */}
                        <div
                            style={{
                                opacity: awake ? 1 : 0,
                                transform: awake ? 'translateY(0)' : 'translateY(10px)',
                                transition: 'opacity .45s ease .08s, transform .45s ease .08s',
                            }}
                        >
                            <div style={{ fontSize: 13, color: '#9ec2ad', maxWidth: 280, margin: '0 auto' }}>
                                {sub}
                            </div>
                            <div
                                style={{
                                    marginTop: 14,
                                    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                                    fontSize: 10,
                                    letterSpacing: '.2em',
                                    textTransform: 'uppercase',
                                    color: hovered ? '#bff5d3' : '#6fb892',
                                    transition: 'color .15s',
                                }}
                            >
                                {hovered ? '› Click to open' : '› Click to open · Croncore'}
                            </div>
                        </div>
                    </div>
                </Html>
            </Billboard>
        </group>
    );
}
