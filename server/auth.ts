import type { Request, Response, NextFunction, Express } from "express";
import session from "express-session";

// ── Session augmentation ──────────────────────────────────────────
declare module "express-session" {
  interface SessionData {
    authenticated: boolean;
    username: string;
  }
}

// ── Setup session middleware ──────────────────────────────────────
export function setupAuth(app: Express) {
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "acm-platform-secret-2026",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: false, // Railway handles TLS termination
        httpOnly: true,
        maxAge: 8 * 60 * 60 * 1000, // 8 hours
      },
    })
  );

  // ── Login endpoint ──────────────────────────────────────────────
  app.post("/api/auth/login", (req: Request, res: Response) => {
    const { username, password } = req.body as { username: string; password: string };
    const validUsername = process.env.ADMIN_USERNAME || "admin";
    const validPassword = process.env.ADMIN_PASSWORD || "ACMResources2026!";

    if (username === validUsername && password === validPassword) {
      req.session.authenticated = true;
      req.session.username = username;
      res.json({ success: true, username });
    } else {
      res.status(401).json({ message: "Invalid username or password" });
    }
  });

  // ── Logout endpoint ─────────────────────────────────────────────
  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.session.destroy(() => {
      res.json({ success: true });
    });
  });

  // ── Session check endpoint ──────────────────────────────────────
  app.get("/api/auth/me", (req: Request, res: Response) => {
    if (req.session.authenticated) {
      res.json({ authenticated: true, username: req.session.username });
    } else {
      res.status(401).json({ authenticated: false });
    }
  });
}

// ── Auth guard middleware ─────────────────────────────────────────
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.session.authenticated) {
    return next();
  }
  res.status(401).json({ message: "Not authenticated" });
}
