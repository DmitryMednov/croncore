import { Html } from '@react-three/drei';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, MeshStandardMaterial, Vector3 } from 'three';
import { MathUtils } from 'three';
import { useGameStore } from '../core/store/gameStore';

/**
 * Croncore "Investor's Circle" blocks — six floating monoliths arranged in
 * a ring around spawn, one per direction Croncore works in.
 *
 * Labels are screen-space DOM cards (drei <Html> WITHOUT `transform` —
 * the CSS3D transform path collapses under the WebGPU renderer, and any
 * in-scene mesh label gets smeared by the DoF/bloom post pipeline).
 * A DOM overlay is untouched by post-processing, so the text stays
 * perfectly crisp on every screen.
 *
 * Proximity: walk close and the monolith wakes — glow ramps in, the
 * label card fades up. Hover (desktop) does the same. Press E (desktop)
 * or tap the monolith (mobile) to open the application bot.
 */

/* Applications go straight to the Telegram bot; ?start=<key> hands the
   bot the direction the visitor came from. */
const BOT_URL = 'https://t.me/CRONCORE_bot';

type Block = {
    key: string;
    title: string;
    sub: string;
    href: string;
};

/* The six directions Croncore works in — one monolith each. */
const BLOCKS: Block[] = [
    { key: 'payments',  title: 'Payments & Fintech',      sub: '01 · Accounts, acquiring, settlement rails',   href: `${BOT_URL}?start=payments`  },
    { key: 'invest',    title: 'Investments & DeFi',      sub: '02 · Allocations, treasury, structured deals', href: `${BOT_URL}?start=invest`    },
    { key: 'spv',       title: 'SPV & Tokenization',      sub: '03 · Vehicles, cap tables, real-world assets', href: `${BOT_URL}?start=spv`       },
    { key: 'legal',     title: 'Legal & Corporate',       sub: '04 · Jurisdictions, structuring, compliance',  href: `${BOT_URL}?start=legal`     },
    { key: 'concierge', title: 'Concierge & Real Estate', sub: '05 · Relocation, property, quiet logistics',   href: `${BOT_URL}?start=concierge` },
    { key: 'network',   title: 'Private Network',         sub: '06 · Introductions inside the circle',         href: `${BOT_URL}?start=network`   },
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
                        href={b.href}
                    />
                );
            })}
        </group>
    );
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
    const isMobile = useGameStore((state) => state.isMobile);

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

        // Glow ramps smoothly instead of snapping. Kept modest so the
        // face never blows out.
        const mat = matRef.current;
        if (mat) {
            mat.emissiveIntensity = MathUtils.lerp(
                mat.emissiveIntensity,
                awake ? 1.0 : 0.5,
                Math.min(1, delta * 6)
            );
        }
    });

    /* Standing close: E opens the application for this direction.
       ev.code is layout-independent, so it works on RU/HE/AR keyboards. */
    useEffect(() => {
        if (!near) return;
        const onKey = (ev: KeyboardEvent) => {
            if (ev.code === 'KeyE' && !ev.repeat) {
                window.open(href, '_blank', 'noopener');
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [near, href]);

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
                    emissive="#2c6c4e"
                    emissiveIntensity={0.5}
                    metalness={0.25}
                    roughness={0.30}
                    transparent
                    opacity={0.92}
                />
            </mesh>

            {/* Screen-space DOM card — outside the DoF/bloom pipeline, so
                the text is always tack-sharp. Rendered only positionally
                by drei (no CSS3D transform). */}
            <Html
                center
                position={[0, 0.4, 0]}
                zIndexRange={[25, 0]}
                style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
                <div
                    style={{
                        width: isMobile ? 'min(78vw, 320px)' : 360,
                        textAlign: 'center',
                        fontFamily: '"Geist", ui-sans-serif, system-ui, sans-serif',
                        color: '#e6fff0',
                        background: 'rgba(5, 13, 9, 0.9)',
                        border: '1px solid rgba(157, 238, 192, 0.32)',
                        borderRadius: 18,
                        padding: isMobile ? '16px 18px 14px' : '20px 24px 18px',
                        boxShadow: '0 18px 50px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.08)',
                        opacity: awake ? 1 : 0,
                        transform: awake ? 'translateY(0)' : 'translateY(10px)',
                        transition: 'opacity .4s ease, transform .4s ease',
                    }}
                >
                    <div
                        style={{
                            fontFamily: '"Newsreader", Georgia, serif',
                            fontStyle: 'italic',
                            fontWeight: 400,
                            fontSize: isMobile ? 26 : 32,
                            lineHeight: 1.1,
                            color: '#dffbe9',
                            marginBottom: 8,
                        }}
                    >
                        {title}
                    </div>
                    <div style={{ fontSize: isMobile ? 12 : 13, color: '#9ec2ad' }}>
                        {sub}
                    </div>
                    <div
                        style={{
                            marginTop: 14,
                            fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                            fontSize: 10,
                            letterSpacing: '.22em',
                            textTransform: 'uppercase',
                            color: '#6fb892',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                        }}
                    >
                        {isMobile ? (
                            <span>TAP THE MONOLITH TO APPLY</span>
                        ) : (
                            <>
                                <span>PRESS</span>
                                <span
                                    style={{
                                        display: 'inline-grid',
                                        placeItems: 'center',
                                        minWidth: 22,
                                        height: 22,
                                        padding: '0 5px',
                                        borderRadius: 6,
                                        border: '1px solid rgba(157, 238, 192, 0.75)',
                                        background: 'rgba(157, 238, 192, 0.14)',
                                        color: '#dffbe9',
                                        fontSize: 12,
                                        fontWeight: 600,
                                        letterSpacing: 0,
                                    }}
                                >
                                    E
                                </span>
                                <span>TO APPLY</span>
                            </>
                        )}
                    </div>
                </div>
            </Html>
        </group>
    );
}
