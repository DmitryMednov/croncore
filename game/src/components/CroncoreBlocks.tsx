import { Billboard } from '@react-three/drei';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { CanvasTexture, Group, MeshStandardMaterial, MeshBasicMaterial, Vector3 } from 'three';
import { MathUtils, SRGBColorSpace } from 'three';
import { useGameStore } from '../core/store/gameStore';

/**
 * Croncore "Investor's Circle" blocks — six floating monoliths arranged in
 * a ring around spawn, one per direction Croncore works in.
 *
 * Labels are drawn into a canvas texture on a billboarded plane — NOT
 * drei <Html>. The CSS3D transform path collapses to a tiny box under
 * the WebGPU renderer, so the label lives inside the scene instead.
 *
 * Proximity: walk close and the monolith wakes — glow ramps in, the
 * label card fades up. Hover (desktop) does the same; click opens the
 * landing with the apply form preselected for that direction.
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

/* Label plane: canvas pixels + world size (same aspect). */
const LABEL_W = 880, LABEL_H = 440;
const PLANE_W = 4.4, PLANE_H = 2.2;

function drawLabel(canvas: HTMLCanvasElement, title: string, sub: string) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    /* glass card */
    const r = 44;
    ctx.beginPath();
    ctx.roundRect(8, 8, W - 16, H - 16, r);
    /* near-opaque: a translucent card lets the emissive monolith bleed
       through and the bloom pass smears the text (seen in review) */
    ctx.fillStyle = 'rgba(5, 13, 9, 0.97)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(157, 238, 192, 0.35)';
    ctx.lineWidth = 3;
    ctx.stroke();
    /* top specular line */
    const spec = ctx.createLinearGradient(0, 8, 0, 80);
    spec.addColorStop(0, 'rgba(255,255,255,0.14)');
    spec.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.beginPath();
    ctx.roundRect(10, 10, W - 20, 70, [r, r, 0, 0]);
    ctx.fillStyle = spec;
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    /* title — serif italic, like the landing */
    ctx.fillStyle = '#dffbe9';
    ctx.font = 'italic 400 84px "Newsreader", Georgia, serif';
    ctx.fillText(title, W / 2, H * 0.36, W - 100);

    /* sub */
    ctx.fillStyle = '#9ec2ad';
    ctx.font = '400 34px "Geist", ui-sans-serif, system-ui, sans-serif';
    ctx.fillText(sub, W / 2, H * 0.60, W - 120);

    /* CTA line: "PRESS [E] TO APPLY" with a drawn keycap */
    const cy = H * 0.80;
    ctx.font = '500 26px "JetBrains Mono", ui-monospace, monospace';
    try { (ctx as any).letterSpacing = '6px'; } catch (e) { /* older engines */ }
    const pressW = ctx.measureText('PRESS ').width;
    const afterW = ctx.measureText(' TO APPLY').width;
    const KEY = 46; /* keycap size */
    const totalW = pressW + KEY + 14 + afterW;
    let x = (W - totalW) / 2;

    ctx.textAlign = 'left';
    ctx.fillStyle = '#6fb892';
    ctx.fillText('PRESS ', x, cy);
    x += pressW + 6;

    /* keycap */
    ctx.beginPath();
    ctx.roundRect(x, cy - KEY / 2, KEY, KEY, 10);
    ctx.fillStyle = 'rgba(157, 238, 192, 0.14)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(157, 238, 192, 0.75)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#dffbe9';
    ctx.font = '600 30px "JetBrains Mono", ui-monospace, monospace';
    try { (ctx as any).letterSpacing = '0px'; } catch (e) { /* keycap glyph */ }
    ctx.fillText('E', x + KEY / 2, cy + 1);
    x += KEY + 8;

    ctx.textAlign = 'left';
    ctx.fillStyle = '#6fb892';
    ctx.font = '500 26px "JetBrains Mono", ui-monospace, monospace';
    try { (ctx as any).letterSpacing = '6px'; } catch (e) { /* older engines */ }
    ctx.fillText(' TO APPLY', x, cy);
    try { (ctx as any).letterSpacing = '0px'; } catch (e) { /* reset */ }
    ctx.textAlign = 'center';
}

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

    const groupRef = useRef<Group>(null);
    const matRef = useRef<MeshStandardMaterial>(null);
    const labelMatRef = useRef<MeshBasicMaterial>(null);
    const worldPos = useMemo(() => new Vector3(), []);
    const phase = index * 1.7; // desync the float bob per monolith

    /* label canvas → texture; redrawn once web fonts arrive */
    const labelTexture = useMemo(() => {
        const canvas = document.createElement('canvas');
        canvas.width = LABEL_W;
        canvas.height = LABEL_H;
        drawLabel(canvas, title, sub);
        const tex = new CanvasTexture(canvas);
        tex.colorSpace = SRGBColorSpace;
        tex.anisotropy = 4;
        (tex as any).__canvas = canvas;
        return tex;
    }, [title, sub]);

    useEffect(() => {
        let alive = true;
        document.fonts?.ready?.then(() => {
            if (!alive) return;
            drawLabel((labelTexture as any).__canvas, title, sub);
            labelTexture.needsUpdate = true;
        });
        return () => { alive = false; };
    }, [labelTexture, title, sub]);

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
        const k = Math.min(1, delta * 6);
        const mat = matRef.current;
        if (mat) {
            mat.emissiveIntensity = MathUtils.lerp(mat.emissiveIntensity, awake ? 1.0 : 0.5, k);
        }
        // Label card fades with the same rhythm.
        const lm = labelMatRef.current;
        if (lm) {
            lm.opacity = MathUtils.lerp(lm.opacity, awake ? 1 : 0, k);
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
                    emissive="#2c6c4e"
                    emissiveIntensity={0.5}
                    metalness={0.25}
                    roughness={0.30}
                    transparent
                    opacity={0.92}
                />
            </mesh>

            {/* In-scene label card: canvas texture on a billboarded plane —
                survives any renderer, unlike CSS3D-transformed HTML.
                depthTest off + high renderOrder: the card reads like a
                floating sign and is never swallowed by the monolith no
                matter the camera angle. */}
            <Billboard follow position={[0, 0, 1.1]}>
                <mesh renderOrder={999}>
                    <planeGeometry args={[PLANE_W, PLANE_H]} />
                    <meshBasicMaterial
                        ref={labelMatRef}
                        map={labelTexture}
                        transparent
                        opacity={0}
                        depthWrite={false}
                        depthTest={false}
                        toneMapped={false}
                    />
                </mesh>
            </Billboard>
        </group>
    );
}
