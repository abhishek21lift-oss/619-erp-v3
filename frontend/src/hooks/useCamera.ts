'use client';
/**
 * useCamera — manages webcam lifecycle.
 * Exposes videoRef, start(), stop(), and permission state.
 */
import { useRef, useState, useCallback } from 'react';

export type CameraStatus = 'idle' | 'starting' | 'active' | 'denied' | 'error';

interface UseCameraReturn {
  videoRef: React.RefObject<HTMLVideoElement>;
  status: CameraStatus;
  error: string;
  start: () => Promise<boolean>;
  stop: () => void;
  dimensions: { width: number; height: number };
}

export function useCamera(): UseCameraReturn {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>('idle');
  const [error, setError] = useState('');
  const [dimensions, setDimensions] = useState({ width: 640, height: 480 });

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus('idle');
    setError('');
  }, []);

  const start = useCallback(async (): Promise<boolean> => {
    if (status === 'active') return true;
    setStatus('starting');
    setError('');

    try {
      // Prefer environment-facing camera on mobile, user-facing on desktop
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30 },
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (!videoRef.current) { stop(); return false; }

      videoRef.current.srcObject = stream;

      // Wait for video to be ready
      await new Promise<void>((resolve, reject) => {
        const v = videoRef.current!;
        v.onloadedmetadata = () => {
          setDimensions({ width: v.videoWidth || 640, height: v.videoHeight || 480 });
          resolve();
        };
        v.onerror = reject;
        setTimeout(reject, 5000); // 5s timeout
      });

      await videoRef.current.play();
      setStatus('active');
      return true;
    } catch (err: any) {
      const msg = err?.name === 'NotAllowedError'
        ? 'Camera permission denied. Please allow camera access.'
        : err?.name === 'NotFoundError'
        ? 'No camera found on this device.'
        : 'Could not start camera. Please check your device.';
      setError(msg);
      setStatus(err?.name === 'NotAllowedError' ? 'denied' : 'error');
      return false;
    }
  }, [status, stop]);

  return { videoRef, status, error, start, stop, dimensions };
}
