'use client';

import * as React from 'react';
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  LineChart,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import AppShell from '@/components/AppShell';
import Guard from '@/components/Guard';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { useToast } from '@/lib/toast';
import { moduleService } from '@/lib/module-service';
import type { ModuleConfig, ModuleRecord } from '@/lib/module-config';

type FormState = Omit<ModuleRecord, 'id' | 'createdAt' | 'updatedAt'>;

const pageSizeOptions = [5, 10, 20];
const chartColors = ['#2563eb', '#16a34a', '#f59e0b', '#7c3aed', '#dc2626'];

const accentClasses = {
  blue: 'from-blue-600 to-cyan-500',
  green: 'from-emerald-600 to-teal-500',
  yellow: 'from-amber-500 to-orange-500',
  purple: 'from-violet-600 to-fuchsia-500',
  red: 'from-rose-600 to-red-500',
};

const blankForm = (config: ModuleConfig): FormState => ({
  title: '',
  owner: '',
  status: config.statuses[0] || 'Draft',
  priority: 'Medium',
  amount: 0,
  dueDate: new Date().toISOString().slice(0, 10),
  channel: config.channels[0] || 'Front desk',
  notes: '',
});

export default function ModuleWorkspace({ config }: { config: ModuleConfig }) {
  const { toast } = useToast();
  const [records, setRecords] = React.useState<ModuleRecord[]>([]);
  const [source, setSource] = React.useState<'api' | 'local'>('local');
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');
  const [query, setQuery] = React.useState('');
  const [status, setStatus] = React.useState('All');
  const [priority, setPriority] = React.useState('All');
  const [sortBy, setSortBy] = React.useState<'dueDate' | 'amount' | 'title' | 'status'>('dueDate');
  const [pageSize, setPageSize] = React.useState(10);
  const [page, setPage] = React.useState(1);
  const [form, setForm] = React.useState<FormState>(() => blankForm(config));
  const [formError, setFormError] = React.useState('');
  const [editingId, setEditingId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await moduleService.list(config);
      setRecords(result.records);
      setSource(result.source);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load module data');
    } finally {
      setLoading(false);
    }
  }, [config]);

  React.useEffect(() => {
    setForm(blankForm(config));
    setEditingId(null);
    setPage(1);
    void load();
  }, [config, load]);

  const filtered = React.useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return records
      .filter((record) => {
        const matchesSearch =
          !normalized ||
          [record.title, record.owner, record.status, record.priority, record.channel, record.notes]
            .join(' ')
            .toLowerCase()
            .includes(normalized);
        const matchesStatus = status === 'All' || record.status === status;
        const matchesPriority = priority === 'All' || record.priority === priority;
        return matchesSearch && matchesStatus && matchesPriority;
      })
      .sort((a, b) => {
        if (sortBy === 'amount') return b.amount - a.amount;
        return String(a[sortBy]).localeCompare(String(b[sortBy]));
      });
  }, [records, query, status, priority, sortBy]);

  React.useEffect(() => {
    setPage(1);
  }, [query, status, priority, pageSize, config.key]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRecords = filtered.slice((page - 1) * pageSize, page * pageSize);
  const activeCount = records.filter((r) => ['Active', 'Approved', 'Confirmed', 'On Track', 'Online', 'Published', 'Assigned'].includes(r.status)).length;
  const pendingCount = records.filter((r) => ['Pending', 'Draft', 'Requested', 'Scheduled', 'Syncing', 'Queued'].includes(r.status)).length;
  const totalValue = records.reduce((sum, record) => sum + Number(record.amount || 0), 0);
  const urgentCount = records.filter((r) => ['High', 'Urgent'].includes(r.priority)).length;

  const trend = React.useMemo(
    () =>
      Array.from({ length: 8 }).map((_, index) => ({
        label: `W${index + 1}`,
        value: Math.round((totalValue / Math.max(records.length, 1) / 500) + activeCount * 4 + index * 8 + (index % 2) * 11),
      })),
    [activeCount, records.length, totalValue],
  );

  const statusData = React.useMemo(
    () =>
      config.statuses.map((name) => ({
        name,
        value: records.filter((record) => record.status === name).length,
      })).filter((item) => item.value > 0),
    [config.statuses, records],
  );

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFormError('');
  }

  function validate() {
    if (!form.title.trim()) return 'Title is required';
    if (!form.owner.trim()) return 'Owner is required';
    if (!form.status) return 'Status is required';
    if (!form.priority) return 'Priority is required';
    if (!form.channel) return 'Channel is required';
    if (!form.dueDate) return 'Due date is required';
    if (Number.isNaN(Number(form.amount)) || Number(form.amount) < 0) return 'Value must be zero or greater';
    return '';
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const validation = validate();
    if (validation) {
      setFormError(validation);
      toast.warning(validation);
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        const updated = await moduleService.update(config, editingId, form);
        setRecords((prev) => prev.map((record) => (record.id === editingId ? updated : record)));
        toast.success(`${config.entityName} updated`);
      } else {
        const created = await moduleService.create(config, form);
        setRecords((prev) => [created, ...prev]);
        toast.success(`${config.entityName} created`);
      }
      setForm(blankForm(config));
      setEditingId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function remove(record: ModuleRecord) {
    if (!window.confirm(`Delete "${record.title}"?`)) return;
    await moduleService.remove(config, record.id);
    setRecords((prev) => prev.filter((item) => item.id !== record.id));
    toast.success(`${config.entityName} deleted`);
  }

  function startEdit(record: ModuleRecord) {
    setEditingId(record.id);
    setForm({
      title: record.title,
      owner: record.owner,
      status: record.status,
      priority: record.priority,
      amount: record.amount,
      dueDate: record.dueDate,
      channel: record.channel,
      notes: record.notes,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function exportCsv() {
    const headers = ['Title', 'Owner', 'Status', 'Priority', 'Value', 'Due Date', 'Channel', 'Notes'];
    const rows = filtered.map((record) =>
      [record.title, record.owner, record.status, record.priority, record.amount, record.dueDate, record.channel, record.notes]
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(','),
    );
    const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${config.key}-export.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success('CSV export started');
  }

  return (
    <Guard role={config.role}>
      <AppShell title={config.title}>
        <div className="page-main">
          <div className="page-content fade-up">
            <div className="grid gap-4">
              <section className="overflow-hidden rounded border border-slate-200 bg-white shadow-sm">
                <div className={cn('h-1.5 bg-gradient-to-r', accentClasses[config.accent])} />
                <div className="grid gap-4 p-4 lg:grid-cols-[1.4fr_0.9fr] lg:items-center">
                  <div>
                    <p className="eyebrow">{config.eyebrow}</p>
                    <h1 className="m-0 text-2xl font-extrabold tracking-tight text-slate-900 md:text-3xl">{config.title}</h1>
                    <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">{config.description}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {config.workflows.map((item) => (
                        <span key={item} className="rounded border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2">
                    <MetricCard label="Records" value={records.length} icon={<BarChart3 className="h-4 w-4" />} />
                    <MetricCard label="Active" value={activeCount} icon={<CheckCircle2 className="h-4 w-4" />} />
                    <MetricCard label="Pending" value={pendingCount} icon={<CalendarDays className="h-4 w-4" />} />
                    <MetricCard label="Urgent" value={urgentCount} icon={<AlertTriangle className="h-4 w-4" />} />
                  </div>
                </div>
              </section>

              <section className="grid gap-4 xl:grid-cols-[0.95fr_1.35fr]">
                <form onSubmit={submit} className="rounded border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <h2 className="m-0 text-base font-bold text-slate-900">{editingId ? 'Edit record' : config.primaryAction}</h2>
                      <p className="mt-1 text-xs text-slate-500">Validated form with API-first save and local fallback.</p>
                    </div>
                    {editingId && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingId(null);
                          setForm(blankForm(config));
                        }}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                  {formError && <div className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">{formError}</div>}
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="Title" required>
                      <input className="input" value={form.title} onChange={(e) => updateForm('title', e.target.value)} placeholder="May renewal campaign" />
                    </Field>
                    <Field label="Owner" required>
                      <input className="input" value={form.owner} onChange={(e) => updateForm('owner', e.target.value)} placeholder="Owner name" />
                    </Field>
                    <Field label="Status" required>
                      <select className="input select" value={form.status} onChange={(e) => updateForm('status', e.target.value)}>
                        {config.statuses.map((item) => <option key={item}>{item}</option>)}
                      </select>
                    </Field>
                    <Field label="Priority" required>
                      <select className="input select" value={form.priority} onChange={(e) => updateForm('priority', e.target.value)}>
                        {config.priorities.map((item) => <option key={item}>{item}</option>)}
                      </select>
                    </Field>
                    <Field label="Value" required>
                      <input className="input" type="number" min={0} value={form.amount} onChange={(e) => updateForm('amount', Number(e.target.value))} />
                    </Field>
                    <Field label="Due date" required>
                      <input className="input" type="date" value={form.dueDate} onChange={(e) => updateForm('dueDate', e.target.value)} />
                    </Field>
                    <Field label="Channel" required>
                      <select className="input select" value={form.channel} onChange={(e) => updateForm('channel', e.target.value)}>
                        {config.channels.map((item) => <option key={item}>{item}</option>)}
                      </select>
                    </Field>
                    <div className="md:col-span-2">
                      <Field label="Notes">
                        <textarea className="input" rows={3} value={form.notes} onChange={(e) => updateForm('notes', e.target.value)} placeholder="Add details, approvals, audience, receipt notes, or reminders" />
                      </Field>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button type="submit" loading={saving} iconLeft={<Plus className="h-4 w-4" />}>
                      {editingId ? 'Save changes' : config.primaryAction}
                    </Button>
                    <Button variant="outline" iconLeft={<RefreshCw className="h-4 w-4" />} onClick={load} disabled={loading}>
                      Refresh
                    </Button>
                  </div>
                </form>

                <section className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="mb-3 flex items-center justify-between">
                      <h2 className="m-0 text-base font-bold text-slate-900">Performance Trend</h2>
                      <LineChart className="h-4 w-4 text-slate-500" />
                    </div>
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={trend} margin={{ left: -22, right: 8, top: 8, bottom: 0 }}>
                          <defs>
                            <linearGradient id={`trend-${config.key}`} x1="0" x2="0" y1="0" y2="1">
                              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.45} />
                              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} />
                          <YAxis tickLine={false} axisLine={false} fontSize={11} />
                          <Tooltip />
                          <Area type="monotone" dataKey="value" stroke="#f59e0b" fill={`url(#trend-${config.key})`} strokeWidth={2} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="rounded border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="mb-3 flex items-center justify-between">
                      <h2 className="m-0 text-base font-bold text-slate-900">Status Mix</h2>
                      <SlidersHorizontal className="h-4 w-4 text-slate-500" />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-[0.9fr_1fr] sm:items-center">
                      <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={statusData.length ? statusData : [{ name: 'Empty', value: 1 }]} dataKey="value" nameKey="name" innerRadius={42} outerRadius={72} paddingAngle={3}>
                              {(statusData.length ? statusData : [{ name: 'Empty', value: 1 }]).map((entry, index) => (
                                <Cell key={entry.name} fill={statusData.length ? chartColors[index % chartColors.length] : '#e2e8f0'} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="grid gap-2">
                        {config.insights.map((item, index) => (
                          <div key={item} className="flex items-center justify-between gap-3 rounded border border-slate-100 bg-slate-50 px-3 py-2">
                            <span className="text-xs font-semibold text-slate-600">{item}</span>
                            <span className="text-sm font-extrabold text-slate-900">{Math.max(1, (records.length + index * 3) % 19)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>
              </section>

              <section className="rounded border border-slate-200 bg-white shadow-sm">
                <div className="grid gap-3 border-b border-slate-200 p-4 lg:grid-cols-[1fr_auto] lg:items-center">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input className="input pl-8" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${config.entityName.toLowerCase()}s`} />
                    </div>
                    <select className="input select max-w-[180px]" value={status} onChange={(e) => setStatus(e.target.value)}>
                      <option>All</option>
                      {config.statuses.map((item) => <option key={item}>{item}</option>)}
                    </select>
                    <select className="input select max-w-[160px]" value={priority} onChange={(e) => setPriority(e.target.value)}>
                      <option>All</option>
                      {config.priorities.map((item) => <option key={item}>{item}</option>)}
                    </select>
                    <select className="input select max-w-[160px]" value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)}>
                      <option value="dueDate">Due date</option>
                      <option value="amount">Value</option>
                      <option value="title">Title</option>
                      <option value="status">Status</option>
                    </select>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600">
                      {source === 'api' ? 'API connected' : 'Mock API fallback'}
                    </span>
                    <Button variant="outline" iconLeft={<Download className="h-4 w-4" />} onClick={exportCsv}>
                      Export CSV
                    </Button>
                  </div>
                </div>

                <div className="table-wrap overflow-x-auto">
                  {loading ? (
                    <div className="grid min-h-64 place-items-center p-8 text-slate-500">
                      <Loader2 className="mb-3 h-6 w-6 animate-spin" />
                      Loading {config.title.toLowerCase()}...
                    </div>
                  ) : error ? (
                    <EmptyState title="Could not load records" description={error} icon={<AlertTriangle className="h-8 w-8" />} />
                  ) : pageRecords.length === 0 ? (
                    <EmptyState title="No records found" description="Adjust filters or create a new record to populate this module." icon={<Filter className="h-8 w-8" />} />
                  ) : (
                    <table className="min-w-[900px]">
                      <thead>
                        <tr>
                          <th>Title</th>
                          <th>Owner</th>
                          <th>Status</th>
                          <th>Priority</th>
                          <th>Value</th>
                          <th>Due</th>
                          <th>Channel</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        <AnimatePresence initial={false}>
                          {pageRecords.map((record) => (
                            <motion.tr key={record.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                              <td>
                                <div className="font-semibold text-slate-900">{record.title}</div>
                                <div className="max-w-sm truncate text-xs text-slate-500">{record.notes || 'No notes'}</div>
                              </td>
                              <td>{record.owner}</td>
                              <td><StatusPill status={record.status} /></td>
                              <td><PriorityPill priority={record.priority} /></td>
                              <td className="tabular font-bold">INR {Number(record.amount || 0).toLocaleString('en-IN')}</td>
                              <td className="tabular text-slate-600">{record.dueDate}</td>
                              <td>{record.channel}</td>
                              <td>
                                <div className="flex gap-2">
                                  <Button size="sm" variant="outline" onClick={() => startEdit(record)}>Edit</Button>
                                  <Button size="sm" variant="danger" onClick={() => remove(record)} aria-label={`Delete ${record.title}`}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </td>
                            </motion.tr>
                          ))}
                        </AnimatePresence>
                      </tbody>
                    </table>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 p-3">
                  <div className="text-xs font-medium text-slate-500">
                    Showing {filtered.length === 0 ? 0 : (page - 1) * pageSize + 1}-{Math.min(page * pageSize, filtered.length)} of {filtered.length}
                  </div>
                  <div className="flex items-center gap-2">
                    <select className="input select h-8 max-w-[90px]" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
                      {pageSizeOptions.map((size) => <option key={size} value={size}>{size}/page</option>)}
                    </select>
                    <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} aria-label="Previous page">
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-xs font-bold text-slate-600">Page {page} / {totalPages}</span>
                    <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} aria-label="Next page">
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </AppShell>
    </Guard>
  );
}

function MetricCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded border border-slate-200 bg-slate-50 p-3">
      <div className="mb-2 flex items-center justify-between text-slate-500">
        <span className="text-[11px] font-bold uppercase tracking-wide">{label}</span>
        {icon}
      </div>
      <div className="text-2xl font-extrabold tabular text-slate-900">{value.toLocaleString('en-IN')}</div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-600">
      <span>{label}{required ? ' *' : ''}</span>
      {children}
    </label>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone = /active|approved|paid|ready|online|published|confirmed|achieved|completed/i.test(status)
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : /pending|draft|scheduled|queued|requested/i.test(status)
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : /rejected|failed|overdue|critical|damaged|offline/i.test(status)
        ? 'border-red-200 bg-red-50 text-red-700'
        : 'border-slate-200 bg-slate-50 text-slate-700';
  return <span className={cn('rounded border px-2 py-1 text-xs font-bold', tone)}>{status}</span>;
}

function PriorityPill({ priority }: { priority: string }) {
  const tone = priority === 'Urgent' || priority === 'High' ? 'bg-rose-100 text-rose-700' : priority === 'Medium' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600';
  return <span className={cn('rounded px-2 py-1 text-xs font-bold', tone)}>{priority}</span>;
}

function EmptyState({ title, description, icon }: { title: string; description: string; icon: React.ReactNode }) {
  return (
    <div className="grid min-h-64 place-items-center p-8 text-center">
      <div>
        <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-slate-100 text-slate-400">{icon}</div>
        <h3 className="m-0 text-base font-bold text-slate-900">{title}</h3>
        <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{description}</p>
      </div>
    </div>
  );
}

