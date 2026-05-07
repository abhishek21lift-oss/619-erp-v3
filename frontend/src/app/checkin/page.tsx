'use client';
/**
 * Face Check-in Page
 *
 * Complete WebRTC + face-api.js based check-in flow:
 *   1. Auto-start camera on mount
 *   2. Live face detection w/ bounding box overlay
 *   3. Anti-spoof: blink detection (Eye Aspect Ratio)
 *   4. Multi-face guard: blocks check-in if >1 face in frame
 *   5. Recognition: 128-D descriptor compared against stored member db
 *   6. Posts to /api/checkin/face for verification + log
 *   7. Voice + visual feedback (green/red), retry, manual fallback
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import Guard from '@/components/Guard';
import AppShell from '@/components/AppShell';
import CameraFeed from '@/components/checkin/CameraFeed';
import { useCamera } from '@/hooks/useCamera';
import { useFaceDetection } from '@/hooks/useFaceDetection';
import { useAntiSpoof } from '@/hooks/useAntiSpoof';
import { api } from '@/lib/api';
import { fmtDate } from '@/lib/format';
import {
  Camera, Scan, User, Search, CheckCircle2, XCircle,
  Loader2, RefreshCw, AlertTriangle, Clock, Volume2, VolumeX,
} from 'lucide-react';
import type { CheckInState, CheckInResult, DetectionResult } from '@/types/checkin';

export default function CheckInPage() {
  return <Guard><CheckInContent /></Guard>;
}

type RecentRow = {
  id: string;
  name: string;
  time: string;
  status: 'success' | 'manual' | 'failed';
  memberId?: string;
  photoUrl?: string;
  membershipStatus?: string;
};

function CheckInContent() {
  const camera = useCamera();
  const detection = useFaceDetection();
  const antiSpoof = useAntiSpoof();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cooldownRef = useRef<number>(0);

  const [state, setState] = useState<CheckInState>('idle');
  const [statusMsg, setStatusMsg] = useState('Initializing camera...');
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [voiceOn, setVoiceOn] = useState(true);
  const [recents, setRecents] = useState<RecentRow[]>([]);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [manualBusy, setManualBusy] = useState(false);

  const speak = useCallback((text: string) => {
    if (!voiceOn) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.05;
      u.volume = 0.9;
      window.speechSynthesis.speak(u);
    } catch { /* ignore */ }
  }, [voiceOn]);

  const saveRecents = useCallback((list: RecentRow[]) => {
    setRecents(list);
    try { localStorage.setItem('619_checkins_today', JSON.stringify(list)); } catch { /* ignore */ }
  }, []);

  const pushRecent = useCallback((row: RecentRow) => {
    setRecents(prev => {
      const next = [row, ...prev].slice(0, 25);
      try { localStorage.setItem('619_checkins_today', JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  useEffect(() => {
    api.clients.list({ status: 'active', limit: 500 })
      .then((r: any) => setClients(Array.isArray(r) ? r : (r?.clients ?? [])))
      .catch(() => {});
    try {
      const saved = localStorage.getItem('619_checkins_today');
      if (saved) setRecents(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!search.trim()) { setSearchResults([]); return; }
    const s = search.toLowerCase();
    setSearchResults(
      clients.filter(c =>
        c.name?.toLowerCase().includes(s) ||
        (c.mobile || '').includes(s) ||
        (c.member_code || '').toLowerCase().includes(s)
      ).slice(0, 6)
    );
  }, [search, clients]);

  const runRecognition = useCallback(async (descriptor: Float32Array) => {
    setState('checking_in');
    setStatusMsg('Verifying with server...');
    try {
      const desc = Array.from(descriptor);
      const data = await api.checkin.face(desc).catch((e: any) => ({
        success: false,
        error: e?.message || 'Network error',
        message: 'Network error',
      } as any));

      if (!data.success) {
        setResult({ success: false, message: data.error || data.message || 'Face not recognized' });
        setState('fail_unknown');
        setStatusMsg('Face not recognized');
        speak('Face not recognized');
        pushRecent({
          id: Math.random().toString(36).slice(2),
          name: 'Unknown',
          time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
          status: 'failed',
        });
        return;
      }

      const memberStatus = (data.member?.status || '').toLowerCase();
      if (memberStatus === 'expired' || memberStatus === 'frozen') {
        setResult({
          success: false,
          message: 'Membership ' + memberStatus,
          clientId: data.member!.id,
          clientName: data.member!.name,
          membershipStatus: memberStatus as any,
        });
        setState('fail_expired');
        setStatusMsg('Membership ' + memberStatus + '. Please contact reception.');
        speak('Membership ' + memberStatus);
        pushRecent({
          id: Math.random().toString(36).slice(2),
          name: data.member!.name,
          time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
          status: 'failed',
          memberId: data.member!.id,
          photoUrl: data.member!.photo_url,
          membershipStatus: memberStatus,
        });
        return;
      }

      setResult({
        success: true,
        message: 'Welcome ' + data.member!.name,
        clientId: data.member!.id,
        clientName: data.member!.name,
        membershipStatus: 'active',
      });
      setState('success');
      setStatusMsg('Check-in successful - Welcome ' + data.member!.name + '!');
      speak('Welcome ' + data.member!.name);
      pushRecent({
        id: Math.random().toString(36).slice(2),
        name: data.member!.name,
        time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        status: 'success',
        memberId: data.member!.id,
        photoUrl: data.member!.photo_url,
        membershipStatus: 'active',
      });
    } catch (err: any) {
      setResult({ success: false, message: 'Network error' });
      setState('error');
      setStatusMsg('Network error - please try again');
      speak('Network error');
    }
  }, [pushRecent, speak]);

  const handleDetection = useCallback((d: DetectionResult) => {
    if (Date.now() < cooldownRef.current) return;

    if (!d.detected) {
      if (state === 'ready' || state === 'liveness') {
        setStatusMsg('Position your face inside the frame');
      }
      return;
    }

    if (d.multipleFaces) {
      setState('fail_multiple');
      setStatusMsg('Only one person allowed in frame');
      cooldownRef.current = Date.now() + 2500;
      return;
    }

    if (d.landmarks) antiSpoof.processFaceLandmarks(d.landmarks);

    if (!antiSpoof.blinkDetected) {
      setState('liveness');
      setStatusMsg('Please blink to confirm liveness');
      return;
    }

    if (state !== 'recognizing' && state !== 'checking_in' && d.descriptor) {
      setState('recognizing');
      setStatusMsg('Recognizing...');
      cooldownRef.current = Date.now() + 4000;
      void runRecognition(d.descriptor);
    }
  }, [state, antiSpoof, runRecognition]);

  const retry = useCallback(() => {
    antiSpoof.reset();
    cooldownRef.current = 0;
    setResult(null);
    setState(camera.status === 'active' ? 'ready' : 'idle');
    setStatusMsg(camera.status === 'active'
      ? 'Position your face inside the frame'
      : 'Starting camera...');
  }, [antiSpoof, camera.status]);

  // Auto-start camera + load models
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setState('loading');
      setStatusMsg('Loading face recognition models...');
      const ok = await detection.loadModels();
      if (!ok || cancelled) {
        if (!cancelled) {
          setState('error');
          setStatusMsg('Could not load face models');
        }
        return;
      }
      setStatusMsg('Starting camera...');
      const camOk = await camera.start();
      if (cancelled) return;
      if (!camOk) {
        setState('no_permission');
        setStatusMsg(camera.error || 'Camera unavailable');
        return;
      }
      setState('ready');
      setStatusMsg('Position your face inside the frame');
    })();

    return () => {
      cancelled = true;
      detection.stopDetectionLoop();
      camera.stop();
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  useEffect(() => {
    if (camera.status !== 'active' || detection.modelStatus !== 'ready') return;
    if (!camera.videoRef.current || !canvasRef.current) return;
    detection.startDetectionLoop(
      camera.videoRef.current,
      canvasRef.current,
      handleDetection
    );
    return () => detection.stopDetectionLoop();
  }, [camera.status, detection.modelStatus, handleDetection]);

  async function manualCheckIn(client: any) {
    setManualBusy(true);
    setSearch('');
    setSearchResults([]);
    try {
      await api.attendance.mark({
        type: 'client',
        ref_id: client.id,
        ref_name: client.name,
        date: new Date().toISOString().split('T')[0],
        check_in: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        status: 'present',
        notes: 'manual',
      });
      pushRecent({
        id: Math.random().toString(36).slice(2),
        name: client.name,
        time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        status: 'manual',
        memberId: client.id,
        photoUrl: client.photo_url,
      });
    } catch (err) { /* ignore */ }
    setManualBusy(false);
  }

  const statusConfig: Record<CheckInState, { color: string; icon: any; label: string }> = {
    idle:           { color: '#94a3b8', icon: Scan,         label: 'Idle' },
    loading:        { color: '#3b82f6', icon: Loader2,      label: 'Loading' },
    ready:          { color: '#6366f1', icon: Scan,         label: 'Scanning' },
    liveness:       { color: '#f59e0b', icon: User,         label: 'Blink to confirm' },
    recognizing:    { color: '#3b82f6', icon: Loader2,      label: 'Recognizing' },
    checking_in:    { color: '#3b82f6', icon: Loader2,      label: 'Checking in' },
    success:        { color: '#22c55e', icon: CheckCircle2, label: 'Success' },
    fail_unknown:   { color: '#ef4444', icon: XCircle,      label: 'Not recognized' },
    fail_expired:   { color: '#ef4444', icon: AlertTriangle,label: 'Expired' },
    fail_multiple:  { color: '#ef4444', icon: AlertTriangle,label: 'Multiple faces' },
    no_permission:  { color: '#ef4444', icon: AlertTriangle,label: 'No camera' },
    error:          { color: '#ef4444', icon: XCircle,      label: 'Error' },
  };
  const sc = statusConfig[state];
  const Icon = sc.icon;

  const isSuccess = state === 'success';
  const isError = state === 'fail_unknown' || state === 'fail_expired'
    || state === 'fail_multiple' || state === 'no_permission' || state === 'error';
  const showRetry = isSuccess || isError;
  const overlayColor = isSuccess ? 'rgba(34,197,94,0.25)'
    : isError ? 'rgba(239,68,68,0.25)' : 'transparent';
  const overlayOpacity = (isSuccess || isError) ? 1 : 0;
  const isSpinning = state === 'loading' || state === 'recognizing' || state === 'checking_in';

  return (
    <AppShell>
      <div className="page-main page-enter">
        <div className="page-content">

          <div className="checkin-page-header">
            <div>
              <h1 className="checkin-title">Face Check-In</h1>
              <p className="checkin-subtitle">
                Live face recognition · {fmtDate(new Date())}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button
                className="btn btn-ghost"
                onClick={() => setVoiceOn(v => !v)}
                title={voiceOn ? 'Mute voice feedback' : 'Enable voice feedback'}
                aria-label="Toggle voice feedback"
                style={{ padding: '0.45rem 0.7rem' }}
              >
                {voiceOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
              </button>
              <div className="checkin-today-badge">
                <Clock size={14} />
                <span>{recents.length} today</span>
              </div>
            </div>
          </div>

          <div className="checkin-layout">

            <div className="checkin-camera-panel card">
              <div className="checkin-camera-header">
                <Camera size={16} />
                <span>Face Recognition</span>
              </div>

              <CameraFeed
                videoRef={camera.videoRef}
                canvasRef={canvasRef}
                isActive={camera.status === 'active'}
                frameColor={sc.color}
                overlayColor={overlayColor}
                overlayOpacity={overlayOpacity}
                resultTone={isSuccess ? 'success' : isError ? 'error' : null}
                showScan={state === 'ready' || state === 'liveness' || state === 'recognizing'}
              />

              <div
                className="checkin-status-bar"
                style={{ borderColor: sc.color + '40', background: sc.color + '10' }}
                role="status"
                aria-live="polite"
              >
                <div className="checkin-status-dot" style={{ background: sc.color }} />
                <Icon size={14} color={sc.color} className={isSpinning ? 'spin' : ''} />
                <span style={{ color: sc.color, fontWeight: 600, fontSize: '0.85rem' }}>{sc.label}</span>
                {statusMsg && <span className="checkin-status-msg">· {statusMsg}</span>}
              </div>

              {result && (
                <div
                  className="checkin-result-card"
                  style={{
                    background: isSuccess ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
                    borderColor: isSuccess ? '#22c55e' : '#ef4444',
                  }}
                >
                  {result.clientId ? (
                    <>
                      <div
                        className="checkin-result-photo"
                        style={{
                          background: isSuccess ? '#22c55e' : '#ef4444',
                          color: '#fff',
                        }}
                      >
                        {result.clientName?.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="checkin-result-body">
                        <div className="checkin-result-name">{result.clientName}</div>
                        <div className="checkin-result-meta">
                          <span className={'badge badge-' + (result.membershipStatus || 'inactive')}>
                            {result.membershipStatus}
                          </span>
                          <span className="checkin-result-msg">{result.message}</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="checkin-result-body">
                      <div className="checkin-result-name">{result.message}</div>
                    </div>
                  )}
                </div>
              )}

              <div className="checkin-camera-controls">
                {showRetry && (
                  <button className="btn btn-primary btn-block" onClick={retry}>
                    <RefreshCw size={16} /> Retry
                  </button>
                )}
                {state === 'no_permission' && (
                  <button className="btn btn-primary btn-block" onClick={() => camera.start()}>
                    <Camera size={16} /> Enable Camera
                  </button>
                )}
              </div>

              <div className="checkin-privacy-note">
                <AlertTriangle size={12} />
                <span>Camera processed locally. Only face descriptors are sent to the server.</span>
              </div>
            </div>

            <div className="checkin-right">

              <div className="card checkin-manual-panel">
                <div className="checkin-manual-header">
                  <Search size={16} />
                  <span>Manual Check-In</span>
                </div>
                <div className="checkin-search-wrap">
                  <Search size={14} className="checkin-search-icon" />
                  <input
                    className="checkin-search-input"
                    placeholder="Search by name, ID, or mobile..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
                {searchResults.length > 0 && (
                  <div className="checkin-results">
                    {searchResults.map(c => (
                      <button key={c.id} className="checkin-result-row" onClick={() => manualCheckIn(c)}>
                        <div className="checkin-result-avatar">{c.name?.slice(0, 2).toUpperCase()}</div>
                        <div className="checkin-result-info">
                          <div className="checkin-result-name">{c.name}</div>
                          <div className="checkin-result-meta">
                            {c.member_code || c.client_id} · {c.package_type || 'Member'}
                            {c.pt_end_date && ' · Ends ' + fmtDate(c.pt_end_date)}
                          </div>
                        </div>
                        <span className={'badge badge-' + c.status}>{c.status}</span>
                      </button>
                    ))}
                  </div>
                )}
                {manualBusy && (
                  <div className="checkin-checking-msg">
                    <Loader2 size={14} className="spin" /> Checking in...
                  </div>
                )}
              </div>

              <div className="card" style={{ marginTop: '1rem' }}>
                <div className="card-header-row">
                  <span className="card-title"><Clock size={15} /> Recent Check-ins</span>
                  {recents.length > 0 && (
                    <button className="btn-link" onClick={() => saveRecents([])}>Clear</button>
                  )}
                </div>
                <div className="checkin-history">
                  {recents.length === 0 ? (
                    <div className="checkin-empty">No check-ins recorded yet today</div>
                  ) : (
                    recents.map(r => (
                      <div key={r.id} className="checkin-history-row">
                        <div
                          className="checkin-history-avatar"
                          style={{
                            background: r.status === 'failed' ? '#ef4444'
                              : r.status === 'success' ? '#22c55e'
                              : '#6366f1',
                          }}
                        >
                          {r.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="checkin-history-info">
                          <div className="checkin-history-name">{r.name}</div>
                          <div className="checkin-history-time">{r.time}</div>
                        </div>
                        <span className={'checkin-badge-' + r.status}>
                          {r.status === 'success' ? <CheckCircle2 size={14} />
                            : r.status === 'failed' ? <XCircle size={14} />
                            : <User size={14} />}
                          {r.status}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
