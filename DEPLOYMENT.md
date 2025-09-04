# Production Deployment Guide

## Quick Deployment Steps for Replit

### 1. Build the Application
```bash
npm run build
```
This creates:
- `dist/index.js` - Production server bundle
- `dist/public/` - Static client assets

### 2. Set Environment Variables
Ensure these environment variables are set in your Replit deployment:
- `DATABASE_URL` - PostgreSQL connection string
- `NODE_ENV=production`

### 3. Deployment Configuration
Use these commands in your Replit deployment settings:

**Build Command:**
```bash
npm run build
```

**Run Command:**
```bash
npm start
```

### 4. Port Configuration
The application is configured to:
- Listen on port 5000
- Bind to 0.0.0.0 for external access
- Serve both API routes and static client files

### 5. Database Setup
Ensure your PostgreSQL database is accessible and run:
```bash
npm run db:push
```

## Production Features
- ✅ TypeScript compiled and bundled
- ✅ Client assets optimized with Vite
- ✅ Server bundled with esbuild
- ✅ Static file serving configured
- ✅ Environment variable support
- ✅ Database connection ready
- ✅ CORS and security headers configured

## Troubleshooting
- If deployment fails with "dev command blocked", ensure you're using `npm start` not `npm run dev` in the run command
- If assets don't load, verify `dist/public/` exists after build
- If database connection fails, check `DATABASE_URL` environment variable