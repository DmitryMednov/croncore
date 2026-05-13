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