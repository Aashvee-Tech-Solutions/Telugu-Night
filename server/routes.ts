import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import compression from 'compression';
import { storage } from "./databaseStorage";
import { GoogleSheetsService } from "./services/googleSheets";
import { EmailService } from "./services/emailService";
import { enhancedEmailService } from "./services/enhancedEmailService";
import { PaymentService } from "./services/paymentService";
import { authService } from "./services/authService";
import { TicketGenerationService } from "./services/ticketGenerationService";
import { authenticate, requirePermission, requireRole } from "./middleware/authMiddleware";
import { insertBookingSchema, insertCouponSchema, insertUserSchema, PERMISSIONS } from "@shared/schema";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

// Configure multer for file uploads with better error handling
const storage_multer = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    // Ensure uploads directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage_multer,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1
  },
  fileFilter: (req: any, file: any, cb: any) => {
    console.log(`📤 File upload attempt: ${file.originalname}, type: ${file.mimetype}`);
    
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Only images (JPG, PNG, GIF, WebP) are allowed. Got: ${file.mimetype}`));
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Enable compression for faster response times, but exclude uploads
  app.use((req, res, next) => {
    // Skip compression for file upload routes
    if (req.path.includes('/payment-proof') || req.path.includes('/uploads/')) {
      return next();
    }
    // Apply compression for other routes
    compression({
      threshold: 1024, // Only compress if response is > 1KB
      level: 6, // Compression level (1-9, 6 is default)
      chunkSize: 16 * 1024 // 16KB chunks
    })(req, res, next);
  });

  // PUBLIC Scanner Routes (must be before any auth middleware)
  app.post('/api/scanner/scan', async (req, res) => {
    try {
      const { scanData } = req.body;
      
      if (!scanData || typeof scanData !== 'string') {
        return res.status(400).json({ message: 'Valid scan data is required' });
      }

      const trimmedData = scanData.trim();
      console.log(`Scanner: Looking for "${trimmedData}"`);
      
      let booking = null;
      
      // Try to find booking by ID first (numeric)
      const bookingId = parseInt(trimmedData);
      if (!isNaN(bookingId) && bookingId > 0) {
        console.log(`Scanner: Searching by booking ID ${bookingId}`);
        booking = await storage.getBooking(bookingId);
      }
      
      // If not found by ID, try to find by guest code (alphanumeric)
      if (!booking) {
        console.log(`Scanner: Searching by guest code "${trimmedData.toUpperCase()}"`);
        const allBookings = await storage.getAllBookings();
        booking = allBookings.find(b => {
          if (!b.guestCodes || !Array.isArray(b.guestCodes)) return false;
          // Check both the exact code and the formatted QR code pattern
          return b.guestCodes.includes(trimmedData.toUpperCase()) || 
                 b.guestCodes.some(code => `TELUGU-NIGHT-${b.id}-${code}` === trimmedData.toUpperCase());
        });
      }
      
      if (!booking) {
        console.log(`Scanner: No booking found for "${trimmedData}"`);
        return res.status(404).json({ 
          message: `No booking found. Please check the booking ID or guest code.` 
        });
      }

      console.log(`Scanner: Found booking ${booking.id} for ${booking.name}`);

      // Check payment status
      if (booking.paymentStatus === 'pending') {
        return res.status(400).json({ 
          message: 'Payment not verified yet. Please wait for admin verification.',
          booking: {
            ...booking,
            scannedAt: booking.scannedAt?.toISOString ? booking.scannedAt.toISOString() : booking.scannedAt
          }
        });
      }

      // Determine if this is an individual guest scan or booking scan
      let scannedGuestCode = null;
      let guestIndex = -1;
      
      // Check if scan data matches a specific guest code
      if (booking.guestCodes && booking.guestCodes.includes(trimmedData.toUpperCase())) {
        scannedGuestCode = trimmedData.toUpperCase();
        guestIndex = booking.guestCodes.indexOf(scannedGuestCode);
      } else if (booking.guestCodes) {
        // Check for formatted QR code pattern
        const match = booking.guestCodes.find(code => `TELUGU-NIGHT-${booking.id}-${code}` === trimmedData.toUpperCase());
        if (match) {
          scannedGuestCode = match;
          guestIndex = booking.guestCodes.indexOf(match);
        }
      }

      // Initialize scannedGuests array if not exists
      if (!booking.scannedGuests) {
        booking.scannedGuests = [];
      }

      // Check if this specific guest is already scanned
      if (scannedGuestCode && booking.scannedGuests.includes(scannedGuestCode)) {
        const guestName = guestIndex === 0 ? booking.name : (booking.guests && booking.guests[guestIndex - 1]) || `Guest ${guestIndex + 1}`;
        return res.json({
          success: true,
          message: `${guestName} has already entered Telugu Night. Entry was confirmed earlier.`,
          alreadyScanned: true,
          booking: {
            ...booking,
            scannedAt: booking.scannedAt?.toISOString ? booking.scannedAt.toISOString() : booking.scannedAt,
            scannedGuests: booking.scannedGuests
          },
          guestInfo: {
            guestName,
            guestCode: scannedGuestCode,
            guestIndex
          }
        });
      }

      // Process entry for verified bookings
      if (booking.paymentStatus === 'verified') {
        if (scannedGuestCode) {
          // Individual guest entry
          const guestName = guestIndex === 0 ? booking.name : (booking.guests && booking.guests[guestIndex - 1]) || `Guest ${guestIndex + 1}`;
          
          // Add guest to scanned list
          booking.scannedGuests.push(scannedGuestCode);
          await storage.updateBookingScannedGuests(booking.id, booking.scannedGuests);
          
          console.log(`Scanner: Guest ${guestName} (${scannedGuestCode}) entered successfully`);
          
          res.json({
            success: true,
            message: `Welcome ${guestName}! Entry approved.`,
            booking: {
              ...booking,
              scannedAt: new Date().toISOString(),
              scannedGuests: booking.scannedGuests
            },
            guestInfo: {
              guestName,
              guestCode: scannedGuestCode,
              guestIndex
            }
          });
        } else {
          // Booking-level scan (legacy support)
          if (booking.isScanned) {
            return res.json({
              success: true,
              message: `${booking.name} has already entered. Entry confirmed.`,
              alreadyScanned: true,
              booking: {
                ...booking,
                scannedAt: booking.scannedAt?.toISOString ? booking.scannedAt.toISOString() : booking.scannedAt
              }
            });
          }
          
          await storage.scanTicket(booking.id, 1);
          booking.isScanned = true;
          booking.scannedAt = new Date();
          console.log(`Scanner: Successfully scanned booking ${booking.id} for ${booking.name}`);
          
          res.json({
            success: true,
            message: `Welcome ${booking.name}! Entry approved.`,
            booking: {
              ...booking,
              scannedAt: booking.scannedAt.toISOString()
            }
          });
        }
      } else {
        res.status(400).json({
          success: false,
          message: 'Payment not verified yet. Please wait for admin verification.'
        });
      }
    } catch (error) {
      console.error('Scanner error:', error);
      res.status(500).json({ 
        message: 'Scanner error occurred' 
      });
    }
  });

  const emailService = new EmailService();
  const paymentService = new PaymentService();
  const googleSheetsService = new GoogleSheetsService();
  const ticketGenerationService = new TicketGenerationService();
  
  // Import helper functions
  const { generateGuestCodes, generatePassIds } = await import('./services/emailService');
  

  // Screenshot viewing route  
  app.get('/api/screenshots/:filename', authenticate, requirePermission(PERMISSIONS.VIEW_BOOKINGS), (req, res) => {
    try {
      const filename = req.params.filename;
      const filepath = path.join(process.cwd(), 'uploads', filename);
      
      console.log(`📸 Screenshot request for: ${filename}`);
      console.log(`📂 Looking in path: ${filepath}`);
      
      // Check if file exists
      if (!fs.existsSync(filepath)) {
        console.log(`❌ Screenshot not found: ${filepath}`);
        return res.status(404).json({ message: 'Screenshot not found' });
      }
      
      console.log(`✅ Screenshot found, serving: ${filename}`);
      res.sendFile(filepath);
    } catch (error: any) {
      console.error('Screenshot viewing error:', error);
      res.status(500).json({ message: 'Failed to load screenshot' });
    }
  });

  // Alternative screenshot route without authentication for development
  app.get('/uploads/:filename', (req, res) => {
    try {
      const filename = req.params.filename;
      const filepath = path.join(process.cwd(), 'uploads', filename);
      
      if (!fs.existsSync(filepath)) {
        return res.status(404).json({ message: 'File not found' });
      }
      
      res.sendFile(filepath);
    } catch (error: any) {
      console.error('File serving error:', error);
      res.status(500).json({ message: 'Failed to serve file' });
    }
  });

  // Initialize admin user route (for fixing login issues)
  app.post('/api/admin/init-user', async (req, res) => {
    try {
      const bcrypt = await import('bcryptjs');
      const hashedPassword = bcrypt.hashSync('Rudra@78611', 10);
      
      // Check and delete existing user if exists
      try {
        await db.delete(users).where(eq(users.username, 'aashvee'));
      } catch (e) {
        // User might not exist, continue
      }
      
      // Create new admin user with all permissions
      const [newUser] = await db.insert(users).values({
        username: 'aashvee',
        password: hashedPassword,
        role: 'super_admin',
        permissions: [
          'VIEW_BOOKINGS', 'VERIFY_PAYMENTS', 'MANAGE_COUPONS', 'SEND_TICKETS', 
          'SCANNER_ACCESS', 'MANAGE_BOOKINGS', 'SYSTEM_SETTINGS', 'VIEW_ANALYTICS',
          'MANAGE_EVENTS', 'MANAGE_PHASES', 'MANAGE_TICKET_TYPES', 'VIEW_USERS'
        ],
        isActive: true
      }).returning();
      
      console.log('✅ Admin user initialized successfully');
      res.json({ message: 'Admin user initialized', user: { username: newUser.username, role: newUser.role } });
    } catch (error: any) {
      console.error('Admin initialization error:', error);
      res.status(500).json({ message: 'Failed to initialize admin user' });
    }
  });

  // New dynamic authentication system
  app.post('/api/auth/admin-login', async (req, res) => {
    try {
      const { username, password } = req.body;
      
      const user = await authService.verifyCredentials(username, password);
      if (!user) {
        return res.status(401).json({ 
          message: 'Invalid username or password',
          code: 'INVALID_CREDENTIALS' 
        });
      }

      const token = await authService.createSession(user.id);
      
      // Set session token as httpOnly cookie for enhanced security
      const cookieOptions = {
        httpOnly: true,
        secure: false, // Allow http in development
        sameSite: 'lax' as const, // More permissive for development
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      };
      
      res.cookie('admin_token', token, cookieOptions);
      
      // Return user info with permissions
      const userPermissions = authService.getUserPermissions(user);
      
      res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          permissions: userPermissions,
          isActive: user.isActive
        }
      });
    } catch (error: any) {
      console.error('Admin login error:', error);
      res.status(500).json({ message: 'Login failed' });
    }
  });

  // Admin login route that also works with old client endpoints
  app.post('/api/admin/login', async (req, res) => {
    try {
      const { username, password } = req.body;
      
      const user = await authService.verifyCredentials(username, password);
      if (!user) {
        return res.status(401).json({ 
          message: 'Invalid username or password',
          code: 'INVALID_CREDENTIALS' 
        });
      }

      const token = await authService.createSession(user.id);
      
      // Set session token as httpOnly cookie for enhanced security
      const cookieOptions = {
        httpOnly: true,
        secure: false, // Allow http in development
        sameSite: 'lax' as const, // More permissive for development
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      };
      
      res.cookie('admin_token', token, cookieOptions);
      
      // Return user info with permissions
      const userPermissions = authService.getUserPermissions(user);
      
      res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          permissions: userPermissions,
          isActive: user.isActive
        }
      });
    } catch (error: any) {
      console.error('Admin login error:', error);
      res.status(500).json({ message: 'Login failed' });
    }
  });

  app.post('/api/auth/logout', authenticate, async (req, res) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (token) {
        await authService.logout(token);
      }
      res.json({ message: 'Logged out successfully' });
    } catch (error: any) {
      res.status(500).json({ message: 'Logout failed' });
    }
  });

  app.get('/api/auth/me', authenticate, async (req, res) => {
    try {
      const userPermissions = authService.getUserPermissions(req.user);
      res.json({
        user: {
          id: req.user.id,
          username: req.user.username,
          role: req.user.role,
          permissions: userPermissions,
          isActive: req.user.isActive,
          lastLogin: req.user.lastLogin
        }
      });
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to get user info' });
    }
  });

  // User Authentication Routes
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { username, password } = req.body;
      const user = await storage.getUserByUsername(username);
      
      if (!user || !bcrypt.compareSync(password, user.password)) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // Simple token (in production, use JWT)
      const token = user.id.toString();
      res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
    } catch (error: any) {
      res.status(500).json({ message: 'Login failed' });
    }
  });

  app.post('/api/auth/register', async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      userData.password = bcrypt.hashSync(userData.password, 10);
      
      const user = await storage.createUser(userData);
      res.json({ user: { id: user.id, username: user.username, role: user.role } });
    } catch (error) {
      res.status(400).json({ message: 'Registration failed' });
    }
  });

  // GET /api/ticket-counts - Get current ticket counts (optimized with caching)
  app.get('/api/ticket-counts', async (req, res) => {
    try {
      const counts = await storage.getTicketCounts();
      
      // Set cache headers for faster responses
      res.set({
        'Cache-Control': 'public, max-age=30', // 30 seconds cache
        'ETag': `"${JSON.stringify(counts)}"`,
        'Vary': 'Accept-Encoding'
      });
      
      res.json(counts);
    } catch (error) {
      console.error('Error fetching ticket counts:', error);
      res.status(500).json({ message: 'Failed to fetch ticket counts' });
    }
  });

  // GET /api/ticket-config - Get ticket configuration for public frontend
  app.get('/api/ticket-config', async (req, res) => {
    try {
      const config = await storage.getTicketConfig();
      const counts = await storage.getTicketCounts();
      res.json({ config, counts });
    } catch (error) {
      console.error('Error fetching ticket config:', error);
      res.status(500).json({ message: 'Failed to fetch ticket configuration' });
    }
  });

  // PUT /api/admin/early-bird-limit - Update early bird limit (admin only)
  app.put('/api/admin/early-bird-limit', authenticate, requirePermission(PERMISSIONS.SYSTEM_SETTINGS), async (req, res) => {
    try {
      const { limit } = req.body;
      if (!limit || limit < 0) {
        return res.status(400).json({ message: 'Invalid limit value' });
      }
      
      await storage.updateEarlyBirdLimit(limit);
      const counts = await storage.getTicketCounts();
      res.json({ message: 'Early bird limit updated', counts });
    } catch (error) {
      console.error('Error updating early bird limit:', error);
      res.status(500).json({ message: 'Failed to update early bird limit' });
    }
  });

  // GET /api/admin/ticket-config - Get current ticket configuration
  app.get('/api/admin/ticket-config', authenticate, requirePermission(PERMISSIONS.SYSTEM_SETTINGS), async (req, res) => {
    try {
      const config = await storage.getTicketConfig();
      const counts = await storage.getTicketCounts();
      res.json({ config, counts });
    } catch (error) {
      console.error('Error getting ticket config:', error);
      res.status(500).json({ message: 'Failed to get ticket configuration' });
    }
  });

  // PUT /api/admin/ticket-config - Update ticket configuration with mutual exclusivity
  app.put('/api/admin/ticket-config', authenticate, requirePermission(PERMISSIONS.SYSTEM_SETTINGS), async (req, res) => {
    try {
      // Support both { config: {...} } and direct field updates
      const config = req.body.config || req.body;
      const userId = (req as any).user?.id;
      
      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }

      // Implement mutual exclusivity logic only if phase flags are being updated
      let finalConfig = { ...config };
      
      // Only apply mutual exclusivity if phase flags are present in the request
      if ('isEarlyBirdActive' in config || 'isPhase1Active' in config) {
        // If Early Bird is being started, automatically stop Phase 1
        if (config.isEarlyBirdActive && !config.isPhase1Active) {
          finalConfig.isPhase1Active = false;
          console.log('🎫 Early Bird started - Phase 1 automatically stopped');
        }
        
        // If Phase 1 is being started, automatically stop Early Bird
        if (config.isPhase1Active && !config.isEarlyBirdActive) {
          finalConfig.isEarlyBirdActive = false;
          console.log('🎫 Phase 1 started - Early Bird automatically stopped');
        }
        
        // If both are being set to true simultaneously, prioritize Phase 1
        if (config.isEarlyBirdActive && config.isPhase1Active) {
          finalConfig.isEarlyBirdActive = false;
          finalConfig.isPhase1Active = true;
          console.log('🎫 Both phases requested - Phase 1 takes priority, Early Bird stopped');
        }
      }

      await storage.updateTicketConfig(finalConfig, userId);
      const updatedConfig = await storage.getTicketConfig();
      const counts = await storage.getTicketCounts();
      
      let message = 'Ticket configuration updated successfully';
      if (finalConfig.isEarlyBirdActive !== config.isEarlyBirdActive || finalConfig.isPhase1Active !== config.isPhase1Active) {
        message += ' (phases adjusted for mutual exclusivity)';
      }
      
      res.json({ 
        message, 
        config: updatedConfig, 
        counts 
      });
    } catch (error) {
      console.error('Error updating ticket config:', error);
      res.status(500).json({ message: 'Failed to update ticket configuration' });
    }
  });

  // Telugu Night 2.0 Specific Configuration Routes
  app.get('/api/admin/telugu-night-config', authenticate, requirePermission(PERMISSIONS.SYSTEM_SETTINGS), async (req, res) => {
    try {
      // Redirect to the unified endpoint
      const config = await storage.getTicketConfig();
      const counts = await storage.getTicketCounts();
      res.json({ config, counts });
    } catch (error) {
      console.error('Error getting Telugu Night config:', error);
      res.status(500).json({ message: 'Failed to get Telugu Night 2.0 configuration' });
    }
  });

  app.put('/api/admin/telugu-night-config', authenticate, requirePermission(PERMISSIONS.SYSTEM_SETTINGS), async (req, res) => {
    try {
      const config = req.body.config || req.body;
      const userId = (req as any).user?.id;
      
      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }

      // Implement mutual exclusivity logic for Telugu Night phases
      let finalConfig = { ...config };
      
      if ('isEarlyBirdActive' in config || 'isPhase1Active' in config) {
        if (config.isEarlyBirdActive && !config.isPhase1Active) {
          finalConfig.isPhase1Active = false;
          console.log('🎫 Telugu Night 2.0: Early Bird started - Phase 1 automatically stopped');
        }
        
        if (config.isPhase1Active && !config.isEarlyBirdActive) {
          finalConfig.isEarlyBirdActive = false;
          console.log('🎫 Telugu Night 2.0: Phase 1 started - Early Bird automatically stopped');
        }
        
        if (config.isEarlyBirdActive && config.isPhase1Active) {
          finalConfig.isEarlyBirdActive = false;
          finalConfig.isPhase1Active = true;
          console.log('🎫 Telugu Night 2.0: Phase 1 takes priority, Early Bird stopped');
        }
      }

      await storage.updateTicketConfig(finalConfig, userId);
      const updatedConfig = await storage.getTicketConfig();
      const counts = await storage.getTicketCounts();
      
      let message = 'Telugu Night 2.0 configuration updated successfully';
      if (finalConfig.isEarlyBirdActive !== config.isEarlyBirdActive || finalConfig.isPhase1Active !== config.isPhase1Active) {
        message += ' (phases adjusted for mutual exclusivity)';
      }
      
      res.json({ 
        message, 
        config: updatedConfig, 
        counts 
      });
    } catch (error) {
      console.error('Error updating Telugu Night config:', error);
      res.status(500).json({ message: 'Failed to update Telugu Night 2.0 configuration' });
    }
  });

  app.patch('/api/admin/telugu-night-config/booking', authenticate, requirePermission(PERMISSIONS.SYSTEM_SETTINGS), async (req, res) => {
    try {
      const { bookingOpen } = req.body;
      const userId = (req as any).user?.id;
      
      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }

      await storage.updateTicketConfig({ bookingOpen }, userId);
      res.json({ 
        message: bookingOpen ? 'Telugu Night 2.0 bookings opened' : 'Telugu Night 2.0 bookings closed',
        bookingOpen 
      });
    } catch (error) {
      console.error('Error toggling Telugu Night bookings:', error);
      res.status(500).json({ message: 'Failed to toggle Telugu Night 2.0 bookings' });
    }
  });

  app.get('/api/admin/telugu-night-counts', authenticate, requirePermission(PERMISSIONS.SYSTEM_SETTINGS), async (req, res) => {
    try {
      const counts = await storage.getTicketCounts();
      res.json(counts);
    } catch (error) {
      console.error('Error fetching Telugu Night counts:', error);
      res.status(500).json({ message: 'Failed to fetch Telugu Night 2.0 ticket counts' });
    }
  });

  // Phase switching endpoint with full mutual exclusivity logic
  app.patch('/api/admin/telugu-night-config/phase', authenticate, requirePermission(PERMISSIONS.SYSTEM_SETTINGS), async (req, res) => {
    try {
      const { phase, active } = req.body;
      const userId = (req as any).user?.id;
      
      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }

      if (!phase || typeof active !== 'boolean') {
        return res.status(400).json({ message: 'Phase and active status are required' });
      }

      // Get current configuration
      const currentConfig = await storage.getTicketConfig();
      let finalConfig = { ...currentConfig };

      // Implement comprehensive mutual exclusivity logic
      if (phase === 'earlybird') {
        finalConfig.isEarlyBirdActive = active;
        if (active) {
          // If Early Bird is activated, deactivate other phases
          finalConfig.isPhase1Active = false;
          finalConfig.isPhase2Active = false;
          console.log('🎫 Early Bird activated - Phase 1 and Phase 2 automatically deactivated');
        }
      } else if (phase === 'phase1') {
        finalConfig.isPhase1Active = active;
        if (active) {
          // If Phase 1 is activated, deactivate other phases
          finalConfig.isEarlyBirdActive = false;
          finalConfig.isPhase2Active = false;
          console.log('🎫 Phase 1 activated - Early Bird and Phase 2 automatically deactivated');
        }
      } else if (phase === 'phase2') {
        finalConfig.isPhase2Active = active;
        if (active) {
          // If Phase 2 is activated, deactivate other phases
          finalConfig.isEarlyBirdActive = false;
          finalConfig.isPhase1Active = false;
          console.log('🎫 Phase 2 activated - Early Bird and Phase 1 automatically deactivated');
        }
      } else {
        return res.status(400).json({ message: 'Invalid phase. Must be: earlybird, phase1, or phase2' });
      }

      await storage.updateTicketConfig(finalConfig, userId);
      const updatedConfig = await storage.getTicketConfig();
      const counts = await storage.getTicketCounts();
      
      res.json({ 
        message: `${phase} ${active ? 'activated' : 'deactivated'} successfully`,
        config: updatedConfig, 
        counts 
      });
    } catch (error) {
      console.error('Error toggling phase:', error);
      res.status(500).json({ message: 'Failed to toggle phase' });
    }
  });

  // GET /api/admin/analytics - Get booking analytics
  app.get('/api/admin/analytics', authenticate, requirePermission(PERMISSIONS.VIEW_ANALYTICS), async (req, res) => {
    try {
      const bookings = await storage.getAllBookings();
      const counts = await storage.getTicketCounts();
      
      const analytics = {
        totalBookings: bookings.length,
        totalTicketsSold: bookings.reduce((sum, booking) => sum + booking.ticketCount, 0),
        totalRevenue: bookings.reduce((sum, booking) => sum + parseFloat(booking.totalAmount), 0),
        verifiedBookings: bookings.filter(b => b.paymentStatus === 'verified').length,
        pendingBookings: bookings.filter(b => b.paymentStatus === 'pending').length,
        scannedTickets: bookings.reduce((sum, booking) => sum + (booking.scannedGuests?.length || 0), 0),
        genderBreakdown: bookings.reduce((acc, booking) => {
          // Count primary ticket holder gender
          if (booking.gender) {
            const gender = booking.gender.toLowerCase();
            if (gender === 'male') acc.male++;
            else if (gender === 'female') acc.female++;
            else acc.other++;
          }
          
          // Count guest genders if available
          if (booking.guestGenders && Array.isArray(booking.guestGenders)) {
            booking.guestGenders.forEach(guestGender => {
              if (guestGender) {
                const gender = guestGender.toLowerCase();
                if (gender === 'male') acc.male++;
                else if (gender === 'female') acc.female++;
                else acc.other++;
              }
            });
          }
          
          return acc;
        }, { male: 0, female: 0, other: 0 }),
        ticketTypes: {
          earlyBird: counts.earlyBirdCount,
          phase1: counts.phase1Count
        },
        earlyBirdLimit: counts.earlyBirdLimit,
        recentBookings: bookings.slice(-5).reverse()
      };
      
      res.json(analytics);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      res.status(500).json({ message: 'Failed to fetch analytics' });
    }
  });

  // Booking Routes
  app.post('/api/bookings', async (req, res) => {
    try {
      console.log('📋 Received booking request:', JSON.stringify(req.body, null, 2));
      
      // Validate booking data using Zod schema
      const validationResult = insertBookingSchema.safeParse(req.body);
      if (!validationResult.success) {
        console.log('❌ Validation failed:', validationResult.error.issues);
        return res.status(400).json({ 
          message: 'Validation failed', 
          errors: validationResult.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message
          }))
        });
      }
      
      const bookingData = validationResult.data;
      
      // Check for duplicate booking (email + phone combination within last 5 minutes)
      const existingBookings = await storage.getAllBookings();
      const recentBooking = existingBookings.find(b => 
        b.email === bookingData.email && 
        b.phone === bookingData.phone && 
        (Date.now() - new Date(b.createdAt).getTime()) < 5 * 60 * 1000 // 5 minutes
      );
      
      if (recentBooking) {
        console.log('⚠️ Duplicate booking attempt detected');
        return res.status(400).json({ 
          message: 'Duplicate booking detected. Please wait 5 minutes before creating another booking with the same details.',
          existingBookingId: recentBooking.id
        });
      }
      
      // Get current ticket counts and config to determine pricing
      const counts = await storage.getTicketCounts();
      const config = await storage.getTicketConfig();
      
      // Enhanced capacity checking
      const totalCurrentBookings = existingBookings.reduce((sum, b) => sum + b.ticketCount, 0);
      const maxCapacity = config.maxCapacity || 500;
      
      if (totalCurrentBookings + bookingData.ticketCount > maxCapacity) {
        return res.status(400).json({ 
          message: `Cannot book ${bookingData.ticketCount} tickets. Only ${maxCapacity - totalCurrentBookings} spots remaining.`,
          remainingCapacity: maxCapacity - totalCurrentBookings
        });
      }
      
      let ticketPrice = 300; // Early bird price
      let ticketType = bookingData.ticketType || 'early_bird';
      
      // Check if Early Bird is active and available
      const isEarlyBirdAvailable = config.isEarlyBirdActive && (counts.earlyBirdCount + bookingData.ticketCount) <= counts.earlyBirdLimit;
      const isPhase1Available = config.isPhase1Active;
      
      // Determine ticket type and pricing based on availability and admin settings
      if (!isEarlyBirdAvailable || ticketType === 'phase_1') {
        if (isPhase1Available) {
          ticketPrice = parseInt(config.phase1Price) || 350;
          ticketType = 'phase_1';
        } else {
          return res.status(400).json({ 
            message: 'No tickets are currently available for sale',
            availableTickets: {
              earlyBird: Math.max(0, counts.earlyBirdLimit - counts.earlyBirdCount),
              phase1: isPhase1Available ? 'Available' : 'Not Active'
            }
          });
        }
      } else {
        ticketPrice = parseInt(config.earlyBirdPrice) || 300;
        ticketType = 'early_bird';
      }
      
      // Apply coupon if provided
      let couponDiscount = 0;
      if (bookingData.couponCode) {
        const coupon = await storage.getCouponByCode(bookingData.couponCode);
        if (coupon && coupon.isActive) {
          if (!coupon.usageLimit || (coupon.usageCount || 0) < coupon.usageLimit) {
            couponDiscount = coupon.discount;
            await storage.updateCouponUsage(bookingData.couponCode);
            console.log(`✅ Applied coupon ${bookingData.couponCode}: ${couponDiscount}% discount`);
          } else {
            console.log(`⚠️ Coupon ${bookingData.couponCode} usage limit reached`);
          }
        } else {
          console.log(`⚠️ Invalid or inactive coupon: ${bookingData.couponCode}`);
        }
      }

      // Calculate total amount with dynamic pricing
      const subtotal = bookingData.ticketCount * ticketPrice;
      const discountAmount = Math.round((subtotal * couponDiscount) / 100);
      const totalAmount = subtotal - discountAmount;
      
      // Generate unique guest codes for each ticket
      const guestCodes = generateGuestCodes(bookingData.ticketCount);
      
      const booking = await storage.createBooking({
        ...bookingData,
        ticketType,
        guestCodes,
        couponCode: bookingData.couponCode || null,
        totalAmount: totalAmount.toString(),
        couponDiscount,
        paymentStatus: 'pending'
      });

      console.log(`✅ Booking created with ID: ${booking.id}`);

      // Update ticket counts
      await storage.updateTicketCounts(ticketType, bookingData.ticketCount);

      // Update promoter stats if referrer was used
      if (booking.promoterId) {
        try {
          await storage.updatePromoterStats(booking.promoterId, totalAmount);
          console.log(`✅ Updated promoter stats for booking ${booking.id}`);
        } catch (error) {
          console.error('Failed to update promoter stats:', error);
        }
      }

      // Add booking to Google Sheets immediately
      try {
        const { GoogleSheetsService } = await import('./services/googleSheets');
        const googleSheetsService = new GoogleSheetsService();
        await googleSheetsService.addBookingToSheet(booking);
        console.log(`✅ Booking ${booking.id} synced to Google Sheets`);
      } catch (sheetsError: any) {
        console.error('Google Sheets sync failed:', sheetsError);
        // Don't fail the booking if sheets sync fails
      }

      // Send booking confirmation email immediately
      try {
        const { enhancedEmailService } = await import('./services/enhancedEmailService');
        await enhancedEmailService.sendPaymentConfirmationEmail({
          id: booking.id,
          name: booking.name,
          email: booking.email,
          phone: booking.phone,
          ticketCount: booking.ticketCount,
          totalAmount: booking.totalAmount,
          guests: booking.guests || [],
          guestCodes: booking.guestCodes || [],
          paymentStatus: booking.paymentStatus as any
        });
        console.log(`✅ Booking confirmation email sent to ${booking.email}`);
      } catch (emailError: any) {
        console.error('Failed to send booking confirmation email:', emailError);
        // Don't fail the booking if email fails
      }

      // Create Cashfree payment order
      const paymentResult = await paymentService.createPaymentOrder({
        bookingId: booking.id,
        amount: totalAmount,
        customerName: booking.name,
        customerEmail: booking.email,
        customerPhone: booking.phone,
      });
      
      if (!paymentResult.success) {
        console.error('Payment order creation failed:', paymentResult.error);
        return res.status(500).json({ 
          message: 'Payment order creation failed', 
          error: paymentResult.userMessage || paymentResult.error 
        });
      }
      
      // Update booking with payment ID
      await storage.updateBookingPaymentId(booking.id, paymentResult.orderId!);
      
      res.json({ 
        booking: {
          ...booking,
          totalAmount: totalAmount.toString(),
          ticketType
        }, 
        paymentLink: paymentResult.paymentLink,
        orderId: paymentResult.orderId,
        ticketCounts: await storage.getTicketCounts()
      });
    } catch (error: any) {
      console.error('❌ Booking creation error:', error);
      res.status(500).json({ message: 'Booking creation failed', error: error.message });
    }
  });

  app.get('/api/bookings', authenticate, requirePermission(PERMISSIONS.VIEW_BOOKINGS), async (req, res) => {
    try {
      const bookings = await storage.getAllBookings();
      res.json(bookings);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch bookings' });
    }
  });

  app.get('/api/bookings/:id', async (req, res) => {
    try {
      const booking = await storage.getBooking(parseInt(req.params.id));
      if (!booking) {
        return res.status(404).json({ message: 'Booking not found' });
      }
      res.json(booking);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch booking' });
    }
  });

  // Payment Routes
  app.get('/api/payment/redirect', (req, res) => {
    const { pa, pn, am, cu, tn, upi } = req.query;
    
    // Create a payment page that will redirect to UPI apps
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Payment - Telugu Night</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; min-height: 100vh; margin: 0; }
          .container { max-width: 400px; margin: 0 auto; background: rgba(255,255,255,0.1); padding: 30px; border-radius: 15px; backdrop-filter: blur(10px); }
          .amount { font-size: 2em; font-weight: bold; margin: 20px 0; }
          .btn { background: #4CAF50; color: white; padding: 15px 30px; border: none; border-radius: 25px; font-size: 1.1em; cursor: pointer; margin: 10px; text-decoration: none; display: inline-block; }
          .btn:hover { background: #45a049; }
          .qr-code { background: white; padding: 20px; border-radius: 10px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Telugu Night Payment</h1>
          <div class="amount">₹${am}</div>
          <p>Pay to: ${pn}</p>
          <p>UPI ID: ${pa}</p>
          <p>Description: ${tn}</p>
          
          <div id="qrcode" class="qr-code"></div>
          
          <a href="${upi}" class="btn" onclick="startTimer()">Pay with UPI Apps</a>
          <br>
          <small>After payment, take a screenshot and upload it for verification</small>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
        <script>
          QRCode.toCanvas(document.getElementById('qrcode'), '${upi}', {width: 250}, function(error) {
            if (error) console.error(error);
          });

          function startTimer() {
            setTimeout(() => {
              alert('After completing payment, please take a screenshot and upload it for verification.');
            }, 3000);
          }
        </script>
      </body>
      </html>
    `;
    
    res.send(html);
  });

  app.post('/api/bookings/:id/payment-proof', (req, res) => {
    // Custom multer error handling
    upload.single('screenshot')(req, res, async (err) => {
      try {
        if (err) {
          console.error('Multer upload error:', err);
          if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
              return res.status(400).json({ message: 'File too large. Maximum size is 10MB.' });
            }
            return res.status(400).json({ message: `Upload error: ${err.message}` });
          }
          return res.status(400).json({ message: err.message || 'File upload failed' });
        }

        const bookingId = parseInt(req.params.id);
        const booking = await storage.getBooking(bookingId);
        
        if (!booking) {
          return res.status(404).json({ message: 'Booking not found' });
        }

        if (!req.file) {
          return res.status(400).json({ 
            message: 'Screenshot is required. Please select an image file and try again.' 
          });
        }

        console.log(`📸 Screenshot uploaded: ${req.file.filename}, size: ${req.file.size} bytes`);
        
        const screenshotUrl = `/uploads/${req.file.filename}`;
        
        // Update booking with screenshot URL
        await storage.updateBookingPaymentStatus(bookingId, 'pending', screenshotUrl);
        console.log(`✅ Booking ${bookingId} updated with screenshot: ${screenshotUrl}`);
        
        // Update Google Sheets with screenshot URL
        try {
          const { GoogleSheetsService } = await import('./services/googleSheets');
          const googleSheetsService = new GoogleSheetsService();
          await googleSheetsService.addPaymentScreenshotToSheet(bookingId, `https://events.qlora.in${screenshotUrl}`);
          console.log(`✅ Screenshot added to Google Sheets for booking ${bookingId}`);
        } catch (sheetsError: any) {
          console.error('Google Sheets update failed:', sheetsError);
        }

        // Skip payment confirmation email after screenshot upload

        res.json({ 
          message: 'Payment screenshot uploaded successfully! Awaiting admin verification.',
          screenshotUrl: screenshotUrl,
          ticketsSent: false,
          filename: req.file.filename
        });
        
      } catch (error: any) {
        console.error('Screenshot upload error:', error);
        res.status(500).json({ 
          message: 'Failed to process screenshot upload. Please try again.',
          error: error.message 
        });
      }
    });
  });

  app.post('/api/bookings/:id/verify-payment', authenticate, requirePermission(PERMISSIONS.VERIFY_PAYMENTS), async (req, res) => {
    try {
      // Permission already checked by middleware

      const bookingId = parseInt(req.params.id);
      const booking = await storage.getBooking(bookingId);
      
      if (!booking) {
        return res.status(404).json({ message: 'Booking not found' });
      }

      // Generate guest codes and pass IDs
      const guestCodes = generateGuestCodes(booking.ticketCount);
      const passIds = generatePassIds(bookingId, booking.ticketCount);

      // Update booking with all details first
      await storage.updateBookingVerification(bookingId, 'verified', guestCodes);
      await storage.updateBookingQRCodes(bookingId, [], passIds, guestCodes);
      
      // Get updated booking and send enhanced email
      const updatedBooking = await storage.getBooking(bookingId);
      if (updatedBooking) {
        await enhancedEmailService.sendTicketEmails({
          ...updatedBooking,
          guests: updatedBooking.guests || [],
          guestCodes: updatedBooking.guestCodes || [],
          paymentStatus: updatedBooking.paymentStatus || 'verified'
        });
      }

      // Update Google Sheets (non-blocking)
      try {
        await googleSheetsService.updateBookingPaymentStatus(bookingId, 'verified');
      } catch (error: any) {
        console.log('Google Sheets update failed (non-critical):', error.message);
      }

      res.json({ 
        message: 'Payment verified successfully! QR tickets sent to customer email.',
        guestCodes,
        passIds,
        ticketsSent: true
      });
    } catch (error: any) {
      res.status(500).json({ message: 'Verification failed' });
    }
  });

  // Coupon Routes
  app.post('/api/coupons', authenticate, requirePermission(PERMISSIONS.MANAGE_COUPONS), async (req, res) => {
    try {
      const couponData = insertCouponSchema.parse(req.body);
      const coupon = await storage.createCoupon(couponData);
      res.json(coupon);
    } catch (error) {
      res.status(400).json({ message: 'Coupon creation failed' });
    }
  });

  app.get('/api/coupons', authenticate, requirePermission(PERMISSIONS.MANAGE_COUPONS), async (req, res) => {
    try {
      const coupons = await storage.getAllCoupons();
      res.json(coupons);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch coupons' });
    }
  });

  // Update coupon
  app.put('/api/coupons/:id', authenticate, requirePermission(PERMISSIONS.MANAGE_COUPONS), async (req, res) => {
    try {
      const couponId = parseInt(req.params.id);
      const updateData = req.body;
      
      if (!couponId) {
        return res.status(400).json({ message: 'Invalid coupon ID' });
      }
      
      const updatedCoupon = await storage.updateCoupon(couponId, updateData);
      res.json(updatedCoupon);
    } catch (error) {
      console.error('Error updating coupon:', error);
      res.status(500).json({ message: 'Failed to update coupon' });
    }
  });

  // Delete coupon
  app.delete('/api/coupons/:id', authenticate, requirePermission(PERMISSIONS.MANAGE_COUPONS), async (req, res) => {
    try {
      const couponId = parseInt(req.params.id);
      
      if (!couponId) {
        return res.status(400).json({ message: 'Invalid coupon ID' });
      }
      
      await storage.deleteCoupon(couponId);
      res.json({ message: 'Coupon deleted successfully' });
    } catch (error) {
      console.error('Error deleting coupon:', error);
      res.status(500).json({ message: 'Failed to delete coupon' });
    }
  });

  // Real-time coupon validation endpoint (public for booking form)
  app.post('/api/coupons/validate', async (req, res) => {
    try {
      const { code } = req.body;
      
      if (!code || typeof code !== 'string') {
        return res.status(400).json({ 
          valid: false, 
          discount: 0, 
          message: 'Coupon code is required' 
        });
      }

      const validation = await storage.validateCoupon(code.trim().toUpperCase());
      res.json(validation);
    } catch (error) {
      console.error('Coupon validation error:', error);
      res.status(500).json({ 
        valid: false, 
        discount: 0, 
        message: 'Validation failed' 
      });
    }
  });

  // Admin Routes - Protected with permissions (optimized with caching)
  app.get('/api/admin/bookings', authenticate, requirePermission(PERMISSIONS.VIEW_BOOKINGS), async (req, res) => {
    try {
      const bookings = await storage.getAllBookings();
      
      // Set cache headers for faster subsequent loads
      res.set({
        'Cache-Control': 'private, max-age=10', // 10 seconds cache for admin data
        'ETag': `"bookings-${bookings.length}-${Date.now()}"`,
        'Vary': 'Accept-Encoding'
      });
      
      res.json(bookings);
    } catch (error) {
      console.error('Failed to fetch bookings:', error);
      res.status(500).json({ message: 'Failed to fetch bookings' });
    }
  });

  app.post('/api/admin/bookings/:id/verify', authenticate, requirePermission(PERMISSIONS.VERIFY_PAYMENTS), async (req, res) => {
    try {
      const bookingId = parseInt(req.params.id);
      const action = req.body?.action || 'verify'; // Default to verify
      
      // Get booking first
      const booking = await storage.getBooking(bookingId);
      if (!booking) {
        return res.status(404).json({ message: 'Booking not found' });
      }
      
      if (action === 'verify') {
        await storage.updateBookingPaymentStatus(bookingId, 'verified');
        
        // Generate guest codes and pass IDs
        const guestCodes = generateGuestCodes(booking.ticketCount);
        const passIds = generatePassIds(bookingId, booking.ticketCount);
        
        // Update booking with generated codes
        await storage.updateBookingQRCodes(bookingId, [], passIds, guestCodes);
        
        // Get updated booking and send enhanced email with QR codes
        const updatedBooking = await storage.getBooking(bookingId);
        if (updatedBooking) {
          try {
            await enhancedEmailService.sendTicketEmails({
              ...updatedBooking,
              guests: updatedBooking.guests || [],
              guestCodes: updatedBooking.guestCodes || [],
              qrCodes: updatedBooking.qrCodes || [],
              paymentStatus: updatedBooking.paymentStatus || 'verified'
            });
            console.log(`✅ QR tickets sent successfully to ${updatedBooking.email}`);
          } catch (emailError) {
            console.error('Email sending failed (non-critical):', emailError);
            // Don't fail the verification if email fails
          }
        }
      } else if (action === 'reject') {
        await storage.updateBookingPaymentStatus(bookingId, 'pending');
      }
      
      res.json({ message: `Payment ${action === 'verify' ? 'verified' : 'rejected'} successfully` });
    } catch (error: unknown) {
      console.error('Verification error:', error);
      res.status(500).json({ message: 'Failed to update payment status' });
    }
  });

  app.post('/api/admin/bookings/:id/send-ticket', authenticate, requirePermission(PERMISSIONS.SEND_TICKETS), async (req, res) => {
    try {
      const bookingId = parseInt(req.params.id);
      const booking = await storage.getBooking(bookingId);
      
      if (!booking) {
        return res.status(404).json({ message: 'Booking not found' });
      }

      if (booking.paymentStatus !== 'verified') {
        return res.status(400).json({ message: 'Payment not verified yet' });
      }

      // Check if QR codes already exist - if so, reuse them instead of generating new ones
      const hasExistingQRCodes = booking.qrCodes && booking.qrCodes.length > 0;
      const hasExistingGuestCodes = booking.guestCodes && booking.guestCodes.length > 0;
      
      if (hasExistingQRCodes && hasExistingGuestCodes) {
        // Tickets already generated - just resend the existing email
        console.log(`♻️ Reusing existing QR codes for booking ${bookingId}`);
        
        try {
          await enhancedEmailService.sendTicketEmails({
            ...booking,
            qrCodes: booking.qrCodes || [],
            passIds: booking.passIds || [],
            guestCodes: booking.guestCodes || []
          });
          
          return res.json({ 
            message: 'Existing tickets resent successfully!',
            guestCodes: booking.guestCodes,
            passIds: booking.passIds,
            note: 'Used existing QR codes'
          });
        } catch (emailError: any) {
          console.error('Failed to resend existing tickets:', emailError);
          return res.status(500).json({ message: 'Failed to resend existing tickets' });
        }
      }

      // Generate new tickets only if they don't exist
      console.log(`🆕 Generating new QR codes for booking ${bookingId}`);
      
      // Use existing guest codes if available, otherwise generate new ones
      const guestCodes = hasExistingGuestCodes 
        ? (booking.guestCodes || [])
        : generateGuestCodes(booking.ticketCount);
      const passIds = generatePassIds(bookingId, booking.ticketCount);
      
      // Update booking verification status and codes (only if new codes were generated)
      if (!hasExistingGuestCodes) {
        await storage.updateBookingVerification(bookingId, 'verified', guestCodes);
      }
      
      // Use ticket generation service for consolidated QR generation and email sending
      const result = await ticketGenerationService.generateTicketsForBooking(bookingId);
      
      if (result.status === 'completed') {
        res.json({ 
          message: 'New tickets generated and sent successfully!',
          guestCodes: result.guestCodes,
          passIds: result.passIds,
          note: 'Generated new QR codes'
        });
      } else {
        res.status(500).json({ 
          message: 'Failed to generate tickets',
          errors: result.errors
        });
      }
    } catch (error: any) {
      console.error('Failed to send ticket:', error);
      res.status(500).json({ message: 'Failed to send ticket' });
    }
  });

  // Delete booking route
  app.delete('/api/admin/bookings/:id', authenticate, requirePermission(PERMISSIONS.DELETE_BOOKINGS), async (req, res) => {
    try {
      const bookingId = parseInt(req.params.id);
      const booking = await storage.getBooking(bookingId);
      
      if (!booking) {
        return res.status(404).json({ message: 'Booking not found' });
      }

      // Delete from database
      await storage.deleteBooking(bookingId);
      
      // Remove from Google Sheets
      try {
        const { GoogleSheetsService } = await import('./services/googleSheets');
        const googleSheetsService = new GoogleSheetsService();
        await googleSheetsService.deleteBookingFromSheet(bookingId);
        console.log(`✅ Booking ${bookingId} deleted from Google Sheets`);
      } catch (sheetsError: any) {
        console.error('Google Sheets delete failed:', sheetsError);
      }

      res.json({ 
        message: `Booking for ${booking.name} deleted successfully` 
      });
    } catch (error: any) {
      console.error('Failed to delete booking:', error);
      res.status(500).json({ message: 'Failed to delete booking' });
    }
  });

  // Guest Checklist Bulk Check-in Route
  app.post('/api/scanner/check-in-guests', authenticate, requirePermission(PERMISSIONS.SCANNER_ACCESS), async (req, res) => {
    try {
      const { bookingId, guestCodes } = req.body;
      
      if (!bookingId || !guestCodes || !Array.isArray(guestCodes) || guestCodes.length === 0) {
        return res.status(400).json({ message: 'Invalid booking ID or guest codes' });
      }

      const booking = await storage.getBooking(bookingId);
      if (!booking) {
        return res.status(404).json({ message: 'Booking not found' });
      }

      if (booking.paymentStatus !== 'verified') {
        return res.status(400).json({ message: 'Payment not verified for this booking' });
      }

      // Check that all guest codes belong to this booking
      const validGuestCodes = guestCodes.filter((code: string) => 
        booking.guestCodes && booking.guestCodes.includes(code)
      );

      if (validGuestCodes.length !== guestCodes.length) {
        return res.status(400).json({ message: 'Some guest codes do not belong to this booking' });
      }

      // Check for already scanned guests
      const alreadyScanned = validGuestCodes.filter((code: string) =>
        booking.scannedGuests && booking.scannedGuests.includes(code)
      );

      if (alreadyScanned.length > 0) {
        return res.status(400).json({ 
          message: `Some guests have already been checked in: ${alreadyScanned.join(', ')}` 
        });
      }

      // Add guests to scanned list
      const updatedScannedGuests = [...(booking.scannedGuests || []), ...validGuestCodes];
      await storage.updateBookingScannedGuests(bookingId, updatedScannedGuests);

      // Get guest names for response
      const guestDetails = validGuestCodes.map((code: string) => {
        const index = booking.guestCodes?.indexOf(code) || 0;
        return {
          guestCode: code,
          guestName: booking.guests?.[index] || `Guest ${index + 1}`,
          guestIndex: index
        };
      });

      console.log(`✅ Bulk guest check-in: ${validGuestCodes.length} guests from booking ${bookingId}`);

      res.json({
        success: true,
        message: `${validGuestCodes.length} guest(s) successfully checked in`,
        checkedInGuests: guestDetails,
        booking: await storage.getBooking(bookingId)
      });

    } catch (error: any) {
      console.error('Bulk check-in error:', error);
      res.status(500).json({ message: 'Check-in failed' });
    }
  });

  // Enhanced Scanner Route - Supports booking ID and individual guest codes
  app.post('/api/scanner/scan', authenticate, requirePermission(PERMISSIONS.SCANNER_ACCESS), async (req, res) => {
    try {
      const { scanData } = req.body;
      const code = scanData;
      
      if (!code) {
        return res.status(400).json({ 
          success: false,
          message: 'Code is required' 
        });
      }

      console.log(`🔍 Scanner attempting to verify code: ${code}`);

      // Try to find booking by ID first
      let booking = null;
      const numericCode = parseInt(code);
      
      if (!isNaN(numericCode)) {
        booking = await storage.getBooking(numericCode);
        console.log(`📋 Searched by booking ID ${numericCode}:`, booking ? 'Found' : 'Not found');
      }
      
      // If not found by ID, search by guest codes
      if (!booking) {
        const allBookings = await storage.getAllBookings();
        booking = allBookings.find(b => 
          b.guestCodes && Array.isArray(b.guestCodes) && b.guestCodes.includes(code.toUpperCase())
        );
        console.log(`🎫 Searched by guest code ${code}:`, booking ? `Found booking ${booking.id}` : 'Not found');
      }

      if (!booking) {
        return res.json({
          success: false,
          message: `Invalid code: ${code}. Check booking ID or guest code.`
        });
      }

      if (booking.paymentStatus !== 'verified') {
        return res.json({
          success: false,
          message: `Entry denied: Payment not verified for ${booking.name}`
        });
      }

      // Check for individual guest code scanning
      const isGuestCode = booking.guestCodes && Array.isArray(booking.guestCodes) && booking.guestCodes.includes(code.toUpperCase());
      
      if (isGuestCode) {
        // Individual guest check-in logic
        const guestCode = code.toUpperCase();
        const guestIndex = booking.guestCodes.indexOf(guestCode);
        const guestName = booking.guests?.[guestIndex] || `Guest ${guestIndex + 1}`;
        
        // Check if this specific guest has already been scanned
        if (booking.scannedGuests && booking.scannedGuests.includes(guestCode)) {
          return res.json({
            success: false,
            alreadyScanned: true,
            message: `${guestName} (${guestCode}) has already entered Telugu Night. Entry was confirmed earlier.`,
            booking: booking,
            guestInfo: {
              guestName,
              guestCode,
              guestIndex
            }
          });
        }
        
        // Add guest to scanned list
        const updatedScannedGuests = [...(booking.scannedGuests || []), guestCode];
        await storage.updateBookingScannedGuests(booking.id, updatedScannedGuests);
        
        // Get updated booking data
        const updatedBooking = await storage.getBooking(booking.id);
        
        console.log(`✅ Individual guest entry approved: ${guestName} (${guestCode}) for booking ${booking.id}`);
        
        return res.json({
          success: true,
          message: `Welcome ${guestName}! Individual entry verified.`,
          booking: updatedBooking,
          guestInfo: {
            guestName,
            guestCode,
            guestIndex
          }
        });
      }
      
      // Legacy full booking scanning (when someone scans the main booking QR)
      if (booking.isScanned) {
        return res.json({
          success: false,
          alreadyScanned: true,
          message: `This ticket has already been scanned for ${booking.name}. Entry was confirmed earlier.`,
          booking: booking
        });
      }

      // Mark as scanned
      await storage.scanTicket(booking.id, 1);
      const updatedBooking = await storage.getBooking(booking.id);
      
      console.log(`✅ Entry approved for booking ${booking.id}: ${booking.name}`);

      res.json({
        success: true,
        message: `Welcome ${booking.name}! Entry approved.`,
        booking: updatedBooking
      });
    } catch (error: any) {
      console.error('Scanner error:', error);
      res.status(500).json({ 
        success: false,
        message: 'Scanner system error' 
      });
    }
  });

  // Test SMTP Email Configuration
  app.post('/api/test-email', async (req, res) => {
    try {
      const { email, subject, message } = req.body;
      
      await enhancedEmailService.testEmailConnection(email || 'test@example.com');
      
      res.json({ 
        success: true, 
        message: 'SMTP connection test successful',
        config: {
          host: 'smtp.hostinger.com',
          port: '465',
          user: 'mis@aashveetech.com'
        }
      });
    } catch (error: any) {
      console.error('SMTP test failed:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message,
        error: error.code || error.errno
      });
    }
  });

  // Test Google Sheets API
  app.get('/api/test-sheets', async (req, res) => {
    try {
      const result = await googleSheetsService.testConnection();
      res.json(result);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ success: false, message: errorMessage });
    }
  });

  // Screenshot diagnostic endpoint for admin
  app.get('/api/admin/screenshot-diagnostic', authenticate, requirePermission(PERMISSIONS.VIEW_BOOKINGS), async (req, res) => {
    try {
      // Get all bookings with screenshot URLs
      const bookings = await storage.getAllBookings();
      const bookingsWithScreenshots = bookings.filter(b => b.paymentScreenshot);
      
      // Get actual files in uploads directory
      const uploadsDir = path.join(process.cwd(), 'uploads');
      const actualFiles = fs.readdirSync(uploadsDir).filter(f => f.startsWith('screenshot-'));
      
      // Check file sizes and validity
      const fileDetails = actualFiles.map(filename => {
        const filepath = path.join(uploadsDir, filename);
        const stats = fs.statSync(filepath);
        return {
          filename,
          size: stats.size,
          isLikelyValid: stats.size > 1000, // Files over 1KB are likely real images
          modified: stats.mtime
        };
      });
      
      // Check mismatches
      const mismatches = [];
      const working = [];
      const corrupted = [];
      
      for (const booking of bookingsWithScreenshots) {
        const filename = booking.paymentScreenshot.replace('/uploads/', '');
        const fileDetail = fileDetails.find(f => f.filename === filename);
        
        if (fileDetail) {
          if (fileDetail.isLikelyValid) {
            working.push({
              bookingId: booking.id,
              name: booking.name,
              email: booking.email,
              phone: booking.phone,
              filename,
              size: fileDetail.size,
              status: 'VALID',
              paymentStatus: booking.paymentStatus
            });
          } else {
            corrupted.push({
              bookingId: booking.id,
              name: booking.name,
              email: booking.email,
              phone: booking.phone,
              filename,
              size: fileDetail.size,
              status: 'CORRUPTED',
              paymentStatus: booking.paymentStatus,
              reuploadUrl: `${process.env.REPLIT_DEV_DOMAIN || 'http://localhost:5000'}/api/bookings/${booking.id}/reupload`
            });
          }
        } else {
          mismatches.push({
            bookingId: booking.id,
            name: booking.name,
            email: booking.email,
            phone: booking.phone,
            expectedFile: filename,
            status: 'MISSING',
            paymentStatus: booking.paymentStatus
          });
        }
      }
      
      res.json({
        totalBookingsWithScreenshots: bookingsWithScreenshots.length,
        actualFilesCount: actualFiles.length,
        validScreenshots: working.length,
        corruptedScreenshots: corrupted.length,
        missingScreenshots: mismatches.length,
        mismatches,
        working,
        corrupted,
        summary: {
          message: corrupted.length > 0 ? 
            `⚠️ ${corrupted.length} customers need to re-upload payment screenshots` :
            '✅ All screenshots are valid',
          corruptedCustomers: corrupted.map(c => `${c.name} (${c.phone}) - Booking #${c.bookingId}`)
        }
      });
    } catch (error) {
      res.status(500).json({ message: 'Diagnostic failed', error: error.message });
    }
  });

  // Customer re-upload route for corrupted screenshots
  app.get('/api/bookings/:id/reupload', async (req, res) => {
    try {
      const bookingId = parseInt(req.params.id);
      const booking = await storage.getBooking(bookingId);
      
      if (!booking) {
        return res.status(404).send(`
          <html>
            <head><title>Booking Not Found</title></head>
            <body style="font-family: Arial; text-align: center; padding: 50px;">
              <h1>Booking Not Found</h1>
              <p>The booking ID ${bookingId} could not be found.</p>
            </body>
          </html>
        `);
      }

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Re-upload Payment Screenshot - Telugu Night</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body { font-family: Arial; max-width: 600px; margin: 0 auto; padding: 20px; }
              .container { background: #f9f9f9; padding: 30px; border-radius: 10px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px; margin-bottom: 20px; }
              .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
              .upload-area { border: 2px dashed #ccc; padding: 40px; text-align: center; border-radius: 10px; margin: 20px 0; }
              .upload-area.dragover { border-color: #007bff; background: #f0f8ff; }
              .btn { background: #007bff; color: white; padding: 12px 30px; border: none; border-radius: 5px; cursor: pointer; font-size: 16px; }
              .btn:hover { background: #0056b3; }
              .success { background: #d4edda; border: 1px solid #c3e6cb; color: #155724; padding: 15px; border-radius: 5px; margin: 20px 0; }
              .error { background: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; padding: 15px; border-radius: 5px; margin: 20px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🎭 Telugu Night - Re-upload Payment Screenshot</h1>
                <p>Booking ID: #${booking.id} | ${booking.name}</p>
              </div>
              
              <div class="warning">
                <strong>⚠️ Screenshot Re-upload Required</strong><br>
                Your previous payment screenshot appears to be corrupted and needs to be uploaded again.
                This is due to a technical issue that has now been resolved.
              </div>

              <form id="reuploadForm" enctype="multipart/form-data">
                <div class="upload-area" id="uploadArea">
                  <input type="file" id="screenshot" name="screenshot" accept="image/*" style="display: none;" required>
                  <p><strong>📸 Click to Select Payment Screenshot</strong></p>
                  <p>JPG, PNG, GIF, WebP files up to 10MB</p>
                  <button type="button" class="btn" onclick="document.getElementById('screenshot').click()">Choose File</button>
                  <div id="fileName" style="margin-top: 15px; font-weight: bold;"></div>
                </div>
                
                <button type="submit" class="btn" id="submitBtn" disabled>Re-upload Screenshot</button>
              </form>

              <div id="message"></div>
            </div>

            <script>
              const form = document.getElementById('reuploadForm');
              const fileInput = document.getElementById('screenshot');
              const fileName = document.getElementById('fileName');
              const submitBtn = document.getElementById('submitBtn');
              const message = document.getElementById('message');

              fileInput.addEventListener('change', function() {
                if (this.files[0]) {
                  fileName.textContent = '✅ ' + this.files[0].name + ' (' + (this.files[0].size / 1024 / 1024).toFixed(2) + ' MB)';
                  fileName.style.color = 'green';
                  submitBtn.disabled = false;
                  submitBtn.style.background = '#28a745';
                }
              });

              form.addEventListener('submit', async function(e) {
                e.preventDefault();
                
                const formData = new FormData();
                formData.append('screenshot', fileInput.files[0]);
                
                submitBtn.disabled = true;
                submitBtn.textContent = 'Uploading...';
                
                try {
                  const response = await fetch('/api/bookings/${booking.id}/payment-proof', {
                    method: 'POST',
                    body: formData
                  });
                  
                  const result = await response.json();
                  
                  if (response.ok) {
                    message.innerHTML = '<div class="success">✅ Screenshot uploaded successfully! Your payment is now pending admin verification. You will receive QR tickets via email once verified.</div>';
                    form.style.display = 'none';
                  } else {
                    message.innerHTML = '<div class="error">❌ ' + result.message + '</div>';
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Re-upload Screenshot';
                  }
                } catch (error) {
                  message.innerHTML = '<div class="error">❌ Upload failed. Please try again.</div>';
                  submitBtn.disabled = false;
                  submitBtn.textContent = 'Re-upload Screenshot';
                }
              });
            </script>
          </body>
        </html>
      `;
      
      res.send(html);
    } catch (error) {
      console.error('Re-upload page error:', error);
      res.status(500).send('Internal server error');
    }
  });

  // Sync all bookings to Google Sheets route (for admin)
  app.post('/api/admin/sync-sheets', authenticate, requirePermission(PERMISSIONS.VIEW_BOOKINGS), async (req, res) => {
    try {
      const bookings = await storage.getAllBookings();
      console.log(`🔄 Starting Google Sheets sync for ${bookings.length} bookings...`);
      
      let syncedCount = 0;
      let errors = 0;
      const errorDetails: string[] = [];

      const { GoogleSheetsService } = await import('./services/googleSheets');
      const googleSheetsService = new GoogleSheetsService();

      for (const booking of bookings) {
        try {
          // Use syncBookingToSheet if available, otherwise addBookingToSheet
          if (typeof googleSheetsService.syncBookingToSheet === 'function') {
            await googleSheetsService.syncBookingToSheet(booking);
          } else {
            await googleSheetsService.addBookingToSheet(booking);
          }
          syncedCount++;
          console.log(`✅ Synced booking ${booking.id}: ${booking.name}`);
        } catch (error: any) {
          console.error(`❌ Failed to sync booking ${booking.id}:`, error.message);
          errors++;
          errorDetails.push(`Booking ${booking.id}: ${error.message}`);
        }
      }

      const message = `Synced ${syncedCount} bookings to Google Sheets (${errors} errors)`;
      console.log(`🎯 ${message}`);

      res.json({
        success: true,
        message,
        syncedCount,
        errors,
        totalBookings: bookings.length,
        errorDetails: errorDetails.slice(0, 3) // Show first 3 errors
      });
    } catch (error: any) {
      console.error('Bulk sync failed:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to sync bookings to Google Sheets',
        error: error.message
      });
    }
  });

  // Reset Google Sheets and sync fresh data
  app.post('/api/admin/reset-sheets', authenticate, requirePermission(PERMISSIONS.VIEW_BOOKINGS), async (req, res) => {
    try {
      console.log('🔄 Starting Google Sheets reset and fresh sync...');
      
      const { GoogleSheetsService } = await import('./services/googleSheets');
      const googleSheetsService = new GoogleSheetsService();
      
      // Step 1: Reset the sheet (clear all data and add fresh headers)
      const resetResult = await googleSheetsService.resetSheet();
      if (!resetResult.success) {
        return res.status(500).json({
          success: false,
          message: `Failed to reset sheet: ${resetResult.message}`
        });
      }
      
      console.log('✅ Google Sheet reset completed, now syncing all bookings...');
      
      // Step 2: Get all current bookings from database
      const bookings = await storage.getAllBookings();
      
      // Step 3: Sync all bookings to the fresh sheet
      const syncResult = await googleSheetsService.syncAllBookingsToFreshSheet(bookings);
      if (!syncResult.success) {
        return res.status(500).json({
          success: false,
          message: `Failed to sync bookings: ${syncResult.message}`
        });
      }
      
      const message = `Google Sheet reset and ${syncResult.successCount} bookings synced successfully`;
      console.log(`🎉 ${message}`);
      
      res.json({
        success: true,
        message,
        resetSuccess: true,
        totalBookings: bookings.length,
        syncedCount: syncResult.successCount,
        errors: syncResult.errorCount
      });
      
    } catch (error: any) {
      console.error('❌ Reset and sync failed:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to reset and sync Google Sheets'
      });
    }
  });

  // Test email route (for development)
  app.get('/api/test-email', async (req, res) => {
    try {
      const testBooking = {
        id: 999,
        name: 'Test User',
        email: 'systemtest@example.com',
        phone: '1234567890',
        ticketCount: 2,
        guests: ['Guest 1'],
        guestCodes: ['TEST01', 'TEST02'],
        totalAmount: '600',
        paymentStatus: 'verified',
        qrCodes: [],
        passIds: []
      };
      
      const result = await emailService.sendPaymentConfirmationEmail(testBooking);
      res.json({ message: 'Test email sent successfully', result });
    } catch (error) {
      console.error('Test email failed:', error);
      res.status(500).json({ message: 'Test email failed', error: error.message });
    }
  });

  // MANDATORY payment screenshot upload route with Google Drive  
  app.post('/api/bookings/:id/payment-proof', upload.single('screenshot'), async (req, res) => {
    try {
      const bookingId = parseInt(req.params.id);
      const booking = await storage.getBooking(bookingId);
      
      if (!booking) {
        return res.status(404).json({ message: 'Booking not found' });
      }
      
      if (!req.file) {
        return res.status(400).json({ 
          message: 'Screenshot upload is mandatory to complete your booking. Please upload payment proof.' 
        });
      }
      
      console.log(`📸 Uploading screenshot to public uploads folder for booking ${bookingId}...`);
      
      // Create unique filename with timestamp
      const timestamp = Date.now();
      const fileExtension = path.extname(req.file.originalname);
      const uniqueFilename = `payment-${bookingId}-${timestamp}${fileExtension}`;
      const publicPath = `/uploads/${uniqueFilename}`;
      
      // Move file to permanent location with unique name
      const oldPath = req.file.path;
      const newPath = path.join(process.cwd(), 'uploads', uniqueFilename);
      fs.renameSync(oldPath, newPath);
      
      console.log(`✅ Screenshot uploaded to public folder: ${publicPath}`);
      await storage.updateBookingPaymentStatus(bookingId, 'pending', publicPath);
      
      // Add screenshot to Google Sheets immediately
      try {
        const { GoogleSheetsService } = await import('./services/googleSheets');
        const googleSheetsService = new GoogleSheetsService();
        await googleSheetsService.addPaymentScreenshotToSheet(bookingId, `https://events.qlora.in${publicPath}`);
        console.log(`✅ Public screenshot URL synced to Google Sheets for booking ${bookingId}`);
      } catch (sheetsError) {
        console.error('Google Sheets screenshot sync failed:', sheetsError);
      }
      
      // Skip payment confirmation email after screenshot upload

      res.json({ 
        message: 'Screenshot uploaded successfully! Your booking is now pending admin verification.',
        screenshot: publicPath,
        booking: {
          id: booking.id,
          name: booking.name,
          paymentStatus: 'pending'
        }
      });
    } catch (error) {
      console.error('Screenshot upload error:', error);
      res.status(500).json({ message: 'Failed to upload screenshot' });
    }
  });

  // Customer re-upload page for corrupted screenshots
  app.get('/api/bookings/:id/reupload', async (req, res) => {
    try {
      const bookingId = parseInt(req.params.id);
      const booking = await storage.getBooking(bookingId);
      
      if (!booking) {
        return res.status(404).send(`
          <html><body style="font-family: Arial; text-align: center; margin-top: 50px;">
            <h2>❌ Booking Not Found</h2>
            <p>The booking ID ${bookingId} was not found in our system.</p>
          </body></html>
        `);
      }

      const totalWithFee = parseFloat(booking.totalAmount) + (booking.ticketCount * 12.96);
      
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Re-upload Payment Screenshot - Telugu Night</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 20px; padding: 30px; box-shadow: 0 20px 40px rgba(0,0,0,0.1); }
            .header { text-align: center; margin-bottom: 30px; }
            .header h1 { color: #333; margin: 0; font-size: 24px; }
            .booking-info { background: #f8f9fa; padding: 20px; border-radius: 10px; margin-bottom: 20px; }
            .upload-area { border: 3px dashed #007bff; border-radius: 10px; padding: 40px; text-align: center; margin: 20px 0; transition: all 0.3s ease; cursor: pointer; }
            .upload-area:hover { border-color: #0056b3; background: #f8f9ff; }
            .upload-area.dragover { border-color: #28a745; background: #f0fff4; }
            .btn { background: linear-gradient(45deg, #007bff, #0056b3); color: white; padding: 12px 30px; border: none; border-radius: 25px; cursor: pointer; font-size: 16px; margin: 10px; transition: all 0.3s ease; }
            .btn:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(0,123,255,0.3); }
            .btn:disabled { background: #ccc; cursor: not-allowed; transform: none; }
            .success { background: #d4edda; color: #155724; padding: 15px; border-radius: 5px; margin: 10px 0; border: 1px solid #c3e6cb; }
            .error { background: #f8d7da; color: #721c24; padding: 15px; border-radius: 5px; margin: 10px 0; border: 1px solid #f5c6cb; }
            .file-info { margin: 15px 0; padding: 10px; background: #e9ecef; border-radius: 5px; display: none; }
            .progress { background: #e9ecef; border-radius: 10px; height: 20px; margin: 10px 0; overflow: hidden; display: none; }
            .progress-bar { background: linear-gradient(45deg, #28a745, #20c997); height: 100%; width: 0%; transition: width 0.3s ease; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎫 Re-upload Payment Screenshot</h1>
              <p>Telugu Night Event - DTR, Manipal</p>
            </div>
            
            <div class="booking-info">
              <h3>Booking Details</h3>
              <p><strong>Booking ID:</strong> #${booking.id}</p>
              <p><strong>Name:</strong> ${booking.name}</p>
              <p><strong>Email:</strong> ${booking.email}</p>
              <p><strong>Tickets:</strong> ${booking.ticketCount}</p>
              <p><strong>Amount Paid:</strong> ₹${totalWithFee.toFixed(2)}</p>
            </div>

            <div style="background: #fff3cd; padding: 15px; border-radius: 10px; margin-bottom: 20px; border: 1px solid #ffeaa7;">
              <h4 style="margin: 0; color: #856404;">📸 Screenshot Upload Required</h4>
              <p style="margin: 10px 0 0 0; color: #856404;">Your previous screenshot was corrupted or missing. Please upload a clear image of your payment confirmation.</p>
            </div>

            <form id="uploadForm" enctype="multipart/form-data">
              <div class="upload-area" id="uploadArea" onclick="document.getElementById('fileInput').click()">
                <p><strong>📱 Drag & drop your screenshot here</strong></p>
                <p>or click to select file</p>
                <p style="font-size: 14px; color: #666; margin-top: 15px;">Supported: JPG, PNG, GIF, WebP (Max 10MB)</p>
              </div>
              
              <input type="file" id="fileInput" name="screenshot" accept="image/*" style="display: none;" required>
              
              <div class="file-info" id="fileInfo"></div>
              <div class="progress" id="progress">
                <div class="progress-bar" id="progressBar"></div>
              </div>
              
              <div style="text-align: center; margin-top: 20px;">
                <button type="submit" class="btn" id="submitBtn" disabled>
                  📤 Upload Screenshot
                </button>
              </div>
            </form>

            <div id="message"></div>

            <div class="footer">
              <p>Need help? Contact us at support@telugunight.com</p>
              <p>Event Date: August 3, 2025 | Venue: DTR, Manipal</p>
            </div>
          </div>

          <script>
            const fileInput = document.getElementById('fileInput');
            const uploadArea = document.getElementById('uploadArea');
            const fileInfo = document.getElementById('fileInfo');
            const submitBtn = document.getElementById('submitBtn');
            const progress = document.getElementById('progress');
            const progressBar = document.getElementById('progressBar');
            const message = document.getElementById('message');
            const form = document.getElementById('uploadForm');

            // Drag and drop functionality
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
              uploadArea.addEventListener(eventName, preventDefaults, false);
            });

            function preventDefaults(e) {
              e.preventDefault();
              e.stopPropagation();
            }

            ['dragenter', 'dragover'].forEach(eventName => {
              uploadArea.addEventListener(eventName, () => uploadArea.classList.add('dragover'), false);
            });

            ['dragleave', 'drop'].forEach(eventName => {
              uploadArea.addEventListener(eventName, () => uploadArea.classList.remove('dragover'), false);
            });

            uploadArea.addEventListener('drop', (e) => {
              const dt = e.dataTransfer;
              const files = dt.files;
              fileInput.files = files;
              handleFiles(files);
            });

            fileInput.addEventListener('change', (e) => {
              handleFiles(e.target.files);
            });

            function handleFiles(files) {
              if (files.length > 0) {
                const file = files[0];
                const fileSize = (file.size / (1024 * 1024)).toFixed(2);
                
                fileInfo.innerHTML = \`
                  <strong>Selected File:</strong> \${file.name}<br>
                  <strong>Size:</strong> \${fileSize} MB<br>
                  <strong>Type:</strong> \${file.type}
                \`;
                fileInfo.style.display = 'block';
                submitBtn.disabled = false;
              }
            }

            form.addEventListener('submit', async (e) => {
              e.preventDefault();
              
              if (!fileInput.files[0]) {
                message.innerHTML = '<div class="error">Please select a screenshot to upload.</div>';
                return;
              }

              const formData = new FormData();
              formData.append('screenshot', fileInput.files[0]);

              submitBtn.disabled = true;
              submitBtn.textContent = '📤 Uploading...';
              progress.style.display = 'block';
              
              // Simulate progress
              let progressValue = 0;
              const progressInterval = setInterval(() => {
                progressValue += Math.random() * 30;
                if (progressValue > 90) progressValue = 90;
                progressBar.style.width = progressValue + '%';
              }, 200);

              try {
                const response = await fetch('/api/bookings/${booking.id}/payment-proof', {
                  method: 'POST',
                  body: formData
                });
                
                clearInterval(progressInterval);
                progressBar.style.width = '100%';
                
                const result = await response.json();
                
                if (response.ok) {
                  message.innerHTML = '<div class="success">✅ Screenshot uploaded successfully! Your payment is now pending admin verification. You will receive QR tickets via email once verified.</div>';
                  form.style.display = 'none';
                } else {
                  throw new Error(result.message || 'Upload failed');
                }
              } catch (error) {
                clearInterval(progressInterval);
                message.innerHTML = \`<div class="error">❌ Upload failed: \${error.message}</div>\`;
                submitBtn.disabled = false;
                submitBtn.textContent = '📤 Upload Screenshot';
                progress.style.display = 'none';
              }
            });
          </script>
        </body>
        </html>
      `;
      
      res.send(html);
    } catch (error) {
      console.error('Re-upload page error:', error);
      res.status(500).send(`
        <html><body style="font-family: Arial; text-align: center; margin-top: 50px;">
          <h2>❌ Error</h2>
          <p>Unable to load re-upload page. Please try again later.</p>
        </body></html>
      `);
    }
  });

  // Manual verification - changes status from pending to verified  
  app.post('/api/admin/verify-payment/:id', authenticate, requirePermission(PERMISSIONS.VERIFY_PAYMENTS), async (req, res) => {
    try {
      const bookingId = parseInt(req.params.id);
      const booking = await storage.getBooking(bookingId);
      
      if (!booking) {
        return res.status(404).json({ message: 'Booking not found' });
      }
      
      if (booking.paymentStatus !== 'pending') {
        return res.status(400).json({ message: 'Booking is not in pending status' });
      }
      
      // Update payment status to verified
      await storage.updateBookingPaymentStatus(bookingId, 'verified');
      
      // Update Google Sheets
      try {
        const { GoogleSheetsService } = await import('./services/googleSheets');
        const googleSheetsService = new GoogleSheetsService();
        await googleSheetsService.updateBookingPaymentStatus(bookingId, 'verified');
      } catch (sheetsError) {
        console.error('Google Sheets update failed:', sheetsError);
      }
      
      res.json({
        message: 'Payment verified successfully. Booking is now ready for ticket generation.',
        booking: { ...booking, paymentStatus: 'verified' }
      });
    } catch (error: any) {
      console.error('Payment verification error:', error);
      res.status(500).json({ message: error.message || 'Failed to verify payment' });
    }
  });

  // Smart ticket generation for single booking with error handling
  app.post('/api/admin/generate-tickets/:id', authenticate, requirePermission(PERMISSIONS.VERIFY_PAYMENTS), async (req, res) => {
    try {
      const bookingId = parseInt(req.params.id);
      const booking = await storage.getBooking(bookingId);
      
      if (!booking) {
        return res.status(404).json({ message: 'Booking not found' });
      }
      
      if (booking.paymentStatus !== 'verified') {
        return res.status(400).json({ message: 'Payment must be verified before generating tickets' });
      }
      
      // Generate and send tickets via email
      const progress = await ticketGenerationService.generateTicketsForBooking(bookingId);
      
      res.json({
        message: 'Tickets generated and sent successfully!',
        progress: progress,
        qrCodes: progress.qrCodes.length,
        passIds: progress.passIds
      });
    } catch (error: any) {
      console.error('Ticket generation error:', error);
      res.status(500).json({ message: error.message || 'Failed to generate tickets' });
    }
  });

  // Delete booking with Google Sheets sync
  app.delete('/api/admin/bookings/:id', authenticate, requirePermission(PERMISSIONS.MANAGE_BOOKINGS), async (req, res) => {
    try {
      const bookingId = parseInt(req.params.id);
      const booking = await storage.getBooking(bookingId);
      
      if (!booking) {
        return res.status(404).json({ message: 'Booking not found' });
      }
      
      // Delete from database
      await storage.deleteBooking(bookingId);
      
      // Skip Google Sheets deletion as per user request - no matter what, Google Sheets should not change data
      console.log(`📋 Skipping Google Sheets deletion for booking ${bookingId} as per admin settings`);
      
      res.json({
        message: `Booking #${bookingId} for ${booking.name} has been deleted successfully.`,
        deletedBooking: booking
      });
    } catch (error: any) {
      console.error('Booking deletion error:', error);
      res.status(500).json({ message: error.message || 'Failed to delete booking' });
    }
  });

  // Batch ticket generation with progress tracking
  app.post('/api/admin/generate-tickets-batch', authenticate, requirePermission(PERMISSIONS.VERIFY_PAYMENTS), async (req, res) => {
    try {
      const { bookingIds } = req.body;
      
      if (!Array.isArray(bookingIds) || bookingIds.length === 0) {
        return res.status(400).json({ message: 'Invalid booking IDs provided' });
      }

      // Start batch processing
      const batchId = await ticketGenerationService.generateTicketsBatch(bookingIds);
      
      res.json({
        message: 'Batch ticket generation started',
        batchId,
        totalBookings: bookingIds.length
      });
    } catch (error: any) {
      console.error('Batch ticket generation error:', error);
      res.status(500).json({ message: error.message || 'Failed to start batch generation' });
    }
  });

  // Get batch progress
  app.get('/api/admin/batch-progress/:batchId', authenticate, requirePermission(PERMISSIONS.VIEW_BOOKINGS), async (req, res) => {
    try {
      const { batchId } = req.params;
      const progress = ticketGenerationService.getBatchProgress(batchId);
      
      if (!progress) {
        return res.status(404).json({ message: 'Batch not found' });
      }

      res.json(progress);
    } catch (error: any) {
      console.error('Batch progress error:', error);
      res.status(500).json({ message: 'Failed to get batch progress' });
    }
  });

  // Auto-generate tickets for all verified payments
  app.post('/api/admin/auto-generate-tickets', authenticate, requirePermission(PERMISSIONS.VERIFY_PAYMENTS), async (req, res) => {
    try {
      const batchIds = await ticketGenerationService.autoGenerateForVerifiedPayments();
      
      res.json({
        message: batchIds.length > 0 ? 'Auto-generation started' : 'No bookings need ticket generation',
        batchIds,
        totalBatches: batchIds.length
      });
    } catch (error: any) {
      console.error('Auto-generation error:', error);
      res.status(500).json({ message: error.message || 'Failed to start auto-generation' });
    }
  });

  // Complete payment verification endpoint with screenshot viewing and QR generation
  app.post('/api/admin/verify-payment', authenticate, requirePermission(PERMISSIONS.VERIFY_PAYMENTS), async (req, res) => {
    try {
      const { bookingId, action } = req.body;
      
      if (!bookingId || !action) {
        return res.status(400).json({ message: 'Missing bookingId or action' });
      }

      const booking = await storage.getBooking(bookingId);
      if (!booking) {
        return res.status(404).json({ message: 'Booking not found' });
      }

      if (action === 'verify') {
        console.log(`🔍 Manual verification for booking ${bookingId}: ${booking.name}`);
        console.log(`📸 Screenshot: ${booking.paymentScreenshot || 'No screenshot'}`);
        
        // Use the smart ticket generation system for verified payments
        const progress = await ticketGenerationService.generateTicketsForBooking(bookingId);
        
        console.log(`✅ Verification complete for booking ${bookingId}:`, {
          qrCodes: progress.qrCodes.length,
          passIds: progress.passIds.length,
          guestCodes: progress.guestCodes
        });

        res.json({ 
          message: `Payment verified and ${progress.qrCodes.length} QR tickets sent to ${booking.email}`,
          qrCodes: progress.qrCodes.length,
          passIds: progress.passIds,
          guestCodes: progress.guestCodes,
          booking: {
            id: booking.id,
            name: booking.name,
            email: booking.email,
            paymentStatus: 'verified'
          }
        });

      } else if (action === 'reject') {
        await storage.updateBookingVerification(bookingId, 'rejected', []);
        console.log(`❌ Payment rejected for booking ${bookingId}: ${booking.name}`);
        res.json({ 
          message: `Payment rejected for ${booking.name}`,
          booking: {
            id: booking.id,
            name: booking.name,
            paymentStatus: 'rejected'
          }
        });
      } else {
        res.status(400).json({ message: 'Invalid action. Use "verify" or "reject"' });
      }
    } catch (error: any) {
      console.error('Payment verification error:', error);
      res.status(500).json({ message: error.message || 'Failed to verify payment' });
    }
  });

  // Legacy admin verification route (kept for compatibility)
  app.post('/api/admin/verify-payment/:id', authenticate, requirePermission(PERMISSIONS.VERIFY_PAYMENTS), async (req, res) => {
    try {
      const bookingId = parseInt(req.params.id);
      
      // Use the new smart ticket generation system
      const progress = await ticketGenerationService.generateTicketsForBooking(bookingId);
      
      res.json({ 
        message: 'Payment verified and tickets sent',
        qrCodes: progress.qrCodes.length,
        passIds: progress.passIds
      });
    } catch (error: any) {
      console.error('Payment verification error:', error);
      res.status(500).json({ message: error.message || 'Failed to verify payment' });
    }
  });

  // Route to serve uploaded screenshots with proper error handling
  app.get('/uploads/:filename', (req, res) => {
    const filename = req.params.filename;
    const filepath = path.join(process.cwd(), 'uploads', filename);
    
    // Check if file exists
    if (!fs.existsSync(filepath)) {
      console.error(`Screenshot not found: ${filepath}`);
      return res.status(404).json({ message: 'Screenshot not found' });
    }
    
    // Set proper headers for image display
    const ext = path.extname(filename).toLowerCase();
    if (ext === '.jpg' || ext === '.jpeg') {
      res.setHeader('Content-Type', 'image/jpeg');
    } else if (ext === '.png') {
      res.setHeader('Content-Type', 'image/png');
    } else if (ext === '.gif') {
      res.setHeader('Content-Type', 'image/gif');
    } else if (ext === '.webp') {
      res.setHeader('Content-Type', 'image/webp');
    }
    
    res.sendFile(filepath, (err) => {
      if (err) {
        console.error('Error serving file:', err);
        res.status(404).json({ message: 'File not found' });
      }
    });
  });

  // Download QR ticket as JPG
  app.get('/api/bookings/:id/download-ticket', authenticate, async (req, res) => {
    try {
      const bookingId = parseInt(req.params.id);
      const booking = await storage.getBooking(bookingId);
      
      if (!booking) {
        return res.status(404).json({ message: 'Booking not found' });
      }

      if (booking.paymentStatus !== 'verified' || !booking.qrCodes || booking.qrCodes.length === 0) {
        return res.status(400).json({ message: 'No tickets available for download' });
      }

      // Create QR ticket image with booking details
      const QRCode = await import('qrcode');
      const Canvas = await import('canvas');
      const canvas = Canvas.default.createCanvas(800, 600);
      const ctx = canvas.getContext('2d');

      // Background
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, 800, 600);

      // Event title
      ctx.fillStyle = '#ffb347';
      ctx.font = 'bold 32px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Telugu Night - DTR, Manipal', 400, 80);

      // Booking details
      ctx.fillStyle = '#ffffff';
      ctx.font = '18px Arial';
      ctx.fillText(`Name: ${booking.name}`, 400, 150);
      ctx.fillText(`Email: ${booking.email}`, 400, 180);
      ctx.fillText(`Tickets: ${booking.ticketCount}`, 400, 210);
      ctx.fillText(`Booking ID: ${booking.id}`, 400, 240);

      // Guest codes
      if (booking.guestCodes && booking.guestCodes.length > 0) {
        ctx.fillText(`Guest Codes: ${booking.guestCodes.join(', ')}`, 400, 270);
      }

      // QR Code using guest code format
      const primaryGuestCode = booking.guestCodes?.[0] || 'ENTRY';
      const qrCodeDataUrl = await QRCode.toDataURL(`TELUGU-NIGHT-${booking.id}-${primaryGuestCode}`, {
        width: 200,
        margin: 2
      });
      
      const qrImg = new Canvas.default.Image();
      qrImg.src = qrCodeDataUrl;
      ctx.drawImage(qrImg, 300, 320, 200, 200);

      // Instructions
      ctx.font = '14px Arial';
      ctx.fillText('Show this QR code at the venue for entry', 400, 550);

      // Send as JPG
      const buffer = canvas.toBuffer('image/jpeg');
      res.set({
        'Content-Type': 'image/jpeg',
        'Content-Disposition': `attachment; filename="telugu-night-ticket-${booking.id}.jpg"`
      });
      res.send(buffer);
    } catch (error: any) {
      console.error('Ticket download error:', error);
      res.status(500).json({ message: 'Failed to generate ticket' });
    }
  });

  // Promoter authentication routes
  app.post('/api/promoter/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      
      const promoter = await storage.getPromoterByEmail(email);
      if (!promoter) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
      
      const bcrypt = await import('bcryptjs');
      const isValid = bcrypt.compareSync(password, promoter.password);
      
      if (!isValid) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
      
      // Update last login time
      await storage.updatePromoterLoginTime(promoter.id);
      
      // Create session
      const { v4: uuidv4 } = await import('uuid');
      const token = uuidv4();
      const session = {
        id: promoter.id,
        email: promoter.email,
        name: promoter.name,
        promoCode: promoter.promoCode,
        token,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      };
      
      res.json({ success: true, promoter: session });
    } catch (error) {
      console.error('Promoter login error:', error);
      res.status(500).json({ message: 'Login failed' });
    }
  });

  // Get promoter dashboard data
  app.get('/api/promoter/dashboard/:promoCode', async (req, res) => {
    try {
      const promoCode = req.params.promoCode.toUpperCase();
      const promoter = await storage.getPromoterByCode(promoCode);
      
      if (!promoter) {
        return res.status(404).json({ message: 'Promoter not found' });
      }
      
      // Get bookings referred by this promoter using both fields for compatibility
      const allBookings = await storage.getAllBookings();
      const promoterBookings = allBookings.filter(b => 
        b.promoCode === promoter.promoCode || 
        b.promoterId === promoter.id ||
        (b as any).referrer === promoter.promoCode
      );
      
      // Calculate real-time stats from actual bookings
      const totalRevenue = promoterBookings.reduce((sum, b) => sum + parseFloat(b.totalAmount || '0'), 0);
      const commissionRate = parseFloat(promoter.commission || '5'); // Commission is stored as percentage
      const commissionEarned = (totalRevenue * commissionRate) / 100;
      
      const stats = {
        totalBookings: promoterBookings.length,
        totalRevenue: totalRevenue,
        commission: commissionEarned,
        commissionRate: commissionRate,
        promoterInfo: {
          name: promoter.name,
          email: promoter.email,
          promoCode: promoter.promoCode,
          isActive: promoter.isActive,
          createdAt: promoter.createdAt,
          lastLoginAt: promoter.lastLoginAt
        },
        referralUrl: `https://events.qlora.in/book?ref=${promoter.promoCode}`,
        bookings: promoterBookings.map(b => ({
          id: b.id,
          name: b.name,
          email: b.email,
          phone: b.phone,
          ticketCount: b.ticketCount,
          totalAmount: b.totalAmount,
          paymentStatus: b.paymentStatus,
          createdAt: b.createdAt,
        })).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      };
      
      console.log(`📊 Dashboard stats for ${promoter.name}: ${stats.totalBookings} bookings, ₹${stats.totalRevenue} revenue, ₹${stats.commission.toFixed(2)} commission`);
      
      res.json({ success: true, stats });
    } catch (error) {
      console.error('Promoter dashboard error:', error);
      res.status(500).json({ message: 'Failed to fetch dashboard data' });
    }
  });

  // Track referral link clicks
  app.post('/api/promoter/track-click/:promoCode', async (req, res) => {
    try {
      const promoCode = req.params.promoCode.toUpperCase();
      const promoter = await storage.getPromoterByCode(promoCode);
      
      if (!promoter) {
        return res.status(404).json({ message: 'Promoter not found' });
      }
      
      // Track click data (you can store in database if needed)
      const clickData = {
        promoCode,
        timestamp: new Date().toISOString(),
        userAgent: req.headers['user-agent'],
        ip: req.ip,
        referrer: req.headers.referer
      };
      
      console.log(`🔗 Referral link clicked for ${promoter.name}:`, clickData);
      
      res.json({ 
        success: true, 
        message: 'Click tracked successfully',
        redirectUrl: '/book'
      });
    } catch (error) {
      console.error('Click tracking error:', error);
      res.status(500).json({ message: 'Failed to track click' });
    }
  });

  // Generate shareable referral link with metadata
  app.get('/api/promoter/share-link/:promoCode', async (req, res) => {
    try {
      const promoCode = req.params.promoCode.toUpperCase();
      const promoter = await storage.getPromoterByCode(promoCode);
      
      if (!promoter) {
        return res.status(404).json({ message: 'Promoter not found' });
      }
      
      const baseUrl = 'https://events.qlora.in';
      const referralUrl = `${baseUrl}/book?ref=${promoter.promoCode}`;
      
      const shareData = {
        url: referralUrl,
        title: 'Telugu Night - DTR Manipal',
        description: `Join me at Telugu Night! Book your tickets through my referral link and save!`,
        image: `${baseUrl}/api/og-image?promoter=${promoter.name}`,
        facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralUrl)}`,
        twitter: `https://twitter.com/intent/tweet?url=${encodeURIComponent(referralUrl)}&text=${encodeURIComponent('Join me at Telugu Night! Book your tickets now!')}`,
        whatsapp: `https://wa.me/?text=${encodeURIComponent(`Join me at Telugu Night! Book your tickets: ${referralUrl}`)}`,
        instagram: referralUrl // Instagram doesn't support direct sharing, just provide the link
      };
      
      res.json({ success: true, shareData });
    } catch (error) {
      console.error('Share link generation error:', error);
      res.status(500).json({ message: 'Failed to generate share link' });
    }
  });

  // Event management routes
  app.post('/api/admin/events', authenticate, requirePermission(PERMISSIONS.SYSTEM_SETTINGS), async (req, res) => {
    try {
      const eventData = req.body;
      const event = await storage.createEvent({
        ...eventData,
        createdBy: req.user.id,
      });
      res.json({ success: true, event });
    } catch (error) {
      console.error('Event creation error:', error);
      res.status(500).json({ message: 'Failed to create event' });
    }
  });

  app.get('/api/events', async (req, res) => {
    try {
      const events = await storage.getAllEvents();
      res.json({ success: true, events });
    } catch (error) {
      console.error('Events fetch error:', error);
      res.status(500).json({ message: 'Failed to fetch events' });
    }
  });

  app.post('/api/admin/events/:id/toggle-booking', authenticate, requirePermission(PERMISSIONS.SYSTEM_SETTINGS), async (req, res) => {
    try {
      const eventId = parseInt(req.params.id);
      const { bookingOpen } = req.body;
      
      await storage.updateEventBookingStatus(eventId, bookingOpen);
      res.json({ success: true });
    } catch (error) {
      console.error('Booking toggle error:', error);
      res.status(500).json({ message: 'Failed to toggle booking status' });
    }
  });

  // Toggle promoter status
  app.patch('/api/admin/promoters/:id/toggle', authenticate, requirePermission(PERMISSIONS.MANAGE_USERS), async (req, res) => {
    try {
      const promoterId = parseInt(req.params.id);
      const { isActive } = req.body;

      if (isNaN(promoterId)) {
        return res.status(400).json({ message: 'Invalid promoter ID' });
      }

      if (typeof isActive !== 'boolean') {
        return res.status(400).json({ message: 'isActive must be a boolean' });
      }

      const updatedPromoter = await storage.updatePromoterStatus(promoterId, isActive);
      res.json({ 
        message: 'Promoter status updated successfully', 
        promoter: updatedPromoter 
      });
    } catch (error) {
      console.error('Error toggling promoter status:', error);
      res.status(500).json({ message: 'Failed to update promoter status' });
    }
  });

  // Promoter management for admin
  app.post('/api/admin/promoters', authenticate, requirePermission(PERMISSIONS.MANAGE_USERS), async (req, res) => {
    try {
      const promoterData = req.body;
      
      // Generate password before creating promoter
      const plainPassword = Math.random().toString(36).slice(-8);
      
      console.log('Creating promoter with data:', { ...promoterData, password: '[HIDDEN]' });
      const promoter = await storage.createPromoter(promoterData, plainPassword);
      
      // Send login credentials via email
      try {
        const { EmailService } = await import('./services/emailService');
        const emailService = new EmailService();
        const referralUrl = `https://events.qlora.in/book?ref=${promoter.promoCode}`;
        await emailService.sendPromoterCredentials(promoter.email, plainPassword, promoter.promoCode, referralUrl);
        console.log('✅ Promoter credentials sent to:', promoter.email);
      } catch (emailError) {
        console.error('Failed to send promoter credentials:', emailError);
      }
      
      res.json({ success: true, promoter });
    } catch (error) {
      console.error('Promoter creation error:', error);
      res.status(500).json({ message: 'Failed to create promoter' });
    }
  });

  app.get('/api/admin/promoters', async (req, res) => {
    try {
      const promoters = await storage.getAllPromoters();
      res.json({ success: true, promoters });
    } catch (error: unknown) {
      console.error('Promoters fetch error:', error);
      res.status(500).json({ message: 'Failed to fetch promoters' });
    }
  });

  // Cashfree webhook endpoint with enhanced error handling and logging
  app.post('/api/webhooks/cashfree', async (req, res) => {
    const webhookId = `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    
    try {
      console.log(`🔔 [${webhookId}] Incoming Cashfree webhook started`);
      
      const { CashfreeService } = await import('./services/cashfreeService');
      const cashfreeService = new CashfreeService();
      
      const signature = req.headers['x-webhook-signature'] as string;
      const timestamp = req.headers['x-webhook-timestamp'] as string;
      
      // Get raw body for signature verification (req.body is already parsed JSON)
      const rawBody = JSON.stringify(req.body);
      
      // Log webhook details for debugging
      console.log(`📋 [${webhookId}] Webhook details:`, {
        headers: {
          signature: signature ? '***present***' : 'missing',
          timestamp,
          'content-type': req.headers['content-type'],
          'user-agent': req.headers['user-agent']
        },
        bodySize: rawBody.length,
        parsedBody: req.body
      });
      
      // Verify webhook signature (skip verification in test mode for development)
      const isTestMode = process.env.NODE_ENV === 'development' || process.env.CASHFREE_TEST_MODE === 'true';
      
      if (!isTestMode) {
        const isValid = await cashfreeService.verifyWebhook(signature, timestamp, rawBody);
        if (!isValid) {
          console.error(`❌ [${webhookId}] Webhook signature verification failed`);
          return res.status(400).json({ 
            message: 'Invalid webhook signature',
            webhookId,
            timestamp: new Date().toISOString()
          });
        }
      } else {
        console.log(`⚠️ [${webhookId}] Skipping webhook signature verification in test mode`);
      }
      
      const { order_id, order_status, payment_amount, cf_payment_id, payment_method } = req.body;
      
      if (!order_id) {
        console.error(`❌ [${webhookId}] Missing order_id in webhook payload`);
        return res.status(400).json({ 
          message: 'Missing order_id in webhook payload',
          webhookId 
        });
      }
      
      // Find booking by payment ID with detailed logging
      console.log(`🔍 [${webhookId}] Looking up booking for order_id: ${order_id}`);
      const booking = await storage.getBookingByPaymentId(order_id);
      
      if (!booking) {
        console.error(`❌ [${webhookId}] No booking found for order_id: ${order_id}`);
        return res.status(404).json({ 
          message: 'Booking not found',
          order_id,
          webhookId 
        });
      }
      
      console.log(`📊 [${webhookId}] Found booking ${booking.id} for ${booking.email} with current status: ${booking.paymentStatus}`);
      
      // Check for duplicate webhook processing (idempotency)
      if (booking.paymentStatus === 'verified' && order_status === 'PAID') {
        console.log(`⚠️ [${webhookId}] Duplicate webhook - booking ${booking.id} already verified`);
        return res.json({ 
          message: 'Webhook already processed (duplicate)',
          status: 'verified',
          webhookId,
          alreadyProcessed: true
        });
      }
      
      // Process different webhook events
      let newStatus = booking.paymentStatus || 'pending';
      let actionTaken = 'none';
      
      try {
        switch (order_status) {
          case 'PAID':
          case 'SUCCESS':
            newStatus = 'verified';
            actionTaken = 'payment_verified';
            
            console.log(`💰 [${webhookId}] Payment successful for booking ${booking.id}, updating status to verified`);
            await storage.updateBookingPaymentStatus(booking.id, 'verified');
            
            // Skip payment completion email - only send QR tickets directly
            
            // Update Google Sheets with payment completion
            try {
              const { GoogleSheetsService } = await import('./services/googleSheets');
              const googleSheetsService = new GoogleSheetsService();
              await googleSheetsService.updateBookingPaymentStatus(booking.id, 'verified');
              console.log(`📊 [${webhookId}] Google Sheets updated with payment status for booking ${booking.id}`);
            } catch (sheetsError: any) {
              console.error(`❌ [${webhookId}] Google Sheets update failed for booking ${booking.id}:`, sheetsError);
              // Don't fail the webhook if sheets update fails
            }
            
            // Generate and send tickets automatically
            try {
              const { TicketGenerationService } = await import('./services/ticketGenerationService');
              const ticketService = new TicketGenerationService();
              await ticketService.generateTicketsForBooking(booking.id);
              console.log(`🎫 [${webhookId}] Tickets auto-generated and sent for booking ${booking.id}`);
              actionTaken = 'payment_verified_all_processed';
            } catch (ticketError: any) {
              console.error(`❌ [${webhookId}] Auto ticket generation failed for booking ${booking.id}:`, ticketError);
              actionTaken = 'payment_verified_tickets_failed';
              // Don't fail the webhook if ticket generation fails
            }
            break;
            
          case 'FAILED':
          case 'CANCELLED':
          case 'TERMINATED':
            newStatus = 'failed';
            actionTaken = 'payment_failed';
            
            console.log(`💸 [${webhookId}] Payment failed for booking ${booking.id}, updating status to failed`);
            await storage.updateBookingPaymentStatus(booking.id, 'failed');
            break;
            
          case 'PENDING':
          case 'ACTIVE':
            console.log(`⏳ [${webhookId}] Payment still pending for booking ${booking.id}, no action taken`);
            actionTaken = 'status_logged';
            break;
            
          default:
            console.warn(`⚠️ [${webhookId}] Unknown order status: ${order_status} for booking ${booking.id}`);
            actionTaken = 'unknown_status';
        }
        
        // Log transaction details for audit trail
        const transactionLog = {
          webhookId,
          bookingId: booking.id,
          orderId: order_id,
          cfPaymentId: cf_payment_id,
          paymentAmount: payment_amount,
          paymentMethod: payment_method,
          oldStatus: booking.paymentStatus,
          newStatus,
          orderStatus: order_status,
          actionTaken,
          processedAt: new Date().toISOString(),
          processingTimeMs: Date.now() - startTime
        };
        
        console.log(`📝 [${webhookId}] Transaction log:`, transactionLog);
        
        const response = {
          message: 'Webhook processed successfully',
          status: newStatus,
          webhookId,
          actionTaken,
          processingTime: `${Date.now() - startTime}ms`,
          timestamp: new Date().toISOString()
        };
        
        console.log(`✅ [${webhookId}] Webhook processing completed successfully in ${Date.now() - startTime}ms`);
        res.json(response);
        
      } catch (processingError: any) {
        console.error(`❌ [${webhookId}] Error processing webhook for booking ${booking.id}:`, processingError);
        
        // Try to recover by at least logging the webhook attempt
        try {
          console.log(`🔄 [${webhookId}] Attempting error recovery...`);
          // Could implement retry queue here for failed webhook processing
        } catch (recoveryError) {
          console.error(`❌ [${webhookId}] Recovery attempt also failed:`, recoveryError);
        }
        
        throw processingError;
      }
      
    } catch (error: any) {
      const processingTime = Date.now() - startTime;
      console.error(`💥 [${webhookId}] Webhook processing failed after ${processingTime}ms:`, {
        error: error.message,
        stack: error.stack,
        body: req.body,
        headers: {
          signature: req.headers['x-webhook-signature'] ? '***present***' : 'missing',
          timestamp: req.headers['x-webhook-timestamp']
        }
      });
      
      res.status(500).json({ 
        message: 'Webhook processing failed',
        webhookId,
        error: error.message,
        timestamp: new Date().toISOString(),
        processingTime: `${processingTime}ms`
      });
    }
  });
  
  // Refund Routes with proper error handling
  app.post('/api/admin/bookings/:id/refund', authenticate, requirePermission(PERMISSIONS.MANAGE_PAYMENTS), async (req, res) => {
    const refundId = `refund_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const bookingId = parseInt(req.params.id);
      const { refundAmount, refundNote } = req.body;
      
      console.log(`💰 [${refundId}] Processing refund request for booking ${bookingId}`);
      
      // Get booking details
      const booking = await storage.getBooking(bookingId);
      if (!booking) {
        return res.status(404).json({ message: 'Booking not found' });
      }
      
      if (!booking.paymentId) {
        return res.status(400).json({ message: 'No payment ID found for this booking' });
      }
      
      if (booking.paymentStatus !== 'verified') {
        return res.status(400).json({ message: 'Can only refund verified payments' });
      }
      
      // Validate refund amount
      const maxRefundAmount = parseFloat(booking.totalAmount.toString());
      const requestedRefund = parseFloat(refundAmount);
      
      if (requestedRefund <= 0 || requestedRefund > maxRefundAmount) {
        return res.status(400).json({ 
          message: `Refund amount must be between ₹1 and ₹${maxRefundAmount}` 
        });
      }
      
      const { CashfreeService } = await import('./services/cashfreeService');
      const cashfreeService = new CashfreeService();
      
      const refundRequest = {
        refund_amount: requestedRefund,
        refund_id: cashfreeService.generateRefundId(booking.paymentId),
        refund_note: refundNote || `Refund for booking ${bookingId}`
      };
      
      // Create refund with Cashfree
      const refundResponse = await cashfreeService.createRefund(booking.paymentId, refundRequest);
      
      // Update booking status to indicate refund processed
      await storage.updateBookingPaymentStatus(bookingId, 'refunded');
      
      console.log(`✅ [${refundId}] Refund processed successfully for booking ${bookingId}`);
      
      res.json({
        success: true,
        message: 'Refund processed successfully',
        refundId: refundResponse.cf_refund_id,
        refundAmount: requestedRefund,
        refundStatus: refundResponse.refund_status,
        processingId: refundId
      });
      
    } catch (error: any) {
      console.error(`❌ [${refundId}] Refund processing failed:`, error);
      
      const { CashfreeService } = await import('./services/cashfreeService');
      const cashfreeService = new CashfreeService();
      const userFriendlyMessage = cashfreeService.getUserFriendlyError(error);
      
      res.status(500).json({ 
        message: userFriendlyMessage,
        refundId,
        error: error.message
      });
    }
  });
  
  app.get('/api/admin/bookings/:id/refund-status', authenticate, requirePermission(PERMISSIONS.VIEW_REPORTS), async (req, res) => {
    try {
      const bookingId = parseInt(req.params.id);
      const { refundId } = req.query;
      
      if (!refundId) {
        return res.status(400).json({ message: 'Refund ID is required' });
      }
      
      const booking = await storage.getBooking(bookingId);
      if (!booking) {
        return res.status(404).json({ message: 'Booking not found' });
      }
      
      if (!booking.paymentId) {
        return res.status(400).json({ message: 'No payment ID found for this booking' });
      }
      
      const { CashfreeService } = await import('./services/cashfreeService');
      const cashfreeService = new CashfreeService();
      
      const refundStatus = await cashfreeService.getRefundStatus(booking.paymentId, refundId as string);
      
      res.json({
        success: true,
        refundStatus: refundStatus.refund_status,
        refundAmount: refundStatus.refund_amount,
        processedAt: refundStatus.processed_at,
        refundId: refundStatus.cf_refund_id
      });
      
    } catch (error: any) {
      console.error('Refund status check failed:', error);
      res.status(500).json({ 
        message: 'Failed to check refund status',
        error: error.message 
      });
    }
  });

  // Public route for sending tickets from payment success page (no authentication required)
  app.post('/api/public/bookings/:id/send-tickets', async (req, res) => {
    try {
      const bookingId = parseInt(req.params.id);
      const booking = await storage.getBooking(bookingId);
      
      if (!booking) {
        return res.status(404).json({ message: 'Booking not found' });
      }

      // Only allow ticket sending for verified payments
      if (booking.paymentStatus !== 'verified') {
        return res.status(400).json({ message: 'Payment not verified yet' });
      }

      // Check if QR codes already exist - if so, reuse them
      const hasExistingQRCodes = booking.qrCodes && booking.qrCodes.length > 0;
      const hasExistingGuestCodes = booking.guestCodes && booking.guestCodes.length > 0;
      
      if (hasExistingQRCodes && hasExistingGuestCodes) {
        // Tickets already generated - just resend the existing email
        console.log(`♻️ Public route: Reusing existing QR codes for booking ${bookingId}`);
        
        try {
          await enhancedEmailService.sendTicketEmails({
            ...booking,
            qrCodes: booking.qrCodes || [],
            passIds: booking.passIds || [],
            guestCodes: booking.guestCodes || []
          });
          
          return res.json({ 
            message: 'QR tickets sent successfully!',
            guestCodes: booking.guestCodes,
            passIds: booking.passIds,
            note: 'Existing QR codes resent'
          });
        } catch (emailError: any) {
          console.error('Failed to resend existing tickets via public route:', emailError);
          return res.status(500).json({ message: 'Failed to resend tickets' });
        }
      }

      // Generate new tickets using the ticket generation service
      console.log(`🆕 Public route: Generating new QR codes for booking ${bookingId}`);
      
      const result = await ticketGenerationService.generateTicketsForBooking(bookingId);
      
      if (result.status === 'completed') {
        res.json({ 
          message: 'QR tickets generated and sent successfully!',
          guestCodes: result.guestCodes,
          passIds: result.passIds,
          note: 'New QR codes generated and sent'
        });
      } else {
        res.status(500).json({ 
          message: 'Failed to generate tickets',
          errors: result.errors
        });
      }
    } catch (error: any) {
      console.error('Public route: Failed to send tickets:', error);
      res.status(500).json({ message: 'Failed to process ticket request' });
    }
  });

  // Health check endpoint for production
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0'
    });
  });

  const httpServer = createServer(app);
  return httpServer;
}
