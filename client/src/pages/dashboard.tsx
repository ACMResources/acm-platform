import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import {
  Users, Building2, FolderOpen, Briefcase, Clock, FileText,
  TrendingUp, AlertCircle, DollarSign, ChevronRight,
  AlertTriangle, CheckCircle2, Hammer, HardHat, Receipt,
  BarChart2, MapPin, Calendar, ArrowUpRight, RefreshCw,
  Layers, FileWarning, Wrench,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area, CartesianGrid, Cell,
} from 'recharts';

// ── Types ────────────────────────────────────────────────────────────
interface ActionItem {
  type: string;
  priority: 'high' | 'medium' | 'low';
  label: string;
  sub: string;
  link: string;
}

interface ProjectHealth {
  id: number;
  name: string;
  location: string | null;
  scope: string | null;
  clientName: string | null;
  contractValue: number;
  headcount: number;
  activePlacements: number;
  invoiced: number;
  paid: number;
  burnPct: number | null;
  startDate: string | null;
  endDate: string | null;
}

interface FullDashboard {
  totalCandidates: number;
  activePlacements: number;
  activeProjects: number;
  totalClients: number;
  pendingTimesheets: number;
  draftQuotes: number;
  totalHoursThisWeek: number;
  xeroSummary: { totalRevenue: number; outstanding: number; overdue: number; invoiceCount: number };
  actionItems: ActionItem[];
  projectHealth: ProjectHealth[];
  workforceByProject: { projectId: number; projectName: string; location: string | null; headcount: number }[];
  tradeBreakdown: { trade: string; count: number }[];
  availableByTrade: { trade: string; count: number }[];
  revenueByMonth: { month: string; revenue: number }[];
  recentQuotes: { id: number; projectName: string; clientName: string; total: number; status: string }[];
}

// ── Helpers ──────────────────────────────────────────────────────────
const GOLD = 'hsl(38,91%,54%)';
const NAVY = '#1c2b4a';

function aud(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n.toFixed(0)}`;
}

function fmtMonth(s: string) {
  const [y, m] = s.split('-');
  return new Date(Number(y), Number(m) - 1).toLocaleString('en-AU', { month: 'short', year: '2-digit' });
}

const PRIORITY_COLOUR: Record<string, string> = {
  high: 'bg-red-500',
  medium: 'bg-orange-400',
  low: 'bg-yellow-400',
};

const ACTION_ICON: Record<string, any> = {
  rfi: FileWarning,
  timesheet: Clock,
  invoice: Receipt,
  quote: FileText,
  project: FolderOpen,
};

const SCOPE_COLOUR: Record<string, string> = {
  labour_hire: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  construction: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  pipeline: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  bore: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
};

const QUOTE_STATUS: Record<string, string> = {
  accepted: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  sent: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  draft: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  declined: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const TRADE_SHORT: Record<string, string> = {
  'Poly Welder': 'P.Welder',
  'Project Manager': 'PM',
  'General Manager': 'GM',
  'Site Supervisor': 'Site Sup',
  'Superintendent': 'Supt',
  'Civil Operator': 'Civil Op',
  'Rigger': 'Rigger',
  'Site Administrator': 'Site Adm',
  'Plant Operator': 'Plant Op',
};

// ── Sub-components ───────────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, sub, accent, link }: {
  icon: any; label: string; value: string | number; sub?: string;
  accent: string; link?: string;
}) {
  const inner = (
    <Card className="border hover:shadow-md transition-shadow cursor-pointer group">
      <CardContent className="p-4 flex items-start gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${accent}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider leading-tight">{label}</p>
          <p className="text-2xl font-bold text-foreground mt-0.5 leading-tight">{value}</p>
          {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
        </div>
        {link && <ArrowUpRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors mt-1 shrink-0" />}
      </CardContent>
    </Card>
  );
  return link ? <Link href={link}>{inner}</Link> : inner;
}

function ActionBadge({ count, type }: { count: number; type: 'high' | 'medium' | 'low' }) {
  if (count === 0) return null;
  const cls = type === 'high'
    ? 'bg-red-500 text-white'
    : type === 'medium'
    ? 'bg-orange-400 text-white'
    : 'bg-yellow-400 text-gray-800';
  return <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold ${cls}`}>{count}</span>;
}

// ── Main Dashboard ───────────────────────────────────────────────────
export default function Dashboard() {
  const { data, isLoading } = useQuery<FullDashboard>({ queryKey: ['/api/dashboard/full'] });

  const today = new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const highActions = data?.actionItems.filter(a => a.priority === 'high') ?? [];
  const medActions = data?.actionItems.filter(a => a.priority === 'medium') ?? [];
  const lowActions = data?.actionItems.filter(a => a.priority === 'low') ?? [];

  return (
    <div className="p-5 space-y-5 max-w-[1400px]">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">ACM Platform</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{today}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs font-semibold border-amber-400 text-amber-600 dark:text-amber-400 gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block animate-pulse" />
            Live · Xero Connected
          </Badge>
        </div>
      </div>

      {/* ── Finance strip (Xero) ── */}
      {isLoading ? (
        <Skeleton className="h-20 w-full rounded-xl" />
      ) : (
        <Link href="/finance">
          <div className="rounded-xl overflow-hidden border cursor-pointer hover:shadow-md transition-shadow group">
            <div className="bg-[#1c2b4a] px-5 py-3 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-[#f5a623]" />
              <span className="text-[11px] font-bold text-[#f5a623] uppercase tracking-widest">Xero · Live Financial Position</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-[#f5a623]/60 group-hover:text-[#f5a623] ml-auto transition-colors" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-border bg-card">
              {[
                { label: 'Paid Revenue', value: aud(data?.xeroSummary?.totalRevenue ?? 0), colour: 'text-green-600 dark:text-green-400' },
                { label: 'Outstanding AR', value: aud(data?.xeroSummary?.outstanding ?? 0), colour: 'text-blue-600 dark:text-blue-400' },
                { label: 'Overdue AR', value: aud(data?.xeroSummary?.overdue ?? 0), colour: (data?.xeroSummary?.overdue ?? 0) > 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground' },
                { label: 'Invoices Total', value: String(data?.xeroSummary?.invoiceCount ?? 0), colour: 'text-foreground' },
              ].map(k => (
                <div key={k.label} className="px-5 py-4 flex flex-col gap-0.5">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{k.label}</p>
                  <p className={`text-xl font-bold ${k.colour}`}>{k.value}</p>
                </div>
              ))}
            </div>
          </div>
        </Link>
      )}

      {/* ── Row 1: KPI chips + Action Centre ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* KPIs — left 2 cols */}
        <div className="xl:col-span-2 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard icon={FolderOpen} label="Active Projects" value={data?.activeProjects ?? '—'} accent="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" link="/projects" />
            <KpiCard icon={Briefcase} label="Active Placements" value={data?.activePlacements ?? '—'} sub="On project now" accent="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" link="/placements" />
            <KpiCard icon={Users} label="Candidates" value={data?.totalCandidates ?? '—'} accent="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" link="/candidates" />
            <KpiCard icon={Building2} label="Clients" value={data?.totalClients ?? '—'} accent="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" link="/clients" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard icon={Clock} label="Pending Timesheets" value={data?.pendingTimesheets ?? '—'} sub="Awaiting approval" accent="bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400" link="/timesheets" />
            <KpiCard icon={FileText} label="Draft Quotes" value={data?.draftQuotes ?? '—'} accent="bg-slate-100 text-slate-600 dark:bg-slate-900/30 dark:text-slate-400" link="/quotes" />
            <KpiCard icon={TrendingUp} label="Hours This Week" value={data?.totalHoursThisWeek ?? '—'} sub="Logged hrs" accent="bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400" link="/timesheets" />
            <KpiCard
              icon={HardHat}
              label="Available Now"
              value={data?.availableByTrade.reduce((s, r) => s + r.count, 0) ?? '—'}
              sub="Ready to deploy"
              accent="bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400"
              link="/candidates"
            />
          </div>
        </div>

        {/* Action Centre */}
        <Card className="border">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-orange-500" />
                <CardTitle className="text-sm font-bold">Action Centre</CardTitle>
              </div>
              <div className="flex items-center gap-1">
                <ActionBadge count={highActions.length} type="high" />
                <ActionBadge count={medActions.length} type="medium" />
                <ActionBadge count={lowActions.length} type="low" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            {isLoading ? (
              <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : (data?.actionItems.length ?? 0) === 0 ? (
              <div className="flex flex-col items-center py-8 gap-2">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
                <p className="text-sm font-medium text-muted-foreground">All clear — no actions needed</p>
              </div>
            ) : (
              <div className="space-y-1 max-h-[240px] overflow-y-auto pr-1">
                {data?.actionItems.map((item, i) => {
                  const Icon = ACTION_ICON[item.type] ?? AlertCircle;
                  return (
                    <Link key={i} href={item.link}>
                      <div className="flex items-start gap-2.5 p-2.5 rounded-lg hover:bg-muted/60 transition-colors cursor-pointer group">
                        <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${PRIORITY_COLOUR[item.priority]}`} />
                        <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-foreground leading-tight truncate">{item.label}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{item.sub}</p>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-muted-foreground shrink-0 mt-0.5 transition-colors" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Project Health Matrix ── */}
      <Card className="border">
        <CardHeader className="pb-2 pt-4 px-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#f5a623]" />
              <CardTitle className="text-sm font-bold">Project Health</CardTitle>
              {data && <Badge variant="secondary" className="text-xs">{data.projectHealth.length} active</Badge>}
            </div>
            <Link href="/projects">
              <span className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 cursor-pointer">
                View all <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          {isLoading ? (
            <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : (data?.projectHealth.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No active projects</p>
          ) : (
            <div className="space-y-3">
              {data?.projectHealth.map(p => {
                const burnColour = (p.burnPct ?? 0) > 90 ? 'bg-red-500' : (p.burnPct ?? 0) > 70 ? 'bg-orange-400' : 'bg-green-500';
                return (
                  <Link key={p.id} href={`/projects/${p.id}`}>
                    <div className="flex items-center gap-4 p-3 rounded-lg border bg-card hover:bg-muted/40 transition-colors cursor-pointer group">
                      {/* Name + location */}
                      <div className="min-w-0 w-[220px] shrink-0">
                        <p className="text-sm font-semibold truncate group-hover:text-[#f5a623] transition-colors">{p.name}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-muted-foreground shrink-0" />
                          <p className="text-[11px] text-muted-foreground truncate">{p.location ?? '—'}</p>
                        </div>
                      </div>
                      {/* Client */}
                      <div className="hidden md:block w-[150px] shrink-0">
                        <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Client</p>
                        <p className="text-xs font-medium truncate">{p.clientName ?? '—'}</p>
                      </div>
                      {/* Scope badge */}
                      {p.scope && (
                        <div className="hidden lg:block w-[110px] shrink-0">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded capitalize ${SCOPE_COLOUR[p.scope] ?? 'bg-muted text-muted-foreground'}`}>
                            {p.scope.replace('_', ' ')}
                          </span>
                        </div>
                      )}
                      {/* Headcount */}
                      <div className="hidden sm:flex items-center gap-1 w-[70px] shrink-0">
                        <HardHat className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-sm font-bold">{p.activePlacements}</span>
                        <span className="text-xs text-muted-foreground">pax</span>
                      </div>
                      {/* Contract value */}
                      <div className="hidden md:block w-[90px] shrink-0">
                        <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Contract</p>
                        <p className="text-xs font-bold">{p.contractValue > 0 ? aud(p.contractValue) : '—'}</p>
                      </div>
                      {/* Budget burn bar */}
                      <div className="flex-1 min-w-[100px]">
                        {p.burnPct !== null ? (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-muted-foreground">Budget burn</span>
                              <span className="text-[10px] font-bold">{p.burnPct}%</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                              <div className={`h-full rounded-full transition-all ${burnColour}`} style={{ width: `${p.burnPct}%` }} />
                            </div>
                            <p className="text-[10px] text-muted-foreground">{aud(p.invoiced)} invoiced</p>
                          </div>
                        ) : (
                          <span className="text-[11px] text-muted-foreground italic">No Xero data linked</span>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Row 3: Revenue Chart + Workforce + Trades ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Revenue by month */}
        <Card className="border lg:col-span-2">
          <CardHeader className="pb-2 pt-4 px-5">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-[#f5a623]" />
              <CardTitle className="text-sm font-bold">Revenue — Last 6 Months (Xero)</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {isLoading ? (
              <Skeleton className="h-[220px] w-full" />
            ) : (data?.revenueByMonth.length ?? 0) === 0 ? (
              <div className="flex flex-col items-center py-10 gap-2">
                <BarChart2 className="w-8 h-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No revenue data — sync Xero first</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={data?.revenueByMonth.map(r => ({ ...r, month: fmtMonth(r.month) }))} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={GOLD} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={GOLD} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(v: number) => [`$${v.toLocaleString('en-AU', { maximumFractionDigits: 0 })}`, 'Revenue']}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid hsl(var(--border))' }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke={GOLD} strokeWidth={2.5} fill="url(#revGrad)" dot={{ r: 4, fill: GOLD, strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Workforce by project */}
        <Card className="border">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center gap-2">
              <HardHat className="w-4 h-4 text-[#f5a623]" />
              <CardTitle className="text-sm font-bold">Workforce Deployment</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            {isLoading ? (
              <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
            ) : (data?.workforceByProject.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No active placements</p>
            ) : (
              <>
                {data?.workforceByProject.map(w => {
                  const max = data.workforceByProject[0].headcount;
                  const pct = Math.round((w.headcount / max) * 100);
                  return (
                    <Link key={w.projectId} href={`/projects/${w.projectId}`}>
                      <div className="space-y-1 cursor-pointer group">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium truncate group-hover:text-[#f5a623] transition-colors">{w.projectName}</span>
                          <span className="text-xs font-bold shrink-0">{w.headcount}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-[#1c2b4a] dark:bg-[#f5a623] transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </Link>
                  );
                })}
                <div className="pt-1 border-t">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Total deployed</span>
                    <span className="text-sm font-bold">{data?.activePlacements} pax</span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Row 4: Trade pool + Quote pipeline ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Trade Breakdown */}
        <Card className="border">
          <CardHeader className="pb-2 pt-4 px-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wrench className="w-4 h-4 text-[#f5a623]" />
                <CardTitle className="text-sm font-bold">Candidate Pool by Trade</CardTitle>
              </div>
              <Link href="/candidates">
                <span className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 cursor-pointer">
                  View all <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {isLoading ? (
              <Skeleton className="h-[200px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={data?.tradeBreakdown.map(t => ({ ...t, trade: TRADE_SHORT[t.trade] ?? t.trade.split(' ').map(w => w.slice(0, 4)).join(' ') }))}
                  margin={{ top: 4, right: 4, bottom: 50, left: 0 }}
                >
                  <XAxis dataKey="trade" tick={{ fontSize: 10 }} interval={0} angle={-30} textAnchor="end" height={55} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip formatter={v => [`${v}`, 'Candidates']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {data?.tradeBreakdown.map((_, i) => (
                      <Cell key={i} fill={i % 2 === 0 ? NAVY : GOLD} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}

            {/* Available summary */}
            {(data?.availableByTrade.length ?? 0) > 0 && (
              <div className="mt-3 pt-3 border-t flex flex-wrap gap-2">
                {data?.availableByTrade.map(a => (
                  <span key={a.trade} className="inline-flex items-center gap-1 text-[11px] bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                    {TRADE_SHORT[a.trade] ?? a.trade} ×{a.count}
                  </span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quote Pipeline */}
        <Card className="border">
          <CardHeader className="pb-2 pt-4 px-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#f5a623]" />
                <CardTitle className="text-sm font-bold">Quote Pipeline</CardTitle>
                {data && (
                  <span className="text-[11px] text-muted-foreground">
                    {aud(data.recentQuotes.reduce((s, q) => s + (q.total ?? 0), 0))} total
                  </span>
                )}
              </div>
              <Link href="/quotes">
                <span className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 cursor-pointer">
                  View all <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-1.5">
            {isLoading ? (
              <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : (data?.recentQuotes.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No quotes yet</p>
            ) : (
              data?.recentQuotes.map(q => (
                <Link key={q.id} href="/quotes">
                  <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/60 transition-colors cursor-pointer group">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate group-hover:text-[#f5a623] transition-colors">{q.projectName}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{q.clientName}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-bold">{aud(q.total ?? 0)}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded capitalize ${QUOTE_STATUS[q.status] ?? QUOTE_STATUS.draft}`}>
                        {q.status}
                      </span>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
