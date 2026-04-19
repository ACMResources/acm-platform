import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  MapPin, Briefcase, DollarSign, Clock, Search, ChevronRight,
  Facebook, Linkedin, Copy, Share2, CheckCircle, Loader2,
  Upload, X, FileText, AlertCircle
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
}

const RIGHT_TO_WORK = ['Australian Citizen', 'Permanent Resident', 'Working Holiday Visa', 'Student Visa', 'Sponsored / 482 Visa', 'Other'];

function JobCard({ job, onApply }: { job: JobAd; onApply: (job: JobAd) => void }) {
  const { toast } = useToast();
  const jobUrl = `${window.location.origin}/jobs/${job.id}`;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-[#f5a623]/30 transition-all group">
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge className="bg-[#1c2b4a]/10 text-[#1c2b4a] hover:bg-[#1c2b4a]/10 text-xs font-semibold">
                {job.trade}
              </Badge>
              <Badge variant="outline" className="text-xs border-[#f5a623]/40 text-[#f5a623]">
                {job.employmentType}
              </Badge>
            </div>
            <h3 className="text-lg font-bold text-[#1c2b4a] mt-2 group-hover:text-[#f5a623] transition-colors">
              {job.title}
            </h3>
            {job.projectName && (
              <p className="text-sm text-gray-500 mt-0.5">{job.projectName}</p>
            )}
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-500 flex-wrap">
              <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-[#f5a623]" />{job.location}</span>
              {job.payRate && <span className="flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5 text-green-500" />{job.payRate}</span>}
              <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />{new Date(job.createdAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            </div>
            <p className="text-sm text-gray-600 mt-3 line-clamp-3">{job.description}</p>
          </div>
        </div>

        <div className="flex items-center justify-between mt-5 pt-4 border-t border-gray-100">
          <div className="flex items-center gap-1.5">
            <Button
              size="sm" variant="ghost"
              className="h-7 px-2 text-[#1877F2] hover:bg-[#1877F2]/10"
              onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(jobUrl)}`, '_blank')}
            >
              <Facebook className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="sm" variant="ghost"
              className="h-7 px-2 text-[#0A66C2] hover:bg-[#0A66C2]/10"
              onClick={() => window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(jobUrl)}`, '_blank')}
            >
              <Linkedin className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="sm" variant="ghost"
              className="h-7 px-2 text-gray-400 hover:text-gray-600"
              onClick={() => { navigator.clipboard.writeText(jobUrl); toast({ title: 'Link copied!' }); }}
            >
              <Copy className="w-3.5 h-3.5" />
            </Button>
          </div>
          <Button
            onClick={() => onApply(job)}
            className="bg-[#1c2b4a] hover:bg-[#f5a623] text-white hover:text-[#1c2b4a] font-semibold transition-colors gap-1.5"
          >
            Apply Now <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function ApplyModal({ job, onClose }: { job: JobAd; onClose: () => void }) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [ticketFiles, setTicketFiles] = useState<File[]>([]);
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '', address: '',
    rightToWork: '', visaDetails: '', experience: '', coverLetter: '',
    availability: '',
  });

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('jobId', String(job.id));
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (cvFile) fd.append('cv', cvFile);
      ticketFiles.forEach(f => fd.append('tickets', f));

      const res = await fetch(`/api/jobs/${job.id}/apply`, { method: 'POST', body: fd });
      if (!res.ok) throw new Error('Submission failed');
      setSubmitted(true);
    } catch {
      toast({ title: 'Error', description: 'Could not submit application. Please try again.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  }

  const f = (key: keyof typeof form, v: string) => setForm(prev => ({ ...prev, [key]: v }));
  const isStep1Valid = form.firstName && form.lastName && form.email && form.phone;
  const isStep2Valid = form.rightToWork;

  if (submitted) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-md text-center">
          <div className="py-8 space-y-4">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-[#1c2b4a]">Application Received!</h3>
              <p className="text-gray-500 mt-2 text-sm">Thanks {form.firstName}! We've received your application for <strong>{job.title}</strong>. Our team will review your details and be in touch soon.</p>
            </div>
            <Button onClick={onClose} className="bg-[#1c2b4a] text-white">Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#1c2b4a]">Apply — {job.title}</DialogTitle>
          <p className="text-sm text-gray-500">{job.location} · {job.employmentType}</p>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-4">
          {[1, 2, 3, 4].map(s => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                step > s ? 'bg-green-500 text-white' : step === s ? 'bg-[#1c2b4a] text-white' : 'bg-gray-100 text-gray-400'}`}>
                {step > s ? <CheckCircle className="w-4 h-4" /> : s}
              </div>
              {s < 4 && <div className={`h-0.5 w-8 transition-colors ${step > s ? 'bg-green-500' : 'bg-gray-200'}`} />}
            </div>
          ))}
          <span className="ml-2 text-xs text-gray-400">{['Personal Info', 'Work Rights', 'Experience', 'Documents'][step - 1]}</span>
        </div>

        {/* Step 1: Personal Info */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-widest text-[#1c2b4a]">First Name *</Label>
                <Input value={form.firstName} onChange={e => f('firstName', e.target.value)} placeholder="First name" required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-widest text-[#1c2b4a]">Last Name *</Label>
                <Input value={form.lastName} onChange={e => f('lastName', e.target.value)} placeholder="Last name" required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-widest text-[#1c2b4a]">Email *</Label>
                <Input type="email" value={form.email} onChange={e => f('email', e.target.value)} placeholder="your@email.com" required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-widest text-[#1c2b4a]">Phone *</Label>
                <Input value={form.phone} onChange={e => f('phone', e.target.value)} placeholder="04XX XXX XXX" required />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-widest text-[#1c2b4a]">Address</Label>
                <Input value={form.address} onChange={e => f('address', e.target.value)} placeholder="Suburb, State" />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setStep(2)} disabled={!isStep1Valid} className="bg-[#1c2b4a] text-white">
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Work Rights */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-widest text-[#1c2b4a]">Right to Work in Australia *</Label>
              <Select value={form.rightToWork} onValueChange={v => f('rightToWork', v)}>
                <SelectTrigger><SelectValue placeholder="Select your work rights..." /></SelectTrigger>
                <SelectContent>{RIGHT_TO_WORK.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {(form.rightToWork === 'Sponsored / 482 Visa' || form.rightToWork === 'Working Holiday Visa' || form.rightToWork === 'Student Visa' || form.rightToWork === 'Other') && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-widest text-[#1c2b4a]">Visa Details</Label>
                <Textarea value={form.visaDetails} onChange={e => f('visaDetails', e.target.value)} placeholder="Visa subclass, expiry date, work limitations..." rows={2} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-widest text-[#1c2b4a]">Availability</Label>
              <Input value={form.availability} onChange={e => f('availability', e.target.value)} placeholder="e.g. Immediate, 2 weeks notice, specific date..." />
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={() => setStep(3)} disabled={!isStep2Valid} className="bg-[#1c2b4a] text-white">
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Experience */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-widest text-[#1c2b4a]">Relevant Experience</Label>
              <Textarea rows={5} value={form.experience} onChange={e => f('experience', e.target.value)} placeholder="Describe your relevant work experience, projects you've worked on, years in the industry..." />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-widest text-[#1c2b4a]">Cover Letter / Additional Notes</Label>
              <Textarea rows={3} value={form.coverLetter} onChange={e => f('coverLetter', e.target.value)} placeholder="Anything else you'd like us to know..." />
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
              <Button onClick={() => setStep(4)} className="bg-[#1c2b4a] text-white">
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Documents */}
        {step === 4 && (
          <div className="space-y-4">
            {/* CV Upload */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-widest text-[#1c2b4a]">CV / Resume</Label>
              {cvFile ? (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <FileText className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-green-700 flex-1 truncate">{cvFile.name}</span>
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-green-600" onClick={() => setCvFile(null)}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-200 rounded-lg cursor-pointer hover:border-[#1c2b4a]/30 hover:bg-gray-50 transition-colors">
                  <Upload className="w-5 h-5 text-gray-400 mb-1" />
                  <span className="text-sm text-gray-500">Upload CV (PDF, Word)</span>
                  <span className="text-xs text-gray-400">Click to browse</span>
                  <input type="file" className="hidden" accept=".pdf,.doc,.docx,.txt" onChange={e => e.target.files?.[0] && setCvFile(e.target.files[0])} />
                </label>
              )}
            </div>

            {/* Tickets */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-widest text-[#1c2b4a]">Licences & Tickets</Label>
              <p className="text-xs text-gray-500">White card, HR licence, forklift, confined space, working at heights, etc.</p>
              {ticketFiles.length > 0 && (
                <div className="space-y-1.5">
                  {ticketFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                      <FileText className="w-4 h-4 text-blue-600" />
                      <span className="text-sm text-blue-700 flex-1 truncate">{f.name}</span>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-blue-600"
                        onClick={() => setTicketFiles(prev => prev.filter((_, idx) => idx !== i))}>
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed border-gray-200 rounded-lg cursor-pointer hover:border-[#1c2b4a]/30 hover:bg-gray-50 transition-colors">
                <Upload className="w-4 h-4 text-gray-400 mb-1" />
                <span className="text-sm text-gray-500">Add ticket / licence files</span>
                <input type="file" className="hidden" multiple accept=".pdf,.jpg,.jpeg,.png" onChange={e => {
                  if (e.target.files) setTicketFiles(prev => [...prev, ...Array.from(e.target.files!)]);
                }} />
              </label>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-700">By submitting this application you consent to ACM Resources storing your personal information in accordance with our Privacy Policy.</p>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(3)}>Back</Button>
              <Button onClick={handleSubmit} disabled={submitting} className="bg-[#f5a623] hover:bg-[#f5a623]/90 text-[#1c2b4a] font-bold min-w-32">
                {submitting ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Submitting...</> : 'Submit Application'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function JobsPage() {
  const [search, setSearch] = useState('');
  const [tradeFilter, setTradeFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [applyJob, setApplyJob] = useState<JobAd | null>(null);

  const { data: jobs = [], isLoading } = useQuery<JobAd[]>({
    queryKey: ['/api/jobs/public'],
    queryFn: async () => {
      const res = await fetch('/api/jobs/public');
      if (!res.ok) throw new Error('Failed to load jobs');
      return res.json();
    },
  });

  const filtered = jobs.filter(j => {
    const q = search.toLowerCase();
    const matchesSearch = !q || j.title.toLowerCase().includes(q) || j.location.toLowerCase().includes(q) || j.trade.toLowerCase().includes(q) || (j.description || '').toLowerCase().includes(q);
    const matchesTrade = tradeFilter === 'all' || j.trade === tradeFilter;
    const matchesType = typeFilter === 'all' || j.employmentType === typeFilter;
    return matchesSearch && matchesTrade && matchesType;
  });

  const trades = Array.from(new Set(jobs.map(j => j.trade))).sort();
  const types = Array.from(new Set(jobs.map(j => j.employmentType))).sort();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero header */}
      <div className="bg-[#1c2b4a] text-white py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-[#f5a623] flex items-center justify-center">
              <span className="text-[10px] font-black text-[#1c2b4a] tracking-wider">ACM</span>
            </div>
            <span className="text-white/70 text-sm font-medium">ACM Resources</span>
          </div>
          <h1 className="text-4xl font-black mb-3">Current Opportunities</h1>
          <p className="text-white/70 text-lg">Civil & Mining roles across Western Australia</p>
          <p className="text-[#f5a623] font-semibold mt-2 text-sm uppercase tracking-widest">Success Without Compromise</p>

          {/* Search */}
          <div className="relative mt-8 max-w-lg mx-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search jobs by title, trade, or location..."
              className="pl-10 bg-white text-gray-900 border-0 h-12 rounded-xl shadow-lg"
            />
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-white border-b sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
          <span className="text-sm font-semibold text-gray-500">{filtered.length} {filtered.length === 1 ? 'role' : 'roles'}</span>
          <Select value={tradeFilter} onValueChange={setTradeFilter}>
            <SelectTrigger className="w-40 h-8 text-sm">
              <SelectValue placeholder="All trades" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Trades</SelectItem>
              {trades.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-40 h-8 text-sm">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {types.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          {(tradeFilter !== 'all' || typeFilter !== 'all' || search) && (
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setTradeFilter('all'); setTypeFilter('all'); setSearch(''); }}>
              <X className="w-3 h-3 mr-1" /> Clear
            </Button>
          )}
        </div>
      </div>

      {/* Jobs */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[#1c2b4a]/30" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Briefcase className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 font-medium">{jobs.length === 0 ? 'No positions currently available' : 'No roles match your search'}</p>
            <p className="text-sm text-gray-300 mt-1">Check back soon or contact us directly</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filtered.map(job => (
              <JobCard key={job.id} job={job} onApply={setApplyJob} />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="bg-[#1c2b4a] text-white/50 text-center py-8 text-sm mt-8">
        <p className="font-semibold text-white/70">ACM Resources Pty Ltd</p>
        <p className="mt-1">Level 4, 432 Murray St, Perth WA 6000</p>
        <p className="mt-1">admin@acmresources.com.au</p>
      </div>

      {applyJob && <ApplyModal job={applyJob} onClose={() => setApplyJob(null)} />}
    </div>
  );
}
