import express, { type Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import { createServer } from "http";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();

// CORS configuration for frontend
app.use((req, res, next) => {
  const allowedOrigins = [
    'https://events.qlora.in',
    'http://localhost:3000',
    'http://localhost:5000'
  ];
  
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin as string)) {
    res.setHeader('Access-Control-Allow-Origin', origin as string);
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  
  next();
});

app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Add cookie parser for session handling
app.use(cookieParser());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

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
    }
  });

  next();
});

(async () => {
  // Production Environment Validation
  console.log('🔍 Starting production environment validation...');
  
  // Check critical environment variables
  const criticalEnvVars = [
    'DATABASE_URL',
    'CASHFREE_APP_ID',
    'CASHFREE_SECRET_KEY'
  ];
  
  const missingVars = criticalEnvVars.filter(envVar => !process.env[envVar]);
  if (missingVars.length > 0) {
    console.error('❌ CRITICAL: Missing environment variables:', missingVars);
    console.error('🚨 Application may not work properly in production without these variables');
  } else {
    console.log('✅ All critical environment variables are present');
  }
  
  // Check optional but recommended environment variables
  const recommendedVars = ['SMTP_USER', 'SMTP_PASSWORD', 'GOOGLE_SHEETS_CREDENTIALS'];
  const missingRecommended = recommendedVars.filter(envVar => !process.env[envVar]);
  if (missingRecommended.length > 0) {
    console.warn('⚠️  Missing recommended environment variables (features may not work):', missingRecommended);
  }
  
  // Test database connectivity
  try {
    console.log('🗄️  Testing database connectivity...');
    const { db } = await import('./db');
    const { sql } = await import('drizzle-orm');
    
    // Simple connectivity test
    const result = await db.execute(sql`SELECT 1 as test`);
    console.log('✅ Database connectivity test passed:', result);
  } catch (dbError: any) {
    console.error('❌ CRITICAL DATABASE ERROR:', {
      message: dbError.message,
      code: dbError.code,
      stack: dbError.stack?.split('\n').slice(0, 3).join('\n'),
      hasDbUrl: !!process.env.DATABASE_URL
    });
  }
  
  console.log('🌍 Environment details:', {
    nodeEnv: process.env.NODE_ENV || 'development',
    platform: process.platform,
    nodeVersion: process.version,
    memoryUsage: process.memoryUsage(),
    timestamp: new Date().toISOString()
  });

  await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // Create the HTTP server
  const server = createServer(app);

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
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
