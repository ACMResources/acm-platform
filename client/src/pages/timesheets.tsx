import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { insertTimesheetSchema, type Timesheet, type Candidate, type Project, type InsertTimesheet } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Pencil, Trash2, CheckCircle, Clock, AlertCircle } from 'lucide-react';

const statusConfig: Record<string, { color: string; icon: any }> = {
  pending: { color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: AlertCircle },
  approved: { color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle },
  invoiced: { color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: Clock },
};

const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

function TimesheetForm({ timesheet, candidates, projects, onClose }: {
  timesheet?: Timesheet; candidates: Candidate[]; projects: Project[]; onClose: () => void;
}) {
  const { toast } = useToast();
  const form = useForm<InsertTimesheet>({
    resolver: zodResolver(insertTimesheetSchema),
    defaultValues: {
      candidateId: timesheet?.candidateId ?? (candidates[0]?.id ?? 1),
      projectId: timesheet?.projectId ?? undefined,
      weekEnding: timesheet?.weekEnding ?? '',
      hoursMonday: timesheet?.hoursMonday ?? 0,
      hoursTuesday: timesheet?.hoursTuesday ?? 0,
      hoursWednesday: timesheet?.hoursWednesday ?? 0,
      hoursThursday: timesheet?.hoursThursday ?? 0,
      hoursFriday: timesheet?.hoursFriday ?? 0,
      hoursSaturday: timesheet?.hoursSaturday ?? 0,
      hoursSunday: timesheet?.hoursSunday ?? 0,
      totalHours: timesheet?.totalHours ?? 0,
      status: timesheet?.status ?? 'pending',
      notes: timesheet?.notes ?? '',
    },
  });

  const watchedDays = form.watch(['hoursMonday','hoursTuesday','hoursWednesday','hoursThursday','hoursFriday','hoursSaturday','hoursSunday']);
  const total = watchedDays.reduce((s, h) => s + (Number(h) || 0), 0);

  const mutation = useMutation({
    mutationFn: (data: InsertTimesheet) => {
      const payload = { ...data, totalHours: total };
      return timesheet ? apiRequest('PATCH', `/api/timesheets/${timesheet.id}`, payload) : apiRequest('POST', '/api/timesheets', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/timesheets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      toast({ title: timesheet ? 'Timesheet updated' : 'Timesheet submitted' });
      onClose();
    },
    onError: () => toast({ title: 'Error saving', variant: 'destructive' }),
  });

  const dayLabels = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const dayFields: (keyof InsertTimesheet)[] = ['hoursMonday','hoursTuesday','hoursWednesday','hoursThursday','hoursFriday','hoursSaturday','hoursSunday'];

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(d => mutation.mutate(d))} className="space-y-4">
        <FormField control={form.control} name="candidateId" render={({ field }) => (
          <FormItem><FormLabel>Candidate</FormLabel>
            <Select onValueChange={v => field.onChange(Number(v))} defaultValue={String(field.value)}>
              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
              <SelectContent>
                {candidates.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.firstName} {c.lastName}</SelectItem>)}
              </SelectContent>
            </Select><FormMessage />
          </FormItem>
        )} />
        <div className="grid grid-cols-2 gap-3">
          <FormField control={form.control} name="projectId" render={({ field }) => (
            <FormItem><FormLabel>Project</FormLabel>
              <Select onValueChange={v => field.onChange(v ? Number(v) : undefined)} defaultValue={field.value ? String(field.value) : ''}>
                <FormControl><SelectTrigger><SelectValue placeholder="No project" /></SelectTrigger></FormControl>
                <SelectContent>
                  {projects.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select><FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="weekEnding" render={({ field }) => (
            <FormItem><FormLabel>Week Ending</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
        </div>
        {/* Daily hours grid */}
        <div>
          <p className="text-sm font-medium mb-2">Daily Hours</p>
          <div className="grid grid-cols-7 gap-1">
            {dayLabels.map((label, i) => (
              <div key={label} className="text-center">
                <p className="text-[10px] text-muted-foreground font-semibold mb-1">{label}</p>
                <FormField control={form.control} name={dayFields[i] as any} render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        type="number" step="0.5" min="0" max="24"
                        className="text-center px-1 text-sm"
                        {...field}
                        value={field.value ?? 0}
                        onChange={e => field.onChange(Number(e.target.value))}
                        data-testid={`input-hours-${label.toLowerCase()}`}
                      />
                    </FormControl>
                  </FormItem>
                )} />
              </div>
            ))}
          </div>
          <div className="mt-2 text-right text-sm font-bold">Total: <span className="text-primary">{total}h</span></div>
        </div>
        <FormField control={form.control} name="status" render={({ field }) => (
          <FormItem><FormLabel>Status</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="invoiced">Invoiced</SelectItem>
              </SelectContent>
            </Select><FormMessage />
          </FormItem>
        )} />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={mutation.isPending} data-testid="button-submit-timesheet">
            {mutation.isPending ? 'Saving…' : timesheet ? 'Update' : 'Submit Timesheet'}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

export default function TimesheetsPage() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Timesheet | undefined>();
  const { toast } = useToast();

  const { data: timesheets, isLoading } = useQuery<Timesheet[]>({ queryKey: ['/api/timesheets'] });
  const { data: candidates } = useQuery<Candidate[]>({ queryKey: ['/api/candidates'] });
  const { data: projects } = useQuery<Project[]>({ queryKey: ['/api/projects'] });

  const candidateMap = Object.fromEntries(candidates?.map(c => [c.id, `${c.firstName} ${c.lastName}`]) ?? []);
  const projectMap = Object.fromEntries(projects?.map(p => [p.id, p.name]) ?? []);

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/timesheets/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/timesheets'] }); toast({ title: 'Timesheet deleted' }); },
  });

  const approveMutation = useMutation({
    mutationFn: (id: number) => apiRequest('PATCH', `/api/timesheets/${id}`, { status: 'approved' }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/timesheets'] }); queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] }); toast({ title: 'Timesheet approved' }); },
  });

  const filtered = timesheets?.filter(t => statusFilter === 'all' || t.status === statusFilter) ?? [];
  const totalHours = filtered.reduce((s, t) => s + (t.totalHours ?? 0), 0);

  return (
    <div className="p-6 space-y-5 max-w-7xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold">Timesheets</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} entries · {totalHours}h total</p>
        </div>
        <Button onClick={() => { setEditing(undefined); setDialogOpen(true); }} data-testid="button-add-timesheet">
          <Plus className="w-4 h-4 mr-2" /> Add Timesheet
        </Button>
      </div>

      <div className="flex gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="invoiced">Invoiced</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? <Skeleton className="h-48" /> : (
        <div className="space-y-2">
          {filtered.map(t => {
            const cfg = statusConfig[t.status] ?? statusConfig.pending;
            const StatusIcon = cfg.icon;
            return (
              <Card key={t.id} className="hover:shadow-sm transition-shadow" data-testid={`row-timesheet-${t.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex-1 min-w-[180px]">
                      <p className="font-semibold text-sm">{candidateMap[t.candidateId] ?? `Candidate #${t.candidateId}`}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.projectId ? projectMap[t.projectId] : 'No project'} · Week ending {t.weekEnding}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      {[t.hoursMonday,t.hoursTuesday,t.hoursWednesday,t.hoursThursday,t.hoursFriday,t.hoursSaturday,t.hoursSunday].map((h, i) => (
                        <span key={i} className={`w-7 text-center py-0.5 rounded text-[10px] font-mono ${(h ?? 0) > 0 ? 'bg-primary/10 text-primary font-bold' : 'bg-muted text-muted-foreground'}`}>
                          {h ?? 0}
                        </span>
                      ))}
                      <span className="ml-2 font-bold text-foreground text-sm">{t.totalHours}h</span>
                    </div>
                    <Badge className={`text-xs ${cfg.color} flex items-center gap-1`} variant="secondary">
                      <StatusIcon className="w-3 h-3" />{t.status}
                    </Badge>
                    <div className="flex gap-2">
                      {t.status === 'pending' && (
                        <Button size="sm" variant="outline" className="h-7 text-xs text-green-600 border-green-300" onClick={() => approveMutation.mutate(t.id)} data-testid={`button-approve-timesheet-${t.id}`}>
                          <CheckCircle className="w-3 h-3 mr-1" /> Approve
                        </Button>
                      )}
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setEditing(t); setDialogOpen(true); }} data-testid={`button-edit-timesheet-${t.id}`}>
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs text-destructive" onClick={() => deleteMutation.mutate(t.id)} data-testid={`button-delete-timesheet-${t.id}`}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit Timesheet' : 'Add Timesheet'}</DialogTitle></DialogHeader>
          {candidates && projects && (
            <TimesheetForm timesheet={editing} candidates={candidates} projects={projects} onClose={() => setDialogOpen(false)} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
