import { Billboard, Edges, Html } from '@react-three/drei';
import { useState } from 'react';

/**
 * Croncore "Investor's Circle" blocks — six floating monoliths arranged in
 * a ring around spawn. Each block is the 3D analogue of a section on the
 * marketing site. Hover → glow; click → open the matching section in a new
 * tab. Designed to drop into <WorldController/> alongside Rose / Grass /
 * Character without depending on any of their pipelines.
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
    position: [number, number, number];
    rotationY: number;
    title: string;
    sub: string;
    href: string;
};

function Monolith({ position, rotationY, title, sub, href }: MonolithProps) {
    const [hovered, setHovered] = useState(false);

    return (
        <group position={position} rotation={[0, rotationY, 0]}>
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
                    color="#0a1d14"
                    emissive={hovered ? '#9deec0' : '#2c6c4e'}
                    emissiveIntensity={hovered ? 1.15 : 0.42}
                    metalness={0.15}
                    roughness={0.35}
                    transparent
                    opacity={0.88}
                />
                <Edges
                    threshold={15}
                    color={hovered ? '#dffbe9' : '#7fc4a0'}
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
                            }}
                        >
                            {title}
                        </div>
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
                            {hovered ? '› Click to open' : 'CRONCORE · 2026'}
                        </div>
                    </div>
                </Html>
            </Billboard>
        </group>
    );
}
