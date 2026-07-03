import { useGameStore } from "../core/store/gameStore";
import { LoadingScreen } from "./LoadingScreen";
import AudioButton from "./AudioButton";
import { SideBar } from "./SideBar";
import { TouchJoystick } from "../core/input/TouchJoystick";
import { input } from "../core/input/controls";

export function UI() {
    const isMobile = useGameStore((state) => state.isMobile);
    const isControlEnabled = useGameStore((state) => state.isControlEnabled);

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none', // Critical: lets clicks pass through to the 3D canvas
            zIndex: 10 // Ensure UI is above Canvas
        }}>
            <LoadingScreen />

            <div style={{
                position: 'absolute',
                top: 0, left: 0, width: '100%', height: '100%',
                pointerEvents: 'none',

                opacity: isControlEnabled ? 1 : 0,
                visibility: isControlEnabled ? 'visible' : 'hidden',
                transition: `opacity 0.5s ease, visibility 0s linear ${isControlEnabled ? '0s' : '0.5s'}`
            }}>
                <AudioButton />
                <SideBar />

                {/* Exit — back to the landing page */}
                <a
                    href="../"
                    style={{
                        position: 'absolute',
                        top: isMobile ? 12 : 18,
                        left: isMobile ? 12 : 18,
                        zIndex: 30,
                        pointerEvents: 'auto',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: isMobile ? '8px 14px' : '10px 18px',
                        borderRadius: 999,
                        background: 'rgba(6, 16, 11, 0.55)',
                        backdropFilter: 'blur(10px)',
                        WebkitBackdropFilter: 'blur(10px)',
                        border: '1px solid rgba(157, 238, 192, 0.28)',
                        color: '#dffbe9',
                        textDecoration: 'none',
                        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                        fontSize: isMobile ? 10 : 11,
                        letterSpacing: '0.18em',
                        boxShadow: '0 8px 24px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.12)',
                    }}
                >
                    ← CRONCORE
                </a>

                {isMobile &&
                    <TouchJoystick
                        input={input}
                        actions={{
                            forward: 'MoveForward',
                            backward: 'MoveBackward',
                            left: 'RotateLeft',
                            right: 'RotateRight',
                            run: 'Run'
                        }} />}
            </div>
        </div>
    );
}