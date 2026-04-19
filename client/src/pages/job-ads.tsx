import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import {
  Plus, Pencil, Trash2, Eye, Share2, Facebook, Linkedin,
  Copy, MapPin, Briefcase, DollarSign, Clock, Users,
  CheckCircle, Globe
} from 'lucide-react';

interface JobAd {
  id: number;
  title: string;
  trade: string;
  location: string;
  projectName: string | null;
  description: string;
  requirements: string | null;
  payRate: string | null;
  employmentType: string;
  published: boolean | number;
  createdAt: string;
  updatedAt: string;
}

const EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Contract', 'Casual', 'FIFO', 'Residential'];
const TRADES = [
  'Civil', 'Mining', 'Electrical', 'Mechanical', 'Plumbing', 'Carpentry',
  'Welding', 'Boilermaking', 'Rigging', 'Scaffolding', 'Earthworks',
  'Surveying', 'Project Management', 'Site Management', 'Safety', 'Labour', 'Other'
];

const emptyForm = {
  title: '', trade: '', location: '', projectName: '', description: '',
  requirements: '', payRate: '', employmentType: 'Full-time', published: false,
};

function ShareButtons({ job }: { job: JobAd }) {
  const { toast } = useToast();
  const jobUrl = `https://platform.civilandmining.com/jobs/${job.id}`;
  const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(jobUrl)}`;
  const liUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(jobUrl)}`;

  return (
    <div className="flex items-center gap-1.5">
      <Button
        size="sm" variant="outline"
        className="h-7 px-2 text-[#1877F2] border-[#1877F2]/30 hover:bg-[#1877F2]/10"
        onClick={() => window.open(fbUrl, '_blank')}
        title="Share on Facebook"
      >
        <Facebook className="w-3.5 h-3.5" />
      </Button>
      <Button
        size="sm" variant="outline"
        className="h-7 px-2 text-[#0A66C2] border-[#0A66C2]/30 hover:bg-[#0A66C2]/10"
        onClick={() => window.open(liUrl, '_blank')}
        title="Share on LinkedIn"
      >
        <Linkedin className="w-3.5 h-3.5" />
      </Button>
      <Button
        size="sm" variant="outline"
        className="h-7 px-2"
        onClick={() => { navigator.clipboard.writeText(jobUrl); toast({ title: 'Link copied!' }); }}
        title="Copy link"
      >
        <Copy className="w-3.5 h-3.5" />
      </Button>
      <Button
        size="sm" variant="outline"
        className="h-7 px-2"
        onClick={() => window.open(jobUrl, '_blank')}
        title="Preview public page"
      >
        <Eye className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}

export default function JobAdsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<JobAd | null>(null);
  const [form, setForm] = useState<typeof emptyForm>({ ...emptyForm });
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const { data: jobs = [], isLoading } = useQuery<JobAd[]>({
    queryKey: ['/api/jobs'],
  });

  const createMut = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/jobs', data).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['/api/jobs'] }); setShowForm(false); setForm({ ...emptyForm }); toast({ title: 'Job ad created' }); },
    onError: () => toast({ title: 'Error', description: 'Could not create job ad', variant: 'destructive' }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest('PATCH', `/api/jobs/${id}`, data).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['/api/jobs'] }); setEditing(null); setShowForm(false); toast({ title: 'Job ad updated' }); },
    onError: () => toast({ title: 'Error', description: 'Could not update job ad', variant: 'destructive' }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/jobs/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['/api/jobs'] }); setDeleteConfirm(null); toast({ title: 'Job ad deleted' }); },
  });

  const togglePublishMut = useMutation({
    mutationFn: ({ id, published }: { id: number; published: boolean }) =>
      apiRequest('PATCH', `/api/jobs/${id}`, { published }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['/api/jobs'] }),
  });

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm });
    setShowForm(true);
  }

  function openEdit(job: JobAd) {
    setEditing(job);
    setForm({
      title: job.title,
      trade: job.trade,
      location: job.location,
      projectName: job.projectName || '',
      description: job.description,
      requirements: job.requirements || '',
      payRate: job.payRate || '',
      employmentType: job.employmentType,
      published: !!job.published,
    });
    setShowForm(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = { ...form, published: form.published ? 1 : 0 };
    if (editing) {
      updateMut.mutate({ id: editing.id, data: payload });
    } else {
      createMut.mutate(payload);
    }
  }

  const publishedJobs = jobs.filter(j => !!j.published);
  const draftJobs = jobs.filter(j => !j.published);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1c2b4a] dark:text-white">Job Ads</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Create and manage job postings for the public job wall</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open('/jobs', '_blank')}
            className="gap-1.5"
          >
            <Globe className="w-4 h-4" />
            View Job Wall
          </Button>
          <Button
            onClick={openCreate}
            className="bg-[#1c2b4a] hover:bg-[#1c2b4a]/90 text-white gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Create Job Ad
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#1c2b4a]/10 flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-[#1c2b4a]" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#1c2b4a]">{jobs.length}</p>
              <p className="text-xs text-muted-foreground">Total Ads</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{publishedJobs.length}</p>
              <p className="text-xs text-muted-foreground">Published</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
              <Clock className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-orange-500">{draftJobs.length}</p>
              <p className="text-xs text-muted-foreground">Drafts</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Job list */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading job ads...</div>
      ) : jobs.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Briefcase className="w-12 h-12 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground font-medium">No job ads yet</p>
            <p className="text-sm text-muted-foreground/70 mt-1">Create your first job ad to post to the public job wall</p>
            <Button onClick={openCreate} className="mt-4 bg-[#1c2b4a] text-white">
              <Plus className="w-4 h-4 mr-2" /> Create Job Ad
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {jobs.map(job => (
            <Card key={job.id} className={`border shadow-sm transition-all ${job.published ? 'border-green-200 bg-green-50/30 dark:bg-green-950/10' : ''}`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-[#1c2b4a] dark:text-white">{job.title}</h3>
                      <Badge variant={job.published ? 'default' : 'secondary'}
                        className={job.published ? 'bg-green-600 text-white text-xs' : 'text-xs'}>
                        {job.published ? 'Published' : 'Draft'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 mt-1.5 text-sm text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" />{job.trade}</span>
                      <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{job.location}</span>
                      {job.payRate && <span className="flex items-center gap-1"><DollarSign className="w-3.5 h-3.5" />{job.payRate}</span>}
                      <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{job.employmentType}</span>
                      {job.projectName && <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{job.projectName}</span>}
                    </div>
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{job.description}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{job.published ? 'Live' : 'Draft'}</span>
                      <Switch
                        checked={!!job.published}
                        onCheckedChange={v => togglePublishMut.mutate({ id: job.id, published: v })}
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      {job.published && <ShareButtons job={job} />}
                      <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => openEdit(job)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 px-2 text-red-500 border-red-200 hover:bg-red-50"
                        onClick={() => setDeleteConfirm(job.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={v => { setShowForm(v); if (!v) setEditing(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#1c2b4a]">{editing ? 'Edit Job Ad' : 'Create Job Ad'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-widest text-[#1c2b4a]">Job Title *</Label>
                <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Civil Labourer — FIFO Pilbara" required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-widest text-[#1c2b4a]">Trade *</Label>
                <Select value={form.trade} onValueChange={v => setForm(f => ({ ...f, trade: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select trade..." /></SelectTrigger>
                  <SelectContent>{TRADES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-widest text-[#1c2b4a]">Employment Type *</Label>
                <Select value={form.employmentType} onValueChange={v => setForm(f => ({ ...f, employmentType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{EMPLOYMENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-widest text-[#1c2b4a]">Location *</Label>
                <Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. Pilbara, WA" required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-widest text-[#1c2b4a]">Pay Rate</Label>
                <Input value={form.payRate} onChange={e => setForm(f => ({ ...f, payRate: e.target.value }))} placeholder="e.g. $45–$55/hr" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-widest text-[#1c2b4a]">Project Name</Label>
                <Input value={form.projectName} onChange={e => setForm(f => ({ ...f, projectName: e.target.value }))} placeholder="e.g. Roy Hill Infrastructure" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-widest text-[#1c2b4a]">Description *</Label>
                <Textarea rows={4} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Role overview, responsibilities, what the candidate will be doing..." required />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-widest text-[#1c2b4a]">Requirements</Label>
                <Textarea rows={3} value={form.requirements} onChange={e => setForm(f => ({ ...f, requirements: e.target.value }))} placeholder="Tickets, licences, experience required..." />
              </div>
              <div className="col-span-2 flex items-center gap-3">
                <Switch checked={form.published} onCheckedChange={v => setForm(f => ({ ...f, published: v }))} />
                <Label className="text-sm">Publish immediately to job wall</Label>
              </div>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" className="bg-[#1c2b4a] text-white" disabled={createMut.isPending || updateMut.isPending}>
                {(createMut.isPending || updateMut.isPending) ? 'Saving...' : (editing ? 'Update Job Ad' : 'Create Job Ad')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete Job Ad?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This will permanently delete the job ad and all associated applications.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && deleteMut.mutate(deleteConfirm)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
