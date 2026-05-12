'use client';
/**
 * Face Check-In Page — production rebuild
 *
 * Flow: Load models → Start camera → Detect face → Blink anti-spoof
 *        → Recognize → POST to /api/checkin/face → Show result
 * Fallback: Manual name/mobile search → mark attendance via API
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import Guard from '@/components/Guard';
import AppShell from '@/components/AppShell';
import { useCamera } from '@/hooks/useCamera';
import { useFaceDetection } from '@/hooks/useFaceDetection';
import { useAntiSpoof } from '@/hooks/useAntiSpoof';
import { api } from '@/lib/api';
import { fmtDate } from '@/lib/format';
import {
  Camera, ScanFace, User, Search, CheckCircle2, XCircle,
  Loader2, RefreshCw, AlertTriangle, Clock, Volume2, VolumeX,
  Wifi, WifiOff,
} from 'lucide-react';
import type { CheckInState, CheckInResult, DetectionResult } from '@/types/checkin';

type RecentRow = {
  id: string; name: string; time: string;
  status: 'success' | 'manual' | 'failed';
  memberId?: string; membershipStatus?: string;
};

const STATUS_CFG: Record<CheckInState, { color: string; label: string; Icon: any }> = {
  idle:          { color: '#94a3b8', label: 'Idle',             Icon: ScanFace },
  loading:       { color: '#6366f1', label: 'Loading models…',  Icon: Loader2 },
  ready:         { color: '#6366f1', label: 'Scanning',         Icon: ScanFace },
  liveness:      { color: '#f59e0b', label: 'Please blink',     Icon: User },
  recognizing:   { color: '#3b82f6', label: 'Recognizing…',    Icon: Loader2 },
  checking_in:   { color: '#3b82f6', label: 'Checking in…',    Icon: Loader2 },
  success:       { color: '#22c55e', label: 'Check-in OK',      Icon: CheckCircle2 },
  fail_unknown:  { color: '#ef4444', label: 'Not recognized',   Icon: XCircle },
  fail_expired:  { color: '#ef4444', label: 'Membership issue', Icon: AlertTriangle },
  fail_multiple: { color: '#f59e0b', label: 'One person only',  Icon: AlertTriangle },
  no_permission: { color: '#ef4444', label: 'Camera blocked',   Icon: Camera },
  error:         { color: '#ef4444', label: 'Error',            Icon: XCircle },
};

export default function CheckInPage() {
  return <Guard><CheckInContent /></Guard>;
}

function CheckInContent() {
  const camera    = useCamera();
  const detection = useFaceDetection();
  const antiSpoof = useAntiSpoof();
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const cooldownRef = useRef<number>(0);
  const autoRetryRef= useRef<ReturnType<typeof setTimeout>>();

  const [state,      setState]      = useState<CheckInState>('idle');
  const [statusMsg,  setStatusMsg]  = useState('Starting…');
  const [result,     setResult]     = useState<CheckInResult | null>(null);
  const [voiceOn,    setVoiceOn]    = useState(true);
  const [recents,    setRecents]    = useState<RecentRow[]>([]);
  const [search,     setSearch]     = useState('');
  const [clients,    setClients]    = useState<any[]>([]);
  const [manualBusy, setManualBusy] = useState(false);
  const [isOnline,   setIsOnline]   = useState(true);

  // Network
  useEffect(() => {
    const up   = () => setIsOnline(true);
    const down = () => setIsOnline(false);
    window.addEventListener('online',  up);
    window.addEventListener('offline', down);
    setIsOnline(navigator.onLine);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);

  // Voice
  const speak = useCallback((text: string) => {
    if (!voiceOn || !('speechSynthesis' in window)) return;
    try { window.speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.rate = 1.05; window.speechSynthesis.speak(u); } catch {}
  }, [voiceOn]);

  // Persist recents
  const pushRecent = useCallback((row: RecentRow) => {
    setRecents((prev) => {
      const next = [row, ...prev].slice(0, 30);
      try { localStorage.setItem('619_checkins_today', JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  useEffect(() => {
    try { const s = localStorage.getItem('619_checkins_today'); if (s) setRecents(JSON.parse(s)); } catch {}
    api.clients.list({ status: 'active', limit: 500 })
      .then((r: any) => setClients(Array.isArray(r) ? r : (r?.clients ?? [])))
      .catch(() => {});
  }, []);

  // Recognition
  const runRecognition = useCallback(async (descriptor: Float32Array) => {
    setState('checking_in'); setStatusMsg('Verifying…');
    try {
      const data = await api.checkin.face(Array.from(descriptor));
      if (!data.success) {
        setResult({ success: false, message: data.error || 'Not recognized' });
        setState('fail_unknown'); setStatusMsg('Not recognized — try again');
        speak('Face not recognized');
        pushRecent({ id: crypto.randomUUID(), name: 'Unknown', time: nowTime(), status: 'failed' });
      } else {
        const ms = (data.member?.status || 'active').toLowerCase();
        const ok = ms === 'active';
        setResult({ success: ok, message: ok ? `Welcome, ${data.member!.name}!` : `Membership ${ms}`, clientId: data.member!.id, clientName: data.member!.name, membershipStatus: ms as any });
        setState(ok ? 'success' : 'fail_expired');
        setStatusMsg(ok ? `Welcome ${data.member!.name}` : `Membership ${ms}`);
        speak(ok ? `Welcome, ${data.member!.name}` : `Membership ${ms}. Please contact reception.`);
        pushRecent({ id: crypto.randomUUID(), name: data.member!.name, time: nowTime(), status: ok ? 'success' : 'failed', memberId: data.member!.id, membershipStatus: ms });
      }
    } catch {
      setResult({ success: false, message: 'Network error' });
      setState('error'); setStatusMsg('Network error');
      speak('Network error');
    }
    clearTimeout(autoRetryRef.current);
    autoRetryRef.current = setTimeout(() => retry(), 6000);
  }, [speak, pushRecent]); // eslint-disable-line

  // Detection callback
  const handleDetection = useCallback((d: DetectionResult) => {
    if (Date.now() < cooldownRef.current) return;
    if (!d.detected) { if (state === 'ready' || state === 'liveness') setStatusMsg('Position your face in the guide'); return; }
    if (d.multipleFaces) { setState('fail_multiple'); setStatusMsg('One person at a time'); cooldownRef.current = Date.now() + 2500; return; }
    if (d.landmarks) antiSpoof.processFaceLandmarks(d.landmarks);
    if (!antiSpoof.blinkDetected) { setState('liveness'); setStatusMsg('Please blink once to verify'); return; }
    if (state !== 'recognizing' && state !== 'checking_in' && d.descriptor) {
      setState('recognizing'); setStatusMsg('Analyzing face…');
      cooldownRef.current = Date.now() + 5000;
      void runRecognition(d.descriptor);
    }
  }, [state, antiSpoof, runRecognition]);

  // Retry
  const retry = useCallback(() => {
    clearTimeout(autoRetryRef.current);
    antiSpoof.reset(); cooldownRef.current = 0; setResult(null);
    setState(camera.status === 'active' ? 'ready' : 'idle');
    setStatusMsg(camera.status === 'active' ? 'Position your face in the guide' : 'Starting camera…');
  }, [antiSpoof, camera.status]);

  // Init
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setState('loading'); setStatusMsg('Loading face recognition models…');
      const ok = await detection.loadModels();
      if (cancelled) return;
      if (!ok) { setState('error'); setStatusMsg('Could not load models — check /public/models/'); return; }
      setStatusMsg('Starting camera…');
      const camOk = await camera.start();
      if (cancelled) return;
      if (!camOk) { setState('no_permission'); setStatusMsg(camera.error || 'Camera unavailable'); return; }
      setState('ready'); setStatusMsg('Position your face in the guide');
    })();
    return () => {
      cancelled = true;
      detection.stopDetectionLoop(); camera.stop();
      clearTimeout(autoRetryRef.current);
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    };
  }, []); // eslint-disable-line

  // Start detection loop once camera + models are ready
  useEffect(() => {
    if (camera.status !== 'active' || detection.modelStatus !== 'ready') return;
    if (!camera.videoRef.current || !canvasRef.current) return;
    detection.startDetectionLoop(camera.videoRef.current, canvasRef.current, handleDetection);
    return () => detection.stopDetectionLoop();
  }, [camera.status, detection.modelStatus, handleDetection]);

  // Manual check-in
  const manualCheckIn = async (client: any) => {
    setManualBusy(true); setSearch('');
    try {
      await api.attendance.mark({ type: 'client', ref_id: client.id, ref_name: client.name, date: new Date().toISOString().split('T')[0], check_in: nowTime(), status: 'present', notes: 'manual' });
      pushRecent({ id: crypto.randomUUID(), name: client.name, time: nowTime(), status: 'manual', memberId: client.id });
      speak(`${client.name} checked in`);
    } catch {}
    setManualBusy(false);
  };

  const searchResults = search.trim()
    ? clients.filter((c) => { const q = search.toLowerCase(); return (c.name || '').toLowerCase().includes(q) || (c.mobile || '').includes(q) || (c.member_code || '').toLowerCase().includes(q); }).slice(0, 6)
    : [];

  const sc = STATUS_CFG[state];
  const StatusIcon = sc.Icon;
  const isSpinning = ['loading','recognizing','checking_in'].includes(state);
  const isSuccess  = state === 'success';
  const isError    = ['fail_unknown','fail_expired','fail_multiple','no_permission','error'].includes(state);
  const showRetry  = isSuccess || isError;

  return (
    <AppShell>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">Face Check-In</h1>
            <p className="page-subtitle">Live recognition · {fmtDate(new Date())}</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: isOnline ? 'var(--success)' : 'var(--danger)' }}>
              {isOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
              {isOnline ? 'Online' : 'Offline'}
            </span>
            <button className="btn btn-outline btn-sm btn-icon" onClick={() => setVoiceOn(v => !v)} title="Toggle voice">
              {voiceOn ? <Volume2 size={14} /> : <VolumeX size={14} />}
            </button>
            <span className="badge badge-neutral"><Clock size={10} style={{ marginRight: 4 }} />{recents.length} today</span>
          </div>
        </div>
      </div>

      <div className="checkin-layout">
        {/* Camera column */}
        <div className="card" style={{ overflow: 'hidden' }}>
          {/* Camera viewport */}
          <div className="camera-wrap">
            <video ref={camera.videoRef} className="camera-video" autoPlay playsInline muted />
            <canvas ref={canvasRef} className="camera-canvas" />
            <div className="camera-overlay" style={{ background: isSuccess ? 'rgba(34,197,94,0.15)' : isError ? 'rgba(239,68,68,0.15)' : 'transparent' }} />
            {(state === 'ready' || state === 'liveness' || state === 'recognizing') && (
              <div className="camera-guide" style={{ borderColor: state === 'liveness' ? '#f59e0b' : state === 'recognizing' ? '#3b82f6' : 'rgba(255,255,255,0.35)' }} />
            )}
            {(state === 'ready' || state === 'recognizing') && <div className="camera-scan" />}
            <div className="camera-pill" style={{ color: sc.color }}>
              <div className="camera-pill-dot" />
              <StatusIcon size={12} style={isSpinning ? { animation: 'spin 0.9s linear infinite' } : {}} />
              <span>{sc.label}</span>
            </div>
          </div>

          {/* Status bar */}
          <div role="status" aria-live="polite" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: sc.color + '14', borderBottom: `1px solid ${sc.color}25`, fontSize: 12, fontWeight: 500, color: sc.color }}>
            <StatusIcon size={13} style={isSpinning ? { animation: 'spin 0.9s linear infinite' } : {}} />
            {statusMsg}
          </div>

          {/* Result panel */}
          {result && (
            <div className="animate-slide-up" style={{ padding: '14px 20px', background: isSuccess ? 'var(--success-bg)' : 'var(--danger-bg)', borderBottom: `1px solid ${isSuccess ? 'var(--success-border)' : 'var(--danger-border)'}`, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: isSuccess ? 'var(--success)' : 'var(--danger)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {isSuccess ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{result.clientName || result.message}</div>
                {result.clientName && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{result.message}</div>}
              </div>
            </div>
          )}

          {/* Controls */}
          <div style={{ padding: '12px 20px', display: 'flex', gap: 10 }}>
            {showRetry && (
              <button className="btn btn-primary btn-sm" onClick={retry} style={{ flex: 1 }}>
                <RefreshCw size={13} /> Retry scan
              </button>
            )}
            {state === 'no_permission' && (
              <button className="btn btn-primary btn-sm" onClick={() => camera.start()} style={{ flex: 1 }}>
                <Camera size={13} /> Enable camera
              </button>
            )}
          </div>

          <div style={{ padding: '0 20px 12px', fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 5, alignItems: 'center' }}>
            <AlertTriangle size={10} />
            Only face descriptors are transmitted — no images or video.
          </div>
        </div>

        {/* Right panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Manual search */}
          <div className="card">
            <div className="card-header" style={{ padding: '12px 16px' }}>
              <span className="card-title" style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Search size={13} /> Manual Check-In
              </span>
            </div>
            <div style={{ padding: '12px 14px' }}>
              <div className="search-bar" style={{ minWidth: 0 }}>
                <Search size={13} style={{ flexShrink: 0 }} />
                <input placeholder="Name, ID, or mobile…" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              {searchResults.length > 0 && (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {searchResults.map((c) => (
                    <button key={c.id} onClick={() => manualCheckIn(c)} disabled={manualBusy}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, width: '100%', border: '1px solid var(--border)', background: 'var(--bg-card)', cursor: 'pointer', textAlign: 'left', fontSize: 13 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--brand-soft)', color: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{(c.name || '').slice(0,2).toUpperCase()}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.member_code || c.client_id}</div>
                      </div>
                      <span className={`badge badge-${c.status || 'active'}`}>{c.status}</span>
                    </button>
                  ))}
                </div>
              )}
              {manualBusy && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, display: 'flex', gap: 6, alignItems: 'center' }}><Loader2 size={12} style={{ animation: 'spin 0.9s linear infinite' }} /> Checking in…</div>}
            </div>
          </div>

          {/* Recents */}
          <div className="card">
            <div className="card-header" style={{ padding: '12px 16px' }}>
              <span className="card-title" style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Clock size={13} /> Recent Check-ins
              </span>
              {recents.length > 0 && (
                <button className="btn btn-ghost btn-xs" onClick={() => { setRecents([]); try { localStorage.removeItem('619_checkins_today'); } catch {} }}>Clear</button>
              )}
            </div>
            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
              {recents.length === 0 ? (
                <div className="empty-state" style={{ padding: '28px 16px' }}>
                  <div className="empty-icon"><ScanFace size={18} /></div>
                  <div className="empty-desc">No check-ins recorded yet today</div>
                </div>
              ) : (
                recents.map((r) => (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: r.status === 'success' ? 'var(--success)' : r.status === 'failed' ? 'var(--danger)' : 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>
                      {r.name.slice(0,2).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.time}</div>
                    </div>
                    <span className={r.status === 'success' ? 'badge badge-active' : r.status === 'failed' ? 'badge badge-expired' : 'badge badge-neutral'}>{r.status}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function nowTime() {
  return new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}
