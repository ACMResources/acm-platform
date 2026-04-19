import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { requireAuth } from "./auth";
import {
  insertCandidateSchema, insertClientSchema, insertProjectSchema,
  insertPlacementSchema, insertQuoteSchema, insertTimesheetSchema,
  insertProjectTaskSchema, insertProjectRfiSchema, insertProjectNoteSchema,
  insertProjectMilestoneSchema,
} from "@shared/schema";

export async function registerRoutes(httpServer: Server, app: Express): Promise<void> {

  // ── Global API auth guard (excludes public endpoints) ────────────
  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    const PUBLIC_PATHS = [
      { method: 'POST', path: '/api/auth/login' },
      { method: 'POST', path: '/api/auth/logout' },
      { method: 'GET',  path: '/api/auth/me' },
      { method: 'GET',  path: '/api/jobs/public' },
    ];
    // Allow public job apply
    if (req.method === 'POST' && req.path.match(/^\/jobs\/\d+\/apply$/)) return next();
    // Allow public job listing
    if (req.method === 'GET' && req.path === '/jobs/public') return next();
    // Allow auth endpoints
    const isPublic = PUBLIC_PATHS.some(p => p.method === req.method && `/api${req.path}` === p.path);
    if (isPublic) return next();
    return requireAuth(req, res, next);
  });

  // ── DASHBOARD ────────────────────────────────────────────────────
  app.get("/api/dashboard/stats", (_req, res) => {
    res.json(storage.getDashboardStats());
  });

  // Rich dashboard endpoint — all cross-entity data in one call
  app.get("/api/dashboard/full", (_req, res) => {
    const base = storage.getDashboardStats();
    const projects = storage.getProjects();
    const placements = storage.getPlacements();
    const candidates = storage.getCandidates();
    const clients = storage.getClients();
    const timesheets = storage.getTimesheets();
    const quotes = storage.getQuotes();
    const xeroSummary = (storage as any).getXeroInvoiceSummary();
    const xeroInvoices = (storage as any).getXeroInvoices();

    const today = new Date().toISOString().slice(0, 10);

    // --- Action items (things needing attention)
    const actionItems: any[] = [];

    // Overdue RFIs
    const rfis: any[] = (storage as any).db
      ? [] // handled below
      : [];
    try {
      const openRfis = (storage as any).db
        .select()
        .from(require('@shared/schema').projectRfis)
        .all();
      openRfis.filter((r: any) => r.status !== 'closed' && r.status !== 'answered' && r.dueDate && r.dueDate < today)
        .forEach((r: any) => actionItems.push({ type: 'rfi', priority: 'high', label: `RFI Overdue: ${r.subject}`, sub: `Due ${r.dueDate}`, link: `/projects/${r.projectId}` }));
    } catch {}

    // Pending timesheets
    timesheets.filter(t => t.status === 'pending')
      .forEach(t => actionItems.push({ type: 'timesheet', priority: 'medium', label: `Timesheet pending: Candidate #${t.candidateId}`, sub: `Week ending ${t.weekEnding} · ${t.totalHours}h`, link: '/timesheets' }));

    // Overdue Xero invoices
    xeroInvoices.filter((i: any) => i.type === 'ACCREC' && i.status === 'AUTHORISED' && i.dueDate && i.dueDate < today)
      .forEach((i: any) => actionItems.push({ type: 'invoice', priority: 'high', label: `Invoice overdue: ${i.invoiceNumber ?? i.xeroInvoiceId}`, sub: `${i.contactName} · $${Number(i.amountDue).toLocaleString('en-AU')}`, link: '/finance' }));

    // Draft quotes older than 7 days
    quotes.filter(q => q.status === 'draft' && q.createdAt && q.createdAt < new Date(Date.now() - 7*86400000).toISOString())
      .forEach(q => actionItems.push({ type: 'quote', priority: 'low', label: `Quote stale: ${q.projectName}`, sub: `${q.clientName} · $${Number(q.total ?? 0).toLocaleString('en-AU')}`, link: '/quotes' }));

    // Active projects with no recent activity (no headcount data as proxy)
    projects.filter(p => p.status === 'active' && !p.headcount)
      .forEach(p => actionItems.push({ type: 'project', priority: 'low', label: `Project needs headcount: ${p.name}`, sub: p.location ?? '', link: `/projects/${p.id}` }));

    // --- Project health cards
    const projectHealth = projects.filter(p => p.status === 'active').map(p => {
      const projPlacements = placements.filter(pl => pl.projectId === p.id && pl.status === 'active');
      const projInvoices = xeroInvoices.filter((i: any) => i.type === 'ACCREC' && String(i.projectId) === String(p.id));
      const invoiced = projInvoices.reduce((s: number, i: any) => s + (i.total ?? 0), 0);
      const paid = projInvoices.filter((i: any) => i.status === 'PAID').reduce((s: number, i: any) => s + (i.total ?? 0), 0);
      const contractValue = p.contractValue ?? 0;
      const burnPct = contractValue > 0 ? Math.min(100, Math.round((invoiced / contractValue) * 100)) : null;
      const client = clients.find(c => c.id === p.clientId);
      return {
        id: p.id,
        name: p.name,
        location: p.location,
        scope: p.scope,
        status: p.status,
        startDate: p.startDate,
        endDate: p.endDate,
        contractValue,
        headcount: p.headcount ?? projPlacements.length,
        activePlacements: projPlacements.length,
        invoiced,
        paid,
        burnPct,
        clientName: client?.name ?? null,
      };
    });

    // --- Workforce by project
    const workforceByProject = projects.filter(p => p.status === 'active').map(p => ({
      projectId: p.id,
      projectName: p.name,
      location: p.location,
      headcount: placements.filter(pl => pl.projectId === p.id && pl.status === 'active').length,
    })).filter(r => r.headcount > 0).sort((a, b) => b.headcount - a.headcount);

    // --- Trade breakdown
    const tradeBreakdown = Object.entries(
      candidates.reduce((acc, c) => { acc[c.trade] = (acc[c.trade] || 0) + 1; return acc; }, {} as Record<string, number>)
    ).map(([trade, count]) => ({ trade, count })).sort((a, b) => b.count - a.count);

    // --- Candidate availability
    const availableByTrade = Object.entries(
      candidates.filter(c => c.status === 'available').reduce((acc, c) => {
        acc[c.trade] = (acc[c.trade] || 0) + 1; return acc;
      }, {} as Record<string, number>)
    ).map(([trade, count]) => ({ trade, count }));

    // --- Revenue by month (last 6 months from Xero paid invoices)
    const monthRevenue: Record<string, number> = {};
    const sixMonthsAgo = new Date(); sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    xeroInvoices.filter((i: any) => i.status === 'PAID' && i.date && i.date >= sixMonthsAgo.toISOString().slice(0, 10))
      .forEach((i: any) => {
        const mo = i.date.slice(0, 7); // YYYY-MM
        monthRevenue[mo] = (monthRevenue[mo] ?? 0) + (i.total ?? 0);
      });
    const revenueByMonth = Object.entries(monthRevenue)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, revenue]) => ({ month, revenue }));

    // --- Recent quotes
    const recentQuotes = quotes.slice(0, 8).map(q => ({
      id: q.id, projectName: q.projectName, clientName: q.clientName,
      total: q.total, status: q.status, createdAt: q.createdAt,
    }));

    res.json({
      ...base,
      xeroSummary,
      actionItems: actionItems.sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.priority as string] ?? 3) - ({ high: 0, medium: 1, low: 2 }[b.priority as string] ?? 3)),
      projectHealth,
      workforceByProject,
      tradeBreakdown,
      availableByTrade,
      revenueByMonth,
      recentQuotes,
    });
  });

  // ── CANDIDATES ───────────────────────────────────────────────────
  app.get("/api/candidates", (_req, res) => { res.json(storage.getCandidates()); });

  // Bulk import — upsert by firstName+lastName; returns {created, updated, skipped}
  app.post("/api/candidates/bulk", (req, res) => {
    const incoming: any[] = Array.isArray(req.body) ? req.body : req.body?.candidates ?? [];
    if (!incoming.length) return res.status(400).json({ message: "No candidates provided" });
    const existing = storage.getCandidates();
    const existingMap = new Map<string, number>();
    for (const c of existing) {
      const k = `${(c.firstName||'').toLowerCase().trim()}|${(c.lastName||'').toLowerCase().trim()}`;
      existingMap.set(k, c.id);
    }
    let created = 0, updated = 0, skipped = 0;
    for (const raw of incoming) {
      const firstName = (raw.firstName || raw.first_name || (raw.name||'').split(' ')[0] || '').trim();
      const lastName  = (raw.lastName  || raw.last_name  || (raw.name||'').split(' ').slice(1).join(' ') || '').trim();
      if (!firstName || !lastName) { skipped++; continue; }
      const k = `${firstName.toLowerCase()}|${lastName.toLowerCase()}`;
      const payload: any = {
        firstName, lastName,
        email:               raw.email || null,
        phone:               raw.phone || null,
        trade:               raw.trade || raw.position || 'Unspecified',
        classification:      raw.classification || null,
        status:              raw.status || 'available',
        location:            raw.location || null,
        tickets:             raw.tickets ? (typeof raw.tickets === 'string' ? raw.tickets : JSON.stringify(raw.tickets)) : null,
        notes:               raw.notes || null,
        address:             raw.address || null,
        rightToWork:         raw.rightToWork || raw.right_to_work || null,
        visaDetails:         raw.visaDetails || raw.visa_details || null,
        availability:        raw.availability || null,
        preferredRoster:     raw.preferredRoster || null,
        objective:           raw.objective || null,
        employmentHistory:   raw.employmentHistory ? (typeof raw.employmentHistory === 'string' ? raw.employmentHistory : JSON.stringify(raw.employmentHistory)) : null,
        certifications:      raw.certifications ? (typeof raw.certifications === 'string' ? raw.certifications : JSON.stringify(raw.certifications)) : null,
        skills:              raw.skills ? (typeof raw.skills === 'string' ? raw.skills : JSON.stringify(raw.skills)) : null,
        docRef:              raw.docRef || null,
        cvClientUrl:         raw.cvClientUrl || null,
        cvInternalUrl:       raw.cvInternalUrl || null,
        sharepointFolderUrl: raw.sharepointFolderUrl || null,
        rawCvUrl:            raw.rawCvUrl || null,
        linkedinUrl:         raw.linkedinUrl || null,
        cvGeneratedAt:       raw.cvGeneratedAt || null,
      };
      if (existingMap.has(k)) {
        storage.updateCandidate(existingMap.get(k)!, payload);
        updated++;
      } else {
        storage.createCandidate(payload);
        created++;
      }
    }
    res.json({ created, updated, skipped, total: incoming.length });
  });
  app.get("/api/candidates/:id", (req, res) => {
    const c = storage.getCandidateById(Number(req.params.id));
    if (!c) return res.status(404).json({ message: "Not found" });
    res.json(c);
  });
  app.post("/api/candidates", (req, res) => {
    const parsed = insertCandidateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    res.status(201).json(storage.createCandidate(parsed.data));
  });
  app.patch("/api/candidates/:id", (req, res) => {
    const updated = storage.updateCandidate(Number(req.params.id), req.body);
    if (!updated) return res.status(404).json({ message: "Not found" });
    res.json(updated);
  });
  app.delete("/api/candidates/:id", (req, res) => {
    storage.deleteCandidate(Number(req.params.id));
    res.json({ success: true });
  });

  // ── Upload CV → ACM Template ───────────────────────────────────
  // Accepts PDF, DOCX, or TXT. Extracts text, parses into JSON, runs generate_cv.py.
  const multer = require("multer");
  const uploadStorage = multer.diskStorage({
    destination: (_req: any, _file: any, cb: any) => {
      const dir = require("path").resolve(__dirname, "../ACM_CV_System/uploads");
      require("fs").mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req: any, file: any, cb: any) => {
      const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      cb(null, `${Date.now()}_${safe}`);
    },
  });
  const upload = multer({
    storage: uploadStorage,
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
    fileFilter: (_req: any, file: any, cb: any) => {
      const allowed = ['.pdf', '.docx', '.doc', '.txt'];
      const ext = require("path").extname(file.originalname).toLowerCase();
      cb(null, allowed.includes(ext));
    },
  });

  app.post("/api/candidates/:id/upload-cv", upload.single('cv'), async (req: any, res) => {
    const candidate = storage.getCandidateById(Number(req.params.id));
    if (!candidate) return res.status(404).json({ error: "Candidate not found" });
    if (!req.file) return res.status(400).json({ error: "No file uploaded. Accepted formats: PDF, DOCX, TXT." });

    const { execSync } = require("child_process");
    const fs = require("fs");
    const path = require("path");

    const cvBase = path.resolve(__dirname, "../ACM_CV_System");
    const candidatesDir = path.join(cvBase, "candidates");
    const outputClient   = path.join(cvBase, "output/client");
    const outputInternal = path.join(cvBase, "output/internal");
    fs.mkdirSync(candidatesDir,  { recursive: true });
    fs.mkdirSync(outputClient,   { recursive: true });
    fs.mkdirSync(outputInternal, { recursive: true });

    // Determine next doc ref
    const existing = fs.readdirSync(candidatesDir)
      .filter((f: string) => f.endsWith(".json"))
      .map((f: string) => {
        try { const d = JSON.parse(fs.readFileSync(path.join(candidatesDir, f), "utf8")); return d._meta?.doc_ref ?? ""; }
        catch { return ""; }
      })
      .filter((r: string) => r.startsWith("ACM-HR-CV-"))
      .map((r: string) => parseInt(r.replace("ACM-HR-CV-", ""), 10))
      .filter((n: number) => !isNaN(n));
    // Also check current candidate's existing doc ref
    const c = candidate as any;
    let docRef = c.docRef;
    if (!docRef) {
      const nextNum = existing.length > 0 ? Math.max(...existing) + 1 : 1;
      docRef = `ACM-HR-CV-${String(nextNum).padStart(3, "0")}`;
    }

    const key = `${candidate.firstName}_${candidate.lastName}`.toLowerCase().replace(/[^a-z_]/g, "");
    const jsonPath = path.join(candidatesDir, `${key}.json`);
    const uploadedFile = req.file.path;

    // Step 1 — extract text and parse into structured JSON via Python
    try {
      const extractResult = execSync(
        `python3 ${path.join(cvBase, "extract_cv.py")} "${uploadedFile}" "${jsonPath}" "${key}" "${docRef}"`,
        { cwd: cvBase, timeout: 60000 }
      ).toString().trim();

      const parsed = JSON.parse(extractResult);
      if (!parsed.success) {
        return res.status(422).json({ error: parsed.error || "Text extraction failed" });
      }
    } catch (err: any) {
      const msg = err.stdout?.toString() || err.message || "Extraction failed";
      return res.status(500).json({ error: "CV extraction failed", detail: msg });
    }

    // Step 2 — generate ACM-branded PDFs
    try {
      execSync(`python3 ${path.join(cvBase, "generate_cv.py")} ${key}`, {
        cwd: cvBase, timeout: 30000,
      });
    } catch (err: any) {
      return res.status(500).json({ error: "CV generation failed", detail: err.message });
    }

    // Step 3 — read back candidate JSON to update profile fields
    let cvData: any = {};
    try { cvData = JSON.parse(fs.readFileSync(jsonPath, "utf8")); } catch {}

    const clientPdf   = path.join(outputClient,   `${docRef}_client.pdf`);
    const internalPdf = path.join(outputInternal, `${docRef}_internal.pdf`);

    // Update candidate record with extracted data + CV refs
    const cand = cvData.candidate || {};
    const updatePayload: any = {
      docRef,
      cvClientUrl:   fs.existsSync(clientPdf)   ? `/cv-output/client/${docRef}_client.pdf`   : null,
      cvInternalUrl: fs.existsSync(internalPdf) ? `/cv-output/internal/${docRef}_internal.pdf` : null,
      cvGeneratedAt: new Date().toISOString(),
      rawCvUrl:      c.rawCvUrl || null,
    };
    if (cand.address && !c.address)  updatePayload.address   = cand.address;
    if (cand.phone   && !c.phone)    updatePayload.phone     = cand.phone;
    if (cand.email   && !c.email)    updatePayload.email     = cand.email;
    if (cand.objective && !c.objective) updatePayload.objective = cand.objective;
    if (cand.visa)    updatePayload.visaDetails  = cand.visa;
    if (cand.availability) updatePayload.availability = cand.availability;
    if (cvData.employment?.length)   updatePayload.employmentHistory = JSON.stringify(cvData.employment);
    if (cvData.certifications?.length) updatePayload.certifications  = JSON.stringify(cvData.certifications);
    if (cvData.skills?.length)       updatePayload.skills            = JSON.stringify(cvData.skills);
    if (cand.positions?.length)      updatePayload.trade             = cand.positions[0];

    storage.updateCandidate(Number(req.params.id), updatePayload);

    // Clean up uploaded temp file
    try { fs.unlinkSync(uploadedFile); } catch {}

    res.json({
      success: true,
      docRef,
      clientPdf:   updatePayload.cvClientUrl,
      internalPdf: updatePayload.cvInternalUrl,
      extracted: {
        name:       cand.full_name,
        positions:  cand.positions,
        employment: cvData.employment?.length,
        certs:      cvData.certifications?.length,
      }
    });
  });

  // Generate ACM-branded CV via Python script
  app.post("/api/candidates/:id/generate-cv", async (req, res) => {
    const candidate = storage.getCandidateById(Number(req.params.id));
    if (!candidate) return res.status(404).json({ error: "Candidate not found" });

    const { execSync } = require("child_process");
    const fs = require("fs");
    const path = require("path");

    const cvBase = path.resolve(__dirname, "../ACM_CV_System");
    const candidatesDir = path.join(cvBase, "candidates");
    const outputClient   = path.join(cvBase, "output/client");
    const outputInternal = path.join(cvBase, "output/internal");

    fs.mkdirSync(candidatesDir,  { recursive: true });
    fs.mkdirSync(outputClient,   { recursive: true });
    fs.mkdirSync(outputInternal, { recursive: true });

    // Assign doc ref
    const existing = fs.readdirSync(candidatesDir)
      .filter((f: string) => f.endsWith(".json"))
      .map((f: string) => {
        const d = JSON.parse(fs.readFileSync(path.join(candidatesDir, f), "utf8"));
        return d._meta?.doc_ref ?? "";
      })
      .filter((r: string) => r.startsWith("ACM-HR-CV-"))
      .map((r: string) => parseInt(r.replace("ACM-HR-CV-", ""), 10))
      .filter((n: number) => !isNaN(n));
    const nextNum = existing.length > 0 ? Math.max(...existing) + 1 : 1;
    const docRef = `ACM-HR-CV-${String(nextNum).padStart(3, "0")}`;

    const key = `${candidate.firstName}_${candidate.lastName}`.toLowerCase().replace(/[^a-z_]/g, "");

    // Parse JSON fields safely
    const parseJ = (v: any) => { try { return JSON.parse(v || "[]"); } catch { return []; } };
    const tickets = parseJ(candidate.tickets);
    const employment = parseJ((candidate as any).employmentHistory);
    const certifications = parseJ((candidate as any).certifications);
    const skills = parseJ((candidate as any).skills);

    // Build CV data JSON
    const cvData = {
      _meta: {
        doc_ref: docRef,
        date: new Date().toLocaleDateString("en-AU", { month: "long", year: "numeric" }),
        classification: "ACM INTERNAL — PERSONNEL FILE",
        submitted_by: "ACM Resources (Australia) Pty Ltd",
        contact: "jobs@acmresources.com.au",
      },
      candidate: {
        full_name: `${candidate.firstName} ${candidate.lastName}`,
        address: (candidate as any).address || "",
        phone: candidate.phone || "",
        email: candidate.email || "",
        visa: (candidate as any).visaDetails || "",
        availability: (candidate as any).availability || "Full Time",
        positions: candidate.trade ? [candidate.trade, candidate.classification].filter(Boolean) : ["Trade Specialist"],
        objective: (candidate as any).objective || `${candidate.firstName} ${candidate.lastName} is an experienced ${candidate.trade} with a strong background in mining and civil construction. Available for immediate placement through ACM Resources.`,
      },
      employment: employment.length > 0 ? employment : [{
        employer: "Previous Employment",
        role: candidate.trade,
        location: candidate.location || "Western Australia",
        start: "2020",
        end: "Present",
        duties: ["Performed duties as per role requirements.", "Maintained compliance with site safety standards."],
      }],
      skills: skills.length > 0 ? skills : [
        { area: "Trade", detail: `Experienced ${candidate.trade}${candidate.classification ? " — " + candidate.classification : ""}` },
        ...(tickets.map((t: string) => ({ area: "Ticket / Licence", detail: t }))),
      ],
      certifications: certifications.length > 0 ? certifications : tickets.map((t: string) => ({
        ticket: t,
        category: t.toLowerCase().includes("white card") ? "Safety"
          : t.toLowerCase().includes("first aid") ? "Safety"
          : t.toLowerCase().includes("licence") || t.toLowerCase().includes("license") ? "Licence"
          : "Competency",
        details: t,
      })),
      referees: "Professional references available upon request. Please contact ACM Resources to facilitate introduction.",
    };

    const jsonPath = path.join(candidatesDir, `${key}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(cvData, null, 2));

    try {
      execSync(`python3 ${path.join(cvBase, "generate_cv.py")} ${key}`, {
        cwd: cvBase, timeout: 30000,
      });
    } catch (err: any) {
      return res.status(500).json({ error: "CV generation failed", detail: err.message });
    }

    const clientPdf   = path.join(outputClient,   `${docRef}_client.pdf`);
    const internalPdf = path.join(outputInternal, `${docRef}_internal.pdf`);

    // Update candidate record with doc ref and generated timestamp
    storage.updateCandidate(Number(req.params.id), {
      ...(candidate as any),
      docRef,
      cvGeneratedAt: new Date().toISOString(),
    });

    res.json({
      success: true,
      docRef,
      clientPdf:   fs.existsSync(clientPdf)   ? `/cv-output/client/${docRef}_client.pdf`   : null,
      internalPdf: fs.existsSync(internalPdf) ? `/cv-output/internal/${docRef}_internal.pdf` : null,
    });
  });

  // Share candidate CV/profile via email (Outlook via Microsoft Graph)
  app.post("/api/candidates/:id/share-cv", async (req, res) => {
    const candidate = storage.getCandidateById(Number(req.params.id));
    if (!candidate) return res.status(404).json({ error: "Candidate not found" });

    const { to, subject, body } = req.body;
    if (!to) return res.status(400).json({ error: "Recipient email required" });

    const c = candidate as any;
    const nodemailer = (() => { try { return require("nodemailer"); } catch { return null; } })();
    const path = require("path");
    const fs = require("fs");

    // Build attachments list — attach client PDF if it exists
    const attachments: any[] = [];
    if (c.docRef && c.cvClientUrl) {
      const clientPdfPath = path.resolve(
        __dirname,
        `../ACM_CV_System/output/client/${c.docRef}_client.pdf`
      );
      if (fs.existsSync(clientPdfPath)) {
        attachments.push({
          filename: `${c.docRef}_ACM_CV_Client.pdf`,
          path: clientPdfPath,
          contentType: "application/pdf",
        });
      }
    }

    // Attempt to send via SMTP env vars (set SMTP_HOST, SMTP_USER, SMTP_PASS on Railway)
    // Falls back to a JSON success response so UI still works in dev (no SMTP configured)
    if (!process.env.SMTP_HOST) {
      // No SMTP configured — log and return success (dev mode)
      console.log(`[share-cv] SMTP not configured. Would send to: ${to}`);
      console.log(`[share-cv] Subject: ${subject}`);
      console.log(`[share-cv] Body:\n${body}`);
      return res.json({
        success: true,
        note: "SMTP not configured — email logged to server console. Set SMTP_HOST, SMTP_USER, SMTP_PASS env vars on Railway to enable live sending.",
      });
    }

    if (!nodemailer) {
      return res.status(500).json({ error: "nodemailer not installed" });
    }

    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      await transporter.sendMail({
        from: process.env.SMTP_FROM ?? `"ACM Resources" <${process.env.SMTP_USER}>`,
        to,
        subject,
        text: body,
        html: `<pre style="font-family:sans-serif;white-space:pre-wrap">${body}</pre>`,
        attachments,
      });

      res.json({ success: true, to, attachmentCount: attachments.length });
    } catch (err: any) {
      res.status(500).json({ error: "Email send failed", detail: err.message });
    }
  });

  // Serve generated CV PDFs
  app.use("/cv-output", require("express").static(
    require("path").resolve(__dirname, "../ACM_CV_System/output")
  ));
  // Serve application uploads
  app.use("/uploads", require("express").static(
    require("path").resolve(__dirname, "../ACM_CV_System/uploads")
  ));

  // ── JOB ADS (admin) ─────────────────────────────────────
  // Normalise DB snake_case -> camelCase for frontend
  function normalizeJob(j: any) {
    if (!j) return j;
    return {
      id: j.id, title: j.title, trade: j.trade, location: j.location,
      projectName: j.project_name || null,
      description: j.description, requirements: j.requirements || null,
      payRate: j.pay_rate || (j.rate_from ? `$${j.rate_from}${j.rate_to ? `-$${j.rate_to}` : ''}/${j.rate_type||'hr'}` : null),
      employmentType: j.employment_type || 'Casual',
      published: j.status === 'published', status: j.status,
      applicationCount: j.application_count || 0,
      createdAt: j.created_at || new Date().toISOString(),
      updatedAt: j.updated_at || j.created_at || new Date().toISOString(),
    };
  }
  function normalizeApp(a: any) {
    if (!a) return a;
    return {
      id: a.id, jobId: a.job_id, jobTitle: a.job_title || null,
      firstName: a.first_name, lastName: a.last_name,
      email: a.email, phone: a.phone, address: a.address || null,
      rightToWork: a.right_to_work || null, visaDetails: a.visa_details || null,
      experience: a.years_experience || null, coverLetter: a.cover_letter || null,
      availability: a.availability || null,
      cvFilePath: a.cv_file_path || null, tickets: a.tickets_file_paths || null,
      status: a.status || 'new', candidateId: a.candidate_id || null,
      createdAt: a.created_at || new Date().toISOString(),
    };
  }

  app.get("/api/jobs", (_req, res) => res.json((storage.getJobAds() as any[]).map(normalizeJob)));
  app.get("/api/jobs/public", (_req, res) => res.json((storage.getPublishedJobAds() as any[]).map(normalizeJob)));
  app.get("/api/jobs/:id", (req, res) => {
    const j = normalizeJob(storage.getJobAdById(Number(req.params.id)));
    if (!j) return res.status(404).json({ message: "Job not found" });
    res.json(j);
  });
  // Map frontend camelCase fields -> storage snake_case fields
  function mapJobBody(raw: any) {
    const body: any = { ...raw };
    // published boolean -> status string
    if (typeof body.published !== 'undefined') {
      body.status = body.published ? 'published' : 'draft';
      delete body.published;
    }
    // projectName -> project_name (for SQL)
    if (body.projectName !== undefined) {
      body.project_name = body.projectName;
    }
    // payRate string -> store in description prefix; also set rate_type
    if (body.payRate !== undefined) {
      body.pay_rate = body.payRate;
      // Try to parse "$45/hr" or "$45-$55/hr" for rate_from/rate_to
      const m = String(body.payRate).match(/\$?(\d+(?:\.\d+)?)(?:\s*[-–]\s*\$?(\d+(?:\.\d+)?))?/);
      if (m) {
        body.rateFrom = m[1];
        body.rateTo = m[2] || null;
      }
      body.rateType = body.payRate.toLowerCase().includes('day') ? 'daily' : 'hourly';
    }
    // employmentType -> also set employment_type for storage
    if (body.employmentType !== undefined) {
      body.employment_type = body.employmentType;
    }
    return body;
  }

  app.post("/api/jobs", (req, res) => {
    const body = mapJobBody(req.body);
    const j = normalizeJob(storage.createJobAd(body));
    res.status(201).json(j);
  });
  app.patch("/api/jobs/:id", (req, res) => {
    const body = mapJobBody(req.body);
    const j = normalizeJob(storage.updateJobAd(Number(req.params.id), body));
    if (!j) return res.status(404).json({ message: "Job not found" });
    res.json(j);
  });
  app.delete("/api/jobs/:id", (req, res) => {
    storage.deleteJobAd(Number(req.params.id));
    res.json({ success: true });
  });

  // ── JOB APPLICATIONS ───────────────────────────────────
  const appMulter = require("multer");
  const appUploadDir = require("path").resolve(__dirname, "../ACM_CV_System/uploads");
  require("fs").mkdirSync(appUploadDir, { recursive: true });
  const appUpload = appMulter({
    storage: appMulter.diskStorage({
      destination: (_req: any, _file: any, cb: any) => cb(null, appUploadDir),
      filename: (_req: any, file: any, cb: any) => {
        const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        cb(null, `${Date.now()}_${safe}`);
      },
    }),
    limits: { fileSize: 20 * 1024 * 1024 },
  });

  app.get("/api/jobs/:id/applications", (req, res) => {
    res.json(storage.getApplicationsByJob(Number(req.params.id)));
  });
  app.get("/api/applications", (_req, res) => res.json((storage.getAllApplications() as any[]).map(normalizeApp)));
  app.get("/api/applications/:id", (req, res) => {
    const a = storage.getApplicationById(Number(req.params.id));
    if (!a) return res.status(404).json({ message: "Not found" });
    res.json(a);
  });
  app.patch("/api/applications/:id", (req, res) => {
    const a = storage.updateApplication(Number(req.params.id), req.body);
    if (!a) return res.status(404).json({ message: "Not found" });
    res.json(a);
  });

  // Public apply — accepts multipart (CV + ticket files)
  app.post("/api/jobs/:id/apply", appUpload.fields([
    { name: 'cv', maxCount: 1 },
    { name: 'tickets', maxCount: 10 },
  ]), async (req: any, res) => {
    const job = storage.getJobAdById(Number(req.params.id));
    if (!job || job.status !== 'published') return res.status(404).json({ error: "Job not found or not open" });

    const body = req.body;
    if (!body.firstName || !body.lastName || !body.email || !body.phone) {
      return res.status(400).json({ error: "First name, last name, email and phone are required" });
    }

    const cvFile = req.files?.cv?.[0];
    const ticketFiles: any[] = req.files?.tickets || [];

    const appData = {
      jobId: Number(req.params.id),
      firstName: body.firstName.trim(),
      lastName: body.lastName.trim(),
      email: body.email.trim().toLowerCase(),
      phone: body.phone.trim(),
      address: body.address || null,
      rightToWork: body.rightToWork || null,
      visaDetails: body.visaDetails || null,
      yearsExperience: body.yearsExperience || null,
      currentEmployer: body.currentEmployer || null,
      availability: body.availability || null,
      availableDate: body.availableDate || null,
      roster: body.roster || null,
      tickets: body.tickets || null,
      cvFileName: cvFile?.originalname || null,
      cvFilePath: cvFile ? `/uploads/${cvFile.filename}` : null,
      ticketsFilePaths: ticketFiles.length ? JSON.stringify(ticketFiles.map((f: any) => `/uploads/${f.filename}`)) : null,
    };

    const application = storage.createApplication(appData);

    // Auto-generate ACM CV from uploaded CV if provided
    if (cvFile) {
      try {
        const { execSync } = require("child_process");
        const path = require("path");
        const fs = require("fs");
        const cvBase = path.resolve(__dirname, "../ACM_CV_System");
        const candidatesDir = path.join(cvBase, "candidates");
        fs.mkdirSync(candidatesDir, { recursive: true });
        fs.mkdirSync(path.join(cvBase, "output/client"), { recursive: true });
        fs.mkdirSync(path.join(cvBase, "output/internal"), { recursive: true });

        // Find next doc ref
        const existingRefs = fs.readdirSync(candidatesDir)
          .filter((f: string) => f.endsWith(".json"))
          .map((f: string) => { try { return JSON.parse(fs.readFileSync(path.join(candidatesDir, f), "utf8"))._meta?.doc_ref ?? ""; } catch { return ""; } })
          .filter((r: string) => r.startsWith("ACM-HR-CV-"))
          .map((r: string) => parseInt(r.replace("ACM-HR-CV-", ""), 10))
          .filter((n: number) => !isNaN(n));
        const nextNum = existingRefs.length > 0 ? Math.max(...existingRefs) + 1 : 1;
        const docRef = `ACM-HR-CV-${String(nextNum).padStart(3, "0")}`;
        const key = `${appData.firstName}_${appData.lastName}`.toLowerCase().replace(/[^a-z_]/g, "");
        const jsonPath = path.join(candidatesDir, `${key}.json`);
        const uploadedPath = path.join(appUploadDir, cvFile.filename);

        const extractOut = execSync(
          `python3 ${path.join(cvBase, "extract_cv.py")} "${uploadedPath}" "${jsonPath}" "${key}" "${docRef}"`,
          { cwd: cvBase, timeout: 60000 }
        ).toString().trim();

        const extracted = JSON.parse(extractOut);
        if (extracted.success) {
          execSync(`python3 ${path.join(cvBase, "generate_cv.py")} ${key}`, { cwd: cvBase, timeout: 30000 });
          const clientPdf = `/cv-output/client/${docRef}_client.pdf`;
          const internalPdf = `/cv-output/internal/${docRef}_internal.pdf`;
          storage.updateApplication(application.id, { docRef, cvClientUrl: clientPdf, cvInternalUrl: internalPdf });

          // Also create a candidate profile automatically
          const cvData = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
          const cand = cvData.candidate || {};
          try {
            const newCandidate = storage.createCandidate({
              firstName: appData.firstName,
              lastName: appData.lastName,
              email: appData.email,
              phone: appData.phone,
              trade: (cand.positions || [job.trade])[0] || job.trade,
              status: 'available',
              location: appData.address || job.location,
              address: cand.address || appData.address,
              rightToWork: appData.rightToWork,
              visaDetails: appData.visaDetails,
              availability: appData.availability,
              objective: cand.objective,
              employmentHistory: JSON.stringify(cvData.employment || []),
              certifications: JSON.stringify(cvData.certifications || []),
              skills: JSON.stringify(cvData.skills || []),
              docRef,
              cvClientUrl: clientPdf,
              cvInternalUrl: internalPdf,
              cvGeneratedAt: new Date().toISOString(),
              sharepointFolderUrl: null,
              rawCvUrl: appData.cvFilePath,
              tickets: appData.tickets,
            } as any);
            storage.updateApplication(application.id, { candidateId: (newCandidate as any).id });
          } catch {}
        }
      } catch (e) {
        // CV generation failed silently — application still saved
      }
    }

    res.status(201).json({ success: true, applicationId: application.id, message: "Application received! We'll be in touch soon." });
  });

  // ── CLIENTS ──────────────────────────────────────────────────────
  app.get("/api/clients", (_req, res) => { res.json(storage.getClients()); });
  app.get("/api/clients/:id", (req, res) => {
    const c = storage.getClientById(Number(req.params.id));
    if (!c) return res.status(404).json({ message: "Not found" });
    res.json(c);
  });
  app.post("/api/clients", (req, res) => {
    const parsed = insertClientSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    res.status(201).json(storage.createClient(parsed.data));
  });
  app.patch("/api/clients/:id", (req, res) => {
    const updated = storage.updateClient(Number(req.params.id), req.body);
    if (!updated) return res.status(404).json({ message: "Not found" });
    res.json(updated);
  });
  app.delete("/api/clients/:id", (req, res) => {
    storage.deleteClient(Number(req.params.id));
    res.json({ success: true });
  });

  // ── PROJECTS ─────────────────────────────────────────────────────
  app.get("/api/projects", (_req, res) => { res.json(storage.getProjects()); });
  app.get("/api/projects/:id", (req, res) => {
    const p = storage.getProjectById(Number(req.params.id));
    if (!p) return res.status(404).json({ message: "Not found" });
    res.json(p);
  });
  app.post("/api/projects", (req, res) => {
    const parsed = insertProjectSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    res.status(201).json(storage.createProject(parsed.data));
  });
  app.patch("/api/projects/:id", (req, res) => {
    const updated = storage.updateProject(Number(req.params.id), req.body);
    if (!updated) return res.status(404).json({ message: "Not found" });
    res.json(updated);
  });
  app.delete("/api/projects/:id", (req, res) => {
    storage.deleteProject(Number(req.params.id));
    res.json({ success: true });
  });

  // ── PROJECT TASKS ─────────────────────────────────────────────────
  app.get("/api/projects/:id/tasks", (req, res) => {
    res.json(storage.getTasksByProject(Number(req.params.id)));
  });
  app.post("/api/projects/:id/tasks", (req, res) => {
    const parsed = insertProjectTaskSchema.safeParse({ ...req.body, projectId: Number(req.params.id) });
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    res.status(201).json(storage.createTask(parsed.data));
  });
  app.patch("/api/tasks/:id", (req, res) => {
    const updated = storage.updateTask(Number(req.params.id), req.body);
    if (!updated) return res.status(404).json({ message: "Not found" });
    res.json(updated);
  });
  app.delete("/api/tasks/:id", (req, res) => {
    storage.deleteTask(Number(req.params.id));
    res.json({ success: true });
  });

  // ── PROJECT RFIs ──────────────────────────────────────────────────
  app.get("/api/projects/:id/rfis", (req, res) => {
    res.json(storage.getRfisByProject(Number(req.params.id)));
  });
  app.post("/api/projects/:id/rfis", (req, res) => {
    const parsed = insertProjectRfiSchema.safeParse({ ...req.body, projectId: Number(req.params.id) });
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    res.status(201).json(storage.createRfi(parsed.data));
  });
  app.patch("/api/rfis/:id", (req, res) => {
    const updated = storage.updateRfi(Number(req.params.id), req.body);
    if (!updated) return res.status(404).json({ message: "Not found" });
    res.json(updated);
  });
  app.delete("/api/rfis/:id", (req, res) => {
    storage.deleteRfi(Number(req.params.id));
    res.json({ success: true });
  });

  // ── PROJECT NOTES ─────────────────────────────────────────────────
  app.get("/api/projects/:id/notes", (req, res) => {
    res.json(storage.getNotesByProject(Number(req.params.id)));
  });
  app.post("/api/projects/:id/notes", (req, res) => {
    const parsed = insertProjectNoteSchema.safeParse({ ...req.body, projectId: Number(req.params.id) });
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    res.status(201).json(storage.createNote(parsed.data));
  });
  app.delete("/api/notes/:id", (req, res) => {
    storage.deleteNote(Number(req.params.id));
    res.json({ success: true });
  });

  // ── PROJECT MILESTONES ────────────────────────────────────────────
  app.get("/api/projects/:id/milestones", (req, res) => {
    res.json(storage.getMilestonesByProject(Number(req.params.id)));
  });
  app.post("/api/projects/:id/milestones", (req, res) => {
    const parsed = insertProjectMilestoneSchema.safeParse({ ...req.body, projectId: Number(req.params.id) });
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    res.status(201).json(storage.createMilestone(parsed.data));
  });
  app.patch("/api/milestones/:id", (req, res) => {
    const updated = storage.updateMilestone(Number(req.params.id), req.body);
    if (!updated) return res.status(404).json({ message: "Not found" });
    res.json(updated);
  });
  app.delete("/api/milestones/:id", (req, res) => {
    storage.deleteMilestone(Number(req.params.id));
    res.json({ success: true });
  });

  // ── PLACEMENTS ───────────────────────────────────────────────────
  app.get("/api/placements", (_req, res) => { res.json(storage.getPlacements()); });
  app.get("/api/placements/:id", (req, res) => {
    const p = storage.getPlacementById(Number(req.params.id));
    if (!p) return res.status(404).json({ message: "Not found" });
    res.json(p);
  });
  app.post("/api/placements", (req, res) => {
    const parsed = insertPlacementSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    res.status(201).json(storage.createPlacement(parsed.data));
  });
  app.patch("/api/placements/:id", (req, res) => {
    const updated = storage.updatePlacement(Number(req.params.id), req.body);
    if (!updated) return res.status(404).json({ message: "Not found" });
    res.json(updated);
  });
  app.delete("/api/placements/:id", (req, res) => {
    storage.deletePlacement(Number(req.params.id));
    res.json({ success: true });
  });

  // ── QUOTES ───────────────────────────────────────────────────────
  app.get("/api/quotes", (_req, res) => { res.json(storage.getQuotes()); });
  app.get("/api/quotes/:id", (req, res) => {
    const q = storage.getQuoteById(Number(req.params.id));
    if (!q) return res.status(404).json({ message: "Not found" });
    res.json(q);
  });
  app.post("/api/quotes", (req, res) => {
    const parsed = insertQuoteSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    res.status(201).json(storage.createQuote(parsed.data));
  });
  app.patch("/api/quotes/:id", (req, res) => {
    const updated = storage.updateQuote(Number(req.params.id), req.body);
    if (!updated) return res.status(404).json({ message: "Not found" });
    res.json(updated);
  });
  app.delete("/api/quotes/:id", (req, res) => {
    storage.deleteQuote(Number(req.params.id));
    res.json({ success: true });
  });

  // ── XERO FINANCE ─────────────────────────────────────────
  // GET all invoices
  app.get("/api/xero/invoices", (_req, res) => {
    res.json((storage as any).getXeroInvoices());
  });
  // GET invoices for a specific project
  app.get("/api/xero/invoices/project/:id", (req, res) => {
    res.json((storage as any).getXeroInvoicesByProject(Number(req.params.id)));
  });
  // GET AR summary totals
  app.get("/api/xero/summary", (_req, res) => {
    res.json((storage as any).getXeroInvoiceSummary());
  });
  // GET contacts
  app.get("/api/xero/contacts", (_req, res) => {
    res.json((storage as any).getXeroContacts());
  });
  // POST sync — accepts batched invoice + contact data from external sync
  app.post("/api/xero/sync", (req, res) => {
    const { invoices = [], contacts = [] } = req.body;
    const syncedAt = new Date().toISOString();
    let invoicesSynced = 0;
    let contactsSynced = 0;
    for (const inv of invoices) {
      try {
        (storage as any).upsertXeroInvoice({ ...inv, syncedAt });
        invoicesSynced++;
      } catch (e) { /* skip bad records */ }
    }
    for (const c of contacts) {
      try {
        (storage as any).upsertXeroContact({ ...c, syncedAt });
        contactsSynced++;
      } catch (e) { /* skip */ }
    }
    res.json({ success: true, invoicesSynced, contactsSynced, syncedAt });
  });

  // ── TIMESHEETS ───────────────────────────────────────────────────
  app.get("/api/timesheets", (_req, res) => { res.json(storage.getTimesheets()); });
  app.get("/api/timesheets/:id", (req, res) => {
    const t = storage.getTimesheetById(Number(req.params.id));
    if (!t) return res.status(404).json({ message: "Not found" });
    res.json(t);
  });
  app.post("/api/timesheets", (req, res) => {
    const parsed = insertTimesheetSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    res.status(201).json(storage.createTimesheet(parsed.data));
  });
  app.patch("/api/timesheets/:id", (req, res) => {
    const updated = storage.updateTimesheet(Number(req.params.id), req.body);
    if (!updated) return res.status(404).json({ message: "Not found" });
    res.json(updated);
  });
  app.delete("/api/timesheets/:id", (req, res) => {
    storage.deleteTimesheet(Number(req.params.id));
    res.json({ success: true });
  });
}
