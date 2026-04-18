import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ── CANDIDATES ─────────────────────────────────────────────────────
export const candidates = sqliteTable("candidates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  trade: text("trade").notNull(), // Poly Welder, Civil Operator, PM, Supervisor, etc.
  classification: text("classification"), // e.g. CW3, EW3
  status: text("status").notNull().default("available"), // available | placed | unavailable | blacklisted
  location: text("location"), // Perth, FIFO, etc.
  tickets: text("tickets"), // JSON array of ticket names
  notes: text("notes"),
  createdAt: text("created_at").notNull().default(""),
});

export const insertCandidateSchema = createInsertSchema(candidates).omit({ id: true, createdAt: true });
export type InsertCandidate = z.infer<typeof insertCandidateSchema>;
export type Candidate = typeof candidates.$inferSelect;

// ── CLIENTS ────────────────────────────────────────────────────────
export const clients = sqliteTable("clients", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  tier: text("tier").notNull().default("Tier 2"), // Tier 1 | Tier 2 | Tier 3
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  industry: text("industry"), // Mining | Civil | Oil & Gas | Water | Rail
  state: text("state"),
  notes: text("notes"),
  createdAt: text("created_at").notNull().default(""),
});

export const insertClientSchema = createInsertSchema(clients).omit({ id: true, createdAt: true });
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clients.$inferSelect;

// ── PROJECTS ───────────────────────────────────────────────────────
export const projects = sqliteTable("projects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: integer("client_id").notNull(),
  name: text("name").notNull(),
  location: text("location"),
  scope: text("scope"), // Labour Hire | HDPE Pipeline | Civil | Shutdown | Mixed
  status: text("status").notNull().default("active"), // active | completed | pending | cancelled
  startDate: text("start_date"),
  endDate: text("end_date"),
  contractValue: real("contract_value"),
  headcount: integer("headcount").default(0),
  notes: text("notes"),
  createdAt: text("created_at").notNull().default(""),
});

export const insertProjectSchema = createInsertSchema(projects).omit({ id: true, createdAt: true });
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;

// ── PLACEMENTS ─────────────────────────────────────────────────────
export const placements = sqliteTable("placements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  candidateId: integer("candidate_id").notNull(),
  clientId: integer("client_id").notNull(),
  projectId: integer("project_id"),
  type: text("type").notNull().default("casual"), // casual | permanent
  role: text("role").notNull(),
  startDate: text("start_date"),
  endDate: text("end_date"),
  rate: real("rate"), // hourly or weekly
  rateType: text("rate_type").default("hourly"), // hourly | weekly | daily
  status: text("status").notNull().default("active"), // active | completed | cancelled
  notes: text("notes"),
  createdAt: text("created_at").notNull().default(""),
});

export const insertPlacementSchema = createInsertSchema(placements).omit({ id: true, createdAt: true });
export type InsertPlacement = z.infer<typeof insertPlacementSchema>;
export type Placement = typeof placements.$inferSelect;

// ── QUOTES / ESTIMATION ────────────────────────────────────────────
export const quotes = sqliteTable("quotes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: integer("client_id"),
  clientName: text("client_name").notNull(), // allow freetext for new clients
  projectName: text("project_name").notNull(),
  location: text("location"),
  scope: text("scope"),
  lineItems: text("line_items").notNull().default("[]"), // JSON array
  subtotal: real("subtotal").default(0),
  margin: real("margin").default(20), // percentage
  total: real("total").default(0),
  status: text("status").notNull().default("draft"), // draft | sent | accepted | declined
  validUntil: text("valid_until"),
  notes: text("notes"),
  createdAt: text("created_at").notNull().default(""),
});

export const insertQuoteSchema = createInsertSchema(quotes).omit({ id: true, createdAt: true });
export type InsertQuote = z.infer<typeof insertQuoteSchema>;
export type Quote = typeof quotes.$inferSelect;

// ── TIMESHEET ENTRIES ──────────────────────────────────────────────
export const timesheets = sqliteTable("timesheets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  candidateId: integer("candidate_id").notNull(),
  projectId: integer("project_id"),
  placementId: integer("placement_id"),
  weekEnding: text("week_ending").notNull(),
  hoursMonday: real("hours_monday").default(0),
  hoursTuesday: real("hours_tuesday").default(0),
  hoursWednesday: real("hours_wednesday").default(0),
  hoursThursday: real("hours_thursday").default(0),
  hoursFriday: real("hours_friday").default(0),
  hoursSaturday: real("hours_saturday").default(0),
  hoursSunday: real("hours_sunday").default(0),
  totalHours: real("total_hours").default(0),
  status: text("status").notNull().default("pending"), // pending | approved | invoiced
  notes: text("notes"),
  createdAt: text("created_at").notNull().default(""),
});

export const insertTimesheetSchema = createInsertSchema(timesheets).omit({ id: true, createdAt: true });
export type InsertTimesheet = z.infer<typeof insertTimesheetSchema>;
export type Timesheet = typeof timesheets.$inferSelect;

// ── QUOTE LINE ITEM TYPE (frontend only) ───────────────────────────
export interface QuoteLineItem {
  id: string;
  description: string;
  trade: string;
  headcount: number;
  hours: number;
  rate: number;
  total: number;
}
