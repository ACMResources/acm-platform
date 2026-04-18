import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { insertPlacementSchema, type Placement, type Candidate, type Client, type Project, type InsertPlacement } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Pencil, Trash2, DollarSign, Calendar } from 'lucide-react';

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  completed: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

function PlacementForm({ placement, candidates, clients, projects, onClose }: {
  placement?: Placement; candidates: Candidate[]; clients: Client[]; projects: Project[]; onClose: () => void;
}) {
  const { toast } = useToast();
  const form = useForm<InsertPlacement>({
    resolver: zodResolver(insertPlacementSchema),
    defaultValues: {
      candidateId: placement?.candidateId ?? (candidates[0]?.id ?? 1),
      clientId: placement?.clientId ?? (clients[0]?.id ?? 1),
      projectId: placement?.projectId ?? undefined,
      type: placement?.type ?? 'casual',
      role: placement?.role ?? '',
      startDate: placement?.startDate ?? '',
      endDate: placement?.endDate ?? '',
      rate: placement?.rate ?? undefined,
      rateType: placement?.rateType ?? 'hourly',
      status: placement?.status ?? 'active',
      notes: placement?.notes ?? '',
    },
  });

  const mutation = useMutation({
    mutationFn: (data: InsertPlacement) =>
      placement ? apiRequest('PATCH', `/api/placements/${placement.id}`, data) : apiRequest('POST', '/api/placements', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/placements'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      toast({ title: placement ? 'Placement updated' : 'Placement created' });
      onClose();
    },
    onError: () => toast({ title: 'Error saving', variant: 'destructive' }),
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(d => mutation.mutate(d))} className="space-y-4">
        <FormField control={form.control} name="candidateId" render={({ field }) => (
          <FormItem><FormLabel>Candidate</FormLabel>
            <Select onValueChange={v => field.onChange(Number(v))} defaultValue={String(field.value)}>
              <FormControl><SelectTrigger><SelectValue placeholder="Select candidate…" /></SelectTrigger></FormControl>
              <SelectContent>
                {candidates.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.firstName} {c.lastName} — {c.trade}</SelectItem>)}
              </SelectContent>
            </Select><FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="clientId" render={({ field }) => (
          <FormItem><FormLabel>Client</FormLabel>
            <Select onValueChange={v => field.onChange(Number(v))} defaultValue={String(field.value)}>
              <FormControl><SelectTrigger><SelectValue placeholder="Select client…" /></SelectTrigger></FormControl>
              <SelectContent>
                {clients.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select><FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="projectId" render={({ field }) => (
          <FormItem><FormLabel>Project (optional)</FormLabel>
            <Select onValueChange={v => field.onChange(v ? Number(v) : undefined)} defaultValue={field.value ? String(field.value) : ''}>
              <FormControl><SelectTrigger><SelectValue placeholder="No project linked" /></SelectTrigger></FormControl>
              <SelectContent>
                {projects.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select><FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="role" render={({ field }) => (
          <FormItem><FormLabel>Role on Site</FormLabel><FormControl><Input {...field} placeholder="e.g. Poly Welder" /></FormControl><FormMessage /></FormItem>
        )} />
        <div className="grid grid-cols-2 gap-3">
          <FormField control={form.control} name="type" render={({ field }) => (
            <FormItem><FormLabel>Type</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="casual">Casual</SelectItem>
                  <SelectItem value="permanent">Permanent</SelectItem>
                </SelectContent>
              </Select><FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="status" render={({ field }) => (
            <FormItem><FormLabel>Status</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select><FormMessage />
            </FormItem>
          )} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField control={form.control} name="rate" render={({ field }) => (
            <FormItem><FormLabel>Rate ($)</FormLabel><FormControl><Input type="number" placeholder="0.00" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="rateType" render={({ field }) => (
            <FormItem><FormLabel>Rate Type</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value ?? 'hourly'}>
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="hourly">Hourly</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select><FormMessage />
            </FormItem>
          )} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField control={form.control} name="startDate" render={({ field }) => (
            <FormItem><FormLabel>Start Date</FormLabel><FormControl><Input type="date" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="endDate" render={({ field }) => (
            <FormItem><FormLabel>End Date</FormLabel><FormControl><Input type="date" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
          )} />
        </div>
        <FormField control={form.control} name="notes" render={({ field }) => (
          <FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea rows={2} {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
        )} />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={mutation.isPending} data-testid="button-submit-placement">
            {mutation.isPending ? 'Saving…' : placement ? 'Update' : 'Create Placement'}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

export default function PlacementsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Placement | undefined>();
  const { toast } = useToast();

  const { data: placements, isLoading } = useQuery<Placement[]>({ queryKey: ['/api/placements'] });
  const { data: candidates } = useQuery<Candidate[]>({ queryKey: ['/api/candidates'] });
  const { data: clients } = useQuery<Client[]>({ queryKey: ['/api/clients'] });
  const { data: projects } = useQuery<Project[]>({ queryKey: ['/api/projects'] });

  const candidateMap = Object.fromEntries(candidates?.map(c => [c.id, `${c.firstName} ${c.lastName}`]) ?? []);
  const clientMap = Object.fromEntries(clients?.map(c => [c.id, c.name]) ?? []);
  const projectMap = Object.fromEntries(projects?.map(p => [p.id, p.name]) ?? []);

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/placements/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/placements'] }); toast({ title: 'Placement removed' }); },
  });

  const active = placements?.filter(p => p.status === 'active') ?? [];
  const completed = placements?.filter(p => p.status !== 'active') ?? [];

  const PlacementCard = ({ p }: { p: Placement }) => (
    <Card className="hover:shadow-md transition-shadow" data-testid={`card-placement-${p.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{candidateMap[p.candidateId] ?? `#${p.candidateId}`}</p>
            <p className="text-xs text-muted-foreground truncate">{p.role} @ {clientMap[p.clientId] ?? `Client #${p.clientId}`}</p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <Badge className={`text-xs capitalize ${statusColors[p.status] ?? ''}`} variant="secondary">{p.status}</Badge>
            <Badge variant="outline" className="text-[10px]">{p.type}</Badge>
          </div>
        </div>
        {p.projectId && <p className="text-xs text-muted-foreground mb-2 truncate">Project: {projectMap[p.projectId]}</p>}
        <div className="flex gap-3 text-xs text-muted-foreground mb-3">
          {p.rate && <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />${p.rate}/{p.rateType}</span>}
          {p.startDate && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{p.startDate}</span>}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={() => { setEditing(p); setDialogOpen(true); }} data-testid={`button-edit-placement-${p.id}`}>
            <Pencil className="w-3 h-3 mr-1" /> Edit
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs text-destructive" onClick={() => deleteMutation.mutate(p.id)} data-testid={`button-delete-placement-${p.id}`}>
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold">Placements</h1>
          <p className="text-sm text-muted-foreground">{active.length} active · {completed.length} completed</p>
        </div>
        <Button onClick={() => { setEditing(undefined); setDialogOpen(true); }} data-testid="button-add-placement">
          <Plus className="w-4 h-4 mr-2" /> New Placement
        </Button>
      </div>

      {isLoading ? <Skeleton className="h-48 w-full" /> : (
        <>
          {active.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Active ({active.length})</h2>
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {active.map(p => <PlacementCard key={p.id} p={p} />)}
              </div>
            </div>
          )}
          {completed.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Completed / Cancelled</h2>
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {completed.map(p => <PlacementCard key={p.id} p={p} />)}
              </div>
            </div>
          )}
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit Placement' : 'New Placement'}</DialogTitle></DialogHeader>
          {candidates && clients && projects && (
            <PlacementForm placement={editing} candidates={candidates} clients={clients} projects={projects} onClose={() => setDialogOpen(false)} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
