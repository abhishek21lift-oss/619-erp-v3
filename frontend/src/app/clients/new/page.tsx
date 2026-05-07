'use client';
import { useState, useEffect, useRef, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Guard from '@/components/Guard';
import AppShell from '@/components/AppShell';
import { api, Trainer } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  importSheetFile, getSheetCache, clearSheetCache,
  lookupByMobile, searchByName, mergeEmptyOnly,
  type SheetCache, type SheetMember,
} from '@/lib/sheet-import';

export default function NewClientPage() { return <Guard><NewClientForm /></Guard>; }

function NewClientForm() {
  const router = useRouter();
  const { user } = useAuth();
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  // Membership/payment fields are intentionally NOT collected here any more —
  // they live in the member profile's "Add Subscription" tab. We keep the
  // backend contract identical (it accepts these as null) so this is a
  // pure UI change, no migrations needed.
  const [f, setF] = useState({
    first_name: '', last_name: '',
    email: '',
    country_code: '+91', mobile: '', is_mobile_redacted: false,
    alt_country_code: '+91', alt_mobile: '',
    dob: '',
    gender: '' as 'Male' | 'Female' | 'Other' | '',
    reference_no: '',
    aadhaar_no: '',
    pan_no: '',
    gst_no: '',
    company_name: '',
    trainer_id: user?.role === 'trainer' ? (user.trainer_id || '') : '',
    address: '',
    street: '',
    city: '',
    state: '',
    country: 'India',
    pincode: '',
    anniversary: '',
    notes: '', status: 'active',
    emergency_no: '',
    interested_in: '',
    weight: '',
  });

  /* ── Sheet-import / auto-fill state ───────────────────────── */
  const [sheetCache, setSheetCache] = useState<SheetCache | null>(null);
  const [sheetBusy, setSheetBusy]   = useState(false);
  const [sheetError, setSheetError] = useState('');
  const [filledFields, setFilledFields] = useState<string[]>([]);
  const [nameSuggestions, setNameSuggestions] = useState<SheetMember[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastLookupMobile = useRef<string>('');

  useEffect(() => {
    api.trainers.list().then(setTrainers).catch(console.error);
    // load any previously-imported sheet from localStorage
    setSheetCache(getSheetCache());
  }, []);

  async function handleSheetUpload(file: File) {
    setSheetBusy(true); setSheetError('');
    try {
      const c = await importSheetFile(file);
      setSheetCache(c);
      if (c.rowCount === 0)
        setSheetError('No recognisable rows found. Make sure the sheet has columns like Name, Mobile, Email, etc.');
    } catch (e: any) {
      setSheetError(e?.message || 'Could not read this file.');
    } finally {
      setSheetBusy(false);
    }
  }

  function applyMember(m: SheetMember) {
    const { merged, filledFields: filled } = mergeEmptyOnly(f, m);
    setF(merged);
    setFilledFields(filled);
    setNameSuggestions([]);
  }

  // when mobile changes, try to auto-fill
  useEffect(() => {
    const m = (f.mobile || '').replace(/\D/g, '').slice(-10);
    if (m.length !== 10 || m === lastLookupMobile.current) return;
    if (!sheetCache) return;
    const hit = lookupByMobile(m);
    if (hit) {
      lastLookupMobile.current = m;
      applyMember(hit);
    }
  }, [f.mobile, sheetCache]);

  // when first_name changes, offer name suggestions if mobile is empty
  useEffect(() => {
    if (!sheetCache) { setNameSuggestions([]); return; }
    if (f.mobile && f.mobile.length >= 6) { setNameSuggestions([]); return; }
    const q = (f.first_name + ' ' + f.last_name).trim();
    setNameSuggestions(q.length >= 2 ? searchByName(q, 6) : []);
  }, [f.first_name, f.last_name, f.mobile, sheetCache]);


  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!f.first_name.trim()) return setError('First name is required');
    setSaving(true); setError('');
    try {
      const fullName = [f.first_name, f.last_name].filter(Boolean).join(' ');
      const trainer = trainers.find(t => t.id === f.trainer_id);
      const created = await api.clients.create({
        ...f,
        name: fullName,
        trainer_name: trainer?.name || '',
        weight: parseFloat(f.weight) || undefined,
      });
      // Drop the user straight onto the new member's profile so they can
      // assign a subscription right away — that's now the only path to
      // create a membership.
      const newId = (created as any)?.client?.id;
      router.push(newId ? `/clients/${newId}/add-subscription` : '/clients');
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }

  const S = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF(p => ({ ...p, [k]: e.target.value }));

  return (
    <AppShell>
      <div className="page-main">
        <div className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button onClick={() => router.back()} className="btn btn-ghost btn-sm">←</button>
            <div>
              <div className="topbar-title">Add New Member</div>
              <div className="topbar-sub">Fill in the member details below</div>
            </div>
          </div>
          <button type="submit" form="member-form" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : '💾 Save Member'}
          </button>
        </div>

        <div className="page-content fade-up">
          {error && <div className="alert alert-error">{error}</div>}

          <form id="member-form" onSubmit={submit}>
            <div style={{ display: 'grid', gap: '1.25rem' }}>

              {/* ── SHEET-IMPORT / AUTO-FILL ── */}
              <div className="card" style={{ borderColor: 'var(--brand)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '.75rem' }}>
                  <div>
                    <div className="card-title" style={{ fontSize: 16, marginBottom: 4 }}>
                      📄 Auto-fill from your sheet
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text2)' }}>
                      {sheetCache
                        ? <>Using <b>{sheetCache.fileName}</b> — {sheetCache.rowCount} members loaded.
                            Type a 10-digit mobile below and matching details will fill in automatically.</>
                        : <>Upload your Google Sheet (export as <code>.xlsx</code> or <code>.csv</code>).
                            Then typing a known mobile number will fill the form automatically.</>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      style={{ display: 'none' }}
                      onChange={e => { const file = e.target.files?.[0]; if (file) handleSheetUpload(file); e.target.value = ''; }}
                    />
                    <button type="button" className="btn btn-primary btn-sm"
                      disabled={sheetBusy}
                      onClick={() => fileInputRef.current?.click()}>
                      {sheetBusy ? 'Reading…' : (sheetCache ? '🔄 Re-import sheet' : '📥 Import sheet')}
                    </button>
                    {sheetCache && (
                      <button type="button" className="btn btn-ghost btn-sm"
                        onClick={() => { clearSheetCache(); setSheetCache(null); setFilledFields([]); }}>
                        Clear
                      </button>
                    )}
                  </div>
                </div>
                {sheetError && <div className="alert alert-error mt-1">{sheetError}</div>}
                {filledFields.length > 0 && (
                  <div className="alert alert-success mt-1" style={{ fontSize: 13 }}>
                    ✨ Auto-filled {filledFields.length} field{filledFields.length === 1 ? '' : 's'} from sheet:
                    {' '}{filledFields.join(', ')}
                  </div>
                )}
                {nameSuggestions.length > 0 && (
                  <div style={{ marginTop: '.75rem' }}>
                    <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: '.35rem' }}>
                      Matches in sheet — click to fill:
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.4rem' }}>
                      {nameSuggestions.map((m, i) => (
                        <button key={i} type="button" className="btn btn-ghost btn-sm"
                          onClick={() => applyMember(m)}
                          style={{ textAlign: 'left' }}>
                          {m.name || `${m.first_name || ''} ${m.last_name || ''}`.trim()}
                          {m.mobile && <span style={{ color: 'var(--text2)', marginLeft: 6 }}>· {m.mobile}</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* ── MEMBER SECTION ── */}
              <div className="card">
                <div className="card-title" style={{ marginBottom: '1.5rem', fontSize: 16 }}>👤 Member</div>

                {/* Name */}
                <FormGroup label="Member Name" required>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem' }}>
                    <input className="input" placeholder="First name" value={f.first_name} onChange={S('first_name')} required />
                    <input className="input" placeholder="Last name" value={f.last_name} onChange={S('last_name')} />
                  </div>
                </FormGroup>

                {/* Email */}
                <FormGroup label="Member Email">
                  <input className="input" type="email" placeholder="e.g. abc@gmail.com" value={f.email} onChange={S('email')} />
                </FormGroup>

                {/* Mobile */}
                <FormGroup label="Mobile Number" required>
                  <div style={{ display: 'flex', gap: '.5rem' }}>
                    <CountryCodeBox />
                    <input className="input" type="tel" placeholder="e.g. 9876543210"
                      value={f.mobile} onChange={S('mobile')}
                      disabled={f.is_mobile_redacted}
                      style={{ flex: 1, opacity: f.is_mobile_redacted ? 0.4 : 1 }} />
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginTop: '.6rem', cursor: 'pointer', fontSize: 13, color: 'var(--text2)' }}>
                    <input type="checkbox" checked={f.is_mobile_redacted}
                      onChange={e => setF(p => ({ ...p, is_mobile_redacted: e.target.checked, mobile: e.target.checked ? '' : p.mobile }))}
                      style={{ width: 15, height: 15, accentColor: 'var(--brand)', cursor: 'pointer' }} />
                    Customer reluctant to give Mobile Number.
                  </label>
                </FormGroup>

                {/* Alt Mobile */}
                <FormGroup label="Alternate Mobile Number">
                  <div style={{ display: 'flex', gap: '.5rem' }}>
                    <CountryCodeBox />
                    <input className="input" type="tel" placeholder="e.g. 9876543210"
                      value={f.alt_mobile} onChange={S('alt_mobile')} style={{ flex: 1 }} />
                  </div>
                </FormGroup>

                {/* DOB & Anniversary */}
                <FormGroup label="Date of Birth">
                  <input className="input" type="date" value={f.dob} onChange={S('dob')} />
                </FormGroup>

                <FormGroup label="Anniversary Date">
                  <input className="input" type="date" value={f.anniversary} onChange={S('anniversary')} />
                </FormGroup>

                {/* Gender radio */}
                <FormGroup label="Gender" required>
                  <div style={{ display: 'flex', gap: '2.5rem', paddingTop: '.25rem' }}>
                    {(['Male', 'Female', 'Other'] as const).map(g => (
                      <label key={g} onClick={() => setF(p => ({ ...p, gender: g }))}
                        style={{ display: 'flex', alignItems: 'center', gap: '.6rem', cursor: 'pointer', fontSize: 14, color: f.gender === g ? 'var(--text)' : 'var(--text2)', userSelect: 'none' }}>
                        <div style={{
                          width: 20, height: 20, borderRadius: '50%', border: '2px solid',
                          borderColor: f.gender === g ? 'var(--brand)' : 'var(--muted)',
                          background: 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all .15s', flexShrink: 0,
                        }}>
                          {f.gender === g && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--brand)' }} />}
                        </div>
                        {g}
                      </label>
                    ))}
                  </div>
                </FormGroup>

                {/* Reference Number */}
                <FormGroup label="Reference Number">
                  <input className="input" value={f.reference_no} onChange={S('reference_no')} />
                </FormGroup>

                {/* Aadhaar */}
                <FormGroup label="Aadhaar Number">
                  <input className="input" placeholder="e.g. 3675 9834 6012" value={f.aadhaar_no} onChange={S('aadhaar_no')} />
                </FormGroup>

                {/* PAN */}
                <FormGroup label="PAN Number">
                  <input className="input" placeholder="Enter PAN Number" value={f.pan_no} onChange={S('pan_no')} />
                </FormGroup>

                {/* GST */}
                <FormGroup label="Customer GST Number">
                  <input className="input" value={f.gst_no} onChange={S('gst_no')} />
                </FormGroup>

                {/* Company */}
                <FormGroup label="Customer Company Name">
                  <input className="input" value={f.company_name} onChange={S('company_name')} />
                </FormGroup>

                {/* Assign Trainer */}
                <FormGroup label="Assign Trainer">
                  <select className="input select" value={f.trainer_id} onChange={S('trainer_id')} disabled={user?.role === 'trainer'}>
                    <option value="">Assign Trainer</option>
                    {trainers.filter(t => t.status === 'active').map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </FormGroup>

                {/* Weight */}
                <FormGroup label="Weight (kg)">
                  <input className="input" type="number" step="0.1" placeholder="e.g. 68.5" value={f.weight} onChange={S('weight')} />
                </FormGroup>

                {/* Emergency */}
                <FormGroup label="Emergency Contact Number">
                  <div style={{ display: 'flex', gap: '.5rem' }}>
                    <CountryCodeBox />
                    <input className="input" type="tel" value={f.emergency_no} onChange={S('emergency_no')} style={{ flex: 1 }} />
                  </div>
                </FormGroup>

                {/* Interested In */}
                <FormGroup label="Interested In">
                  <input className="input" placeholder="e.g. Weight Loss, Muscle Gain, Yoga" value={f.interested_in} onChange={S('interested_in')} />
                </FormGroup>
              </div>

              {/* ── ADDRESS SECTION ── */}
              <div className="card">
                <div className="card-title" style={{ marginBottom: '1.5rem', fontSize: 16 }}>📍 Address</div>

                <FormGroup label="Address">
                  <input className="input" placeholder="Flat No., Building name" value={f.address} onChange={S('address')} style={{ marginBottom: '.5rem' }} />
                  <input className="input" placeholder="Street, Area" value={f.street} onChange={S('street')} />
                </FormGroup>

                <FormGroup label="City">
                  <input className="input" value={f.city} onChange={S('city')} />
                </FormGroup>

                <FormGroup label="State">
                  <input className="input" value={f.state} onChange={S('state')} />
                </FormGroup>

                <FormGroup label="Country">
                  <input className="input" value={f.country} onChange={S('country')} />
                </FormGroup>

                <FormGroup label="Pincode">
                  <input className="input" value={f.pincode} onChange={S('pincode')} />
                </FormGroup>
              </div>

              {/* Membership + Payment sections live on the member's
                  profile under "Add Subscription" now — keeps onboarding
                  to two short steps instead of one long form. */}
              <div className="card" style={{ background: 'var(--bg-page,#f8fafc)', borderStyle: 'dashed' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem' }}>
                  <span style={{ fontSize: 22 }}>💡</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>Plan & payment moved</div>
                    <div style={{ fontSize: 13, color: 'var(--text2)' }}>
                      After saving, you'll land on this member's profile where you can pick a plan, set start/end dates and record the payment under <b>Add Subscription</b>.
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="card">
                <label style={{ fontWeight: 600, fontSize: 14, display: 'block', marginBottom: '.5rem' }}>Notes (optional)</label>
                <textarea className="input" rows={3} value={f.notes} onChange={S('notes')}
                  placeholder="Health conditions, goals, special instructions…" />
              </div>

              <div style={{ display: 'flex', gap: '.75rem' }}>
                <button type="submit" className="btn btn-primary btn-lg" disabled={saving}>
                  {saving ? 'Saving…' : '💾 Save Member'}
                </button>
                <button type="button" className="btn btn-ghost btn-lg" onClick={() => router.back()}>Cancel</button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </AppShell>
  );
}

/* ── Sub-components ── */
function FormGroup({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '1.1rem' }}>
      <label style={{ display: 'block', fontWeight: 600, fontSize: 14, color: 'var(--text)', marginBottom: '.5rem' }}>
        {label}{required && <span style={{ color: 'var(--brand)', marginLeft: 2 }}> *</span>}
      </label>
      {children}
    </div>
  );
}

function CountryCodeBox() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '0 14px', borderRadius: 'var(--radius-sm)',
      border: '1px solid var(--glass-border-strong)',
      background: 'var(--glass-bg-2)', color: 'var(--text2)',
      fontSize: 14, fontWeight: 600, minWidth: 62, whiteSpace: 'nowrap',
    }}>+91</div>
  );
}
