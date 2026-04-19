import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import {
  Users, Search, Eye, MapPin, Briefcase, Phone, Mail,
  Clock, ChevronRight, FileText, CheckCircle, XCircle,
  Star, Inbox, Filter, ExternalLink, Download
} from 'lucide-react';

interface Application {
  id: number;
  jobId: number;
  jobTitle?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string | null;
  rightToWork: string | null;
  visaDetails: string | null;
  experience: string | null;
  coverLetter: string | null;
  availability: string | null;
  cvFilePath: string | null;
  tickets: string | null;
  status: string;
  candidateId: number | null;
  createdAt: string;
}

interface JobAd {
  id: number;
  title: string;
  trade: string;
  location: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  new:         { label: 'New',         color: 'bg-blue-100 text-blue-700',    icon: Inbox },
  reviewed:    { label: 'Reviewed',    color: 'bg-yellow-100 text-yellow-700', icon: Eye },
  shortlisted: { label: 'Shortlisted', color: 'bg-purple-100 text-purple-700', icon: Star },
  hired:       { label: 'Hired',       color: 'bg-green-100 text-green-700',   icon: CheckCircle },
  rejected:    { label: 'Rejected',    color: 'bg-red-100 text-red-700',       icon: XCircle },
};

const STATUS_FLOW = ['new', 'reviewed', 'shortlisted', 'hired'];

export default function ApplicationsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [jobFilter, setJobFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState<Application | null>(null);

  const { data: applications = [], isLoading } = useQuery<Application[]>({
    queryKey: ['/api/applications'],
  });

  const { data: jobs = [] } = useQuery<JobAd[]>({
    queryKey: ['/api/jobs'],
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiRequest('PATCH', `/api/applications/${id}`, { status }).then(r => r.json()),
    onSuccess: (updated: Application) => {
      qc.invalidateQueries({ queryKey: ['/api/applications'] });
      setSelected(prev => prev?.id === updated.id ? updated : prev);
      toast({ title: `Status updated to ${STATUS_CONFIG[updated.status]?.label}` });
    },
  });

  // Enrich applications with job title
  const enriched = applications.map(app => {
    const job = jobs.find(j => j.id === app.jobId);
    return { ...app, jobTitle: job?.title || `Job #${app.jobId}` };
  });

  const filtered = enriched.filter(a => {
    const q = search.toLowerCase();
    const matchSearch = !q || `${a.firstName} ${a.lastName}`.toLowerCase().includes(q) || a.email.toLowerCase().includes(q) || (a.jobTitle || '').toLowerCase().includes(q);
    const matchJob = jobFilter === 'all' || String(a.jobId) === jobFilter;
    const matchStatus = statusFilter === 'all' || a.status === statusFilter;
    return matchSearch && matchJob && matchStatus;
  });

  // Stats
  const counts = Object.keys(STATUS_CONFIG).reduce((acc, s) => {
    acc[s] = applications.filter(a => a.status === s).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1c2b4a] dark:text-white">Applications Inbox</h1>
          <p className="text-sm text-muted-foreground mt-0.5">All job applications received from the public job wall</p>
        </div>
        <Badge className="bg-[#1c2b4a] text-white text-sm px-3 py-1">
          {applications.length} total
        </Badge>
      </div>

      {/* Status stats */}
      <div className="grid grid-cols-5 gap-3">
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
          <button key={key}
            onClick={() => setStatusFilter(statusFilter === key ? 'all' : key)}
            className={`p-3 rounded-xl border text-left transition-all ${statusFilter === key ? 'ring-2 ring-[#1c2b4a]' : ''} ${cfg.color} hover:opacity-80`}>
            <p className="text-2xl font-bold">{counts[key] || 0}</p>
            <p className="text-xs font-semibold mt-0.5">{cfg.label}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search applicants..." className="pl-9" />
        </div>
        <Select value={jobFilter} onValueChange={setJobFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All jobs" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Jobs</SelectItem>
            {jobs.map(j => <SelectItem key={j.id} value={String(j.id)}>{j.title}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading applications...</div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center py-16 text-center">
            <Inbox className="w-12 h-12 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground font-medium">No applications yet</p>
            <p className="text-sm text-muted-foreground/70 mt-1">Applications will appear here when candidates apply via the job wall</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(app => {
            const cfg = STATUS_CONFIG[app.status] || STATUS_CONFIG.new;
            const StatusIcon = cfg.icon;
            return (
              <Card key={app.id} className="border shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelected(app)}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="w-9 h-9 rounded-full bg-[#1c2b4a]/10 flex items-center justify-center text-sm font-bold text-[#1c2b4a] shrink-0">
                      {app.firstName[0]}{app.lastName[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[#1c2b4a] dark:text-white">{app.firstName} {app.lastName}</span>
                        {app.candidateId && (
                          <Badge variant="outline" className="text-xs border-[#f5a623]/40 text-[#f5a623]">
                            Candidate #{app.candidateId}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" />{app.jobTitle}</span>
                        {app.address && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{app.address}</span>}
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(app.createdAt).toLocaleDateString('en-AU')}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${cfg.color}`}>
                        <StatusIcon className="w-3 h-3" />{cfg.label}
                      </span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail dialog */}
      {selected && (
        <Dialog open onOpenChange={() => setSelected(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-[#1c2b4a]">{selected.firstName} {selected.lastName}</DialogTitle>
              <p className="text-sm text-muted-foreground">{selected.jobTitle} · Applied {new Date(selected.createdAt).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </DialogHeader>

            {/* Status workflow */}
            <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Status</p>
              <div className="flex items-center gap-2 flex-wrap">
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
                  const SIcon = cfg.icon;
                  return (
                    <button key={key}
                      onClick={() => statusMut.mutate({ id: selected.id, status: key })}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
                        selected.status === key
                          ? `${cfg.color} border-transparent ring-2 ring-offset-1 ring-[#1c2b4a]`
                          : 'border-gray-200 hover:border-gray-300 bg-white dark:bg-gray-800'
                      }`}>
                      <SIcon className="w-3.5 h-3.5" />{cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Contact info */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Contact</p>
                <p className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-[#f5a623]" />{selected.email}</p>
                <p className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-[#f5a623]" />{selected.phone}</p>
                {selected.address && <p className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-[#f5a623]" />{selected.address}</p>}
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Work Rights</p>
                <p>{selected.rightToWork || 'Not specified'}</p>
                {selected.visaDetails && <p className="text-muted-foreground text-xs">{selected.visaDetails}</p>}
                {selected.availability && <p className="text-xs text-muted-foreground">Available: {selected.availability}</p>}
              </div>
            </div>

            {selected.experience && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Experience</p>
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap bg-gray-50 dark:bg-gray-900 rounded-lg p-3">{selected.experience}</p>
              </div>
            )}

            {selected.coverLetter && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Cover Letter</p>
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap bg-gray-50 dark:bg-gray-900 rounded-lg p-3">{selected.coverLetter}</p>
              </div>
            )}

            {/* Documents */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Documents</p>
              {selected.cvFilePath ? (
                <a href={selected.cvFilePath} target="_blank" rel="noreferrer"
                  className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-700 flex-1">CV / Resume</span>
                  <Download className="w-4 h-4 text-blue-500" />
                </a>
              ) : (
                <p className="text-sm text-muted-foreground">No CV uploaded</p>
              )}
              {selected.tickets && (() => {
                try {
                  const tickets = JSON.parse(selected.tickets);
                  return tickets.map((t: string, i: number) => (
                    <a key={i} href={t} target="_blank" rel="noreferrer"
                      className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100">
                      <FileText className="w-4 h-4 text-green-600" />
                      <span className="text-sm font-medium text-green-700 flex-1">Ticket / Licence {i + 1}</span>
                      <Download className="w-4 h-4 text-green-500" />
                    </a>
                  ));
                } catch { return null; }
              })()}
            </div>

            {selected.candidateId && (
              <Button variant="outline" className="w-full gap-2" asChild>
                <a href={`/candidates/${selected.candidateId}`}>
                  <ExternalLink className="w-4 h-4" /> View Candidate Profile
                </a>
              </Button>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
