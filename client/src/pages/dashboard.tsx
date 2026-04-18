import { useQuery } from '@tanstack/react-query';
import { Users, Building2, FolderOpen, Briefcase, Clock, FileText, TrendingUp, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { Candidate, Client, Project, Placement, Quote, Timesheet } from '@shared/schema';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface DashboardStats {
  totalCandidates: number;
  activePlacements: number;
  activeProjects: number;
  totalClients: number;
  pendingTimesheets: number;
  draftQuotes: number;
  totalHoursThisWeek: number;
}

function StatCard({ icon: Icon, label, value, color, sub }: {
  icon: any; label: string; value: number | string; color: string; sub?: string;
}) {
  return (
    <Card className="shadow-sm" data-testid={`stat-${label.toLowerCase().replace(/\s/g, '-')}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({ queryKey: ['/api/dashboard/stats'] });
  const { data: candidates } = useQuery<Candidate[]>({ queryKey: ['/api/candidates'] });
  const { data: projects } = useQuery<Project[]>({ queryKey: ['/api/projects'] });
  const { data: quotes } = useQuery<Quote[]>({ queryKey: ['/api/quotes'] });
  const { data: timesheets } = useQuery<Timesheet[]>({ queryKey: ['/api/timesheets'] });

  // Short label map for chart x-axis
  const SHORT_TRADE: Record<string, string> = {
    'Poly Welder': 'P.Welder',
    'Project Manager': 'PM',
    'General Manager': 'GM',
    'Site Supervisor': 'Supervisor',
    'Superintendent': 'Supt',
    'Civil Operator': 'Civil Op',
    'Rigger': 'Rigger',
    'Site Administrator': 'Site Admin',
    'Plant Operator': 'Plant Op',
  };

  // Trade breakdown for chart
  const tradeData = candidates ? Object.entries(
    candidates.reduce((acc, c) => { acc[c.trade] = (acc[c.trade] || 0) + 1; return acc; }, {} as Record<string, number>)
  ).map(([trade, count]) => ({ trade: SHORT_TRADE[trade] ?? trade.split(' ').map((w: string) => w.slice(0, 4)).join(' '), count })) : [];

  // Recent timesheets pending
  const pendingSheets = timesheets?.filter(t => t.status === 'pending') ?? [];

  const GOLD = 'hsl(38,91%,54%)';
  const NAVY = 'hsl(220,45%,20%)';

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">ACM Resources (Australia) Pty Ltd — Admin Overview</p>
        </div>
        <Badge variant="outline" className="text-xs font-semibold border-amber-400 text-amber-600 dark:text-amber-400">
          Live Data
        </Badge>
      </div>

      {/* KPI Cards — 2 rows of 4 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statsLoading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <Card key={i}><CardContent className="p-5"><Skeleton className="h-16 w-full" /></CardContent></Card>
          ))
        ) : (
          <>
            <StatCard icon={Users} label="Total Candidates" value={stats?.totalCandidates ?? 0} color="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" />
            <StatCard icon={Briefcase} label="Active Placements" value={stats?.activePlacements ?? 0} color="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" sub="Currently on project" />
            <StatCard icon={FolderOpen} label="Active Projects" value={stats?.activeProjects ?? 0} color="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" />
            <StatCard icon={Building2} label="Total Clients" value={stats?.totalClients ?? 0} color="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" />
            <StatCard icon={Clock} label="Pending Timesheets" value={stats?.pendingTimesheets ?? 0} color="bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400" sub="Awaiting approval" />
            <StatCard icon={FileText} label="Draft Quotes" value={stats?.draftQuotes ?? 0} color="bg-slate-100 text-slate-600 dark:bg-slate-900/30 dark:text-slate-400" />
            <StatCard icon={TrendingUp} label="Hours This Week" value={`${stats?.totalHoursThisWeek ?? 0}`} color="bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400" sub="Logged hrs" />
            <StatCard icon={AlertCircle} label="Pipeline Value" value={`$${((quotes ?? []).reduce((s, q) => s + (q.total ?? 0), 0) / 1000).toFixed(0)}k`} color="bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400" sub="Active quotes" />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Candidate Trade Breakdown */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Candidate Pool by Trade</CardTitle>
          </CardHeader>
          <CardContent>
            {tradeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={tradeData} margin={{ top: 4, right: 4, bottom: 50, left: 0 }}>
                  <XAxis dataKey="trade" tick={{ fontSize: 10 }} interval={0} angle={-35} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip formatter={(v) => [`${v} candidates`, 'Count']} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {tradeData.map((_, i) => (
                      <Cell key={i} fill={i % 2 === 0 ? NAVY : GOLD} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <Skeleton className="h-[220px]" />}
          </CardContent>
        </Card>

        {/* Active Projects */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Active Projects</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {projects?.filter(p => p.status === 'active').slice(0, 6).map(p => (
              <div key={p.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors" data-testid={`project-row-${p.id}`}>
                <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{p.location}</p>
                </div>
                <Badge variant="secondary" className="text-xs shrink-0">{p.headcount} pax</Badge>
              </div>
            )) ?? <Skeleton className="h-32" />}
          </CardContent>
        </Card>

        {/* Pending Timesheets */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-semibold">Pending Timesheets</CardTitle>
              {pendingSheets.length > 0 && (
                <Badge className="bg-orange-500 text-white text-xs">{pendingSheets.length}</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingSheets.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">All timesheets approved</p>
            ) : pendingSheets.slice(0, 5).map(t => (
              <div key={t.id} className="flex items-center justify-between gap-2 p-2 rounded-md border bg-orange-50/40 dark:bg-orange-900/10" data-testid={`timesheet-pending-${t.id}`}>
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                  <div>
                    <p className="text-xs font-medium">Candidate #{t.candidateId}</p>
                    <p className="text-xs text-muted-foreground">Week ending {t.weekEnding}</p>
                  </div>
                </div>
                <span className="text-xs font-bold">{t.totalHours}h</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Quote Pipeline */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Quote Pipeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {quotes?.slice(0, 5).map(q => (
              <div key={q.id} className="flex items-center justify-between gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors" data-testid={`quote-row-${q.id}`}>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{q.projectName}</p>
                  <p className="text-xs text-muted-foreground truncate">{q.clientName}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-bold">${((q.total ?? 0) / 1000).toFixed(0)}k</span>
                  <Badge
                    variant={q.status === 'accepted' ? 'default' : q.status === 'sent' ? 'secondary' : 'outline'}
                    className={`text-xs capitalize ${q.status === 'accepted' ? 'bg-green-600' : ''}`}
                  >
                    {q.status}
                  </Badge>
                </div>
              </div>
            )) ?? <Skeleton className="h-32" />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
