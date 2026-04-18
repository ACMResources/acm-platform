import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { insertQuoteSchema, type Quote, type InsertQuote, type QuoteLineItem } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Pencil, Trash2, PlusCircle, MinusCircle, DollarSign, FileText } from 'lucide-react';
import { z } from 'zod';

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  sent: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  accepted: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  declined: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const TRADES = ['Poly Welder','Civil Operator','Plant Operator','Supervisor','Site Superintendent','Project Manager','Rigger','Pipe Fitter','Boilermaker','Labourer'];

function QuoteBuilder({ quote, onClose }: { quote?: Quote; onClose: () => void }) {
  const { toast } = useToast();
  const [lineItems, setLineItems] = useState<QuoteLineItem[]>(() =>
    quote?.lineItems ? JSON.parse(quote.lineItems) : []
  );
  const [margin, setMargin] = useState(quote?.margin ?? 20);

  const form = useForm<InsertQuote>({
    resolver: zodResolver(insertQuoteSchema),
    defaultValues: {
      clientName: quote?.clientName ?? '',
      projectName: quote?.projectName ?? '',
      location: quote?.location ?? '',
      scope: quote?.scope ?? '',
      status: quote?.status ?? 'draft',
      validUntil: quote?.validUntil ?? '',
      notes: quote?.notes ?? '',
      lineItems: '[]',
      subtotal: 0,
      margin: margin,
      total: 0,
    },
  });

  const subtotal = lineItems.reduce((s, i) => s + i.total, 0);
  const total = subtotal * (1 + margin / 100);

  const addLine = () => setLineItems(prev => [...prev, {
    id: Date.now().toString(), description: '', trade: 'Poly Welder', headcount: 1, hours: 120, rate: 65, total: 7800,
  }]);

  const updateLine = (id: string, field: keyof QuoteLineItem, value: any) => {
    setLineItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: field === 'description' || field === 'trade' ? value : Number(value) };
      updated.total = updated.headcount * updated.hours * updated.rate;
      return updated;
    }));
  };

  const removeLine = (id: string) => setLineItems(prev => prev.filter(i => i.id !== id));

  const mutation = useMutation({
    mutationFn: (data: InsertQuote) => {
      const payload: InsertQuote = {
        ...data, lineItems: JSON.stringify(lineItems), subtotal, total, margin,
      };
      return quote ? apiRequest('PATCH', `/api/quotes/${quote.id}`, payload) : apiRequest('POST', '/api/quotes', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/quotes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      toast({ title: quote ? 'Quote updated' : 'Quote created' });
      onClose();
    },
    onError: () => toast({ title: 'Error saving', variant: 'destructive' }),
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(d => mutation.mutate(d))} className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <FormField control={form.control} name="clientName" render={({ field }) => (
            <FormItem><FormLabel>Client Name</FormLabel><FormControl><Input {...field} data-testid="input-quote-client" /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="projectName" render={({ field }) => (
            <FormItem><FormLabel>Project Name</FormLabel><FormControl><Input {...field} data-testid="input-quote-project" /></FormControl><FormMessage /></FormItem>
          )} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField control={form.control} name="location" render={({ field }) => (
            <FormItem><FormLabel>Location</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="status" render={({ field }) => (
            <FormItem><FormLabel>Status</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="declined">Declined</SelectItem>
                </SelectContent>
              </Select><FormMessage />
            </FormItem>
          )} />
        </div>

        {/* Line Items */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold">Labour Line Items</p>
            <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={addLine} data-testid="button-add-line-item">
              <PlusCircle className="w-3 h-3 mr-1" /> Add Line
            </Button>
          </div>
          {lineItems.length === 0 ? (
            <div className="border rounded-lg p-4 text-center text-sm text-muted-foreground">No line items — click Add Line to start</div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <div className="grid grid-cols-[1fr_100px_60px_70px_70px_80px_32px] gap-1 px-3 py-1.5 bg-muted text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <span>Description / Trade</span><span>Trade</span><span className="text-center">Pax</span><span className="text-center">Hrs</span><span className="text-center">Rate $</span><span className="text-right">Total</span><span />
              </div>
              {lineItems.map(item => (
                <div key={item.id} className="grid grid-cols-[1fr_100px_60px_70px_70px_80px_32px] gap-1 px-3 py-1.5 items-center border-t text-xs" data-testid={`row-line-item-${item.id}`}>
                  <Input className="h-7 text-xs" value={item.description} onChange={e => updateLine(item.id, 'description', e.target.value)} placeholder="Description" />
                  <Select value={item.trade} onValueChange={v => updateLine(item.id, 'trade', v)}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TRADES.map(t => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input className="h-7 text-xs text-center" type="number" min="1" value={item.headcount} onChange={e => updateLine(item.id, 'headcount', e.target.value)} />
                  <Input className="h-7 text-xs text-center" type="number" min="0" value={item.hours} onChange={e => updateLine(item.id, 'hours', e.target.value)} />
                  <Input className="h-7 text-xs text-center" type="number" min="0" step="0.5" value={item.rate} onChange={e => updateLine(item.id, 'rate', e.target.value)} />
                  <p className="text-right font-semibold text-xs">${item.total.toLocaleString()}</p>
                  <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeLine(item.id)}>
                    <MinusCircle className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Totals */}
        <div className="border rounded-lg p-4 bg-muted/30 space-y-2">
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span className="font-medium">${subtotal.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</span></div>
          <div className="flex items-center justify-between text-sm gap-4">
            <span className="text-muted-foreground">Margin %</span>
            <Input type="number" min="0" max="100" className="w-24 h-7 text-sm text-right" value={margin} onChange={e => setMargin(Number(e.target.value))} data-testid="input-margin" />
          </div>
          <div className="flex justify-between text-base font-bold border-t pt-2">
            <span>Total</span><span className="text-primary">${total.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        <FormField control={form.control} name="notes" render={({ field }) => (
          <FormItem><FormLabel>Notes / Terms</FormLabel><FormControl><Textarea rows={2} {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
        )} />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={mutation.isPending} data-testid="button-submit-quote">
            {mutation.isPending ? 'Saving…' : quote ? 'Update Quote' : 'Create Quote'}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

export default function QuotesPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Quote | undefined>();
  const { toast } = useToast();

  const { data: quotes, isLoading } = useQuery<Quote[]>({ queryKey: ['/api/quotes'] });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/quotes/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/quotes'] }); toast({ title: 'Quote deleted' }); },
  });

  const totalPipeline = quotes?.filter(q => q.status !== 'declined').reduce((s, q) => s + (q.total ?? 0), 0) ?? 0;

  return (
    <div className="p-6 space-y-5 max-w-7xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold">Quotes & Estimation</h1>
          <p className="text-sm text-muted-foreground">Pipeline value: <span className="font-semibold text-foreground">${totalPipeline.toLocaleString('en-AU', { maximumFractionDigits: 0 })}</span></p>
        </div>
        <Button onClick={() => { setEditing(undefined); setDialogOpen(true); }} data-testid="button-new-quote">
          <Plus className="w-4 h-4 mr-2" /> New Quote
        </Button>
      </div>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <Card key={i}><CardContent className="p-4"><Skeleton className="h-40 w-full" /></CardContent></Card>)}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {(quotes ?? []).map(q => {
            const items: QuoteLineItem[] = q.lineItems ? JSON.parse(q.lineItems) : [];
            return (
              <Card key={q.id} className="hover:shadow-md transition-shadow" data-testid={`card-quote-${q.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{q.projectName}</p>
                      <p className="text-xs text-muted-foreground">{q.clientName}</p>
                    </div>
                    <Badge className={`text-xs capitalize shrink-0 ${statusColors[q.status] ?? ''}`} variant="secondary">{q.status}</Badge>
                  </div>
                  {q.location && <p className="text-xs text-muted-foreground mb-2">{q.location}</p>}
                  <div className="space-y-1 mb-3">
                    {items.slice(0, 2).map(i => (
                      <div key={i.id} className="flex justify-between text-xs text-muted-foreground">
                        <span className="truncate">{i.headcount}× {i.trade}</span>
                        <span>${i.total.toLocaleString()}</span>
                      </div>
                    ))}
                    {items.length > 2 && <p className="text-xs text-muted-foreground">+{items.length - 2} more lines</p>}
                  </div>
                  <div className="border-t pt-2 mb-3">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Margin {q.margin}%</span>
                      <span className="font-bold text-foreground text-sm">${(q.total ?? 0).toLocaleString('en-AU', { maximumFractionDigits: 0 })}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={() => { setEditing(q); setDialogOpen(true); }} data-testid={`button-edit-quote-${q.id}`}>
                      <Pencil className="w-3 h-3 mr-1" /> Edit
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs text-destructive" onClick={() => deleteMutation.mutate(q.id)} data-testid={`button-delete-quote-${q.id}`}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {(quotes?.length ?? 0) === 0 && <p className="text-sm text-muted-foreground col-span-full text-center py-12">No quotes yet — create your first one</p>}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit Quote' : 'New Quote'}</DialogTitle></DialogHeader>
          <QuoteBuilder quote={editing} onClose={() => setDialogOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
