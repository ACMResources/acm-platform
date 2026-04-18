import { useState } from 'react';
import { useRoute, useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  insertProjectTaskSchema, insertProjectRfiSchema, insertProjectNoteSchema, insertProjectMilestoneSchema,
  type Project, type Client, type Placement, type Candidate,
  type ProjectTask, type InsertProjectTask,
  type ProjectRfi, type InsertProjectRfi,
  type ProjectNote, type InsertProjectNote,
  type ProjectMilestone, type InsertProjectMilestone,
} from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft, MapPin, Users, DollarSign, Calendar, Plus, Trash2,
  CheckCircle2, Circle, Clock, AlertTriangle, MessageSquare,
  ClipboardList, FileQuestion, Flag, Pencil,
} from 'lucide-react';

// ── Colour helpers ────────────────────────────────────────────────
const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  completed: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const taskStatusIcon = (s: string) => {
  if (s === 'done') return <CheckCircle2 className="w-4 h-4 text-green-500" />;
  if (s === 'in_progress') return <Clock className="w-4 h-4 text-amber-500" />;
  if (s === 'cancelled') return <Circle className="w-4 h-4 text-gray-400" />;
  return <Circle className="w-4 h-4 text-muted-foreground" />;
};

const priorityBadge: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-amber-100 text-amber-700',
  critical: 'bg-red-100 text-red-700',
};

const rfiStatusBadge: Record<string, string> = {
  open: 'bg-amber-100 text-amber-700',
  under_review: 'bg-blue-100 text-blue-700',
  answered: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-600',
};

// ── Task Form ─────────────────────────────────────────────────────
function TaskForm({ projectId, task, onClose }: { projectId: number; task?: ProjectTask; onClose: () => void }) {
  const { toast } = useToast();
  const form = useForm<InsertProjectTask>({
    resolver: zodResolver(insertProjectTaskSchema),
    defaultValues: {
      projectId,
      title: task?.title ?? '',
      description: task?.description ?? '',
      assignedTo: task?.assignedTo ?? '',
      priority: task?.priority ?? 'medium',
      status: task?.status ?? 'open',
      dueDate: task?.dueDate ?? '',
    },
  });
  const mutation = useMutation({
    mutationFn: (data: InsertProjectTask) =>
      task ? apiRequest('PATCH', `/api/tasks/${task.id}`, data) : apiRequest('POST', `/api/projects/${projectId}/tasks`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/tasks`] });
      toast({ title: task ? 'Task updated' : 'Task added' });
      onClose();
    },
  });
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(d => mutation.mutate(d))} className="space-y-3">
        <FormField control={form.control} name="title" render={({ field }) => (
          <FormItem><FormLabel>Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="description" render={({ field }) => (
          <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea rows={2} {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
        )} />
        <div className="grid grid-cols-2 gap-3">
          <FormField control={form.control} name="assignedTo" render={({ field }) => (
            <FormItem><FormLabel>Assigned To</FormLabel><FormControl><Input {...field} value={field.value ?? ''} placeholder="Name…" /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="dueDate" render={({ field }) => (
            <FormItem><FormLabel>Due Date</FormLabel><FormControl><Input type="date" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
          )} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField control={form.control} name="priority" render={({ field }) => (
            <FormItem><FormLabel>Priority</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                  {['low','medium','high','critical'].map(p => <SelectItem key={p} value={p}>{p.charAt(0).toUpperCase()+p.slice(1)}</SelectItem>)}
                </SelectContent>
              </Select><FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="status" render={({ field }) => (
            <FormItem><FormLabel>Status</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select><FormMessage />
            </FormItem>
          )} />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Saving…' : task ? 'Update' : 'Add Task'}</Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

// ── RFI Form ──────────────────────────────────────────────────────
function RfiForm({ projectId, rfi, onClose }: { projectId: number; rfi?: ProjectRfi; onClose: () => void }) {
  const { toast } = useToast();
  const form = useForm<InsertProjectRfi>({
    resolver: zodResolver(insertProjectRfiSchema),
    defaultValues: {
      projectId,
      rfiNumber: rfi?.rfiNumber ?? '',
      subject: rfi?.subject ?? '',
      question: rfi?.question ?? '',
      raisedBy: rfi?.raisedBy ?? 'ACM Resources',
      assignedTo: rfi?.assignedTo ?? '',
      dueDate: rfi?.dueDate ?? '',
      response: rfi?.response ?? '',
      status: rfi?.status ?? 'open',
    },
  });
  const mutation = useMutation({
    mutationFn: (data: InsertProjectRfi) =>
      rfi ? apiRequest('PATCH', `/api/rfis/${rfi.id}`, data) : apiRequest('POST', `/api/projects/${projectId}/rfis`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/rfis`] });
      toast({ title: rfi ? 'RFI updated' : 'RFI raised' });
      onClose();
    },
  });
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(d => mutation.mutate(d))} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <FormField control={form.control} name="rfiNumber" render={({ field }) => (
            <FormItem><FormLabel>RFI Number</FormLabel><FormControl><Input {...field} value={field.value ?? ''} placeholder="RFI-001" /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="status" render={({ field }) => (
            <FormItem><FormLabel>Status</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="under_review">Under Review</SelectItem>
                  <SelectItem value="answered">Answered</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select><FormMessage />
            </FormItem>
          )} />
        </div>
        <FormField control={form.control} name="subject" render={({ field }) => (
          <FormItem><FormLabel>Subject</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="question" render={({ field }) => (
          <FormItem><FormLabel>Question / Issue</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <div className="grid grid-cols-2 gap-3">
          <FormField control={form.control} name="raisedBy" render={({ field }) => (
            <FormItem><FormLabel>Raised By</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="assignedTo" render={({ field }) => (
            <FormItem><FormLabel>Assigned To</FormLabel><FormControl><Input {...field} value={field.value ?? ''} placeholder="Client / engineer…" /></FormControl><FormMessage /></FormItem>
          )} />
        </div>
        <FormField control={form.control} name="dueDate" render={({ field }) => (
          <FormItem><FormLabel>Due Date</FormLabel><FormControl><Input type="date" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="response" render={({ field }) => (
          <FormItem><FormLabel>Response (if answered)</FormLabel><FormControl><Textarea rows={2} {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
        )} />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Saving…' : rfi ? 'Update RFI' : 'Raise RFI'}</Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

// ── Milestone Form ────────────────────────────────────────────────
function MilestoneForm({ projectId, milestone, onClose }: { projectId: number; milestone?: ProjectMilestone; onClose: () => void }) {
  const { toast } = useToast();
  const form = useForm<InsertProjectMilestone>({
    resolver: zodResolver(insertProjectMilestoneSchema),
    defaultValues: {
      projectId,
      title: milestone?.title ?? '',
      targetDate: milestone?.targetDate ?? '',
      completedDate: milestone?.completedDate ?? '',
      status: milestone?.status ?? 'pending',
    },
  });
  const mutation = useMutation({
    mutationFn: (data: InsertProjectMilestone) =>
      milestone ? apiRequest('PATCH', `/api/milestones/${milestone.id}`, data) : apiRequest('POST', `/api/projects/${projectId}/milestones`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/milestones`] });
      toast({ title: milestone ? 'Milestone updated' : 'Milestone added' });
      onClose();
    },
  });
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(d => mutation.mutate(d))} className="space-y-3">
        <FormField control={form.control} name="title" render={({ field }) => (
          <FormItem><FormLabel>Milestone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <div className="grid grid-cols-2 gap-3">
          <FormField control={form.control} name="targetDate" render={({ field }) => (
            <FormItem><FormLabel>Target Date</FormLabel><FormControl><Input type="date" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="status" render={({ field }) => (
            <FormItem><FormLabel>Status</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="achieved">Achieved</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select><FormMessage />
            </FormItem>
          )} />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Saving…' : milestone ? 'Update' : 'Add Milestone'}</Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

// ── Main Page ─────────────────────────────────────────────────────
export default function ProjectDetailPage() {
  const [, params] = useRoute('/projects/:id');
  const [, navigate] = useLocation();
  const projectId = Number(params?.id);
  const { toast } = useToast();

  const [taskDialog, setTaskDialog] = useState(false);
  const [rfiDialog, setRfiDialog] = useState(false);
  const [msDialog, setMsDialog] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [editingTask, setEditingTask] = useState<ProjectTask | undefined>();
  const [editingRfi, setEditingRfi] = useState<ProjectRfi | undefined>();
  const [editingMs, setEditingMs] = useState<ProjectMilestone | undefined>();

  const { data: project, isLoading: loadingProject } = useQuery<Project>({ queryKey: [`/api/projects/${projectId}`] });
  const { data: clients } = useQuery<Client[]>({ queryKey: ['/api/clients'] });
  const { data: placements } = useQuery<Placement[]>({ queryKey: ['/api/placements'] });
  const { data: candidates } = useQuery<Candidate[]>({ queryKey: ['/api/candidates'] });
  const { data: tasks } = useQuery<ProjectTask[]>({ queryKey: [`/api/projects/${projectId}/tasks`] });
  const { data: rfis } = useQuery<ProjectRfi[]>({ queryKey: [`/api/projects/${projectId}/rfis`] });
  const { data: notes } = useQuery<ProjectNote[]>({ queryKey: [`/api/projects/${projectId}/notes`] });
  const { data: milestones } = useQuery<ProjectMilestone[]>({ queryKey: [`/api/projects/${projectId}/milestones`] });

  const clientName = clients?.find(c => c.id === project?.clientId)?.name ?? '—';
  const projectPlacements = placements?.filter(p => p.projectId === projectId) ?? [];
  const candidateMap = Object.fromEntries(candidates?.map(c => [c.id, `${c.firstName} ${c.lastName}`]) ?? []);

  const deleteTask = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/tasks/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/tasks`] }),
  });
  const deleteRfi = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/rfis/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/rfis`] }),
  });
  const deleteNote = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/notes/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/notes`] }),
  });
  const deleteMilestone = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/milestones/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/milestones`] }),
  });
  const addNote = useMutation({
    mutationFn: (body: string) => apiRequest('POST', `/api/projects/${projectId}/notes`, { body, author: 'Lydon Hollitt', projectId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/notes`] });
      setNoteText('');
      toast({ title: 'Note saved' });
    },
  });

  if (loadingProject) return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-48" />
      <div className="grid grid-cols-4 gap-4 mt-4">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
      </div>
    </div>
  );

  if (!project) return <div className="p-6 text-muted-foreground">Project not found.</div>;

  // Progress bar: milestones achieved / total
  const totalMs = milestones?.length ?? 0;
  const achievedMs = milestones?.filter(m => m.status === 'achieved').length ?? 0;
  const msPercent = totalMs > 0 ? Math.round((achievedMs / totalMs) * 100) : 0;

  const openTasks = tasks?.filter(t => t.status === 'open' || t.status === 'in_progress').length ?? 0;
  const openRfis = rfis?.filter(r => r.status === 'open' || r.status === 'under_review').length ?? 0;

  return (
    <div className="p-6 space-y-5 max-w-7xl">
      {/* Header */}
      <div className="flex items-start gap-3 flex-wrap">
        <Button variant="ghost" size="icon" onClick={() => navigate('/projects')} className="shrink-0 mt-0.5">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold truncate">{project.name}</h1>
            <Badge className={`capitalize ${statusColors[project.status] ?? ''}`} variant="secondary">{project.status}</Badge>
            {project.scope && <Badge variant="outline" className="text-xs">{project.scope}</Badge>}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">{clientName}</p>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <DollarSign className="w-5 h-5 text-[hsl(38,91%,54%)] shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Contract Value</p>
              <p className="font-bold text-sm">{project.contractValue ? `$${project.contractValue.toLocaleString()}` : '—'}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="w-5 h-5 text-[hsl(38,91%,54%)] shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Headcount</p>
              <p className="font-bold text-sm">{project.headcount ?? 0} people</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <MapPin className="w-5 h-5 text-[hsl(38,91%,54%)] shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Location</p>
              <p className="font-bold text-sm truncate">{project.location ?? '—'}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Calendar className="w-5 h-5 text-[hsl(38,91%,54%)] shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Start Date</p>
              <p className="font-bold text-sm">{project.startDate ?? '—'}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Milestone progress bar */}
      {totalMs > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-medium">Milestone Progress</span>
            <span>{achievedMs} / {totalMs} achieved ({msPercent}%)</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-[hsl(38,91%,54%)] transition-all"
              style={{ width: `${msPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="mb-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tasks">
            Tasks {openTasks > 0 && <span className="ml-1.5 bg-amber-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{openTasks}</span>}
          </TabsTrigger>
          <TabsTrigger value="rfis">
            RFIs {openRfis > 0 && <span className="ml-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{openRfis}</span>}
          </TabsTrigger>
          <TabsTrigger value="milestones">Milestones</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        {/* ── OVERVIEW ─────────────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Project Details</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
              {[
                ['Client', clientName],
                ['Scope', project.scope ?? '—'],
                ['Status', project.status],
                ['Location', project.location ?? '—'],
                ['Start Date', project.startDate ?? '—'],
                ['End Date', project.endDate ?? '—'],
                ['Contract Value', project.contractValue ? `$${project.contractValue.toLocaleString()}` : '—'],
                ['Headcount', String(project.headcount ?? 0)],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
                  <p className="font-medium capitalize">{value}</p>
                </div>
              ))}
              {project.notes && (
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground mb-0.5">Notes</p>
                  <p className="font-medium">{project.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardContent className="p-4 text-center">
                <ClipboardList className="w-5 h-5 mx-auto mb-1 text-amber-500" />
                <p className="text-xl font-bold">{openTasks}</p>
                <p className="text-xs text-muted-foreground">Open Tasks</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <FileQuestion className="w-5 h-5 mx-auto mb-1 text-red-500" />
                <p className="text-xl font-bold">{openRfis}</p>
                <p className="text-xs text-muted-foreground">Open RFIs</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Flag className="w-5 h-5 mx-auto mb-1 text-[hsl(38,91%,54%)]" />
                <p className="text-xl font-bold">{msPercent}%</p>
                <p className="text-xs text-muted-foreground">Milestones</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── TASKS ────────────────────────────────────────────── */}
        <TabsContent value="tasks" className="space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">{tasks?.length ?? 0} tasks</p>
            <Button size="sm" onClick={() => { setEditingTask(undefined); setTaskDialog(true); }}>
              <Plus className="w-3 h-3 mr-1" /> Add Task
            </Button>
          </div>
          {tasks?.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">No tasks yet.</p>}
          <div className="space-y-2">
            {tasks?.map(task => (
              <Card key={task.id} className={task.status === 'done' ? 'opacity-60' : ''}>
                <CardContent className="p-3 flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">{taskStatusIcon(task.status)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`text-sm font-medium ${task.status === 'done' ? 'line-through' : ''}`}>{task.title}</p>
                      <Badge className={`text-[10px] ${priorityBadge[task.priority] ?? ''}`} variant="secondary">{task.priority}</Badge>
                      <Badge variant="outline" className="text-[10px] capitalize">{task.status.replace('_', ' ')}</Badge>
                    </div>
                    {task.description && <p className="text-xs text-muted-foreground mt-0.5">{task.description}</p>}
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      {task.assignedTo && <span>→ {task.assignedTo}</span>}
                      {task.dueDate && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{task.dueDate}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingTask(task); setTaskDialog(true); }}>
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteTask.mutate(task.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ── RFIs ─────────────────────────────────────────────── */}
        <TabsContent value="rfis" className="space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">{rfis?.length ?? 0} RFIs</p>
            <Button size="sm" onClick={() => { setEditingRfi(undefined); setRfiDialog(true); }}>
              <Plus className="w-3 h-3 mr-1" /> Raise RFI
            </Button>
          </div>
          {rfis?.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">No RFIs raised.</p>}
          <div className="space-y-3">
            {rfis?.map(rfi => (
              <Card key={rfi.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        {rfi.rfiNumber && <span className="text-xs font-mono font-bold text-[hsl(38,91%,54%)]">{rfi.rfiNumber}</span>}
                        <p className="text-sm font-semibold">{rfi.subject}</p>
                        <Badge className={`text-[10px] ${rfiStatusBadge[rfi.status] ?? ''}`} variant="secondary">{rfi.status.replace('_', ' ')}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">{rfi.question}</p>
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        {rfi.raisedBy && <span>Raised by: {rfi.raisedBy}</span>}
                        {rfi.assignedTo && <span>To: {rfi.assignedTo}</span>}
                        {rfi.dueDate && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{rfi.dueDate}</span>}
                      </div>
                      {rfi.response && (
                        <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 rounded text-xs border-l-2 border-green-500">
                          <span className="font-semibold text-green-700 dark:text-green-400">Response: </span>{rfi.response}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingRfi(rfi); setRfiDialog(true); }}>
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteRfi.mutate(rfi.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ── MILESTONES ───────────────────────────────────────── */}
        <TabsContent value="milestones" className="space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">{milestones?.length ?? 0} milestones</p>
            <Button size="sm" onClick={() => { setEditingMs(undefined); setMsDialog(true); }}>
              <Plus className="w-3 h-3 mr-1" /> Add Milestone
            </Button>
          </div>
          {milestones?.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">No milestones set.</p>}
          <div className="space-y-2">
            {milestones?.map(ms => (
              <Card key={ms.id}>
                <CardContent className="p-3 flex items-center gap-3">
                  {ms.status === 'achieved'
                    ? <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                    : ms.status === 'overdue'
                    ? <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                    : <Circle className="w-5 h-5 text-muted-foreground shrink-0" />
                  }
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${ms.status === 'achieved' ? 'line-through text-muted-foreground' : ''}`}>{ms.title}</p>
                    {ms.targetDate && <p className="text-xs text-muted-foreground">Target: {ms.targetDate}</p>}
                  </div>
                  <Badge variant="outline" className="text-[10px] capitalize shrink-0">{ms.status}</Badge>
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingMs(ms); setMsDialog(true); }}>
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteMilestone.mutate(ms.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ── TEAM ─────────────────────────────────────────────── */}
        <TabsContent value="team" className="space-y-3">
          <p className="text-sm text-muted-foreground">{projectPlacements.length} active placement{projectPlacements.length !== 1 ? 's' : ''} on this project</p>
          {projectPlacements.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">No placements linked to this project.</p>}
          <div className="space-y-2">
            {projectPlacements.map(pl => (
              <Card key={pl.id}>
                <CardContent className="p-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{candidateMap[pl.candidateId] ?? `Worker #${pl.candidateId}`}</p>
                    <p className="text-xs text-muted-foreground">{pl.role} · {pl.rateType === 'hourly' ? `$${pl.rate}/hr` : `$${pl.rate}/day`}</p>
                  </div>
                  <Badge className={`capitalize ${statusColors[pl.status] ?? ''}`} variant="secondary">{pl.status}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ── NOTES ────────────────────────────────────────────── */}
        <TabsContent value="notes" className="space-y-3">
          <div className="flex gap-2">
            <Textarea
              rows={2}
              placeholder="Add a project note…"
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              className="flex-1"
            />
            <Button
              className="self-end"
              disabled={!noteText.trim() || addNote.isPending}
              onClick={() => addNote.mutate(noteText)}
            >
              <MessageSquare className="w-4 h-4 mr-1" /> Save
            </Button>
          </div>
          {notes?.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">No notes yet.</p>}
          <div className="space-y-2">
            {notes?.map(note => (
              <Card key={note.id}>
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-[hsl(38,91%,54%)]">{note.author}</span>
                        <span className="text-xs text-muted-foreground">{note.createdAt.slice(0, 10)}</span>
                      </div>
                      <p className="text-sm">{note.body}</p>
                    </div>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive shrink-0" onClick={() => deleteNote.mutate(note.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Dialogs ─────────────────────────────────────────────── */}
      <Dialog open={taskDialog} onOpenChange={setTaskDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingTask ? 'Edit Task' : 'Add Task'}</DialogTitle></DialogHeader>
          <TaskForm projectId={projectId} task={editingTask} onClose={() => setTaskDialog(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={rfiDialog} onOpenChange={setRfiDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingRfi ? 'Edit RFI' : 'Raise RFI'}</DialogTitle></DialogHeader>
          <RfiForm projectId={projectId} rfi={editingRfi} onClose={() => setRfiDialog(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={msDialog} onOpenChange={setMsDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingMs ? 'Edit Milestone' : 'Add Milestone'}</DialogTitle></DialogHeader>
          <MilestoneForm projectId={projectId} milestone={editingMs} onClose={() => setMsDialog(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
