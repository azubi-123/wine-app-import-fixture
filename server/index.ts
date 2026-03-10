import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import session from "express-session";
import pgSession from "connect-pg-simple";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { db } from "./db";
import { sql } from "drizzle-orm";

const app = express();

// Trust proxy for Railway/Heroku/etc (required for secure cookies behind proxy)
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Security headers (clickjacking, MIME sniffing, etc.)
app.use(helmet({
  contentSecurityPolicy: false, // Vite dev server needs inline scripts
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Session configuration for solo tasting auth
// Require SESSION_SECRET in production to prevent session hijacking
const sessionSecret = process.env.SESSION_SECRET;
if (process.env.NODE_ENV === 'production' && !sessionSecret) {
  console.error('FATAL: SESSION_SECRET environment variable is required in production');
  process.exit(1);
}

const PgStore = pgSession(session);

app.use(session({
  store: new PgStore({
    conString: process.env.DATABASE_URL,
    tableName: 'user_sessions',
    createTableIfMissing: true,
  }),
  secret: sessionSecret || 'cata-dev-secret-not-for-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    sameSite: 'strict' // CSRF protection - always strict
  },
  name: 'cata.sid' // Custom session cookie name
}));

// Check database migration status on startup
(async () => {
  try {
    console.log('[DB_CHECK] Checking database migration status...');
    
    // Check if media table exists
    const mediaTableCheck = await db.execute(sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'media'
      );
    `);
    
    // Handle different response structures from different database clients
    let mediaTableExists = false;
    if (Array.isArray(mediaTableCheck) && mediaTableCheck[0]) {
      mediaTableExists = (mediaTableCheck[0] as any).exists;
    } else if ((mediaTableCheck as any).rows && (mediaTableCheck as any).rows[0]) {
      mediaTableExists = (mediaTableCheck as any).rows[0].exists;
    } else {
      console.warn('[DB_CHECK] Unexpected database response structure:', mediaTableCheck);
    }
    
    if (!mediaTableExists) {
      console.error('[DB_CHECK] ❌ CRITICAL: Media table is missing!');
      console.error('[DB_CHECK] Run "npm run db:push" to apply migrations');
      console.error('[DB_CHECK] This is causing media upload failures');
    } else {
      console.log('[DB_CHECK] ✅ Media table exists');
    }
    
    // Log all tables for debugging
    const tables = await db.execute(sql`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename;
    `);
    
    // Handle different response structures for table listing
    let tableNames: string[] = [];
    if (Array.isArray(tables)) {
      tableNames = tables.map((r: any) => r.tablename);
    } else if ((tables as any).rows && Array.isArray((tables as any).rows)) {
      tableNames = (tables as any).rows.map((r: any) => r.tablename);
    } else {
      console.warn('[DB_CHECK] Unexpected table query response structure:', tables);
      tableNames = ['Unable to fetch table list'];
    }
    
    console.log('[DB_CHECK] Current tables:', tableNames.join(', '));
  } catch (error) {
    console.error('[DB_CHECK] Error checking database status:', error);
  }
})();

// Configure CORS
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://cata.wine', 'https://www.cata.wine', 'https://cata-production.up.railway.app'] // Production domains
    : true, // Allow all origins in development
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400 // Cache preflight response for 24 hours
}));

// Add cache prevention middleware for API routes
app.use('/api/*', (req, res, next) => {
  // Prevent any caching of API responses
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  // Enhanced logging for session join debugging
  if (path.includes('/api/sessions') && path.includes('/participants') && req.method === 'POST') {
    console.log(`\n[JOIN_REQUEST] ${new Date().toISOString()}`);
    console.log(`[JOIN_REQUEST] ${req.method} ${path}`);
    console.log(`[JOIN_REQUEST] Params:`, req.params);
    console.log(`[JOIN_REQUEST] Body:`, JSON.stringify(req.body, null, 2));
  }

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
      
      // Log 500 errors with full details
      if (res.statusCode === 500) {
        console.error(`\n[500_ERROR] ${new Date().toISOString()}`);
        console.error(`[500_ERROR] ${req.method} ${path}`);
        console.error(`[500_ERROR] Response:`, capturedJsonResponse);
      }
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    
    // Enhanced error logging for debugging
    if (status === 500 || err.code) {
      const errorId = `ERR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      console.error(`\n${'='.repeat(80)}`);
      console.error(`[GLOBAL_ERROR_HANDLER] ${errorId}`);
      console.error(`Timestamp: ${new Date().toISOString()}`);
      console.error(`Request: ${req.method} ${req.originalUrl}`);
      console.error(`Params:`, req.params);
      console.error(`Body:`, req.body);
      console.error(`Error:`, {
        name: err.name,
        message: err.message,
        code: err.code,
        detail: err.detail,
        table: err.table,
        constraint: err.constraint,
        stack: err.stack
      });
      console.error(`${'='.repeat(80)}\n`);
      
      // Include error ID in response for tracking (don't leak internal details)
      res.status(status).json({
        message,
        errorId,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(status).json({ message });
    }
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000');
  
  server.listen(port, "0.0.0.0", () => {
    log(`serving on port ${port}`);
  }).on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${port} is already in use. Trying alternative port...`);
      const alternativePort = port + 1;
      server.listen(alternativePort, "0.0.0.0", () => {
        log(`serving on port ${alternativePort}`);
      });
    } else {
      console.error('Server error:', err);
      process.exit(1);
    }
  });
})();
