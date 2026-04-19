import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import {
  insertCandidateSchema, insertClientSchema, insertProjectSchema,
  insertPlacementSchema, insertQuoteSchema, insertTimesheetSchema,
  insertProjectTaskSchema, insertProjectRfiSchema, insertProjectNoteSchema,
  insertProjectMilestoneSchema,
} from "@shared/schema";

export async function registerRoutes(httpServer: Server, app: Express): Promise<void> {

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

  // Generate ACM-branded CV via Python script
  app.post("/api/candidates/:id/generate-cv", async (req, res) => {
    const candidate = storage.getCandidateById(Number(req.params.id));
    if (!candidate) return res.status(404).json({ error: "Candidate not found" });

    const { execSync } = require("child_process");
    const fs = require("fs");
    const path = require("path");

    const cvBase = path.resolve(__dirname, "../../ACM_CV_System");
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
        `../../ACM_CV_System/output/client/${c.docRef}_client.pdf`
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
    require("path").resolve(__dirname, "../../ACM_CV_System/output")
  ));

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
