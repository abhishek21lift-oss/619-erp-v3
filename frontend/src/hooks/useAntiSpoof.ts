'use client';
/**
 * useAntiSpoof — blink detection using Eye Aspect Ratio (EAR).
 *
 * EAR = (||p2-p6|| + ||p3-p5||) / (2 * ||p1-p4||)
 * Reference: Soukupová & Čech, 2016.
 *
 * A blink is detected when EAR drops below BLINK_THRESHOLD for
 * CONSEC_FRAMES consecutive frames, then rises above it again.
 */
import { useRef, useCallback } from 'react';

const BLINK_THRESHOLD = 0.22;  // EAR below this = eye closing
const CONSEC_FRAMES   = 2;     // Frames below threshold to count as blink

// face-api.js landmark indices for left eye (points 36-41) and right eye (42-47)
const LEFT_EYE_IDX  = [36, 37, 38, 39, 40, 41];
const RIGHT_EYE_IDX = [42, 43, 44, 45, 46, 47];

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function computeEAR(pts: { x: number; y: number }[]): number {
  // pts are the 6 eye landmark points: [p1, p2, p3, p4, p5, p6]
  const vertical1 = dist(pts[1], pts[5]);
  const vertical2 = dist(pts[2], pts[4]);
  const horizontal = dist(pts[0], pts[3]);
  return (vertical1 + vertical2) / (2.0 * horizontal);
}

interface UseAntiSpoofReturn {
  /** Call each detection frame with landmark positions (array of {x,y}) */
  processFaceLandmarks: (landmarks: { x: number; y: number }[]) => void;
  /** Whether a genuine blink has been detected */
  blinkDetected: boolean;
  /** Reset blink state (call after successful check-in) */
  reset: () => void;
  /** Current EAR value for debugging / UI display */
  currentEAR: number;
}

export function useAntiSpoof(): UseAntiSpoofReturn {
  const blinkDetectedRef  = useRef(false);
  const consecFramesRef   = useRef(0);     // consecutive frames below threshold
  const wasClosedRef      = useRef(false); // tracks eye-open → close → open cycle
  const currentEARRef     = useRef(0.3);

  const processFaceLandmarks = useCallback(
    (landmarks: { x: number; y: number }[]) => {
      if (blinkDetectedRef.current) return; // Already detected blink this session
      if (landmarks.length < 68) return;    // Need 68-point model

      // Extract eye landmark subsets
      const leftEyePts  = LEFT_EYE_IDX.map(i => landmarks[i]);
      const rightEyePts = RIGHT_EYE_IDX.map(i => landmarks[i]);

      const earLeft  = computeEAR(leftEyePts);
      const earRight = computeEAR(rightEyePts);
      const ear = (earLeft + earRight) / 2;
      currentEARRef.current = ear;

      if (ear < BLINK_THRESHOLD) {
        consecFramesRef.current += 1;
        wasClosedRef.current = true;
      } else {
        // Eyes just re-opened after being closed for enough frames → blink!
        if (wasClosedRef.current && consecFramesRef.current >= CONSEC_FRAMES) {
          blinkDetectedRef.current = true;
        }
        consecFramesRef.current = 0;
        wasClosedRef.current = false;
      }
    },
    []
  );

  const reset = useCallback(() => {
    blinkDetectedRef.current = false;
    consecFramesRef.current  = 0;
    wasClosedRef.current     = false;
    currentEARRef.current    = 0.3;
  }, []);

  return {
    processFaceLandmarks,
    get blinkDetected() { return blinkDetectedRef.current; },
    reset,
    get currentEAR() { return currentEARRef.current; },
  };
}
