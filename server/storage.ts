import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, desc, like, and } from "drizzle-orm";
import {
  candidates, clients, projects, placements, quotes, timesheets,
  type Candidate, type InsertCandidate,
  type Client, type InsertClient,
  type Project, type InsertProject,
  type Placement, type InsertPlacement,
  type Quote, type InsertQuote,
  type Timesheet, type InsertTimesheet,
} from "@shared/schema";

const sqlite = new Database("acm.db");
export const db = drizzle(sqlite);

// ── Create tables ──────────────────────────────────────────────────
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS candidates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    trade TEXT NOT NULL,
    classification TEXT,
    status TEXT NOT NULL DEFAULT 'available',
    location TEXT,
    tickets TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    tier TEXT NOT NULL DEFAULT 'Tier 2',
    contact_name TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    industry TEXT,
    state TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    location TEXT,
    scope TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    start_date TEXT,
    end_date TEXT,
    contract_value REAL,
    headcount INTEGER DEFAULT 0,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS placements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    candidate_id INTEGER NOT NULL,
    client_id INTEGER NOT NULL,
    project_id INTEGER,
    type TEXT NOT NULL DEFAULT 'casual',
    role TEXT NOT NULL,
    start_date TEXT,
    end_date TEXT,
    rate REAL,
    rate_type TEXT DEFAULT 'hourly',
    status TEXT NOT NULL DEFAULT 'active',
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS quotes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER,
    client_name TEXT NOT NULL,
    project_name TEXT NOT NULL,
    location TEXT,
    scope TEXT,
    line_items TEXT NOT NULL DEFAULT '[]',
    subtotal REAL DEFAULT 0,
    margin REAL DEFAULT 20,
    total REAL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'draft',
    valid_until TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS timesheets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    candidate_id INTEGER NOT NULL,
    project_id INTEGER,
    placement_id INTEGER,
    week_ending TEXT NOT NULL,
    hours_monday REAL DEFAULT 0,
    hours_tuesday REAL DEFAULT 0,
    hours_wednesday REAL DEFAULT 0,
    hours_thursday REAL DEFAULT 0,
    hours_friday REAL DEFAULT 0,
    hours_saturday REAL DEFAULT 0,
    hours_sunday REAL DEFAULT 0,
    total_hours REAL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// ── Seed demo data ─────────────────────────────────────────────────
const existingCandidates = sqlite.prepare("SELECT COUNT(*) as count FROM candidates").get() as { count: number };
if (existingCandidates.count === 0) {
  sqlite.exec(`
    INSERT INTO candidates (first_name, last_name, email, phone, trade, classification, status, location, tickets) VALUES
    ('Aaron', 'Holder', 'aaron.holder@email.com', '0411 111 001', 'Poly Welder', 'CW3', 'placed', 'FIFO - Pilbara', '["Working at Heights","Confined Space","EWP","White Card"]'),
    ('Umut', 'Korkmaz', 'umut.korkmaz@email.com', '0411 111 002', 'Poly Welder', 'CW3', 'placed', 'FIFO - Pilbara', '["Working at Heights","White Card","First Aid"]'),
    ('Alan', 'Jones', 'alan.jones@email.com', '0411 111 003', 'Poly Welder', 'CW3', 'placed', 'FIFO - Pilbara', '["Working at Heights","Confined Space","White Card"]'),
    ('Daniel', 'Lorimer', 'daniel.lorimer@email.com', '0411 111 004', 'Poly Welder', 'CW3', 'placed', 'FIFO - Pilbara', '["Working at Heights","White Card","HR Licence"]'),
    ('Scott', 'Guthrie-Phelps', 'scott.gp@email.com', '0411 111 005', 'Poly Welder', 'CW3', 'placed', 'FIFO - Kalgoorlie', '["Working at Heights","Confined Space","EWP","White Card","First Aid"]'),
    ('Izak', 'Moriss', 'izak.moriss@email.com', '0411 111 006', 'Poly Welder', 'CW3', 'placed', 'Perth', '["Working at Heights","White Card","Confined Space"]'),
    ('Liam', 'Smith', 'liam.smith@email.com', '0411 111 007', 'Poly Welder', 'CW2', 'placed', 'FIFO - Pilbara', '["Working at Heights","White Card"]'),
    ('Kyle', 'Pettett', 'kyle.pettett@email.com', '0411 111 008', 'Poly Welder', 'CW3', 'placed', 'FIFO - Kalgoorlie', '["Working at Heights","Confined Space","White Card","First Aid"]'),
    ('Edwin', 'Kipruto', 'edwin.kipruto@email.com', '0411 111 009', 'Poly Welder', 'CW2', 'placed', 'FIFO - Pilbara', '["Working at Heights","White Card","MR Licence"]'),
    ('Justin', 'Pomponio', 'justin.pomponio@email.com', '0411 111 010', 'Poly Welder', 'CW3', 'placed', 'FIFO - Kalgoorlie', '["Working at Heights","White Card","Confined Space"]'),
    ('Nathaniel', 'Perez', 'nathaniel.perez@email.com', '0411 111 011', 'Poly Welder', 'CW2', 'available', 'Perth', '["Working at Heights","White Card"]'),
    ('Lydon', 'Hollitt', 'lydon@acmresources.com.au', '0400 000 001', 'Project Manager', 'Senior PM', 'placed', 'Perth', '["White Card","First Aid","HR Licence"]'),
    ('Dan', 'Johnstone', 'dan@acmresources.com.au', '0488 488 072', 'General Manager', 'GM', 'available', 'Perth', '["White Card","First Aid"]'),
    ('Brian', 'Cox', 'brian.cox@acmresources.com.au', '0411 222 001', 'Site Superintendent', 'Senior Sup', 'available', 'Perth', '["Working at Heights","Confined Space","White Card","First Aid","EWP"]'),
    ('James', 'Walker', 'james.walker@email.com', '0411 333 001', 'Civil Operator', 'CW3', 'available', 'Perth', '["Working at Heights","White Card","HR Licence","Dogging"]'),
    ('Mark', 'Thompson', 'mark.thompson@email.com', '0411 333 002', 'Rigger', 'CW3', 'available', 'FIFO - Goldfields', '["Rigging","Dogging","Working at Heights","White Card"]'),
    ('Sarah', 'Chen', 'sarah.chen@email.com', '0411 444 001', 'Site Admin', 'Admin', 'available', 'Perth', '["White Card","First Aid"]'),
    ('Troy', 'Mitchell', 'troy.mitchell@email.com', '0411 555 001', 'Plant Operator', 'CW3', 'available', 'FIFO - Pilbara', '["Working at Heights","White Card","HR Licence","EWP","Dogman"]');

    INSERT INTO clients (name, tier, contact_name, contact_email, contact_phone, industry, state) VALUES
    ('BHP', 'Tier 1', 'Project Manager', 'pm@bhp.com', '08 9000 0001', 'Mining', 'WA'),
    ('Rio Tinto', 'Tier 1', 'Contracts Manager', 'contracts@riotinto.com', '08 9000 0002', 'Mining', 'WA'),
    ('Fortescue (FMG)', 'Tier 1', 'Site Manager', 'site@fmg.com.au', '08 9000 0003', 'Mining', 'WA'),
    ('NRW Holdings', 'Tier 2', 'Dan Reynolds', 'dan@nrw.com.au', '08 9000 0004', 'Civil', 'WA'),
    ('Warrikal', 'Tier 2', 'Scott Briggs', 'scott@warrikal.com.au', '08 9000 0005', 'Mining', 'WA'),
    ('MPC Kinetic', 'Tier 2', 'Chris Hall', 'chris@mpckinetic.com.au', '08 9000 0006', 'Mining', 'WA'),
    ('Water Corporation', 'Tier 1', 'Contracts Team', 'contracts@watercorp.wa.gov.au', '08 9000 0007', 'Water', 'WA'),
    ('Civcon', 'Tier 2', 'Project Admin', 'admin@civcon.com.au', '08 9000 0008', 'Civil', 'WA'),
    ('Interforge', 'Tier 2', 'Vietnam Ops', 'ops@interforge.com', '08 9000 0009', 'Oil & Gas', 'International'),
    ('Lynas Resources', 'Tier 1', 'Site Manager', 'site@lynas.com.au', '08 9000 0010', 'Mining', 'WA'),
    ('Plummers Project Services', 'Tier 2', 'Project Manager', 'pm@plummers.com.au', '08 9000 0011', 'Civil', 'WA'),
    ('Diab Engineering', 'Tier 2', 'Fabrication Manager', 'fab@diab.com.au', '08 9000 0012', 'Mining', 'WA');

    INSERT INTO projects (client_id, name, location, scope, status, start_date, headcount, contract_value) VALUES
    (4, 'West Angelas DN630 Pipeline', 'Pilbara, WA', 'HDPE Pipeline', 'completed', '2024-03-01', 8, 420000),
    (5, 'Mt Whaleback Pipeline & HDPE Works', 'Newman, WA', 'HDPE Pipeline', 'completed', '2024-06-01', 12, 680000),
    (12, 'Full Plant Fabrication & Installation', 'Goldfields, WA', 'Civil', 'completed', '2024-09-01', 6, 310000),
    (11, 'Cloudbreak Bore Installation & HDPE', 'Pilbara, WA', 'HDPE Pipeline', 'completed', '2024-11-01', 10, 550000),
    (7, 'Ellenbrook HDPE WS2 Compliance', 'Perth Metro, WA', 'HDPE Pipeline', 'completed', '2025-02-01', 5, 220000),
    (2, 'Gudai-Darri Rail Supervision & Ops', 'Pilbara, WA', 'Labour Hire', 'completed', '2024-04-01', 14, 890000),
    (2, 'Waste Fines Storage Facility Stage 3', 'Pilbara, WA', 'HDPE Pipeline', 'completed', '2024-08-01', 9, 460000),
    (3, 'Solomon Mine Road Maintenance', 'Pilbara, WA', 'Labour Hire', 'active', '2022-01-01', 20, 2400000),
    (3, 'Solomon Grout Wall', 'Pilbara, WA', 'Civil', 'active', '2024-01-01', 8, 750000),
    (6, 'Iron Bridge CRWP & RAW', 'Pilbara, WA', 'HDPE Pipeline', 'active', '2025-03-01', 16, 1200000),
    (9, 'Phu My Port HDPE Welding Oversight', 'Vung Tau, Vietnam', 'HDPE Pipeline', 'completed', '2025-06-01', 4, 380000),
    (3, 'PPS Cloudbreak Poly Welding', 'Cloudbreak, WA', 'HDPE Pipeline', 'active', '2026-01-01', 4, 280000),
    (2, 'North Banister Leachate Welding', 'Perth, WA', 'HDPE Pipeline', 'completed', '2026-03-11', 2, 95000),
    (2, 'BOR Solomon String Welding', 'Solomon, WA', 'HDPE Pipeline', 'active', '2026-04-08', 1, 60000),
    (9, 'ADC NSR Kalgoorlie', 'Kalgoorlie, WA', 'HDPE Pipeline', 'active', '2026-02-01', 3, 180000);

    INSERT INTO placements (candidate_id, client_id, project_id, type, role, start_date, rate, rate_type, status) VALUES
    (1, 3, 8, 'casual', 'Poly Welder', '2022-01-01', 65.50, 'hourly', 'active'),
    (2, 3, 12, 'casual', 'Poly Welder', '2026-01-01', 65.50, 'hourly', 'active'),
    (3, 3, 12, 'casual', 'Poly Welder', '2026-01-01', 65.50, 'hourly', 'active'),
    (4, 3, 12, 'casual', 'Poly Welder', '2026-01-01', 62.00, 'hourly', 'active'),
    (5, 9, 15, 'casual', 'Poly Welder', '2026-02-01', 65.50, 'hourly', 'active'),
    (6, 2, 13, 'casual', 'Poly Welder', '2026-03-11', 65.50, 'hourly', 'completed'),
    (7, 3, 12, 'casual', 'Poly Welder', '2026-01-01', 62.00, 'hourly', 'active'),
    (8, 9, 15, 'casual', 'Poly Welder', '2026-02-01', 65.50, 'hourly', 'active'),
    (9, 3, 12, 'casual', 'Poly Welder', '2026-01-01', 62.00, 'hourly', 'active'),
    (10, 9, 15, 'casual', 'Poly Welder', '2026-02-01', 62.00, 'hourly', 'active'),
    (12, 2, 14, 'casual', 'Project Manager', '2026-04-08', 125.00, 'hourly', 'active');

    INSERT INTO quotes (client_name, project_name, location, scope, line_items, subtotal, margin, total, status, valid_until) VALUES
    ('Rio Tinto', 'Pilbara HDPE Shutdown Crew', 'Pilbara, WA', 'HDPE Pipeline', '[{"id":"1","description":"Senior Poly Welder","trade":"Poly Welder","headcount":4,"hours":240,"rate":75,"total":72000},{"id":"2","description":"HDPE Supervisor","trade":"Supervisor","headcount":1,"hours":240,"rate":95,"total":22800}]', 94800, 18, 111864, 'sent', '2026-05-01'),
    ('Fortescue (FMG)', 'Solomon Maintenance Extension', 'Pilbara, WA', 'Labour Hire', '[{"id":"1","description":"Plant Operators","trade":"Plant Operator","headcount":6,"hours":480,"rate":58,"total":166560},{"id":"2","description":"Civil Supervisors","trade":"Supervisor","headcount":2,"hours":480,"rate":88,"total":84480}]', 251040, 20, 301248, 'draft', '2026-04-30'),
    ('NRW Holdings', 'Mid-West Pipeline Labour', 'Mid-West, WA', 'HDPE Pipeline', '[{"id":"1","description":"Poly Welders","trade":"Poly Welder","headcount":3,"hours":360,"rate":70,"total":75600}]', 75600, 22, 92232, 'accepted', '2026-06-01');

    INSERT INTO timesheets (candidate_id, project_id, placement_id, week_ending, hours_monday, hours_tuesday, hours_wednesday, hours_thursday, hours_friday, hours_saturday, hours_sunday, total_hours, status) VALUES
    (1, 8, 1, '2026-04-13', 12, 12, 12, 12, 12, 12, 0, 72, 'approved'),
    (2, 12, 2, '2026-04-13', 12, 12, 12, 12, 12, 12, 0, 72, 'approved'),
    (3, 12, 3, '2026-04-13', 12, 12, 12, 12, 12, 12, 0, 72, 'approved'),
    (4, 12, 4, '2026-04-13', 12, 12, 12, 12, 12, 0, 0, 60, 'approved'),
    (5, 15, 5, '2026-04-13', 12, 12, 12, 12, 12, 12, 0, 72, 'pending'),
    (6, 13, 6, '2026-03-16', 12, 12, 12, 12, 12, 0, 0, 60, 'invoiced'),
    (7, 12, 7, '2026-04-13', 12, 12, 12, 12, 12, 12, 0, 72, 'approved'),
    (8, 15, 8, '2026-04-13', 12, 12, 12, 12, 12, 0, 0, 60, 'pending'),
    (9, 12, 9, '2026-04-13', 12, 12, 12, 12, 0, 0, 0, 48, 'approved'),
    (10, 15, 10, '2026-04-13', 12, 12, 12, 0, 0, 0, 0, 36, 'pending'),
    (12, 14, 11, '2026-04-13', 12, 12, 0, 0, 0, 0, 0, 24, 'pending');
  `);
}

// ── Storage Interface ──────────────────────────────────────────────
export interface IStorage {
  // Candidates
  getCandidates(): Candidate[];
  getCandidateById(id: number): Candidate | undefined;
  createCandidate(data: InsertCandidate): Candidate;
  updateCandidate(id: number, data: Partial<InsertCandidate>): Candidate | undefined;
  deleteCandidate(id: number): void;

  // Clients
  getClients(): Client[];
  getClientById(id: number): Client | undefined;
  createClient(data: InsertClient): Client;
  updateClient(id: number, data: Partial<InsertClient>): Client | undefined;
  deleteClient(id: number): void;

  // Projects
  getProjects(): Project[];
  getProjectById(id: number): Project | undefined;
  getProjectsByClient(clientId: number): Project[];
  createProject(data: InsertProject): Project;
  updateProject(id: number, data: Partial<InsertProject>): Project | undefined;
  deleteProject(id: number): void;

  // Placements
  getPlacements(): Placement[];
  getPlacementById(id: number): Placement | undefined;
  createPlacement(data: InsertPlacement): Placement;
  updatePlacement(id: number, data: Partial<InsertPlacement>): Placement | undefined;
  deletePlacement(id: number): void;

  // Quotes
  getQuotes(): Quote[];
  getQuoteById(id: number): Quote | undefined;
  createQuote(data: InsertQuote): Quote;
  updateQuote(id: number, data: Partial<InsertQuote>): Quote | undefined;
  deleteQuote(id: number): void;

  // Timesheets
  getTimesheets(): Timesheet[];
  getTimesheetById(id: number): Timesheet | undefined;
  getTimesheetsByCandidate(candidateId: number): Timesheet[];
  createTimesheet(data: InsertTimesheet): Timesheet;
  updateTimesheet(id: number, data: Partial<InsertTimesheet>): Timesheet | undefined;
  deleteTimesheet(id: number): void;

  // Dashboard stats
  getDashboardStats(): {
    totalCandidates: number;
    activePlacements: number;
    activeProjects: number;
    totalClients: number;
    pendingTimesheets: number;
    draftQuotes: number;
    totalHoursThisWeek: number;
  };
}

export class SqliteStorage implements IStorage {
  getCandidates(): Candidate[] {
    return db.select().from(candidates).orderBy(desc(candidates.createdAt)).all();
  }
  getCandidateById(id: number): Candidate | undefined {
    return db.select().from(candidates).where(eq(candidates.id, id)).get();
  }
  createCandidate(data: InsertCandidate): Candidate {
    return db.insert(candidates).values({ ...data, createdAt: new Date().toISOString() }).returning().get();
  }
  updateCandidate(id: number, data: Partial<InsertCandidate>): Candidate | undefined {
    return db.update(candidates).set(data).where(eq(candidates.id, id)).returning().get();
  }
  deleteCandidate(id: number): void {
    db.delete(candidates).where(eq(candidates.id, id)).run();
  }

  getClients(): Client[] {
    return db.select().from(clients).orderBy(desc(clients.createdAt)).all();
  }
  getClientById(id: number): Client | undefined {
    return db.select().from(clients).where(eq(clients.id, id)).get();
  }
  createClient(data: InsertClient): Client {
    return db.insert(clients).values({ ...data, createdAt: new Date().toISOString() }).returning().get();
  }
  updateClient(id: number, data: Partial<InsertClient>): Client | undefined {
    return db.update(clients).set(data).where(eq(clients.id, id)).returning().get();
  }
  deleteClient(id: number): void {
    db.delete(clients).where(eq(clients.id, id)).run();
  }

  getProjects(): Project[] {
    return db.select().from(projects).orderBy(desc(projects.createdAt)).all();
  }
  getProjectById(id: number): Project | undefined {
    return db.select().from(projects).where(eq(projects.id, id)).get();
  }
  getProjectsByClient(clientId: number): Project[] {
    return db.select().from(projects).where(eq(projects.clientId, clientId)).all();
  }
  createProject(data: InsertProject): Project {
    return db.insert(projects).values({ ...data, createdAt: new Date().toISOString() }).returning().get();
  }
  updateProject(id: number, data: Partial<InsertProject>): Project | undefined {
    return db.update(projects).set(data).where(eq(projects.id, id)).returning().get();
  }
  deleteProject(id: number): void {
    db.delete(projects).where(eq(projects.id, id)).run();
  }

  getPlacements(): Placement[] {
    return db.select().from(placements).orderBy(desc(placements.createdAt)).all();
  }
  getPlacementById(id: number): Placement | undefined {
    return db.select().from(placements).where(eq(placements.id, id)).get();
  }
  createPlacement(data: InsertPlacement): Placement {
    return db.insert(placements).values({ ...data, createdAt: new Date().toISOString() }).returning().get();
  }
  updatePlacement(id: number, data: Partial<InsertPlacement>): Placement | undefined {
    return db.update(placements).set(data).where(eq(placements.id, id)).returning().get();
  }
  deletePlacement(id: number): void {
    db.delete(placements).where(eq(placements.id, id)).run();
  }

  getQuotes(): Quote[] {
    return db.select().from(quotes).orderBy(desc(quotes.createdAt)).all();
  }
  getQuoteById(id: number): Quote | undefined {
    return db.select().from(quotes).where(eq(quotes.id, id)).get();
  }
  createQuote(data: InsertQuote): Quote {
    return db.insert(quotes).values({ ...data, createdAt: new Date().toISOString() }).returning().get();
  }
  updateQuote(id: number, data: Partial<InsertQuote>): Quote | undefined {
    return db.update(quotes).set(data).where(eq(quotes.id, id)).returning().get();
  }
  deleteQuote(id: number): void {
    db.delete(quotes).where(eq(quotes.id, id)).run();
  }

  getTimesheets(): Timesheet[] {
    return db.select().from(timesheets).orderBy(desc(timesheets.weekEnding)).all();
  }
  getTimesheetById(id: number): Timesheet | undefined {
    return db.select().from(timesheets).where(eq(timesheets.id, id)).get();
  }
  getTimesheetsByCandidate(candidateId: number): Timesheet[] {
    return db.select().from(timesheets).where(eq(timesheets.candidateId, candidateId)).all();
  }
  createTimesheet(data: InsertTimesheet): Timesheet {
    return db.insert(timesheets).values({ ...data, createdAt: new Date().toISOString() }).returning().get();
  }
  updateTimesheet(id: number, data: Partial<InsertTimesheet>): Timesheet | undefined {
    return db.update(timesheets).set(data).where(eq(timesheets.id, id)).returning().get();
  }
  deleteTimesheet(id: number): void {
    db.delete(timesheets).where(eq(timesheets.id, id)).run();
  }

  getDashboardStats() {
    const totalCandidates = (sqlite.prepare("SELECT COUNT(*) as c FROM candidates").get() as any).c;
    const activePlacements = (sqlite.prepare("SELECT COUNT(*) as c FROM placements WHERE status='active'").get() as any).c;
    const activeProjects = (sqlite.prepare("SELECT COUNT(*) as c FROM projects WHERE status='active'").get() as any).c;
    const totalClients = (sqlite.prepare("SELECT COUNT(*) as c FROM clients").get() as any).c;
    const pendingTimesheets = (sqlite.prepare("SELECT COUNT(*) as c FROM timesheets WHERE status='pending'").get() as any).c;
    const draftQuotes = (sqlite.prepare("SELECT COUNT(*) as c FROM quotes WHERE status='draft'").get() as any).c;
    const hoursRow = (sqlite.prepare("SELECT COALESCE(SUM(total_hours),0) as h FROM timesheets WHERE week_ending >= date('now','-7 days')").get() as any);
    return {
      totalCandidates, activePlacements, activeProjects, totalClients,
      pendingTimesheets, draftQuotes, totalHoursThisWeek: hoursRow.h,
    };
  }
}

export const storage = new SqliteStorage();
