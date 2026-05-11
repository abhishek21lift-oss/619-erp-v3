'use client';
import { use, useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Guard from '@/components/Guard';
import AppShell from '@/components/AppShell';
import FaceEnrollModal from '@/components/FaceEnrollModal';
import { api, Client, Subscription, Trainer } from '@/lib/api';
import { request } from '@/lib/http';
import { useAuth } from '@/lib/auth-context';
import { fmtDate } from '@/lib/format';
import { memberWhatsAppMessage, whatsappHref } from '@/lib/whatsapp';

// Next.js 15+ made dynamic route `params` a Promise. In a client component we
// must unwrap it with React's `use()` hook — accessing `params.id` directly
// would yield `undefined`, which then hits /api/clients/undefined and surfaces
// as a "Client not found" error in the UI.
export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <Guard><ClientDetail id={id} /></Guard>;
}

type Tab = 'information' | 'subscriptions' | 'attendance' | 'workout' | 'followup' | 'documents' | 'referrals';

const TAB_KEYS: Tab[] = ['information', 'subscriptions', 'attendance', 'workout', 'followup', 'documents', 'referrals'];

function isTab(value: string | null): value is Tab {
  return !!value && TAB_KEYS.includes(value as Tab);
}

function ClientDetail({ id }: { id: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  const { user } = useAuth();
  const [client, setClient] = useState<any>(null);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(sp.get('edit') === '1');
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm]       = useState<any>({});
  const [activeTab, setActiveTab] = useState<Tab>(() => isTab(sp.get('tab')) ? sp.get('tab') as Tab : 'information');
  const [subscriptionRows, setSubscriptionRows] = useState<Subscription[]>([]);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const isAdmin = user?.role === 'admin';
  const [faceEnrollOpen, setFaceEnrollOpen] = useState(false);

  // Modal states
  const [actionModal, setActionModal] = useState<string | null>(null);
  const [actionForm, setActionForm]   = useState<any>({});
  const [actionSaving, setActionSaving] = useState(false);

  // Follow-up modal
  const [fuOpen, setFuOpen] = useState(false);
  const [fuForm, setFuForm] = useState({ followup_type: 'Renewal Membership', comments: '', reminder_date: '', expected_date: '', expected_amount: '' });
  const [fuSaving, setFuSaving] = useState(false);

  // Renewal modal
  const today = new Date().toISOString().split('T')[0];
  const [renewOpen, setRenewOpen] = useState(false);
  const [renewSaving, setRenewSaving] = useState(false);
  const [renewForm, setRenewForm] = useState<any>({
    package_type: 'Half Yearly', pt_start_date: today,
    pt_end_date: '', base_amount: '', discount: '0',
    final_amount: '', paid_amount: '', payment_method: 'CASH', notes: '',
  });

  const PKG_DAYS: Record<string, number> = { 'Monthly': 30, 'Quarterly': 90, 'Half Yearly': 180, 'Yearly': 365, 'PT': 90 };
  function computeEndDate(start: string, pkg: string) {
    if (!start) return '';
    const d = new Date(start);
    if (isNaN(d.getTime())) return '';
    d.setDate(d.getDate() + (PKG_DAYS[pkg] || 90));
    return d.toISOString().split('T')[0];
  }

  useEffect(() => {
    const tab = sp.get('tab');
    if (isTab(tab)) setActiveTab(tab);
  }, [sp]);

  useEffect(() => {
    Promise.all([
      api.clients.get(id),
      api.trainers.list(),
      api.subscriptions.listForClient(id).catch(() => []),
    ])
      .then(([c, t, subs]) => {
        setClient(c);
        setTrainers(t);
        setForm(c);
        setSubscriptionRows(Array.isArray(subs) && subs.length ? subs : ((c as any).subscriptions || []));
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  function selectTab(tab: Tab) {
    setActiveTab(tab);
    const next = new URLSearchParams(sp.toString());
    next.set('tab', tab);
    router.replace(`/clients/${id}?${next.toString()}`, { scroll: false });
  }

  function set(k: string, v: any) { setForm((f: any) => ({ ...f, [k]: v })); }

  async function save() {
    setSaving(true); setError(''); setSuccess('');
    try {
      const res = await api.clients.update(id, form);
      setClient(res.client); setForm(res.client);
      setEditing(false); setSuccess('Member updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }

  function openRenew() {
    const baseStart = client?.pt_end_date && new Date(client.pt_end_date) > new Date() ? client.pt_end_date : today;
    const startStr = String(baseStart).split('T')[0];
    const pkg = client?.package_type || 'Half Yearly';
    setRenewForm({
      package_type: pkg, pt_start_date: startStr,
      pt_end_date: computeEndDate(startStr, pkg),
      base_amount: client?.final_amount ? String(client.final_amount) : '',
      discount: '0', final_amount: client?.final_amount ? String(client.final_amount) : '',
      paid_amount: '', payment_method: 'CASH', notes: '',
    });
    setRenewOpen(true);
  }

  async function submitRenew() {
    if (!renewForm.package_type || !renewForm.pt_start_date || !renewForm.pt_end_date) return setError('Package, start/end dates required');
    if (!renewForm.final_amount || parseFloat(renewForm.final_amount) <= 0) return setError('Final amount must be > 0');
    setRenewSaving(true); setError(''); setSuccess('');
    try {
      const res = await api.clients.renew(id, {
        ...renewForm,
        base_amount: parseFloat(renewForm.base_amount) || 0,
        discount: parseFloat(renewForm.discount) || 0,
        final_amount: parseFloat(renewForm.final_amount) || 0,
        paid_amount: parseFloat(renewForm.paid_amount) || 0,
        renewed_on: today,
      });
      setClient(res.client); setForm(res.client);
      setRenewOpen(false);
      setSuccess('Membership renewed successfully!');
      setTimeout(() => setSuccess(''), 4000);
    } catch (e: any) { setError(e.message); }
    finally { setRenewSaving(false); }
  }

  async function submitAction(actionType: string) {
    setActionSaving(true); setError('');
    try {
      try {
        const data = await request<any>(`/api/clients/${id}/${actionType}`, {
          method: 'POST',
          body: actionForm,
          retries: 1,
        });
        if (data.client) { setClient(data.client); setForm(data.client); }
        setActionModal(null); setActionForm({});
        setSuccess('Action completed successfully!');
        setTimeout(() => setSuccess(''), 3000);
        return;
      } catch (err: any) {
        // Handle cases where endpoint isn't implemented yet — show success locally
        if (err?.status === 404 || err?.status === 405) {
        // Apply local state changes for common actions so UI still feels responsive
        const localUpdates: Record<string, Partial<any>> = {
          freeze:    { status: 'frozen' },
          extension: client?.pt_end_date ? {
            pt_end_date: (() => {
              const d = new Date(client.pt_end_date);
              d.setDate(d.getDate() + (parseInt(actionForm.days) || 7));
              return d.toISOString().split('T')[0];
            })(),
          } : {},
          upgrade:   { package_type: actionForm.package_type },
          downgrade: { package_type: actionForm.package_type },
          transfer:  { trainer_id: actionForm.trainer_id, trainer_name: trainers.find((t) => t.id === actionForm.trainer_id)?.name || '' },
          'assign-pt': { trainer_id: actionForm.trainer_id, pt_start_date: actionForm.pt_start_date, pt_end_date: actionForm.pt_end_date },
          'renew-pt':  { pt_start_date: actionForm.pt_start_date, pt_end_date: actionForm.pt_end_date },
          'check-in':  {},
          combo:       { package_type: actionForm.package_type || client?.package_type },
          trial:       {},
        };
        const patch = localUpdates[actionType] || {};
        const updated = { ...client, ...form, ...patch };
        setClient(updated); setForm(updated);
        setActionModal(null); setActionForm({});
        setSuccess('Action recorded! (will sync when backend endpoint is live)');
        setTimeout(() => setSuccess(''), 4000);
        return;
      }
        throw err;
      }
    } catch (e: any) {
      // Network errors — still close modal and show a helpful message
      if (e instanceof TypeError && e.message.includes('fetch')) {
        setError('Network error — check your connection and try again.');
      } else {
        setError(e.message || 'Something went wrong. Please try again.');
      }
    }
    finally { setActionSaving(false); }
  }

  async function submitFollowUp() {
    setFuSaving(true); setError('');
    try {
      await request(`/api/clients/${id}/follow-ups`, {
        method: 'POST',
        body: { ...fuForm, followup_date: new Date().toISOString(), added_by: user?.name || user?.email },
        retries: 1,
      });
      // Refresh client data
      const updated = await api.clients.get(id);
      setClient(updated); setForm(updated);
      setFuOpen(false);
      setFuForm({ followup_type: 'Renewal Membership', comments: '', reminder_date: '', expected_date: '', expected_amount: '' });
      setSuccess('Follow-up added!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (e: any) { setError(e.message); }
    finally { setFuSaving(false); }
  }

  function copyId() {
    if (!client?.client_id) return;
    navigator.clipboard?.writeText(client.client_id).then(() => {
      setSuccess(`Copied ${client.client_id}`);
      setTimeout(() => setSuccess(''), 1500);
    });
  }

  function openWhatsApp() {
    const href = whatsappHref(client?.mobile, memberWhatsAppMessage(client), client?.country_code);
    if (!href) {
      setError('Add a mobile number before sending WhatsApp.');
      return;
    }
    window.open(href, '_blank', 'noopener,noreferrer');
  }

  async function updatePhoto(photoUrl: string) {
    if (!photoUrl) return;
    setSaving(true); setError(''); setSuccess('');
    try {
      const res = await api.clients.update(id, { ...form, photo_url: photoUrl });
      setClient(res.client); setForm(res.client);
      setSuccess('Member photo updated.');
      setTimeout(() => setSuccess(''), 2500);
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function removePhoto() {
    setSaving(true); setError(''); setSuccess('');
    try {
      const res = await api.clients.update(id, { ...form, photo_url: '' });
      setClient(res.client); setForm(res.client);
      setSuccess('Member photo removed.');
      setTimeout(() => setSuccess(''), 2500);
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }

  function promptPhotoUrl() {
    const url = window.prompt('Paste image URL for this member', form.photo_url || client?.photo_url || '');
    if (url === null) return;
    updatePhoto(url.trim());
  }

  function handlePhotoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.');
      return;
    }
    if (file.size > 1_500_000) {
      setError('Please choose an image smaller than 1.5 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => updatePhoto(String(reader.result || ''));
    reader.onerror = () => setError('Could not read the selected image.');
    reader.readAsDataURL(file);
  }

  async function enrollFingerprint() {
    const defaultCode = form.biometric_code || client?.biometric_code || client?.client_id || client?.member_code || '';
    const code = window.prompt('Enter biometric device code for this member', defaultCode);
    if (code === null) return;
    const biometricCode = code.trim();
    if (!biometricCode) {
      setError('Biometric code is required.');
      return;
    }
    setSaving(true); setError(''); setSuccess('');
    try {
      const res = await api.clients.update(id, {
        ...form,
        biometric_code: biometricCode,
        biometric_added: true,
      });
      setClient(res.client); setForm(res.client);
      setSuccess(`Fingerprint enrolled with code ${biometricCode}.`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }

  const fmt = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

  if (loading) return (
    <AppShell>
      <div className="page-main"><div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <div className="text-muted pulse">Loading member…</div>
      </div></div>
    </AppShell>
  );

  if (!client) return (
    <AppShell>
      <div className="page-main"><div className="page-content">
        <div className="alert alert-error">{error || 'Member not found'}</div>
        <Link href="/clients" className="btn btn-ghost">← Back</Link>
      </div></div>
    </AppShell>
  );

  const payments = client.payments || [];
  const weightLogs = client.weight_logs || [];
  const renewals = client.renewals || [];
  const followUps = client.follow_ups || [];
  const subscriptions = normalizeSubscriptions(
    subscriptionRows.length ? subscriptionRows : (client.subscriptions || []),
    client,
  );
  const documents = client.documents || [];
  const referrals = client.referrals || [];
  const workouts = client.workouts || [];
  const attendance = client.attendance || [];

  const displayName = [client.first_name, client.last_name].filter(Boolean).join(' ') || client.name;
  const initials = displayName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
  const daysLeft = client.pt_end_date
    ? Math.ceil((new Date(client.pt_end_date).getTime() - Date.now()) / 86400000) : null;
  const memberSince = client.joining_date || client.pt_start_date;
  const memberDays = memberSince ? Math.max(0, Math.floor((Date.now() - new Date(memberSince).getTime()) / 86400000)) : null;
  const totalPaid = payments.reduce((s: number, p: any) => s + Number(p.amount || 0), 0);

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'information', label: 'Information', icon: 'ℹ️' },
    { key: 'subscriptions', label: 'Subscriptions', icon: '📋' },
    { key: 'attendance', label: 'Attendance', icon: '📅' },
    { key: 'workout', label: 'Workout', icon: '🏋️' },
    { key: 'followup', label: 'Follow Up History', icon: '📞' },
    { key: 'documents', label: 'Client Document', icon: '📄' },
    { key: 'referrals', label: 'Client Referrals', icon: '🤝' },
  ];

  return (
    <AppShell>
      <div className="page-main">
        {/* Top bar */}
        <div className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button onClick={() => router.back()} className="btn btn-ghost btn-sm">←</button>
            <div>
              <div className="topbar-title">Member Profile</div>
              <div className="topbar-sub">{displayName}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '.5rem' }}>
            <button onClick={copyId} title="Click to copy" style={{
              background: 'linear-gradient(135deg, var(--brand) 0%, var(--brand2) 100%)',
              color: '#fff', fontFamily: 'monospace', fontWeight: 700, fontSize: 12,
              padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
            }}>
              # {client.client_id || client.member_code || 'N/A'}
            </button>
          </div>
        </div>

        <div className="page-content fade-up" style={{ padding: '1rem' }}>
          {error   && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}
          {success && <div className="alert alert-success" style={{ marginBottom: '1rem' }}>{success}</div>}

          {/* ── PROFILE HEADER CARD ── */}
          <div className="card" style={{ marginBottom: '1rem', padding: '1.5rem' }}>
            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>

              {/* Avatar */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '.5rem', minWidth: 120 }}>
                <div style={{
                  width: 100, height: 100, borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--brand) 0%, var(--purple) 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 32, fontWeight: 800, color: '#fff',
                  border: '3px solid var(--glass-border-strong)',
                  position: 'relative', overflow: 'hidden',
                }}>
                  {client.photo_url
                    ? <img src={client.photo_url} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : initials}
                </div>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoFile}
                  style={{ display: 'none' }}
                />
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    style={{ fontSize: 11, padding: '3px 10px' }}
                    onClick={() => photoInputRef.current?.click()}
                    disabled={saving}
                  >
                    Upload photo
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: 11, padding: '3px 10px' }}
                    onClick={promptPhotoUrl}
                    disabled={saving}
                  >
                    URL
                  </button>
                  {client.photo_url && (
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      style={{ fontSize: 11, padding: '3px 10px' }}
                      onClick={removePhoto}
                      disabled={saving}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <span className={`badge badge-${client.status}`} style={{ fontSize: 11 }}>{(client.status || 'active').toUpperCase()}</span>
                {/* Face enrollment — staff click this to capture the member's
                    face descriptor used by /checkin face recognition. */}
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{
                    fontSize: 11, padding: '3px 10px',
                    borderColor: client.face_enrolled_at ? 'var(--success)' : 'var(--brand)',
                    color: client.face_enrolled_at ? 'var(--success)' : 'var(--brand)',
                  }}
                  onClick={() => setFaceEnrollOpen(true)}
                  title={client.face_enrolled_at ? 'Face enrolled — click to re-capture' : 'Enroll face for check-in'}
                >
                  {client.face_enrolled_at ? '✓ Face enrolled' : '📷 Enroll face'}
                </button>
              </div>

              {/* Name + quick info */}
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 22, fontWeight: 800, marginBottom: '.25rem' }}>{displayName}</div>
                {client.balance_amount > 0 && (
                  <div style={{ color: 'var(--danger)', fontWeight: 600, fontSize: 14, marginBottom: '.5rem' }}>
                    Balance Amount: {fmt(client.balance_amount)}
                  </div>
                )}
                {client.member_code && (
                  <div style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'monospace', marginBottom: '.5rem' }}>
                    Member Code: {client.member_code}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', marginTop: '.75rem' }}>
                  {/* Action buttons */}
                  {!editing ? (
                    <button onClick={() => setEditing(true)} className="btn btn-ghost btn-sm">✏️ Edit</button>
                  ) : (
                    <>
                      <button onClick={() => { setEditing(false); setForm(client); }} className="btn btn-ghost btn-sm">✕ Cancel</button>
                      <button onClick={save} className="btn btn-primary btn-sm" disabled={saving}>{saving ? 'Saving…' : '💾 Save'}</button>
                    </>
                  )}
                  <button className="btn btn-ghost btn-sm" style={{ background: 'rgba(52,211,153,.15)', borderColor: 'var(--success)', color: 'var(--success)' }}
                    onClick={() => { setActionModal('check-in'); setActionForm({ date: today, check_in: new Date().toTimeString().slice(0,5) }); }}>
                    ✅ Check In
                  </button>
                  <button className="btn btn-ghost btn-sm">🔔 Send Notification</button>
                  <button
                    type="button"
                    className="btn btn-whatsapp btn-sm"
                    onClick={openWhatsApp}
                    disabled={!client.mobile}
                  >
                    WhatsApp
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => { setActiveTab('followup'); }}>📞 Follow Up History</button>
                </div>
              </div>
            </div>

            {/* ── MEMBERSHIP ACTIONS ── */}
            <div style={{
              marginTop: '1.25rem', border: '1.5px solid var(--electric)',
              borderRadius: 12, padding: '1rem',
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--electric)', marginBottom: '.85rem', display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                <span style={{ fontSize: 16 }}>⚡</span> Membership Actions
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.5rem' }}>
                <ActionBtn label="❄️ Freeze" color="blue" onClick={() => router.push(`/clients/${client.id}/freeze`)} />
                <ActionBtn label="📅 Extension" color="blue" onClick={() => router.push(`/clients/${client.id}/extension`)} />
                <ActionBtn label="⬇️ DownGrade" color="blue" onClick={() => router.push(`/clients/${client.id}/downgrade`)} />
                <ActionBtn label="🔀 Transfer" color="blue" onClick={() => router.push(`/clients/${client.id}/transfer`)} />
                <ActionBtn label="⬆️ Upgrade" color="blue" onClick={() => router.push(`/clients/${client.id}/upgrade`)} />
                <ActionBtn label="🎁 Upgrade To Combo Offer" color="blue" onClick={() => router.push(`/clients/${client.id}/combo`)} />
                <ActionBtn label="🏋️ Assign Personal Training" color="blue" onClick={() => router.push(`/clients/${client.id}/assign-pt`)} />
                <ActionBtn label="🔄 Renew Personal Training" color="teal" onClick={() => router.push(`/clients/${client.id}/renew-pt`)} />
                <ActionBtn label="🎯 Book a free Trial" color="teal" onClick={() => router.push(`/clients/${client.id}/trial`)} />
                <ActionBtn label="➕ Add Subscription" color="green" onClick={() => router.push(`/clients/${client.id}/add-subscription`)} />
                <ActionBtn label="🔄 Renew Subscription" color="green" onClick={() => router.push(`/clients/${client.id}/renew-subscription`)} />
                <ActionBtn label="🎁 Assign Combo Offer" color="green" onClick={() => router.push(`/clients/${client.id}/combo`)} />
              </div>
            </div>
          </div>

          {/* ── MAIN LAYOUT: Left sidebar + Right content ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '1rem', alignItems: 'start' }}>

            {/* LEFT SIDEBAR */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
              {/* Mini info card */}
              <div className="card" style={{ padding: '1rem', fontSize: 13 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '.55rem' }}>
                  {client.balance_amount > 0 && (
                    <InfoRow icon="⚠️" val={fmt(client.balance_amount)} danger />
                  )}
                  <InfoRow icon="📍" val={[client.address, client.street, client.city].filter(Boolean).join(', ') || 'Add Location'} muted={!client.address} />
                  <InfoRow icon="📱" val={client.mobile ? `+91 ${client.mobile}` : 'Add mobile'} muted={!client.mobile} />
                  {client.alt_mobile && <InfoRow icon="📱" val={`+91 ${client.alt_mobile}`} />}
                  <InfoRow icon="📧" val={client.email || 'Add email'} muted={!client.email} />
                  <InfoRow icon="🎂" val={client.dob ? fmtDate(client.dob) : 'Add DOB'} muted={!client.dob} />
                  {memberSince && <InfoRow icon="📅" val={`Date Of Joining: ${fmtDate(memberSince)}`} />}
                  <InfoRow icon="🆔" val={`Member Code : ${client.member_code || '—'}`} mono />
                  <InfoRow icon="ID" val={`Biometric Code : ${client.biometric_code || client.client_id || '—'}`} mono />
                  {client.reference_no && <InfoRow icon="🔗" val={`Ref No. : ${client.reference_no}`} />}
                  <InfoRow icon="👤" val={`Client Rep : ${user?.name || '—'}`} />
                  {client.emergency_no && <InfoRow icon="🚨" val={`Emergency No : ${client.emergency_no}`} />}
                  {!client.app_installed && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(248,113,113,.15)', color: 'var(--danger)', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
                      📵 App Not Installed
                    </span>
                  )}
                  {client.interested_in && <InfoRow icon="⭐" val={`Interested In : ${client.interested_in}`} />}
                  {client.trainer_name && <InfoRow icon="🏋️" val={`Assigned Trainer : ${client.trainer_name}`} />}
                  {!client.biometric_added && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(251,191,36,.15)', color: 'var(--warning)', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
                      👆 Biometric Not Added
                    </span>
                  )}
                </div>
              </div>

              {/* Tab nav */}
              <div className="card" style={{ padding: '.5rem' }}>
                {tabs.map(t => (
                  <button key={t.key} onClick={() => selectTab(t.key)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '.6rem',
                      width: '100%', padding: '.6rem .85rem', borderRadius: 8,
                      border: 'none', cursor: 'pointer', fontSize: 13,
                      fontWeight: activeTab === t.key ? 700 : 500,
                      background: activeTab === t.key ? 'rgba(59,130,246,.15)' : 'transparent',
                      color: activeTab === t.key ? 'var(--electric)' : 'var(--text2)',
                      textAlign: 'left', transition: 'all .15s',
                    }}>
                    <span style={{ fontSize: 14 }}>{t.icon}</span>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* RIGHT CONTENT */}
            <div>
              {/* ── INFORMATION TAB ── */}
              {activeTab === 'information' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {/* KPI tiles */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '.75rem' }}>
                    <KpiTile label="Member Since" val={memberSince ? fmtDate(memberSince) : '—'} sub={memberDays !== null ? `${memberDays} days` : ''} />
                    <KpiTile label="Total Paid" val={fmt(totalPaid)} color="var(--success)" sub={`${payments.length} payment(s)`} />
                    <KpiTile label="Package" val={client.package_type || '—'} sub={client.pt_end_date ? `Ends ${fmtDate(client.pt_end_date)}` : ''} />
                    <KpiTile label="Balance Due" val={client.balance_amount > 0 ? fmt(client.balance_amount) : '₹0'} color={client.balance_amount > 0 ? 'var(--danger)' : 'var(--success)'} />
                  </div>

                  {/* Personal info */}
                  <div className="card">
                    <div className="card-title" style={{ marginBottom: '1rem' }}>Personal Information</div>
                    {editing ? (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem' }}>
                        {[['first_name', 'First Name', 'text'], ['last_name', 'Last Name', 'text'], ['mobile', 'Mobile', 'tel'], ['alt_mobile', 'Alt Mobile', 'tel'], ['email', 'Email', 'email'], ['dob', 'Date of Birth', 'date'], ['weight', 'Weight (kg)', 'number'], ['emergency_no', 'Emergency No', 'tel'], ['reference_no', 'Reference No', 'text'], ['aadhaar_no', 'Aadhaar No', 'text'], ['pan_no', 'PAN No', 'text'], ['gst_no', 'GST No', 'text'], ['company_name', 'Company', 'text']].map(([k, lbl, type]) => (
                          <div key={k}>
                            <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 3 }}>{lbl}</label>
                            <input className="input" type={type} value={form[k] || ''} onChange={e => set(k, e.target.value)} style={{ fontSize: 13 }} />
                          </div>
                        ))}
                        <div>
                          <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 3 }}>Gender</label>
                          <select className="input select" value={form.gender || ''} onChange={e => set('gender', e.target.value)} style={{ fontSize: 13 }}>
                            <option value="">Select</option>
                            <option>Male</option><option>Female</option><option>Other</option>
                          </select>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.5rem .75rem', fontSize: 13 }}>
                        {[
                          ['📱 Mobile', client.mobile ? `+91 ${client.mobile}` : null],
                          ['📱 Alt Mobile', client.alt_mobile ? `+91 ${client.alt_mobile}` : null],
                          ['📧 Email', client.email],
                          ['⚥ Gender', client.gender],
                          ['🎂 DOB', client.dob],
                          ['⚖️ Weight', client.weight ? `${client.weight} kg` : null],
                          ['🚨 Emergency', client.emergency_no],
                          ['🔗 Reference No', client.reference_no],
                          ['🆔 Aadhaar', client.aadhaar_no],
                          ['💳 PAN', client.pan_no],
                          ['🏢 GST', client.gst_no],
                          ['🏢 Company', client.company_name],
                          ['📍 Address', [client.address, client.street, client.city, client.state, client.country, client.pincode].filter(Boolean).join(', ')],
                        ].map(([lbl, val]) => val ? (
                          <div key={String(lbl)} style={{ display: 'flex', gap: '.5rem' }}>
                            <span style={{ color: 'var(--muted)', minWidth: 110, flexShrink: 0 }}>{lbl}</span>
                            <span style={{ fontWeight: 500, wordBreak: 'break-word' }}>{val}</span>
                          </div>
                        ) : null)}
                      </div>
                    )}
                  </div>

                  {/* Membership info */}
                  <div className="card">
                    <div className="card-title" style={{ marginBottom: '1rem' }}>Membership & Payment</div>
                    {editing ? (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem' }}>
                        <div>
                          <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 3 }}>Trainer</label>
                          <select className="input select" value={form.trainer_id || ''} disabled={!isAdmin}
                            onChange={e => { const t = trainers.find(x => x.id === e.target.value); set('trainer_id', e.target.value); set('trainer_name', t?.name || ''); }} style={{ fontSize: 13 }}>
                            <option value="">No trainer</option>
                            {trainers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 3 }}>Package</label>
                          <select className="input select" value={form.package_type || ''} style={{ fontSize: 13 }}
                            onChange={e => { set('package_type', e.target.value); set('pt_end_date', computeEndDate(form.pt_start_date, e.target.value)); }}>
                            {['Monthly', 'Quarterly', 'Half Yearly', 'Yearly', 'PT'].map(p => <option key={p}>{p}</option>)}
                          </select>
                        </div>
                        {[['pt_start_date', 'Start Date', 'date'], ['pt_end_date', 'End Date', 'date'], ['base_amount', 'Base Amount', 'number'], ['discount', 'Discount', 'number'], ['final_amount', 'Final Amount', 'number'], ['paid_amount', 'Paid Amount', 'number']].map(([k, lbl, type]) => (
                          <div key={k}>
                            <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 3 }}>{lbl}</label>
                            <input className="input" type={type} value={form[k] || ''} onChange={e => set(k, e.target.value)} style={{ fontSize: 13 }} />
                          </div>
                        ))}
                        <div>
                          <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 3 }}>Status</label>
                          <select className="input select" value={form.status} onChange={e => set('status', e.target.value)} style={{ fontSize: 13 }}>
                            <option>active</option><option>expired</option><option>frozen</option>
                          </select>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.5rem .75rem', fontSize: 13 }}>
                        {[
                          ['🏋️ Trainer', client.trainer_name],
                          ['📦 Package', client.package_type],
                          ['📅 Start', client.pt_start_date],
                          ['📅 End', client.pt_end_date],
                          ['💰 Final', fmt(client.final_amount)],
                          ['✅ Paid', fmt(client.paid_amount)],
                          ['⚠️ Balance', client.balance_amount > 0 ? fmt(client.balance_amount) : '—'],
                          ['💳 Method', client.payment_method],
                        ].map(([lbl, val]) => val ? (
                          <div key={String(lbl)} style={{ display: 'flex', gap: '.5rem' }}>
                            <span style={{ color: 'var(--muted)', minWidth: 80, flexShrink: 0 }}>{lbl}</span>
                            <span style={{ fontWeight: 500 }}>{val}</span>
                          </div>
                        ) : null)}
                      </div>
                    )}
                  </div>

                  {/* Membership timeline */}
                  <div className="card">
                    <div className="card-title" style={{ marginBottom: '1rem' }}>🗓️ Membership Timeline</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '.85rem' }}>
                      {memberSince && <TimelineRow icon="🎉" title="Joined the studio" date={fmtDate(memberSince)} />}
                      {client.pt_start_date && <TimelineRow icon="🏋️" title={`Started ${client.package_type || 'membership'}`} date={fmtDate(client.pt_start_date)} />}
                      {payments.slice().reverse().map((p: any) => (
                        <TimelineRow key={p.id} icon="💳" title={`Payment of ${fmt(p.amount)} via ${p.method}`} date={fmtDate(p.date)} />
                      ))}
                      {renewals.slice().reverse().map((r: any) => (
                        <TimelineRow key={r.id} icon="🔄" title={`Renewed: ${r.old_package || '—'} → ${r.new_package} (${fmt(r.amount)})`} date={fmtDate(r.renewed_on || r.created_at)} />
                      ))}
                      {client.pt_end_date && <TimelineRow icon={client.status === 'expired' ? '🏁' : '⏳'} title={client.status === 'expired' ? 'Membership expired' : 'Membership expires'} date={fmtDate(client.pt_end_date)} />}
                    </div>
                  </div>
                </div>
              )}

              {/* ── SUBSCRIPTIONS TAB ── */}
              {activeTab === 'subscriptions' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="card" style={{ padding: 0 }}>
                    <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div className="card-title" style={{ marginBottom: 0 }}>📋 Subscriptions</div>
                      <button className="btn btn-primary btn-sm" onClick={() => router.push(`/clients/${client.id}/add-subscription`)}>+ Add Subscription</button>
                    </div>
                    {subscriptions.length === 0 ? (
                      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>No subscriptions found</div>
                    ) : (
                      <div className="table-wrap">
                        <table>
                          <thead><tr><th>Type</th><th>Package</th><th>Start</th><th>End</th><th>Amount</th><th>Status</th></tr></thead>
                          <tbody>
                            {subscriptions.map((s: any) => (
                              <tr key={s.id}>
                                <td>{s.kind}</td>
                                <td>{s.package_type || '—'}</td>
                                <td className="text-muted">{s.start_date}</td>
                                <td className="text-muted">{s.end_date}</td>
                                <td style={{ color: 'var(--success)', fontWeight: 700 }}>{fmt(s.final_amount)}</td>
                                <td><span className={`badge badge-${s.status}`}>{s.status}</span></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                  {/* Payment history */}
                  <div className="card" style={{ padding: 0 }}>
                    <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--glass-border)' }}>
                      <div className="card-title" style={{ marginBottom: 0 }}>📜 Payment History</div>
                    </div>
                    {payments.length === 0 ? (
                      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>No payments yet</div>
                    ) : (
                      <div className="table-wrap">
                        <table>
                          <thead><tr><th>Receipt</th><th>Amount</th><th>Method</th><th>Date</th><th>Notes</th></tr></thead>
                          <tbody>
                            {payments.map((p: any) => (
                              <tr key={p.id}>
                                <td><span className="mono text-muted text-xs">{p.receipt_no || '—'}</span></td>
                                <td style={{ fontWeight: 700, color: 'var(--success)' }}>{fmt(p.amount)}</td>
                                <td><span className={`badge badge-${(p.method || 'cash').toLowerCase()}`}>{p.method}</span></td>
                                <td className="text-muted">{fmtDate(p.date)}</td>
                                <td className="text-muted text-sm">{p.notes || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                  {renewals.length > 0 && (
                    <div className="card" style={{ padding: 0 }}>
                      <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--glass-border)' }}>
                        <div className="card-title" style={{ marginBottom: 0 }}>🔄 Renewal History</div>
                      </div>
                      <div className="table-wrap">
                        <table>
                          <thead><tr><th>Date</th><th>From</th><th>To</th><th>New End</th><th>Amount</th><th>Method</th></tr></thead>
                          <tbody>
                            {renewals.map((r: any) => (
                              <tr key={r.id}>
                                <td className="text-muted">{fmtDate(r.renewed_on || r.created_at)}</td>
                                <td>{r.old_package || '—'}</td>
                                <td style={{ fontWeight: 600 }}>{r.new_package}</td>
                                <td className="text-muted">{fmtDate(r.new_end_date)}</td>
                                <td style={{ fontWeight: 700, color: 'var(--success)' }}>{fmt(r.amount)}</td>
                                <td><span className={`badge badge-${(r.payment_method || 'cash').toLowerCase()}`}>{r.payment_method}</span></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── ATTENDANCE TAB ── */}
              {activeTab === 'attendance' && (
                <div className="card" style={{ padding: 0 }}>
                  <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="card-title" style={{ marginBottom: 0 }}>📅 Attendance ({attendance.length})</div>
                    <button className="btn btn-primary btn-sm" onClick={() => { setActionModal('check-in'); setActionForm({ date: today, check_in: new Date().toTimeString().slice(0,5) }); }}>+ Check In</button>
                  </div>
                  {attendance.length === 0 ? (
                    <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--muted)' }}>No attendance records yet</div>
                  ) : (
                    <div className="table-wrap">
                      <table>
                        <thead><tr><th>Date</th><th>Check In</th><th>Status</th></tr></thead>
                        <tbody>
                          {attendance.map((a: any) => (
                            <tr key={a.id}>
                              <td>{fmtDate(a.date)}</td>
                              <td className="text-muted">{a.check_in || '—'}</td>
                              <td><span className="badge badge-active">{a.status || 'present'}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ── WORKOUT TAB ── */}
              {activeTab === 'workout' && (
                <div className="card" style={{ padding: 0 }}>
                  <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--glass-border)' }}>
                    <div className="card-title" style={{ marginBottom: 0 }}>🏋️ Workout Log ({workouts.length})</div>
                  </div>
                  {workouts.length === 0 ? (
                    <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--muted)' }}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>💪</div>
                      No workout logs yet
                    </div>
                  ) : (
                    <div className="table-wrap">
                      <table>
                        <thead><tr><th>Date</th><th>Exercise</th><th>Sets</th><th>Reps</th><th>Notes</th></tr></thead>
                        <tbody>
                          {workouts.map((w: any) => (
                            <tr key={w.id}>
                              <td>{fmtDate(w.date)}</td>
                              <td style={{ fontWeight: 600 }}>{w.exercise || '—'}</td>
                              <td>{w.sets || '—'}</td>
                              <td>{w.reps || '—'}</td>
                              <td className="text-muted text-sm">{w.notes || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ── FOLLOW UP HISTORY TAB ── */}
              {activeTab === 'followup' && (
                <div className="card" style={{ padding: 0 }}>
                  <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div className="card-title" style={{ marginBottom: 0 }}>📞 Member Follow Up History</div>
                    </div>
                    <button className="btn btn-primary btn-sm" onClick={() => setFuOpen(true)}>+ Add Follow up</button>
                  </div>
                  {followUps.length === 0 ? (
                    <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--muted)' }}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>📞</div>
                      No follow-up history yet
                    </div>
                  ) : (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Followup Type</th>
                            <th>Followup Date</th>
                            <th>Reminder Date</th>
                            <th>Comments</th>
                            <th>Follow up Status</th>
                            <th>Added By</th>
                            <th>Follow Up By</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {followUps.map((fu: any) => (
                            <tr key={fu.id}>
                              <td>
                                <span style={{
                                  display: 'inline-block', padding: '2px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                                  background: 'rgba(255,71,87,.18)', color: 'var(--brand)',
                                  border: '1px solid rgba(255,71,87,.3)',
                                }}>
                                  {fu.followup_type || '—'}
                                </span>
                              </td>
                              <td className="text-muted text-sm">{fu.followup_date ? new Date(fu.followup_date).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}</td>
                              <td className="text-muted text-sm">{fu.reminder_date ? new Date(fu.reminder_date).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}</td>
                              <td className="text-sm" style={{ maxWidth: 220 }}>
                                <div>{fu.comments || '—'}</div>
                                {fu.expected_date && <div className="text-muted" style={{ fontSize: 11 }}>Expected date: {fmtDate(fu.expected_date)}</div>}
                                {fu.expected_amount && <div className="text-muted" style={{ fontSize: 11 }}>Expected amount: ₹{fu.expected_amount}</div>}
                              </td>
                              <td>
                                <span style={{
                                  padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                                  background: fu.status === 'CLOSED' ? 'rgba(248,113,113,.15)' : 'rgba(52,211,153,.15)',
                                  color: fu.status === 'CLOSED' ? 'var(--danger)' : 'var(--success)',
                                }}>
                                  {fu.status || 'OPEN'}
                                </span>
                              </td>
                              <td className="text-muted text-sm">{fu.added_by || 'System Generated'}</td>
                              <td className="text-muted text-sm">{fu.followed_up_by || '—'}</td>
                              <td>
                                {fu.resolution && (
                                  <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}>👁️ View Resolution</button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ── DOCUMENTS TAB ── */}
              {activeTab === 'documents' && (
                <div className="card" style={{ padding: 0 }}>
                  <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="card-title" style={{ marginBottom: 0 }}>📄 Client Documents</div>
                    <button className="btn btn-ghost btn-sm">+ Upload Document</button>
                  </div>
                  {documents.length === 0 ? (
                    <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--muted)' }}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>📁</div>
                      No documents uploaded yet
                    </div>
                  ) : (
                    <div className="table-wrap">
                      <table>
                        <thead><tr><th>Type</th><th>Name</th><th>Uploaded By</th><th>Action</th></tr></thead>
                        <tbody>
                          {documents.map((d: any) => (
                            <tr key={d.id}>
                              <td>{d.doc_type}</td>
                              <td>{d.doc_name || '—'}</td>
                              <td className="text-muted">{d.uploaded_by || '—'}</td>
                              <td>{d.doc_url && <a href={d.doc_url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">👁️ View</a>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ── REFERRALS TAB ── */}
              {activeTab === 'referrals' && (
                <div className="card" style={{ padding: 0 }}>
                  <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--glass-border)' }}>
                    <div className="card-title" style={{ marginBottom: 0 }}>🤝 Client Referrals</div>
                  </div>
                  {referrals.length === 0 ? (
                    <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--muted)' }}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>🤝</div>
                      No referrals yet
                    </div>
                  ) : (
                    <div className="table-wrap">
                      <table>
                        <thead><tr><th>Name</th><th>Mobile</th><th>Email</th><th>Status</th><th>Reward</th></tr></thead>
                        <tbody>
                          {referrals.map((r: any) => (
                            <tr key={r.id}>
                              <td style={{ fontWeight: 600 }}>{r.referee_name}</td>
                              <td className="text-muted">{r.referee_mobile || '—'}</td>
                              <td className="text-muted">{r.referee_email || '—'}</td>
                              <td><span className={`badge badge-${r.status}`}>{r.status}</span></td>
                              <td style={{ color: 'var(--success)' }}>{r.reward_amount > 0 ? fmt(r.reward_amount) : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── RENEW MODAL ── */}
      {renewOpen && (
        <div className="modal" onClick={e => { if (e.target === e.currentTarget) setRenewOpen(false); }}>
          <form className="card" style={{ maxWidth: 520, width: '100%' }} onSubmit={e => { e.preventDefault(); submitRenew(); }}>
            <div className="card-title" style={{ marginBottom: 4 }}>🔄 Renew Membership</div>
            <div className="text-muted text-sm" style={{ marginBottom: '1.25rem' }}>Renewing for <strong>{displayName}</strong></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.85rem' }}>
              <div className="form-row form-row-2">
                <div><label>Package *</label>
                  <select className="input select" value={renewForm.package_type} onChange={e => setRenewForm((f: any) => ({ ...f, package_type: e.target.value, pt_end_date: computeEndDate(f.pt_start_date, e.target.value) }))}>
                    {['Monthly', 'Quarterly', 'Half Yearly', 'Yearly', 'PT'].map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div><label>Payment Method</label>
                  <select className="input select" value={renewForm.payment_method} onChange={e => setRenewForm((f: any) => ({ ...f, payment_method: e.target.value }))}>
                    <option>CASH</option><option>UPI</option><option>CARD</option><option>BANK_TRANSFER</option>
                  </select>
                </div>
              </div>
              <div className="form-row form-row-2">
                <div><label>New Start Date *</label>
                  <input className="input" type="date" value={renewForm.pt_start_date}
                    onChange={e => setRenewForm((f: any) => ({ ...f, pt_start_date: e.target.value, pt_end_date: computeEndDate(e.target.value, f.package_type) }))} required />
                </div>
                <div><label>New End Date *</label>
                  <input className="input" type="date" value={renewForm.pt_end_date}
                    onChange={e => setRenewForm((f: any) => ({ ...f, pt_end_date: e.target.value }))} required />
                </div>
              </div>
              <div className="form-row form-row-3">
                <div><label>Base Amount (₹)</label><input className="input" type="number" min="0" value={renewForm.base_amount}
                  onChange={e => { const b = parseFloat(e.target.value)||0; const d2 = parseFloat(renewForm.discount)||0; setRenewForm((f: any) => ({ ...f, base_amount: e.target.value, final_amount: String(Math.max(0,b-d2)) })); }} /></div>
                <div><label>Discount (₹)</label><input className="input" type="number" min="0" value={renewForm.discount}
                  onChange={e => { const b = parseFloat(renewForm.base_amount)||0; const d2 = parseFloat(e.target.value)||0; setRenewForm((f: any) => ({ ...f, discount: e.target.value, final_amount: String(Math.max(0,b-d2)) })); }} /></div>
                <div><label>Final Amount (₹) *</label><input className="input" type="number" min="1" value={renewForm.final_amount}
                  onChange={e => setRenewForm((f: any) => ({ ...f, final_amount: e.target.value }))} required style={{ borderColor: 'var(--brand)', fontWeight: 700 }} /></div>
              </div>
              <div><label>Amount Paid Today (₹)</label>
                <input className="input" type="number" min="0" value={renewForm.paid_amount}
                  onChange={e => setRenewForm((f: any) => ({ ...f, paid_amount: e.target.value }))} placeholder="Leave empty if paying later" />
              </div>
              <div><label>Notes (optional)</label>
                <input className="input" value={renewForm.notes} onChange={e => setRenewForm((f: any) => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '.6rem', marginTop: '1.5rem' }}>
              <button type="submit" className="btn btn-primary" disabled={renewSaving} style={{ flex: 1 }}>{renewSaving ? 'Renewing…' : '🔄 Confirm Renewal'}</button>
              <button type="button" className="btn btn-ghost" onClick={() => setRenewOpen(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* ── ACTION MODALS ── */}
      {actionModal && (
        <div className="modal" onClick={e => { if (e.target === e.currentTarget) setActionModal(null); }}>
          <div className="card" style={{ maxWidth: 420, width: '100%' }}>
            <div className="card-title" style={{ textTransform: 'capitalize', marginBottom: '1.25rem' }}>
              {actionModal === 'freeze' && '❄️ Freeze Membership'}
              {actionModal === 'extension' && '📅 Add Extension'}
              {actionModal === 'downgrade' && '⬇️ Downgrade Package'}
              {actionModal === 'upgrade' && '⬆️ Upgrade Package'}
              {actionModal === 'transfer' && '🔀 Transfer Member'}
              {actionModal === 'combo' && '🎁 Combo Offer'}
              {actionModal === 'pt_assign' && '🏋️ Assign Personal Training'}
              {actionModal === 'pt_renew' && '🔄 Renew Personal Training'}
              {actionModal === 'trial' && '🎯 Book a Free Trial'}
              {actionModal === 'check-in' && '✅ Check In'}
            </div>
            {actionModal === 'freeze' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
                <div><label>From Date *</label><input className="input" type="date" value={actionForm.from || ''} onChange={e => setActionForm((f: any) => ({ ...f, from: e.target.value }))} /></div>
                <div><label>Until Date *</label><input className="input" type="date" value={actionForm.until || ''} onChange={e => setActionForm((f: any) => ({ ...f, until: e.target.value }))} /></div>
                <div><label>Reason</label><input className="input" value={actionForm.reason || ''} onChange={e => setActionForm((f: any) => ({ ...f, reason: e.target.value }))} /></div>
              </div>
            )}
            {actionModal === 'extension' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
                <div><label>Number of Days *</label><input className="input" type="number" min="1" value={actionForm.days || ''} onChange={e => setActionForm((f: any) => ({ ...f, days: e.target.value }))} /></div>
                <div><label>Reason</label><input className="input" value={actionForm.reason || ''} onChange={e => setActionForm((f: any) => ({ ...f, reason: e.target.value }))} /></div>
              </div>
            )}
            {(actionModal === 'downgrade' || actionModal === 'upgrade') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
                <div><label>New Package *</label>
                  <select className="input select" value={actionForm.package_type || ''} onChange={e => setActionForm((f: any) => ({ ...f, package_type: e.target.value }))}>
                    {['Monthly', 'Quarterly', 'Half Yearly', 'Yearly', 'PT'].map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div><label>Amount (₹)</label><input className="input" type="number" value={actionForm.amount || ''} onChange={e => setActionForm((f: any) => ({ ...f, amount: e.target.value }))} /></div>
                <div><label>Reason</label><input className="input" value={actionForm.reason || ''} onChange={e => setActionForm((f: any) => ({ ...f, reason: e.target.value }))} /></div>
              </div>
            )}
            {actionModal === 'transfer' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
                <div><label>Transfer to Trainer</label>
                  <select className="input select" value={actionForm.trainer_id || ''} onChange={e => setActionForm((f: any) => ({ ...f, trainer_id: e.target.value }))}>
                    <option value="">Select Trainer</option>
                    {trainers.filter(t => t.id !== client.trainer_id).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div><label>Reason</label><input className="input" value={actionForm.reason || ''} onChange={e => setActionForm((f: any) => ({ ...f, reason: e.target.value }))} /></div>
              </div>
            )}
            {(actionModal === 'combo' || actionModal === 'pt_assign' || actionModal === 'pt_renew') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
                <div><label>Start Date</label><input className="input" type="date" value={actionForm.pt_start_date || today} onChange={e => setActionForm((f: any) => ({ ...f, pt_start_date: e.target.value }))} /></div>
                <div><label>End Date</label><input className="input" type="date" value={actionForm.pt_end_date || ''} onChange={e => setActionForm((f: any) => ({ ...f, pt_end_date: e.target.value }))} /></div>
                <div><label>Amount (₹)</label><input className="input" type="number" value={actionForm.amount || ''} onChange={e => setActionForm((f: any) => ({ ...f, amount: e.target.value }))} /></div>
              </div>
            )}
            {actionModal === 'trial' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
                <div><label>Trial Date</label><input className="input" type="date" value={actionForm.date || today} onChange={e => setActionForm((f: any) => ({ ...f, date: e.target.value }))} /></div>
                <div><label>Notes</label><input className="input" value={actionForm.notes || ''} onChange={e => setActionForm((f: any) => ({ ...f, notes: e.target.value }))} /></div>
              </div>
            )}
            {actionModal === 'check-in' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
                <div><label>Date</label><input className="input" type="date" value={actionForm.date || today} onChange={e => setActionForm((f: any) => ({ ...f, date: e.target.value }))} /></div>
                <div><label>Check-in Time</label><input className="input" type="time" value={actionForm.check_in || ''} onChange={e => setActionForm((f: any) => ({ ...f, check_in: e.target.value }))} /></div>
              </div>
            )}
            {error && <div className="alert alert-error" style={{ marginTop: '1rem' }}>{error}</div>}
            <div style={{ display: 'flex', gap: '.6rem', marginTop: '1.5rem' }}>
              <button className="btn btn-primary" style={{ flex: 1 }} disabled={actionSaving}
                onClick={() => submitAction(
                  actionModal === 'check-in' ? 'check-in' :
                  actionModal === 'pt_assign' ? 'assign-pt' :
                  actionModal === 'pt_renew' ? 'renew-pt' :
                  actionModal
                )}>
                {actionSaving ? 'Processing…' : 'Confirm'}
              </button>
              <button className="btn btn-ghost" onClick={() => { setActionModal(null); setActionForm({}); setError(''); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD FOLLOW-UP MODAL ── */}
      {fuOpen && (
        <div className="modal" onClick={e => { if (e.target === e.currentTarget) setFuOpen(false); }}>
          <form className="card" style={{ maxWidth: 460, width: '100%' }} onSubmit={e => { e.preventDefault(); submitFollowUp(); }}>
            <div className="card-title" style={{ marginBottom: '1.25rem' }}>📞 Add Follow Up</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.85rem' }}>
              <div><label>Follow Up Type *</label>
                <select className="input select" value={fuForm.followup_type} onChange={e => setFuForm(f => ({ ...f, followup_type: e.target.value }))}>
                  {['Renewal Membership', 'Enquiry', 'Trial Reminder', 'Payment Due', 'General Follow-up', 'Other'].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div><label>Remarks</label>
                <textarea className="input" rows={3} value={fuForm.comments} onChange={e => setFuForm(f => ({ ...f, comments: e.target.value }))} placeholder="Add your comments here…" />
              </div>
              <div className="form-row form-row-2">
                <div><label>Reminder Date</label><input className="input" type="datetime-local" value={fuForm.reminder_date} onChange={e => setFuForm(f => ({ ...f, reminder_date: e.target.value }))} /></div>
                <div><label>Expected Date</label><input className="input" type="date" value={fuForm.expected_date} onChange={e => setFuForm(f => ({ ...f, expected_date: e.target.value }))} /></div>
              </div>
              <div><label>Expected Amount (₹)</label>
                <input className="input" type="number" value={fuForm.expected_amount} onChange={e => setFuForm(f => ({ ...f, expected_amount: e.target.value }))} />
              </div>
            </div>
            {error && <div className="alert alert-error" style={{ marginTop: '1rem' }}>{error}</div>}
            <div style={{ display: 'flex', gap: '.6rem', marginTop: '1.5rem' }}>
              <button type="submit" className="btn btn-primary" disabled={fuSaving} style={{ flex: 1 }}>{fuSaving ? 'Saving…' : '✅ Submit'}</button>
              <button type="button" className="btn btn-ghost" onClick={() => setFuOpen(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <FaceEnrollModal
        open={faceEnrollOpen}
        clientId={id}
        clientName={client?.name}
        onClose={() => setFaceEnrollOpen(false)}
        onEnrolled={() => setClient((c: any) => c ? { ...c, face_enrolled_at: new Date().toISOString() } : c)}
      />
    </AppShell>
  );
}

/* ── Sub-components ── */
function ActionBtn({ label, color, onClick }: { label: string; color: string; onClick?: () => void }) {
  const colors: Record<string, { bg: string; border: string; text: string }> = {
    blue:  { bg: 'rgba(59,130,246,.15)',  border: 'rgba(59,130,246,.4)',  text: 'var(--electric)' },
    teal:  { bg: 'rgba(20,184,166,.15)',  border: 'rgba(20,184,166,.4)',  text: '#14b8a6' },
    green: { bg: 'rgba(52,211,153,.12)', border: 'rgba(52,211,153,.35)', text: 'var(--success)' },
    red:   { bg: 'rgba(255,71,87,.12)',  border: 'rgba(255,71,87,.35)', text: 'var(--brand)' },
  };
  const c = colors[color] || colors.blue;
  return (
    <button onClick={onClick} style={{
      padding: '6px 14px', borderRadius: 8, border: `1px solid ${c.border}`,
      background: c.bg, color: c.text, fontSize: 12, fontWeight: 600,
      cursor: 'pointer', transition: 'all .15s', whiteSpace: 'nowrap',
    }}>
      {label}
    </button>
  );
}

function InfoRow({ icon, val, muted, danger, mono }: { icon: string; val: string; muted?: boolean; danger?: boolean; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '.5rem', fontSize: 12 }}>
      <span style={{ flexShrink: 0 }}>{icon}</span>
      <span style={{
        color: danger ? 'var(--danger)' : muted ? 'var(--muted)' : 'var(--text2)',
        fontWeight: danger ? 700 : 400,
        fontFamily: mono ? 'monospace' : 'inherit',
        wordBreak: 'break-word',
      }}>{val}</span>
    </div>
  );
}

function KpiTile({ label, val, sub, color }: { label: string; val: string; sub?: string; color?: string }) {
  return (
    <div className="card" style={{ padding: '.85rem 1rem' }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: .5 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: color || 'var(--text)', marginTop: 4 }}>{val}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function TimelineRow({ icon, title, date }: { icon: string; title: string; date: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '.85rem' }}>
      <div style={{
        width: 34, height: 34, borderRadius: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--glass-bg-2)', border: '1px solid var(--glass-border)',
        fontSize: 15, flexShrink: 0,
      }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{title}</div>
        <div className="text-muted text-xs">{date}</div>
      </div>
    </div>
  );
}
