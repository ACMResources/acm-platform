import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import {
  DollarSign, TrendingUp, Clock, AlertTriangle, RefreshCw,
  ChevronRight, Building2, Receipt, CheckCircle2, FileWarning,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';

interface XeroInvoice {
  id: number;
  xeroInvoiceId: string;
  invoiceNumber: string | null;
  reference: string | null;
  contactName: string | null;
  trackingOption: string | null;
  status: string;
  type: string;
  date: string | null;
  dueDate: string | null;
  subTotal: number;
  totalTax: number;
  total: number;
  amountDue: number;
  amountPaid: number;
  currencyCode: string;
  syncedAt: string;
}

interface XeroContact {
  id: number;
  xeroContactId: string;
  name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  isCustomer: boolean;
  isSupplier: boolean;
  outstandingAR: number;
  overdueAR: number;
  syncedAt: string;
}

interface XeroSummary {
  totalRevenue: number;
  outstanding: number;
  overdue: number;
  invoiceCount: number;
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(n);
}

function fmtDate(s: string | null) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    PAID: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    AUTHORISED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    DRAFT: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    VOIDED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    OVERDUE: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${map[status] ?? map['DRAFT']}`}>
      {status}
    </span>
  );
}

export default function FinancePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('invoices');

  const { data: invoices = [], isLoading: loadingInv } = useQuery<XeroInvoice[]>({
    queryKey: ['/api/xero/invoices'],
  });

  const { data: contacts = [], isLoading: loadingCon } = useQuery<XeroContact[]>({
    queryKey: ['/api/xero/contacts'],
  });

  const { data: summary } = useQuery<XeroSummary>({
    queryKey: ['/api/xero/summary'],
  });

  const syncMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/xero/sync-trigger', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/xero/invoices'] });
      queryClient.invalidateQueries({ queryKey: ['/api/xero/contacts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/xero/summary'] });
      toast({ title: 'Xero sync complete', description: 'Invoices and contacts refreshed from Xero.' });
    },
    onError: () => {
      toast({ title: 'Sync unavailable', description: 'Use the Perplexity session to push Xero data.', variant: 'destructive' });
    },
  });

  const today = new Date().toISOString().slice(0, 10);
  const accRec = invoices.filter(i => i.type === 'ACCREC');
  const overdue = accRec.filter(i => i.status === 'AUTHORISED' && i.dueDate && i.dueDate < today);
  const outstanding = accRec.filter(i => i.status === 'AUTHORISED');

  const lastSync = invoices[0]?.syncedAt
    ? new Date(invoices[0].syncedAt).toLocaleString('en-AU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : null;

  const kpis = [
    {
      label: 'Total Revenue (Paid)',
      value: fmt(summary?.totalRevenue ?? 0),
      icon: TrendingUp,
      color: 'text-green-600 dark:text-green-400',
      bg: 'bg-green-50 dark:bg-green-900/20',
    },
    {
      label: 'Outstanding AR',
      value: fmt(summary?.outstanding ?? 0),
      icon: Clock,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-900/20',
    },
    {
      label: 'Overdue AR',
      value: fmt(summary?.overdue ?? 0),
      icon: AlertTriangle,
      color: 'text-orange-600 dark:text-orange-400',
      bg: 'bg-orange-50 dark:bg-orange-900/20',
    },
    {
      label: 'Total Invoices',
      value: String(summary?.invoiceCount ?? invoices.length),
      icon: Receipt,
      color: 'text-[hsl(38,91%,54%)]',
      bg: 'bg-amber-50 dark:bg-amber-900/20',
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Finance</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Live data from Xero — ACM Resources (Australia) Pty Ltd
            {lastSync && <span className="ml-2 text-xs">Last sync: {lastSync}</span>}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          className="gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
          Sync Xero
        </Button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(k => (
          <Card key={k.label} className="border">
            <CardContent className="p-4 flex items-start gap-3">
              <div className={`p-2 rounded-lg ${k.bg} shrink-0`}>
                <k.icon className={`w-5 h-5 ${k.color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground leading-tight">{k.label}</p>
                <p className="text-lg font-bold text-foreground mt-0.5 truncate">{k.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Overdue alert */}
      {overdue.length > 0 && (
        <div className="flex items-center gap-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg px-4 py-3">
          <FileWarning className="w-5 h-5 text-orange-600 dark:text-orange-400 shrink-0" />
          <span className="text-sm font-medium text-orange-800 dark:text-orange-300">
            {overdue.length} invoice{overdue.length > 1 ? 's are' : ' is'} overdue — total {fmt(overdue.reduce((s, i) => s + i.amountDue, 0))}
          </span>
        </div>
      )}

      {/* No data empty state */}
      {!loadingInv && invoices.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <DollarSign className="w-12 h-12 text-muted-foreground/30" />
            <p className="text-sm font-medium text-muted-foreground">No Xero data yet</p>
            <p className="text-xs text-muted-foreground/70 text-center max-w-xs">
              Click "Sync Xero" above, or push data from your Perplexity session using the sync endpoint.
            </p>
          </CardContent>
        </Card>
      )}

      {invoices.length > 0 && (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="invoices">
              Sales Invoices
              <span className="ml-1.5 text-[10px] bg-muted px-1.5 rounded-full">{accRec.length}</span>
            </TabsTrigger>
            <TabsTrigger value="outstanding">
              Outstanding
              <span className="ml-1.5 text-[10px] bg-muted px-1.5 rounded-full">{outstanding.length}</span>
            </TabsTrigger>
            <TabsTrigger value="byproject">By Project</TabsTrigger>
            <TabsTrigger value="contacts">
              Contacts
              <span className="ml-1.5 text-[10px] bg-muted px-1.5 rounded-full">{contacts.length}</span>
            </TabsTrigger>
          </TabsList>

          {/* ALL INVOICES */}
          <TabsContent value="invoices">
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice #</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Project</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Due</TableHead>
                        <TableHead className="text-right">Total (AUD)</TableHead>
                        <TableHead className="text-right">Amount Due</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {accRec.map(inv => {
                        const isOverdue = inv.status === 'AUTHORISED' && inv.dueDate && inv.dueDate < today;
                        return (
                          <TableRow key={inv.id} className={isOverdue ? 'bg-orange-50/50 dark:bg-orange-900/10' : ''}>
                            <TableCell className="font-mono text-xs font-semibold">{inv.invoiceNumber ?? '—'}</TableCell>
                            <TableCell className="max-w-[160px]">
                              <span className="truncate block text-sm">{inv.contactName ?? '—'}</span>
                            </TableCell>
                            <TableCell className="max-w-[180px]">
                              <span className="truncate block text-xs text-muted-foreground">{inv.trackingOption ?? '—'}</span>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{fmtDate(inv.date)}</TableCell>
                            <TableCell className="text-xs whitespace-nowrap">
                              <span className={isOverdue ? 'text-orange-600 font-semibold' : 'text-muted-foreground'}>
                                {fmtDate(inv.dueDate)}
                              </span>
                            </TableCell>
                            <TableCell className="text-right font-semibold text-sm">{fmt(inv.total)}</TableCell>
                            <TableCell className="text-right text-sm">
                              {inv.amountDue > 0 ? <span className="font-semibold text-orange-600">{fmt(inv.amountDue)}</span> : <span className="text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell>
                              <StatusBadge status={isOverdue ? 'OVERDUE' : inv.status} />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* OUTSTANDING */}
          <TabsContent value="outstanding">
            <Card>
              <CardContent className="p-0">
                {outstanding.length === 0 ? (
                  <div className="flex flex-col items-center py-12 gap-2">
                    <CheckCircle2 className="w-10 h-10 text-green-500" />
                    <p className="text-sm text-muted-foreground">All invoices paid — nothing outstanding.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Invoice #</TableHead>
                          <TableHead>Client</TableHead>
                          <TableHead>Project</TableHead>
                          <TableHead>Due Date</TableHead>
                          <TableHead className="text-right">Amount Due</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {outstanding
                          .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))
                          .map(inv => {
                            const isOverdue = inv.dueDate && inv.dueDate < today;
                            return (
                              <TableRow key={inv.id} className={isOverdue ? 'bg-orange-50/50 dark:bg-orange-900/10' : ''}>
                                <TableCell className="font-mono text-xs font-semibold">{inv.invoiceNumber ?? '—'}</TableCell>
                                <TableCell className="text-sm">{inv.contactName ?? '—'}</TableCell>
                                <TableCell className="text-xs text-muted-foreground">{inv.trackingOption ?? '—'}</TableCell>
                                <TableCell>
                                  <span className={isOverdue ? 'text-orange-600 font-semibold text-sm' : 'text-muted-foreground text-sm'}>
                                    {fmtDate(inv.dueDate)}
                                    {isOverdue && ' ⚠'}
                                  </span>
                                </TableCell>
                                <TableCell className="text-right font-bold text-orange-600">{fmt(inv.amountDue)}</TableCell>
                                <TableCell><StatusBadge status={isOverdue ? 'OVERDUE' : 'AUTHORISED'} /></TableCell>
                              </TableRow>
                            );
                          })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* BY PROJECT */}
          <TabsContent value="byproject">
            <ProjectRevenueView invoices={accRec} />
          </TabsContent>

          {/* CONTACTS */}
          <TabsContent value="contacts">
            <Card>
              <CardContent className="p-0">
                {contacts.length === 0 ? (
                  <div className="flex flex-col items-center py-12 gap-2">
                    <Building2 className="w-10 h-10 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">No contacts synced yet.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>City</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead className="text-right">Outstanding AR</TableHead>
                          <TableHead className="text-right">Overdue AR</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {contacts.map(c => (
                          <TableRow key={c.id}>
                            <TableCell className="font-medium text-sm">{c.name}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{c.email ?? '—'}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{c.city ?? '—'}</TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                {c.isCustomer && <span className="text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-1.5 rounded font-semibold">Customer</span>}
                                {c.isSupplier && <span className="text-[10px] bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-1.5 rounded font-semibold">Supplier</span>}
                              </div>
                            </TableCell>
                            <TableCell className="text-right text-sm">{c.outstandingAR > 0 ? <span className="font-semibold text-orange-600">{fmt(c.outstandingAR)}</span> : <span className="text-muted-foreground">—</span>}</TableCell>
                            <TableCell className="text-right text-sm">{c.overdueAR > 0 ? <span className="font-bold text-red-600">{fmt(c.overdueAR)}</span> : <span className="text-muted-foreground">—</span>}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

// ── Project Revenue sub-component ──────────────────────────────────────
function ProjectRevenueView({ invoices }: { invoices: XeroInvoice[] }) {
  // Group by tracking option (project)
  const grouped: Record<string, { option: string; paid: number; outstanding: number; count: number }> = {};
  for (const inv of invoices) {
    const key = inv.trackingOption ?? 'Unallocated';
    if (!grouped[key]) grouped[key] = { option: key, paid: 0, outstanding: 0, count: 0 };
    grouped[key].count++;
    if (inv.status === 'PAID') grouped[key].paid += inv.total ?? 0;
    if (inv.status === 'AUTHORISED') grouped[key].outstanding += inv.amountDue ?? 0;
  }
  const rows = Object.values(grouped).sort((a, b) => (b.paid + b.outstanding) - (a.paid + a.outstanding));
  const maxTotal = Math.max(...rows.map(r => r.paid + r.outstanding), 1);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Revenue by Project</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pb-4">
        {rows.map(r => {
          const total = r.paid + r.outstanding;
          const paidPct = total > 0 ? (r.paid / total) * 100 : 0;
          const outPct = total > 0 ? (r.outstanding / total) * 100 : 0;
          return (
            <div key={r.option} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium truncate max-w-[60%]">{r.option}</span>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="text-green-600 font-semibold">{new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(r.paid)} paid</span>
                  {r.outstanding > 0 && <span className="text-orange-500 font-semibold">{new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(r.outstanding)} due</span>}
                  <span className="text-muted-foreground">{r.count} inv</span>
                </div>
              </div>
              <div className="flex h-2 rounded-full overflow-hidden bg-muted">
                <div className="bg-green-500 transition-all" style={{ width: `${paidPct}%` }} />
                <div className="bg-orange-400 transition-all" style={{ width: `${outPct}%` }} />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
