import { useState } from 'react';
import { useRoute, useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft, User, Briefcase, Award, FileText, Building2,
  Phone, Mail, MapPin, Calendar, Clock, ExternalLink,
  FileDown, Share2, CheckCircle2, AlertCircle, Loader2,
  Shield, Clipboard, Wrench, ChevronRight, Send
} from 'lucide-react';
import type { Candidate, Placement, Project } from '@shared/schema';

const statusColors: Record<string, string> = {
  available: 'bg-green-100 text-green-700',
  placed: 'bg-blue-100 text-blue-700',
  unavailable: 'bg-gray-100 text-gray-600',
  blacklisted: 'bg-red-100 text-red-700',
};

// ── Share CV Modal ─────────────────────────────────────────────────────────────
function ShareCVModal({
  open,
  onClose,
  candidate,
  docRef,
  clientPdfUrl,
}: {
  open: boolean;
  onClose: () => void;
  candidate: Candidate;
  docRef?: string | null;
  clientPdfUrl?: string | null;
}) {
  const { toast } = useToast();
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState(
    `Candidate Profile — ${candidate.firstName} ${candidate.lastName}${docRef ? ` (${docRef})` : ''}`
  );
  const [body, setBody] = useState(
    `Hi,\n\nPlease find attached the ACM Resources candidate profile for ${candidate.firstName} ${candidate.lastName}.\n\nCandidate: ${candidate.firstName} ${candidate.lastName}\nTrade: ${candidate.trade}${candidate.classification ? ` — ${candidate.classification}` : ''}\nLocation: ${candidate.location ?? 'N/A'}\nStatus: ${candidate.status}\n${docRef ? `Doc Ref: ${docRef}\n` : ''}\nPlease note this is a client-facing CV — contact and personal details are withheld per ACM Resources policy.\n\nKind regards,\nACM Resources\njobs@acmresources.com.au\n+61 8 XXXX XXXX`
  );
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!to.trim()) { toast({ title: 'Enter a recipient email', variant: 'destructive' }); return; }
    setSending(true);
    try {
      const r = await apiRequest('POST', `/api/candidates/${candidate.id}/share-cv`, { to, subject, body });
      const data = await r.json();
      if (data.success) {
        toast({ title: 'Email sent', description: `Candidate profile sent to ${to}` });
        onClose();
      } else {
        throw new Error(data.error ?? 'Failed to send');
      }
    } catch (e: any) {
      toast({ title: 'Email failed', description: e.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="w-4 h-4 text-[#f5a623]" />
            Share Candidate Profile
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {!clientPdfUrl && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>No client CV generated yet. The email will include the candidate summary only. Generate the CV first to attach it.</span>
            </div>
          )}
          {clientPdfUrl && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Client CV ({docRef}) will be linked in the email. The client PDF withholds name, phone, and email per ACM policy.</span>
            </div>
          )}
          <div className="space-y-1">
            <Label>To (client email)</Label>
            <Input type="email" placeholder="client@company.com.au" value={to} onChange={e => setTo(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Subject</Label>
            <Input value={subject} onChange={e => setSubject(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Message</Label>
            <Textarea rows={10} value={body} onChange={e => setBody(e.target.value)} className="text-sm font-mono" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleSend}
            disabled={sending}
            className="bg-[#1c2b4a] hover:bg-[#1c2b4a]/90 text-white"
          >
            {sending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending…</> : <><Send className="w-4 h-4 mr-2" /> Send Email</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── CV Documents Tab ───────────────────────────────────────────────────────────
function DocumentsTab({ candidate }: { candidate: Candidate }) {
  const { toast } = useToast();
  const [shareOpen, setShareOpen] = useState(false);
  const [cvResult, setCvResult] = useState<{ docRef?: string; clientPdf?: string; internalPdf?: string } | null>(null);

  const cvMutation = useMutation({
    mutationFn: () => apiRequest('POST', `/api/candidates/${candidate.id}/generate-cv`, {}).then(r => r.json()),
    onSuccess: (data) => {
      if (data.success) {
        setCvResult(data);
        queryClient.invalidateQueries({ queryKey: [`/api/candidates/${candidate.id}`] });
        toast({ title: `CV generated — ${data.docRef}`, description: 'Client and internal PDFs ready.' });
      } else {
        toast({ title: 'CV generation failed', description: data.error, variant: 'destructive' });
      }
    },
    onError: () => toast({ title: 'CV generation failed', variant: 'destructive' }),
  });

  const c = candidate as any;
  const docRef = cvResult?.docRef ?? c.docRef;
  const clientUrl = cvResult?.clientPdf ?? c.cvClientUrl;
  const internalUrl = cvResult?.internalPdf ?? c.cvInternalUrl;
  const generatedAt = c.cvGeneratedAt;

  return (
    <div className="space-y-5">
      {/* ACM CV Generator */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#f5a623]" />
            ACM CV Generator
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {docRef ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <div>
                  <p className="font-semibold">CV Generated — {docRef}</p>
                  {generatedAt && <p className="text-xs text-muted-foreground mt-0.5">Generated {new Date(generatedAt).toLocaleString('en-AU')}</p>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {clientUrl && (
                  <a href={clientUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm" className="w-full gap-2 text-xs">
                      <FileDown className="w-3.5 h-3.5" />
                      Client PDF
                      <Badge variant="secondary" className="text-[10px] px-1">Safe to send</Badge>
                    </Button>
                  </a>
                )}
                {internalUrl && (
                  <a href={internalUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm" className="w-full gap-2 text-xs">
                      <FileDown className="w-3.5 h-3.5" />
                      Internal PDF
                      <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-700 px-1">ACM only</Badge>
                    </Button>
                  </a>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="gap-2 bg-[#1c2b4a] hover:bg-[#1c2b4a]/90 text-white"
                  onClick={() => setShareOpen(true)}
                >
                  <Share2 className="w-3.5 h-3.5" />
                  Share with Client
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={cvMutation.isPending}
                  onClick={() => cvMutation.mutate()}
                >
                  {cvMutation.isPending ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Regenerating…</> : 'Regenerate CV'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Generate the ACM-branded candidate CV. Produces two versions:
                a <strong>client PDF</strong> (name/contact withheld) and an <strong>internal PDF</strong> (full details, ACM HR only).
              </p>
              <Button
                className="gap-2 bg-[#1c2b4a] hover:bg-[#1c2b4a]/90 text-white"
                disabled={cvMutation.isPending}
                onClick={() => cvMutation.mutate()}
              >
                {cvMutation.isPending
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating CV…</>
                  : <><FileText className="w-4 h-4 mr-2" /> Generate ACM CV</>}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* SharePoint / Raw CV */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <ExternalLink className="w-4 h-4 text-[#f5a623]" />
            Source Documents
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {c.sharepointFolderUrl ? (
            <a href={c.sharepointFolderUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/40 transition-colors text-sm">
              <div className="flex items-center gap-2"><Building2 className="w-4 h-4 text-[#1c2b4a]" /> SharePoint Employee Folder</div>
              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
            </a>
          ) : (
            <p className="text-xs text-muted-foreground p-3">No SharePoint folder linked.</p>
          )}
          {c.rawCvUrl && (
            <a href={c.rawCvUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/40 transition-colors text-sm">
              <div className="flex items-center gap-2"><FileText className="w-4 h-4" /> Original CV</div>
              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
            </a>
          )}
          {c.linkedinUrl && (
            <a href={c.linkedinUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/40 transition-colors text-sm">
              <div className="flex items-center gap-2"><ExternalLink className="w-4 h-4" /> LinkedIn</div>
              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
            </a>
          )}
          {!c.sharepointFolderUrl && !c.rawCvUrl && !c.linkedinUrl && (
            <p className="text-xs text-muted-foreground p-3">No source documents linked. Edit the candidate to add SharePoint or LinkedIn URLs.</p>
          )}
        </CardContent>
      </Card>

      <ShareCVModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        candidate={candidate}
        docRef={docRef}
        clientPdfUrl={clientUrl}
      />
    </div>
  );
}

// ── Profile Tab ────────────────────────────────────────────────────────────────
function ProfileTab({ candidate }: { candidate: Candidate }) {
  const c = candidate as any;
  const ec = (() => { try { return JSON.parse(c.emergencyContact || '{}'); } catch { return {}; } })();

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {/* Personal */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><User className="w-4 h-4 text-[#f5a623]" /> Personal Info</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <InfoRow label="Full Name" value={`${candidate.firstName} ${candidate.lastName}`} />
          <InfoRow label="Date of Birth" value={c.dateOfBirth} />
          <InfoRow label="Address" value={c.address} />
          <InfoRow label="Phone" value={candidate.phone} icon={<Phone className="w-3 h-3" />} />
          <InfoRow label="Email" value={candidate.email} icon={<Mail className="w-3 h-3" />} />
          <InfoRow label="Location" value={candidate.location} icon={<MapPin className="w-3 h-3" />} />
        </CardContent>
      </Card>

      {/* Work */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Briefcase className="w-4 h-4 text-[#f5a623]" /> Work Details</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <InfoRow label="Trade" value={candidate.trade} />
          <InfoRow label="Classification" value={candidate.classification} />
          <InfoRow label="Availability" value={c.availability} icon={<Clock className="w-3 h-3" />} />
          <InfoRow label="Preferred Roster" value={c.preferredRoster} icon={<Calendar className="w-3 h-3" />} />
          <InfoRow label="Status">
            <Badge className={`text-xs capitalize ${statusColors[candidate.status] ?? ''}`} variant="secondary">{candidate.status}</Badge>
          </InfoRow>
        </CardContent>
      </Card>

      {/* Right to Work */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Shield className="w-4 h-4 text-[#f5a623]" /> Right to Work</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <InfoRow label="Status" value={c.rightToWork} />
          <InfoRow label="Visa Details" value={c.visaDetails} />
        </CardContent>
      </Card>

      {/* Emergency Contact */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Phone className="w-4 h-4 text-[#f5a623]" /> Emergency Contact</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {ec.name || ec.phone ? (
            <>
              <InfoRow label="Name" value={ec.name} />
              <InfoRow label="Phone" value={ec.phone} />
              <InfoRow label="Relation" value={ec.relation} />
            </>
          ) : (
            <p className="text-muted-foreground text-xs">No emergency contact recorded.</p>
          )}
        </CardContent>
      </Card>

      {/* Objective */}
      {c.objective && (
        <Card className="sm:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Clipboard className="w-4 h-4 text-[#f5a623]" /> Professional Objective</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground">{c.objective}</p></CardContent>
        </Card>
      )}

      {/* Notes */}
      {candidate.notes && (
        <Card className="sm:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Internal Notes</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground whitespace-pre-line">{candidate.notes}</p></CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Employment Tab ─────────────────────────────────────────────────────────────
function EmploymentTab({ candidate }: { candidate: Candidate }) {
  const c = candidate as any;
  const history: any[] = (() => { try { return JSON.parse(c.employmentHistory || '[]'); } catch { return []; } })();

  if (history.length === 0) {
    return <EmptyState icon={<Briefcase className="w-8 h-8" />} message="No employment history recorded." />;
  }
  return (
    <div className="space-y-4">
      {history.map((job, i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <p className="font-semibold text-sm">{job.role}</p>
                <p className="text-sm text-muted-foreground">{job.employer}{job.location ? ` · ${job.location}` : ''}</p>
              </div>
              <div className="text-xs text-muted-foreground text-right shrink-0">
                {job.start} – {job.end ?? 'Present'}
              </div>
            </div>
            {job.duties && job.duties.length > 0 && (
              <ul className="mt-2 space-y-1">
                {job.duties.map((d: string, j: number) => (
                  <li key={j} className="flex gap-2 text-xs text-muted-foreground">
                    <ChevronRight className="w-3 h-3 shrink-0 mt-0.5 text-[#f5a623]" />
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── Certifications Tab ─────────────────────────────────────────────────────────
function CertificationsTab({ candidate }: { candidate: Candidate }) {
  const c = candidate as any;
  const certs: any[] = (() => { try { return JSON.parse(c.certifications || '[]'); } catch { return []; } })();
  const tickets: string[] = (() => { try { return JSON.parse(candidate.tickets || '[]'); } catch { return []; } })();
  const skills: any[] = (() => { try { return JSON.parse(c.skills || '[]'); } catch { return []; } })();

  const categoryColor: Record<string, string> = {
    Safety: 'bg-red-100 text-red-700',
    Plant: 'bg-orange-100 text-orange-700',
    Civil: 'bg-yellow-100 text-yellow-700',
    Drilling: 'bg-blue-100 text-blue-700',
    Licence: 'bg-purple-100 text-purple-700',
    Competency: 'bg-teal-100 text-teal-700',
    Qualification: 'bg-green-100 text-green-700',
  };

  return (
    <div className="space-y-5">
      {certs.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Award className="w-4 h-4 text-[#f5a623]" /> Tickets &amp; Certifications</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {certs.map((cert, i) => (
                <div key={i} className="flex items-start justify-between gap-3 p-2 rounded-lg border text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">{cert.ticket}</p>
                    {cert.details && cert.details !== cert.ticket && <p className="text-xs text-muted-foreground">{cert.details}</p>}
                  </div>
                  <Badge className={`text-[10px] shrink-0 ${categoryColor[cert.category] ?? 'bg-gray-100 text-gray-700'}`} variant="secondary">{cert.category}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {tickets.length > 0 && certs.length === 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Award className="w-4 h-4 text-[#f5a623]" /> Tickets &amp; Licences</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {tickets.map((t, i) => <Badge key={i} variant="outline" className="text-xs">{t}</Badge>)}
            </div>
          </CardContent>
        </Card>
      )}

      {skills.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Wrench className="w-4 h-4 text-[#f5a623]" /> Skills &amp; Competencies</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {skills.map((s, i) => (
              <div key={i} className="flex gap-3 text-sm">
                <span className="font-medium min-w-[120px] text-[#1c2b4a] dark:text-[#f5a623]">{s.area}</span>
                <span className="text-muted-foreground">{s.detail}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {certs.length === 0 && tickets.length === 0 && skills.length === 0 && (
        <EmptyState icon={<Award className="w-8 h-8" />} message="No tickets, certifications or skills recorded." />
      )}
    </div>
  );
}

// ── Placements Tab ─────────────────────────────────────────────────────────────
function PlacementsTab({ candidateId }: { candidateId: number }) {
  const { data: allPlacements } = useQuery<Placement[]>({ queryKey: ['/api/placements'] });
  const { data: projects } = useQuery<Project[]>({ queryKey: ['/api/projects'] });
  const candidatePlacements = allPlacements?.filter(p => p.candidateId === candidateId) ?? [];

  const placementStatusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    completed: 'bg-gray-100 text-gray-600',
    terminated: 'bg-red-100 text-red-700',
  };

  if (candidatePlacements.length === 0) {
    return <EmptyState icon={<Building2 className="w-8 h-8" />} message="No placement history for this candidate." />;
  }

  return (
    <div className="space-y-3">
      {candidatePlacements.map(p => {
        const project = projects?.find(pr => pr.id === p.projectId);
        return (
          <Card key={p.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-sm">{project?.name ?? `Project #${p.projectId}`}</p>
                  <p className="text-xs text-muted-foreground">{p.role}{p.rate ? ` · $${p.rate}/hr` : ''}</p>
                  {project?.location && <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" />{project.location}</p>}
                </div>
                <div className="text-right shrink-0 space-y-1">
                  <Badge className={`text-xs capitalize ${placementStatusColors[p.status] ?? ''}`} variant="secondary">{p.status}</Badge>
                  <p className="text-xs text-muted-foreground">{p.startDate}{p.endDate ? ` → ${p.endDate}` : ''}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function InfoRow({ label, value, icon, children }: { label: string; value?: string | null; icon?: React.ReactNode; children?: React.ReactNode }) {
  if (!value && !children) return null;
  return (
    <div className="flex items-start gap-2 py-1">
      <span className="text-muted-foreground min-w-[110px] shrink-0 text-xs pt-0.5">{label}</span>
      <span className="font-medium text-xs flex items-center gap-1 min-w-0 flex-wrap">
        {icon}
        {children ?? value}
      </span>
    </div>
  );
}

function EmptyState({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
      <div className="text-muted-foreground/30">{icon}</div>
      <p className="text-sm">{message}</p>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function CandidateDetailPage() {
  const [, params] = useRoute('/candidates/:id');
  const [, navigate] = useLocation();
  const id = Number(params?.id);

  const { data: candidate, isLoading } = useQuery<Candidate>({
    queryKey: [`/api/candidates/${id}`],
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-4 max-w-5xl">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!candidate) {
    return (
      <div className="p-6 flex flex-col items-center justify-center gap-3 text-muted-foreground">
        <AlertCircle className="w-8 h-8" />
        <p>Candidate not found.</p>
        <Button variant="outline" onClick={() => navigate('/candidates')}>Back to Candidates</Button>
      </div>
    );
  }

  const c = candidate as any;
  const ticketList: string[] = (() => { try { return JSON.parse(candidate.tickets || '[]'); } catch { return []; } })();

  return (
    <div className="p-6 space-y-5 max-w-5xl">
      {/* Back */}
      <button
        onClick={() => navigate('/candidates')}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Candidates
      </button>

      {/* Header Card */}
      <Card className="border-l-4 border-l-[#f5a623]">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-[#1c2b4a] dark:text-white">
                  {candidate.firstName} {candidate.lastName}
                </h1>
                <Badge className={`capitalize ${statusColors[candidate.status] ?? ''}`} variant="secondary">
                  {candidate.status}
                </Badge>
                {c.docRef && (
                  <Badge variant="outline" className="text-xs font-mono">{c.docRef}</Badge>
                )}
              </div>
              <p className="text-muted-foreground mt-1">
                {candidate.trade}{candidate.classification ? ` — ${candidate.classification}` : ''}
              </p>
              <div className="flex gap-4 mt-2 flex-wrap">
                {candidate.location && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="w-3 h-3" />{candidate.location}
                  </span>
                )}
                {candidate.phone && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Phone className="w-3 h-3" />{candidate.phone}
                  </span>
                )}
                {candidate.email && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Mail className="w-3 h-3" />{candidate.email}
                  </span>
                )}
                {c.availability && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />{c.availability}
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              {c.docRef && c.cvClientUrl && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2 text-xs"
                  onClick={() => window.open(c.cvClientUrl, '_blank')}
                >
                  <FileDown className="w-3.5 h-3.5" />
                  Client CV
                </Button>
              )}
            </div>
          </div>

          {/* Quick ticket chips */}
          {ticketList.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t">
              {ticketList.map(t => <Badge key={t} variant="outline" className="text-[10px] px-1.5">{t}</Badge>)}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="profile">
        <TabsList className="grid grid-cols-5 w-full max-w-xl">
          <TabsTrigger value="profile" className="text-xs"><User className="w-3.5 h-3.5 mr-1" />Profile</TabsTrigger>
          <TabsTrigger value="employment" className="text-xs"><Briefcase className="w-3.5 h-3.5 mr-1" />History</TabsTrigger>
          <TabsTrigger value="certifications" className="text-xs"><Award className="w-3.5 h-3.5 mr-1" />Tickets</TabsTrigger>
          <TabsTrigger value="documents" className="text-xs"><FileText className="w-3.5 h-3.5 mr-1" />Documents</TabsTrigger>
          <TabsTrigger value="placements" className="text-xs"><Building2 className="w-3.5 h-3.5 mr-1" />Placements</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4">
          <ProfileTab candidate={candidate} />
        </TabsContent>

        <TabsContent value="employment" className="mt-4">
          <EmploymentTab candidate={candidate} />
        </TabsContent>

        <TabsContent value="certifications" className="mt-4">
          <CertificationsTab candidate={candidate} />
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <DocumentsTab candidate={candidate} />
        </TabsContent>

        <TabsContent value="placements" className="mt-4">
          <PlacementsTab candidateId={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
