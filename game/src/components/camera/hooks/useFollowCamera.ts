// src/ui/components/hooks/useFollowCamera.ts
import { useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { CameraControls } from '@react-three/drei';
import { Group } from 'three';
import { CAMERA_POSITION, CAMERA_LOOKAT } from '../CameraViewControl';

interface UseFollowCameraProps {
  characterRef: React.MutableRefObject<Group | null> | null;
  controlsRef: React.MutableRefObject<CameraControls | null>; 
  enabled: boolean;
}

export function useFollowCamera({
  characterRef,
  controlsRef,
  enabled,
}: UseFollowCameraProps) {
  const { gl } = useThree();

  useEffect(() => {
    if (!enabled) return;
    
    const onMove = (e: MouseEvent) => {
      controlsRef.current?.rotate(-e.movementX * 0.002, -e.movementY * 0.002, true);
    };

    document.addEventListener('mousemove', onMove);
    return () => document.removeEventListener('mousemove', onMove);
  }, [enabled, controlsRef]);

  // Handle Pointer Lock
  useEffect(() => {
    if (!enabled) return;
    const canvas = gl.domElement;

    const requestLock = async () => {
      // Only request if not already locked to avoid errors
      if (document.pointerLockElement !== canvas) {
        try {
          await canvas.requestPointerLock();
        } catch (e) {
          console.warn('Pointer lock denied:', e);
        }
      }
    };

    // Auto-lock on click
    const handleClick = () => requestLock();
    canvas.addEventListener('click', handleClick);

    // Initial lock attempt
    requestLock();

    return () => {
      canvas.removeEventListener('click', handleClick);
      // Only exit if we are the one holding the lock
      if (document.pointerLockElement === canvas) {
        document.exitPointerLock();
      }
    };
  }, [enabled, gl.domElement]);

  useFrame(() => {
    if (!enabled || !controlsRef.current || !characterRef?.current) return;
    
    const { x, y, z } = characterRef.current.position;
    controlsRef.current.moveTo(x, y + 1.0, z, true);
  });
}