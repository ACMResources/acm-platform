import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { insertProjectSchema, type Project, type Client, type InsertProject } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Search, Pencil, Trash2, MapPin, Users, DollarSign } from 'lucide-react';

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  completed: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

function ProjectForm({ project, clients, onClose }: { project?: Project; clients: Client[]; onClose: () => void }) {
  const { toast } = useToast();
  const form = useForm<InsertProject>({
    resolver: zodResolver(insertProjectSchema),
    defaultValues: {
      clientId: project?.clientId ?? (clients[0]?.id ?? 1),
      name: project?.name ?? '',
      location: project?.location ?? '',
      scope: project?.scope ?? 'Labour Hire',
      status: project?.status ?? 'active',
      startDate: project?.startDate ?? '',
      endDate: project?.endDate ?? '',
      contractValue: project?.contractValue ?? undefined,
      headcount: project?.headcount ?? 0,
      notes: project?.notes ?? '',
    },
  });
  const mutation = useMutation({
    mutationFn: (data: InsertProject) =>
      project ? apiRequest('PATCH', `/api/projects/${project.id}`, data) : apiRequest('POST', '/api/projects', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      toast({ title: project ? 'Project updated' : 'Project added' });
      onClose();
    },
    onError: () => toast({ title: 'Error saving', variant: 'destructive' }),
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(d => mutation.mutate(d))} className="space-y-4">
        <FormField control={form.control} name="clientId" render={({ field }) => (
          <FormItem><FormLabel>Client</FormLabel>
            <Select onValueChange={v => field.onChange(Number(v))} defaultValue={String(field.value)}>
              <FormControl><SelectTrigger data-testid="select-project-client"><SelectValue placeholder="Select client…" /></SelectTrigger></FormControl>
              <SelectContent>
                {clients.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select><FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="name" render={({ field }) => (
          <FormItem><FormLabel>Project Name</FormLabel><FormControl><Input {...field} data-testid="input-project-name" /></FormControl><FormMessage /></FormItem>
        )} />
        <div className="grid grid-cols-2 gap-3">
          <FormField control={form.control} name="location" render={({ field }) => (
            <FormItem><FormLabel>Location</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="scope" render={({ field }) => (
            <FormItem><FormLabel>Scope</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value ?? 'Labour Hire'}>
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                  {['Labour Hire','HDPE Pipeline','Civil','Shutdown','Mixed'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select><FormMessage />
            </FormItem>
          )} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField control={form.control} name="status" render={({ field }) => (
            <FormItem><FormLabel>Status</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select><FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="headcount" render={({ field }) => (
            <FormItem><FormLabel>Headcount</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? 0} onChange={e => field.onChange(Number(e.target.value))} /></FormControl><FormMessage /></FormItem>
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
        <FormField control={form.control} name="contractValue" render={({ field }) => (
          <FormItem><FormLabel>Contract Value ($)</FormLabel><FormControl><Input type="number" placeholder="0" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="notes" render={({ field }) => (
          <FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea rows={2} {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
        )} />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={mutation.isPending} data-testid="button-submit-project">
            {mutation.isPending ? 'Saving…' : project ? 'Update' : 'Add Project'}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

export default function ProjectsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Project | undefined>();
  const { toast } = useToast();

  const { data: projects, isLoading } = useQuery<Project[]>({ queryKey: ['/api/projects'] });
  const { data: clients } = useQuery<Client[]>({ queryKey: ['/api/clients'] });

  const clientMap = Object.fromEntries(clients?.map(c => [c.id, c.name]) ?? []);

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/projects/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/projects'] }); toast({ title: 'Project removed' }); },
  });

  const filtered = projects?.filter(p => {
    const matchSearch = `${p.name} ${p.location ?? ''} ${clientMap[p.clientId] ?? ''}`.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchSearch && matchStatus;
  }) ?? [];

  return (
    <div className="p-6 space-y-5 max-w-7xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold">Projects</h1>
          <p className="text-sm text-muted-foreground">{projects?.length ?? 0} projects</p>
        </div>
        <Button onClick={() => { setEditing(undefined); setDialogOpen(true); }} data-testid="button-add-project">
          <Plus className="w-4 h-4 mr-2" /> Add Project
        </Button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search projects…" value={search} onChange={e => setSearch(e.target.value)} data-testid="input-search-projects" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Card key={i}><CardContent className="p-4"><Skeleton className="h-28 w-full" /></CardContent></Card>)}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(p => (
            <Card key={p.id} className="hover:shadow-md transition-shadow" data-testid={`card-project-${p.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{clientMap[p.clientId] ?? `Client #${p.clientId}`}</p>
                  </div>
                  <Badge className={`text-xs capitalize shrink-0 ${statusColors[p.status] ?? ''}`} variant="secondary">{p.status}</Badge>
                </div>
                <div className="space-y-1 text-xs text-muted-foreground mb-3">
                  {p.location && <div className="flex items-center gap-1.5"><MapPin className="w-3 h-3" />{p.location}</div>}
                  <div className="flex items-center gap-1.5"><Users className="w-3 h-3" />{p.headcount ?? 0} people</div>
                  {p.contractValue && <div className="flex items-center gap-1.5"><DollarSign className="w-3 h-3" />${p.contractValue.toLocaleString()}</div>}
                </div>
                {p.scope && <Badge variant="outline" className="text-[10px] mb-3">{p.scope}</Badge>}
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={() => { setEditing(p); setDialogOpen(true); }} data-testid={`button-edit-project-${p.id}`}>
                    <Pencil className="w-3 h-3 mr-1" /> Edit
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(p.id)} data-testid={`button-delete-project-${p.id}`}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit Project' : 'Add Project'}</DialogTitle></DialogHeader>
          {clients && <ProjectForm project={editing} clients={clients} onClose={() => setDialogOpen(false)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
