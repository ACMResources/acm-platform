import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { insertCandidateSchema, type Candidate, type InsertCandidate } from '@shared/schema';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Search, Pencil, Trash2, Phone, Mail, MapPin } from 'lucide-react';

const statusColors: Record<string, string> = {
  available: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  placed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  unavailable: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  blacklisted: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const formSchema = insertCandidateSchema.extend({
  tickets: z.string().optional(),
});
type FormData = z.infer<typeof formSchema>;

function CandidateForm({ candidate, onClose }: { candidate?: Candidate; onClose: () => void }) {
  const { toast } = useToast();
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: candidate?.firstName ?? '',
      lastName: candidate?.lastName ?? '',
      email: candidate?.email ?? '',
      phone: candidate?.phone ?? '',
      trade: candidate?.trade ?? 'Poly Welder',
      classification: candidate?.classification ?? '',
      status: candidate?.status ?? 'available',
      location: candidate?.location ?? '',
      tickets: candidate?.tickets ? JSON.parse(candidate.tickets).join(', ') : '',
      notes: candidate?.notes ?? '',
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload: InsertCandidate = {
        ...data,
        tickets: data.tickets ? JSON.stringify(data.tickets.split(',').map(t => t.trim()).filter(Boolean)) : '[]',
      };
      if (candidate) {
        return apiRequest('PATCH', `/api/candidates/${candidate.id}`, payload);
      }
      return apiRequest('POST', '/api/candidates', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/candidates'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      toast({ title: candidate ? 'Candidate updated' : 'Candidate added' });
      onClose();
    },
    onError: () => toast({ title: 'Error saving candidate', variant: 'destructive' }),
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(d => mutation.mutate(d))} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <FormField control={form.control} name="firstName" render={({ field }) => (
            <FormItem><FormLabel>First Name</FormLabel><FormControl><Input {...field} data-testid="input-firstname" /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="lastName" render={({ field }) => (
            <FormItem><FormLabel>Last Name</FormLabel><FormControl><Input {...field} data-testid="input-lastname" /></FormControl><FormMessage /></FormItem>
          )} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField control={form.control} name="email" render={({ field }) => (
            <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} value={field.value ?? ''} data-testid="input-email" /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="phone" render={({ field }) => (
            <FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} value={field.value ?? ''} data-testid="input-phone" /></FormControl><FormMessage /></FormItem>
          )} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField control={form.control} name="trade" render={({ field }) => (
            <FormItem><FormLabel>Trade</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl><SelectTrigger data-testid="select-trade"><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                  {['Poly Welder','Civil Operator','Plant Operator','Supervisor','Site Superintendent','Project Manager','General Manager','Rigger','Dogman','Site Admin','Labourer','Pipe Fitter','Boilermaker','Electrician'].map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select><FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="classification" render={({ field }) => (
            <FormItem><FormLabel>Classification</FormLabel><FormControl><Input placeholder="e.g. CW3" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
          )} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField control={form.control} name="status" render={({ field }) => (
            <FormItem><FormLabel>Status</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl><SelectTrigger data-testid="select-status"><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="placed">Placed</SelectItem>
                  <SelectItem value="unavailable">Unavailable</SelectItem>
                  <SelectItem value="blacklisted">Blacklisted</SelectItem>
                </SelectContent>
              </Select><FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="location" render={({ field }) => (
            <FormItem><FormLabel>Location</FormLabel><FormControl><Input placeholder="Perth / FIFO" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
          )} />
        </div>
        <FormField control={form.control} name="tickets" render={({ field }) => (
          <FormItem><FormLabel>Tickets / Licences</FormLabel>
            <FormControl><Input placeholder="White Card, First Aid, EWP (comma separated)" {...field} value={field.value ?? ''} /></FormControl>
          <FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="notes" render={({ field }) => (
          <FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea rows={2} {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
        )} />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={mutation.isPending} data-testid="button-submit-candidate">
            {mutation.isPending ? 'Saving…' : candidate ? 'Update' : 'Add Candidate'}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

export default function CandidatesPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [tradeFilter, setTradeFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Candidate | undefined>();
  const { toast } = useToast();

  const { data: candidates, isLoading } = useQuery<Candidate[]>({ queryKey: ['/api/candidates'] });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/candidates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/candidates'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      toast({ title: 'Candidate removed' });
    },
  });

  const filtered = candidates?.filter(c => {
    const matchSearch = `${c.firstName} ${c.lastName} ${c.trade} ${c.location ?? ''}`
      .toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || c.status === statusFilter;
    const matchTrade = tradeFilter === 'all' || c.trade === tradeFilter;
    return matchSearch && matchStatus && matchTrade;
  }) ?? [];

  const trades = [...new Set(candidates?.map(c => c.trade) ?? [])];

  return (
    <div className="p-6 space-y-5 max-w-7xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold">Candidates</h1>
          <p className="text-sm text-muted-foreground">{candidates?.length ?? 0} in database</p>
        </div>
        <Button onClick={() => { setEditing(undefined); setDialogOpen(true); }} data-testid="button-add-candidate">
          <Plus className="w-4 h-4 mr-2" /> Add Candidate
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search name, trade, location…" value={search} onChange={e => setSearch(e.target.value)} data-testid="input-search-candidates" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36" data-testid="select-status-filter"><SelectValue placeholder="All Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="available">Available</SelectItem>
            <SelectItem value="placed">Placed</SelectItem>
            <SelectItem value="unavailable">Unavailable</SelectItem>
          </SelectContent>
        </Select>
        <Select value={tradeFilter} onValueChange={setTradeFilter}>
          <SelectTrigger className="w-40" data-testid="select-trade-filter"><SelectValue placeholder="All Trades" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Trades</SelectItem>
            {trades.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Cards */}
      {isLoading ? (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Card key={i}><CardContent className="p-4"><Skeleton className="h-28 w-full" /></CardContent></Card>)}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(c => {
            const ticketList: string[] = c.tickets ? JSON.parse(c.tickets) : [];
            return (
              <Card key={c.id} className="hover:shadow-md transition-shadow" data-testid={`card-candidate-${c.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{c.firstName} {c.lastName}</p>
                      <p className="text-xs text-muted-foreground">{c.trade}{c.classification ? ` — ${c.classification}` : ''}</p>
                    </div>
                    <Badge className={`text-xs capitalize shrink-0 ${statusColors[c.status] ?? ''}`} variant="secondary">
                      {c.status}
                    </Badge>
                  </div>
                  <div className="space-y-1 text-xs text-muted-foreground mb-3">
                    {c.location && <div className="flex items-center gap-1.5"><MapPin className="w-3 h-3 shrink-0" /><span className="truncate">{c.location}</span></div>}
                    {c.phone && <div className="flex items-center gap-1.5"><Phone className="w-3 h-3 shrink-0" /><span>{c.phone}</span></div>}
                    {c.email && <div className="flex items-center gap-1.5"><Mail className="w-3 h-3 shrink-0" /><span className="truncate">{c.email}</span></div>}
                  </div>
                  {ticketList.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {ticketList.slice(0, 3).map(t => <Badge key={t} variant="outline" className="text-[10px] px-1.5 py-0">{t}</Badge>)}
                      {ticketList.length > 3 && <Badge variant="outline" className="text-[10px] px-1.5 py-0">+{ticketList.length - 3}</Badge>}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={() => { setEditing(c); setDialogOpen(true); }} data-testid={`button-edit-candidate-${c.id}`}>
                      <Pencil className="w-3 h-3 mr-1" /> Edit
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(c.id)} data-testid={`button-delete-candidate-${c.id}`}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-12 text-muted-foreground text-sm">No candidates match your filters</div>
          )}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Candidate' : 'Add Candidate'}</DialogTitle>
          </DialogHeader>
          <CandidateForm candidate={editing} onClose={() => setDialogOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
