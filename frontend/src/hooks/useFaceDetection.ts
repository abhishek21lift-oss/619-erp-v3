'use client';
/**
 * useFaceDetection — loads face-api.js models lazily and runs the
 * detection loop using requestAnimationFrame.
 *
 * Models used:
 *  - TinyFaceDetector  (fast, ~190KB, good for real-time)
 *  - FaceLandmark68Net (for blink detection EAR)
 *  - FaceRecognitionNet (128-D descriptor for matching)
 *
 * Models are served from /public/models/ or CDN fallback.
 */
import { useRef, useState, useCallback, useEffect } from 'react';
import type { FaceDescriptorEntry, DetectionResult } from '@/types/checkin';

const MODEL_URL = '/models'; // Served from public/models/
const RECOGNITION_THRESHOLD = 0.50; // Euclidean distance — lower = stricter
const DETECTION_INTERVAL_MS = 80;   // ~12 fps detection (not blocking 30fps render)
const MIN_FACE_SIZE = 80;           // px — ignore tiny detected faces

type ModelStatus = 'idle' | 'loading' | 'ready' | 'error';

interface UseFaceDetectionReturn {
  modelStatus: ModelStatus;
  modelError: string;
  loadModels: () => Promise<boolean>;
  startDetectionLoop: (
    videoEl: HTMLVideoElement,
    canvasEl: HTMLCanvasElement,
    onDetection: (result: DetectionResult) => void
  ) => void;
  stopDetectionLoop: () => void;
  matchDescriptor: (
    descriptor: Float32Array,
    storedDescriptors: FaceDescriptorEntry[]
  ) => { matched: boolean; entry?: FaceDescriptorEntry; distance: number };
}

export function useFaceDetection(): UseFaceDetectionReturn {
  const [modelStatus, setModelStatus] = useState<ModelStatus>('idle');
  const [modelError, setModelError]   = useState('');
  const faceApiRef    = useRef<any>(null);
  const rafRef        = useRef<number>(0);
  const lastRunRef    = useRef<number>(0);
  const processingRef = useRef(false);

  // Dynamically import face-api.js (client-side only)
  const getFaceApi = useCallback(async () => {
    if (faceApiRef.current) return faceApiRef.current;
    // Dynamic import — only runs in browser
    const faceapi = await import('face-api.js');
    faceApiRef.current = faceapi;
    return faceapi;
  }, []);

  const loadModels = useCallback(async (): Promise<boolean> => {
    if (modelStatus === 'ready') return true;
    setModelStatus('loading');
    setModelError('');

    try {
      const faceapi = await getFaceApi();

      // Load all three models concurrently
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);

      setModelStatus('ready');
      return true;
    } catch (err: any) {
      const msg = 'Failed to load face recognition models. Check /public/models/ folder.';
      setModelError(msg);
      setModelStatus('error');
      console.error('[FaceDetection] Model load error:', err);
      return false;
    }
  }, [modelStatus, getFaceApi]);

  const stopDetectionLoop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    processingRef.current = false;
  }, []);

  const startDetectionLoop = useCallback(
    (
      videoEl: HTMLVideoElement,
      canvasEl: HTMLCanvasElement,
      onDetection: (result: DetectionResult) => void
    ) => {
      if (!faceApiRef.current) return;
      const faceapi = faceApiRef.current;

      // Match canvas size to video
      canvasEl.width  = videoEl.videoWidth  || 640;
      canvasEl.height = videoEl.videoHeight || 480;

      const ctx = canvasEl.getContext('2d');

      const loop = async (timestamp: number) => {
        rafRef.current = requestAnimationFrame(loop);

        // Throttle detection to DETECTION_INTERVAL_MS
        if (timestamp - lastRunRef.current < DETECTION_INTERVAL_MS) return;
        if (processingRef.current) return; // Skip if previous frame still processing
        if (videoEl.readyState < 2) return; // Video not ready

        lastRunRef.current    = timestamp;
        processingRef.current = true;

        try {
          // Clear previous drawings
          ctx?.clearRect(0, 0, canvasEl.width, canvasEl.height);

          const detectorOptions = new faceapi.TinyFaceDetectorOptions({
            inputSize: 320,   // 128|160|224|320|416|608
            scoreThreshold: 0.5,
          });

          // Detect with landmarks + descriptor in one pass
          const detections = await faceapi
            .detectAllFaces(videoEl, detectorOptions)
            .withFaceLandmarks()
            .withFaceDescriptors();

          if (!detections || detections.length === 0) {
            onDetection({ detected: false, multipleFaces: false });
            processingRef.current = false;
            return;
          }

          // Reject if multiple faces detected
          if (detections.length > 1) {
            // Draw red boxes for all faces
            if (ctx) {
              const scaleX = canvasEl.width  / (videoEl.videoWidth  || 640);
              const scaleY = canvasEl.height / (videoEl.videoHeight || 480);
              ctx.strokeStyle = '#ef4444';
              ctx.lineWidth = 2;
              detections.forEach((d: any) => {
                const b = d.detection.box;
                ctx.strokeRect(b.x * scaleX, b.y * scaleY, b.width * scaleX, b.height * scaleY);
              });
            }
            onDetection({ detected: true, multipleFaces: true });
            processingRef.current = false;
            return;
          }

          const det = detections[0];
          const box = det.detection.box;

          // Ignore faces that are too small (likely background noise)
          if (box.width < MIN_FACE_SIZE) {
            onDetection({ detected: false, multipleFaces: false });
            processingRef.current = false;
            return;
          }

          // Scale box to canvas dimensions
          const scaleX = canvasEl.width  / (videoEl.videoWidth  || 640);
          const scaleY = canvasEl.height / (videoEl.videoHeight || 480);
          const scaledBox = {
            x:      box.x      * scaleX,
            y:      box.y      * scaleY,
            width:  box.width  * scaleX,
            height: box.height * scaleY,
          };

          // Draw face bounding box on canvas
          if (ctx) {
            ctx.strokeStyle = '#6366f1';
            ctx.lineWidth   = 2;
            ctx.strokeRect(scaledBox.x, scaledBox.y, scaledBox.width, scaledBox.height);

            // Draw subtle fill
            ctx.fillStyle = 'rgba(99,102,241,0.06)';
            ctx.fillRect(scaledBox.x, scaledBox.y, scaledBox.width, scaledBox.height);
          }

          // Extract landmark positions
          const landmarks = det.landmarks.positions.map((p: any) => ({ x: p.x, y: p.y }));

          onDetection({
            detected: true,
            multipleFaces: false,
            box: scaledBox,
            descriptor: det.descriptor,
            landmarks,
          });
        } catch (err) {
          // Silent — log only in dev
          if (process.env.NODE_ENV === 'development') {
            console.warn('[FaceDetection] Frame error:', err);
          }
        } finally {
          processingRef.current = false;
        }
      };

      rafRef.current = requestAnimationFrame(loop);
    },
    []
  );

  /** Compare one descriptor against a list of stored descriptors */
  const matchDescriptor = useCallback(
    (descriptor: Float32Array, storedDescriptors: FaceDescriptorEntry[]) => {
      if (!faceApiRef.current || storedDescriptors.length === 0) {
        return { matched: false, distance: Infinity };
      }

      let bestDistance = Infinity;
      let bestEntry: FaceDescriptorEntry | undefined;

      for (const entry of storedDescriptors) {
        const stored = new Float32Array(entry.descriptor);
        // Euclidean distance
        const dist = faceApiRef.current.euclideanDistance(descriptor, stored);
        if (dist < bestDistance) {
          bestDistance = dist;
          bestEntry    = entry;
        }
      }

      return {
        matched:  bestDistance < RECOGNITION_THRESHOLD,
        entry:    bestEntry,
        distance: bestDistance,
      };
    },
    []
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => { stopDetectionLoop(); };
  }, [stopDetectionLoop]);

  return {
    modelStatus,
    modelError,
    loadModels,
    startDetectionLoop,
    stopDetectionLoop,
    matchDescriptor,
  };
}
