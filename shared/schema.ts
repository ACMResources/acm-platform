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
  trade: text("trade").notNull(),
  classification: text("classification"),
  status: text("status").notNull().default("available"),
  location: text("location"),
  tickets: text("tickets"),           // JSON array of ticket/licence strings
  notes: text("notes"),
  // Extended profile fields
  address: text("address"),
  dateOfBirth: text("date_of_birth"),
  emergencyContact: text("emergency_contact"),  // JSON {name, phone, relation}
  rightToWork: text("right_to_work"),           // citizen | PR | visa
  visaDetails: text("visa_details"),
  availability: text("availability"),           // full_time | part_time | casual | unavailable
  preferredRoster: text("preferred_roster"),    // 2/1 | 3/1 | 4/1 | residential etc
  objective: text("objective"),                 // professional summary
  employmentHistory: text("employment_history"), // JSON array of employment records
  certifications: text("certifications"),       // JSON array of cert records (structured)
  skills: text("skills"),                       // JSON array of {area, detail}
  // ACM CV / Document tracking
  docRef: text("doc_ref"),                      // ACM-HR-CV-001 etc
  cvClientUrl: text("cv_client_url"),           // SharePoint URL for client PDF
  cvInternalUrl: text("cv_internal_url"),       // SharePoint URL for internal PDF
  sharepointFolderUrl: text("sharepoint_folder_url"), // HR SharePoint folder link
  rawCvUrl: text("raw_cv_url"),                 // Original CV SharePoint URL
  linkedinUrl: text("linkedin_url"),
  cvGeneratedAt: text("cv_generated_at"),
  createdAt: text("created_at").notNull().default(""),
});

export const insertCandidateSchema = createInsertSchema(candidates).omit({ id: true, createdAt: true });
export type InsertCandidate = z.infer<typeof insertCandidateSchema>;
export type Candidate = typeof candidates.$inferSelect;

// ── CLIENTS ────────────────────────────────────────────────────────
export const clients = sqliteTable("clients", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  tier: text("tier").notNull().default("Tier 2"),
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  industry: text("industry"),
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
  scope: text("scope"),
  status: text("status").notNull().default("active"),
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

// ── PROJECT TASKS ──────────────────────────────────────────────────
export const projectTasks = sqliteTable("project_tasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  assignedTo: text("assigned_to"),   // free text name
  priority: text("priority").notNull().default("medium"), // low | medium | high | critical
  status: text("status").notNull().default("open"),       // open | in_progress | done | cancelled
  dueDate: text("due_date"),
  createdAt: text("created_at").notNull().default(""),
});

export const insertProjectTaskSchema = createInsertSchema(projectTasks).omit({ id: true, createdAt: true });
export type InsertProjectTask = z.infer<typeof insertProjectTaskSchema>;
export type ProjectTask = typeof projectTasks.$inferSelect;

// ── PROJECT RFIs ───────────────────────────────────────────────────
export const projectRfis = sqliteTable("project_rfis", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").notNull(),
  rfiNumber: text("rfi_number"),      // e.g. RFI-001
  subject: text("subject").notNull(),
  question: text("question").notNull(),
  raisedBy: text("raised_by"),
  assignedTo: text("assigned_to"),
  dueDate: text("due_date"),
  response: text("response"),
  status: text("status").notNull().default("open"), // open | under_review | answered | closed
  createdAt: text("created_at").notNull().default(""),
});

export const insertProjectRfiSchema = createInsertSchema(projectRfis).omit({ id: true, createdAt: true });
export type InsertProjectRfi = z.infer<typeof insertProjectRfiSchema>;
export type ProjectRfi = typeof projectRfis.$inferSelect;

// ── PROJECT NOTES ──────────────────────────────────────────────────
export const projectNotes = sqliteTable("project_notes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").notNull(),
  author: text("author").notNull().default("Lydon Hollitt"),
  body: text("body").notNull(),
  createdAt: text("created_at").notNull().default(""),
});

export const insertProjectNoteSchema = createInsertSchema(projectNotes).omit({ id: true, createdAt: true });
export type InsertProjectNote = z.infer<typeof insertProjectNoteSchema>;
export type ProjectNote = typeof projectNotes.$inferSelect;

// ── MILESTONES ─────────────────────────────────────────────────────
export const projectMilestones = sqliteTable("project_milestones", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").notNull(),
  title: text("title").notNull(),
  targetDate: text("target_date"),
  completedDate: text("completed_date"),
  status: text("status").notNull().default("pending"), // pending | achieved | overdue
  createdAt: text("created_at").notNull().default(""),
});

export const insertProjectMilestoneSchema = createInsertSchema(projectMilestones).omit({ id: true, createdAt: true });
export type InsertProjectMilestone = z.infer<typeof insertProjectMilestoneSchema>;
export type ProjectMilestone = typeof projectMilestones.$inferSelect;

// ── PLACEMENTS ─────────────────────────────────────────────────────
export const placements = sqliteTable("placements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  candidateId: integer("candidate_id").notNull(),
  clientId: integer("client_id").notNull(),
  projectId: integer("project_id"),
  type: text("type").notNull().default("casual"),
  role: text("role").notNull(),
  startDate: text("start_date"),
  endDate: text("end_date"),
  rate: real("rate"),
  rateType: text("rate_type").default("hourly"),
  status: text("status").notNull().default("active"),
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
  clientName: text("client_name").notNull(),
  projectName: text("project_name").notNull(),
  location: text("location"),
  scope: text("scope"),
  lineItems: text("line_items").notNull().default("[]"),
  subtotal: real("subtotal").default(0),
  margin: real("margin").default(20),
  total: real("total").default(0),
  status: text("status").notNull().default("draft"),
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
  status: text("status").notNull().default("pending"),
  notes: text("notes"),
  createdAt: text("created_at").notNull().default(""),
});

export const insertTimesheetSchema = createInsertSchema(timesheets).omit({ id: true, createdAt: true });
export type InsertTimesheet = z.infer<typeof insertTimesheetSchema>;
export type Timesheet = typeof timesheets.$inferSelect;

// ── XERO INVOICES (synced from Xero) ─────────────────────────────
export const xeroInvoices = sqliteTable("xero_invoices", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  xeroInvoiceId: text("xero_invoice_id").notNull().unique(),
  invoiceNumber: text("invoice_number"),
  reference: text("reference"),
  contactId: text("contact_id"),
  contactName: text("contact_name"),
  // Tracking category match
  trackingOption: text("tracking_option"), // e.g. "P0139 - PPS - Cloudbreak"
  projectId: integer("project_id"),        // matched ACM project
  status: text("status").notNull().default("AUTHORISED"), // DRAFT | AUTHORISED | PAID | VOIDED
  type: text("type").notNull().default("ACCREC"),         // ACCREC | ACCPAY
  date: text("date"),
  dueDate: text("due_date"),
  subTotal: real("sub_total").default(0),
  totalTax: real("total_tax").default(0),
  total: real("total").default(0),
  amountDue: real("amount_due").default(0),
  amountPaid: real("amount_paid").default(0),
  currencyCode: text("currency_code").default("AUD"),
  lineItemsJson: text("line_items_json").default("[]"),
  syncedAt: text("synced_at").notNull().default(""),
});

export const insertXeroInvoiceSchema = createInsertSchema(xeroInvoices).omit({ id: true });
export type InsertXeroInvoice = z.infer<typeof insertXeroInvoiceSchema>;
export type XeroInvoice = typeof xeroInvoices.$inferSelect;

// ── XERO CONTACTS (synced from Xero) ──────────────────────────────
export const xeroContacts = sqliteTable("xero_contacts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  xeroContactId: text("xero_contact_id").notNull().unique(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  city: text("city"),
  state: text("state"),
  isCustomer: integer("is_customer", { mode: "boolean" }).default(false),
  isSupplier: integer("is_supplier", { mode: "boolean" }).default(false),
  outstandingAR: real("outstanding_ar").default(0),
  overdueAR: real("overdue_ar").default(0),
  clientId: integer("client_id"),  // matched ACM client
  syncedAt: text("synced_at").notNull().default(""),
});

export const insertXeroContactSchema = createInsertSchema(xeroContacts).omit({ id: true });
export type InsertXeroContact = z.infer<typeof insertXeroContactSchema>;
export type XeroContact = typeof xeroContacts.$inferSelect;

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
