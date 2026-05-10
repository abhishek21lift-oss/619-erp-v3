'use client';
/**
 * FaceEnrollModal — capture and store a single face descriptor for a member.
 *
 * Opens a modal with the live camera, runs face-api.js detection, asks the
 * staff member to align the member's face inside the frame, captures three
 * descriptors and averages them for stability, then POSTs to
 * /api/checkin/enroll.
 *
 * Why average three samples?  A single 128-D embedding is noisy under
 * different lighting/expression — averaging three quick captures gives a
 * much more reliable anchor than relying on any one frame.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, CheckCircle2, XCircle, Loader2, RefreshCw, Scan } from 'lucide-react';
import { useCamera } from '@/hooks/useCamera';
import { useFaceDetection } from '@/hooks/useFaceDetection';
import { api } from '@/lib/api';

type State = 'loading' | 'ready' | 'capturing' | 'saving' | 'success' | 'error';

const SAMPLES_REQUIRED = 3;

interface Props {
  clientId: string;
  clientName?: string;
  open: boolean;
  onClose: () => void;
  onEnrolled?: () => void;
}

export default function FaceEnrollModal({ clientId, clientName, open, onClose, onEnrolled }: Props) {
  const camera = useCamera();
  const detection = useFaceDetection();

  const videoRef = camera.videoRef;
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [state, setState] = useState<State>('loading');
  const [statusMsg, setStatusMsg] = useState('Loading face models…');
  const [samples, setSamples] = useState<Float32Array[]>([]);
  const [error, setError] = useState('');
  const samplesRef = useRef<Float32Array[]>([]);

  // Reset on open
  useEffect(() => {
    if (!open) return;
    setSamples([]);
    samplesRef.current = [];
    setError('');
    setState('loading');
    setStatusMsg('Loading face models…');
  }, [open]);

  // Start camera + load models once the modal is open
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const ok = await detection.loadModels();
      if (cancelled) return;
      if (!ok) {
        setState('error');
        setError('Could not load face recognition models');
        return;
      }
      setStatusMsg('Starting camera…');
      const camOk = await camera.start();
      if (cancelled) return;
      if (!camOk) {
        setState('error');
        setError(camera.error || 'Camera unavailable');
        return;
      }
      setState('ready');
      setStatusMsg('Align the face inside the frame and hold still');
    })();

    return () => {
      cancelled = true;
      detection.stopDetectionLoop();
      camera.stop();
    };
  }, [open]);

  // Detection loop — capture descriptors automatically while we're below the
  // sample budget. Throttled by useFaceDetection.
  useEffect(() => {
    if (!open || (state !== 'ready' && state !== 'capturing')) return;
    if (!videoRef.current || !canvasRef.current) return;
    if (camera.status !== 'active' || detection.modelStatus !== 'ready') return;

    detection.startDetectionLoop(videoRef.current, canvasRef.current, (d) => {
      if (samplesRef.current.length >= SAMPLES_REQUIRED) return;

      if (!d.detected) {
        setStatusMsg('Position the face inside the frame');
        return;
      }
      if (d.multipleFaces) {
        setStatusMsg('Only one face at a time, please');
        return;
      }
      if (!d.descriptor) return;

      // Capture this sample
      samplesRef.current = [...samplesRef.current, d.descriptor];
      setSamples([...samplesRef.current]);
      setState('capturing');
      setStatusMsg(`Captured ${samplesRef.current.length}/${SAMPLES_REQUIRED} — keep holding still`);
    });

    return () => detection.stopDetectionLoop();
  }, [open, state, camera.status, detection.modelStatus, detection, videoRef]);

  // Once we have N samples, send the average to the backend.
  const enroll = useCallback(async () => {
    if (samplesRef.current.length < SAMPLES_REQUIRED) return;
    setState('saving');
    setStatusMsg('Saving face descriptor…');
    try {
      // Average the descriptors element-wise — gives a more stable anchor
      // than relying on any single noisy capture.
      const len = samplesRef.current[0].length;
      const avg = new Array<number>(len).fill(0);
      for (const s of samplesRef.current) {
        for (let i = 0; i < len; i++) avg[i] += s[i];
      }
      for (let i = 0; i < len; i++) avg[i] /= samplesRef.current.length;

      await api.checkin.enroll(clientId, avg);
      setState('success');
      setStatusMsg('Face enrolled successfully');
      onEnrolled?.();
    } catch (e: any) {
      setState('error');
      setError(e?.message || 'Failed to save face descriptor');
    }
  }, [clientId, onEnrolled]);

  useEffect(() => {
    if (samples.length === SAMPLES_REQUIRED && state === 'capturing') {
      enroll();
    }
  }, [samples, state, enroll]);

  function retry() {
    samplesRef.current = [];
    setSamples([]);
    setError('');
    setState('ready');
    setStatusMsg('Align the face inside the frame and hold still');
  }

  if (!open) return null;

  const progressPct = Math.min(100, (samples.length / SAMPLES_REQUIRED) * 100);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(15,23,42,0.78)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-surface,#fff)', color: 'var(--text)',
          borderRadius: 16, maxWidth: 560, width: '100%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.35)', overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '1rem 1.25rem', borderBottom: '1px solid var(--line)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Scan size={20} color="var(--brand,#6366f1)" />
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Enroll Face</div>
              {clientName && (
                <div style={{ fontSize: 12, color: 'var(--text2)' }}>for {clientName}</div>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              fontSize: 22, color: 'var(--text2)', lineHeight: 1,
            }}
            aria-label="Close"
          >×</button>
        </div>

        {/* Camera */}
        <div style={{ position: 'relative', background: '#000', aspectRatio: '4 / 3' }}>
          <video
            ref={videoRef}
            playsInline
            autoPlay
            muted
            style={{
              width: '100%', height: '100%', objectFit: 'cover',
              transform: 'scaleX(-1)',  // mirror — feels more natural
              display: camera.status === 'active' ? 'block' : 'none',
            }}
          />
          <canvas
            ref={canvasRef}
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              transform: 'scaleX(-1)',
              pointerEvents: 'none',
            }}
          />
          {/* Reticle */}
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
          }}>
            <div style={{
              width: '60%', aspectRatio: '3/4',
              border: '3px dashed rgba(255,255,255,0.55)',
              borderRadius: '50% / 40%',
              boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)',
            }} />
          </div>
          {/* State overlays */}
          {(state === 'loading' || state === 'saving') && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0,0,0,0.45)', color: '#fff', gap: 10,
            }}>
              <Loader2 size={20} className="spin" /> {statusMsg}
            </div>
          )}
          {state === 'success' && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(34,197,94,0.35)', color: '#fff', flexDirection: 'column', gap: 6,
            }}>
              <CheckCircle2 size={42} />
              <div style={{ fontWeight: 700 }}>Face enrolled</div>
            </div>
          )}
          {state === 'error' && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(239,68,68,0.4)', color: '#fff', flexDirection: 'column', gap: 6,
            }}>
              <XCircle size={42} />
              <div style={{ fontWeight: 700, padding: '0 1rem', textAlign: 'center' }}>{error || statusMsg}</div>
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div style={{
          height: 6, background: 'var(--line,#e5e7eb)', position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0,
            width: `${progressPct}%`,
            background: state === 'success' ? '#22c55e' : 'var(--brand,#6366f1)',
            transition: 'width .25s ease',
          }} />
        </div>

        {/* Status / actions */}
        <div style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '.75rem', flexWrap: 'wrap' }}>
          <div style={{ fontSize: 13, color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Camera size={14} />
            <span>{statusMsg}</span>
          </div>
          <div style={{ display: 'flex', gap: '.5rem' }}>
            {state === 'error' || state === 'success' ? (
              <>
                <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
                {state === 'error' && (
                  <button className="btn btn-primary btn-sm" onClick={retry}>
                    <RefreshCw size={14} /> Try again
                  </button>
                )}
              </>
            ) : (
              <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
