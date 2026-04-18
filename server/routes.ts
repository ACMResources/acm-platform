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

  // ── CANDIDATES ───────────────────────────────────────────────────
  app.get("/api/candidates", (_req, res) => { res.json(storage.getCandidates()); });
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
