import type { Express } from "express";
// http server creation is handled in server/index.ts
import bcrypt from 'bcryptjs';
import compression from 'compression';
import path from "path";
import fs from "fs";
import { storage } from "./databaseStorage";
import { GoogleSheetsService } from "./services/googleSheets";
import { EmailService } from "./services/emailService";
import { enhancedEmailService } from "./services/enhancedEmailService";
import { PaymentService } from "./services/paymentService";
import { authService } from "./services/authService";
import { TicketGenerationService } from "./services/ticketGenerationService";
import { authenticate, requirePermission, requireRole } from "./middleware/authMiddleware";
import { getPublicBaseUrl } from "./utils/urlUtils";
import { insertBookingSchema, insertCouponSchema, insertUserSchema, PERMISSIONS } from "@shared/schema";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { registerWebhookMonitoringRoutes } from "./routes/webhookMonitoring";

// All payments are fully automated via Cashfree webhooks - no manual uploads or verification needed

// Helper function to convert database booking to BookingData format
function toBookingData(booking: any): any {
  return {
    ...booking,
    guests: booking.guests || [],
    guestCodes: booking.guestCodes || [],
    paymentStatus: booking.paymentStatus || 'pending',
    qrCodes: booking.qrCodes || [],
    passIds: booking.passIds || [],
    totalAmount: booking.totalAmount ? booking.totalAmount.toString() : '0'
  };
}

export async function registerRoutes(app: Express): Promise<Express> {
  // PRIORITY: Cashfree webhook endpoints (must be FIRST to avoid middleware interference)
  app.get('/api/webhooks/cashfree', async (req, res) => {
    const timestamp = new Date().toISOString();
    const validationId = `VAL-${Date.now()}`;
    
    console.log(`🎯 [${validationId}] GET webhook validation started at ${timestamp}`);
    console.log(`📋 [${validationId}] Request details:`, {
      method: req.method,
      url: req.url,
      headers: {
        'user-agent': req.headers['user-agent'],
        'x-forwarded-for': req.headers['x-forwarded-for'],
        'x-real-ip': req.headers['x-real-ip'],
        'host': req.headers['host'],
        'origin': req.headers['origin']
      },
      query: req.query,
      ip: req.ip
    });
    
    // Cashfree webhook validation requires simple 200 response
    console.log(`✅ [${validationId}] Webhook validation successful - responding with 200 OK`);
    res.status(200).send('OK');
  });

  // CRITICAL: POST webhook handler for Cashfree payment notifications (Enhanced)
  // Raw body parsing is now handled in server/index.ts before global JSON middleware
  app.post('/api/webhooks/cashfree', async (req: any, res: any) => {
    const webhookId = `WH-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();
    
    try {
      console.log(`🎯 [${webhookId}] Enhanced webhook processing started at ${timestamp}`);
      
      // Get request data
      const rawBody = req.body ? req.body.toString() : '';
      const signature = req.headers['x-webhook-signature'] as string;
      const webhookTimestamp = req.headers['x-webhook-timestamp'] as string;
      const userAgent = req.headers['user-agent'] as string || 'unknown';
      const clientIp = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.ip || 'unknown';

      console.log(`📋 [${webhookId}] Request metadata:`, {
        contentType: req.headers['content-type'],
        payloadSize: rawBody.length,
        userAgent: userAgent.substring(0, 100),
        clientIp,
        hasSignature: !!signature,
        hasTimestamp: !!webhookTimestamp
      });

      // Import and use enhanced webhook service
      const { enhancedWebhookService } = await import('./services/enhancedWebhookService');
      
      // Process webhook with comprehensive enhancements
      const result = await enhancedWebhookService.processWebhook(
        webhookId,
        signature,
        webhookTimestamp,
        rawBody,
        userAgent,
        clientIp
      );

      // Log processing result
      console.log(`📊 [${webhookId}] Processing completed:`, {
        success: result.success,
        status: result.status,
        processingTime: result.processingTimeMs,
        bookingId: result.bookingId
      });

      // Return appropriate response based on result
      if (result.success) {
        // Add security headers to response
        res.setHeader('X-Webhook-ID', webhookId);
        res.setHeader('X-Processing-Time', result.processingTimeMs?.toString() || '0');
        
        res.status(200).json({
          success: true,
          message: result.message,
          webhookId: webhookId,
          status: result.status,
          processingTimeMs: result.processingTimeMs
        });
      } else {
        // Handle errors appropriately
        const statusCode = result.error?.includes('Rate limit') ? 429 :
                          result.error?.includes('signature') ? 401 :
                          result.error?.includes('JSON') ? 400 : 500;
        
        res.status(statusCode).json({
          success: false,
          error: result.message,
          webhookId: webhookId,
          details: result.error
        });
      }

    } catch (error: any) {
      console.error(`💥 [${webhookId}] Critical webhook error:`, error);
      
      // Always return 200 for critical errors to prevent webhook retries
      // Log the error for investigation
      res.status(200).json({
        success: false,
        error: 'Webhook received but processing failed',
        webhookId: webhookId,
        message: 'Error logged for investigation'
      });
    }
  });

  // Enable compression for faster response times
  app.use(compression({
    threshold: 1024, // Only compress if response is > 1KB
    level: 6, // Compression level (1-9, 6 is default)
    chunkSize: 16 * 1024 // 16KB chunks
  }));

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
          message: 'Payment is being processed automatically. Please wait a few minutes for verification.',
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
          message: 'Payment is being processed automatically. Please wait a few minutes for verification.'
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
          finalConfig.isPhase3Active = false;
          finalConfig.isPhase4Active = false;
          console.log('🎫 Early Bird activated - Phase 1, Phase 2, Phase 3, and Phase 4 automatically deactivated');
        }
      } else if (phase === 'phase1') {
        finalConfig.isPhase1Active = active;
        if (active) {
          // If Phase 1 is activated, deactivate other phases
          finalConfig.isEarlyBirdActive = false;
          finalConfig.isPhase2Active = false;
          finalConfig.isPhase3Active = false;
          finalConfig.isPhase4Active = false;
          console.log('🎫 Phase 1 activated - Early Bird, Phase 2, Phase 3, and Phase 4 automatically deactivated');
        }
      } else if (phase === 'phase2') {
        finalConfig.isPhase2Active = active;
        if (active) {
          // If Phase 2 is activated, deactivate other phases
          finalConfig.isEarlyBirdActive = false;
          finalConfig.isPhase1Active = false;
          finalConfig.isPhase3Active = false;
          finalConfig.isPhase4Active = false;
          console.log('🎫 Phase 2 activated - Early Bird, Phase 1, Phase 3, and Phase 4 automatically deactivated');
        }
      } else if (phase === 'phase3') {
        finalConfig.isPhase3Active = active;
        if (active) {
          // If Phase 3 is activated, deactivate other phases
          finalConfig.isEarlyBirdActive = false;
          finalConfig.isPhase1Active = false;
          finalConfig.isPhase2Active = false;
          finalConfig.isPhase4Active = false;
          console.log('🎫 Phase 3 activated - Early Bird, Phase 1, Phase 2, and Phase 4 automatically deactivated');
        }
      } else if (phase === 'phase4') {
        finalConfig.isPhase4Active = active;
        if (active) {
          // If Phase 4 is activated, deactivate other phases
          finalConfig.isEarlyBirdActive = false;
          finalConfig.isPhase1Active = false;
          finalConfig.isPhase2Active = false;
          finalConfig.isPhase3Active = false;
          console.log('🎫 Phase 4 activated - Early Bird, Phase 1, Phase 2, and Phase 3 automatically deactivated');
        }
      } else {
        return res.status(400).json({ message: 'Invalid phase. Must be: earlybird, phase1, phase2, phase3, or phase4' });
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

  // Public: Enhanced booking status check with Cashfree API verification
  app.post('/api/bookings/:id/check-status', async (req, res) => {
    try {
      const bookingId = parseInt(req.params.id);
      const booking = await storage.getBooking(bookingId);
      
      if (!booking) {
        return res.status(404).json({ message: 'Booking not found' });
      }
      
      console.log(`🔍 Checking status for booking ${bookingId}, current status: ${booking.paymentStatus}`);
      
      // Enhanced idempotency protection - prevent re-verification of finalized bookings
      const finalizedStatuses = ['verified', 'failed', 'refunded'] as const;
      if (finalizedStatuses.includes(booking.paymentStatus as any)) {
        console.log(`🛡️ Idempotency: Booking ${bookingId} already finalized with status: ${booking.paymentStatus}`);
        return res.json({ 
          message: `Payment ${booking.paymentStatus === 'verified' ? 'already verified' : booking.paymentStatus === 'failed' ? 'already failed' : 'already refunded'}. No further verification needed.`,
          status: booking.paymentStatus,
          bookingId: bookingId,
          finalized: true,
          finalizedAt: booking.updatedAt
        });
      }
      
      // For pending/paid bookings, try to verify with Cashfree API
      if (booking.paymentStatus === 'pending' || booking.paymentStatus === 'paid') {
        try {
          // Extract order ID from paymentId if available
          let orderId = booking.paymentId;
          
          // If no payment ID stored, try to reconstruct it
          if (!orderId) {
            // CRITICAL FIX: Use stored paymentId directly instead of fragile timestamp reconstruction
            // The old logic used timestamps which could fail if timing was inconsistent
            console.log(`❌ Critical Error: Booking ${bookingId} has no paymentId - cannot verify payment without stored payment ID`);
            return res.status(400).json({ 
              message: 'Cannot verify payment: No payment ID stored for this booking. This indicates the payment was not properly initiated through Cashfree.',
              code: 'MISSING_PAYMENT_ID',
              requiresManualCheck: true
            });
          }
          
          if (orderId) {
            console.log(`🔍 Verifying payment with Cashfree for order: ${orderId}`);
            
            // CRITICAL FIX: Use centralized payment verification with proper status mapping
            const verificationResult = await paymentService.verifyPaymentWithMapping(orderId);
            
            if (verificationResult.success && verificationResult.status) {
              console.log(`📊 Cashfree API status: ${verificationResult.status} -> ${verificationResult.mappedStatus}`);
              
              // Use the centralized status mapping - already properly typed
              const newStatus = verificationResult.mappedStatus;
              const shouldSendSuccessEmail = newStatus === 'verified';
              
              // Log the status mapping for debugging
              if (verificationResult.status === 'ACTIVE' && newStatus !== 'verified') {
                console.log(`✅ CRITICAL FIX: 'ACTIVE' status correctly mapped to '${newStatus}' instead of incorrectly mapping to 'verified'`);
              }
              
              // Update booking if status changed
              if (newStatus !== booking.paymentStatus) {
                console.log(`🔄 Updating booking ${bookingId} status from ${booking.paymentStatus} to ${newStatus}`);
                await storage.updateBookingPaymentStatus(bookingId, newStatus);
                
                // Update paymentId if not already set
                if (!booking.paymentId && orderId) {
                  await storage.updateBookingPaymentId(bookingId, orderId);
                }
                
                // Send appropriate emails
                if (shouldSendSuccessEmail) {
                  try {
                    console.log(`📧 Sending success email with QR codes to ${booking.email}`);
                    const { EnhancedEmailService } = await import('./services/enhancedEmailService');
                    const enhancedEmailService = new EnhancedEmailService();
                    await enhancedEmailService.sendTicketEmails(toBookingData({...booking, paymentStatus: newStatus}));
                    console.log(`✅ Success email sent to ${booking.email}`);
                    
                    return res.json({ 
                      message: 'Payment verified successfully! Check your email for tickets.',
                      status: newStatus,
                      bookingId: bookingId,
                      verified: true
                    });
                  } catch (emailError) {
                    console.error('Failed to send success email:', emailError);
                    // Still return success as payment was verified
                    return res.json({ 
                      message: 'Payment verified! Tickets will be sent shortly.',
                      status: newStatus,
                      bookingId: bookingId,
                      verified: true,
                      emailError: 'Ticket email pending'
                    });
                  }
                } else if (newStatus === 'failed') {
                  try {
                    console.log(`📧 Sending failure email to ${booking.email}`);
                    const { EnhancedEmailService } = await import('./services/enhancedEmailService');
                    const enhancedEmailService = new EnhancedEmailService();
                    await enhancedEmailService.sendPaymentFailureEmail(toBookingData({...booking, paymentStatus: newStatus}));
                    console.log(`✅ Failure email sent to ${booking.email}`);
                  } catch (emailError) {
                    console.error('Failed to send failure email:', emailError);
                  }
                  
                  return res.json({ 
                    message: 'Payment failed. Please try booking again.',
                    status: newStatus,
                    bookingId: bookingId,
                    reason: 'payment_failed'
                  });
                }
                
                return res.json({ 
                  message: 'Booking status updated',
                  status: newStatus,
                  bookingId: bookingId
                });
              }
              
              // Status unchanged, return current status
              return res.json({ 
                message: 'Payment still processing',
                status: booking.paymentStatus,
                bookingId: bookingId,
                cashfreeStatus: verificationResult.status
              });
              
            } else {
              console.log(`⚠️ Cashfree API verification failed: ${verificationResult.error || 'Unknown error'}`);
              // Continue to timeout logic below
            }
          }
        } catch (apiError: any) {
          console.error(`❌ Cashfree API error for booking ${bookingId}:`, apiError.message);
          // Continue to timeout logic as fallback
        }
      }
      
      // CONSERVATIVE timeout logic - only timeout after 15 minutes of no webhook activity
      // This prevents premature failure marking while Cashfree processes payments
      const createdTime = new Date(booking.createdAt || '').getTime();
      const currentTime = Date.now();
      const timeDiff = currentTime - createdTime;
      const fifteenMinutes = 15 * 60 * 1000; // 15 minutes instead of 45 seconds
      
      if (booking.paymentStatus === 'pending' && timeDiff > fifteenMinutes) {
        console.log(`🕒 Booking ${bookingId} pending for ${Math.round(timeDiff / (60 * 1000))} minutes - this indicates a likely payment gateway issue`);
        
        // CRITICAL: Before marking as failed, do one final API verification attempt
        try {
          if (booking.paymentId) {
            console.log(`🔍 Final verification attempt before timeout for booking ${bookingId}`);
            const finalCheck = await paymentService.verifyPaymentWithMapping(booking.paymentId);
            
            if (finalCheck.success && finalCheck.mappedStatus === 'verified') {
              console.log(`✅ CRITICAL: Last-minute verification successful! Booking ${bookingId} is actually verified - preventing false timeout`);
              
              // Update status and send success emails
              await storage.updateBookingPaymentStatus(bookingId, 'verified');
              
              try {
                const ticketGenerationService = new TicketGenerationService();
                await ticketGenerationService.generateTicketsForBooking(bookingId);
                console.log(`🎫 Late verification - tickets generated for booking ${bookingId}`);
              } catch (ticketError) {
                console.error('Failed to generate tickets after late verification:', ticketError);
              }
              
              return res.json({ 
                message: 'Payment verified at the last moment! Tickets are being sent.',
                status: 'verified',
                bookingId: bookingId,
                note: 'Late verification prevented timeout'
              });
            }
          }
        } catch (finalCheckError) {
          console.error('Final verification check failed:', finalCheckError);
        }
        
        // Only mark as failed after final check confirms it's actually failed
        console.log(`⚠️ Marking booking ${bookingId} as failed after ${Math.round(timeDiff / (60 * 1000))} minutes timeout`);
        await storage.updateBookingPaymentStatus(bookingId, 'failed');
        
        // Send failure email with more context
        try {
          const { EnhancedEmailService } = await import('./services/enhancedEmailService');
          const enhancedEmailService = new EnhancedEmailService();
          await enhancedEmailService.sendPaymentFailureEmail(toBookingData({...booking, paymentStatus: 'failed'}));
          console.log(`📧 Payment timeout email sent to ${booking.email} after 15-minute verification delay`);
        } catch (emailError) {
          console.error('Failed to send timeout email:', emailError);
        }
        
        return res.json({ 
          message: 'Payment verification timed out after 15 minutes. Please try booking again.',
          status: 'failed',
          reason: 'timeout_after_verification_attempts',
          bookingId: bookingId
        });
      }
      
      res.json({ 
        message: 'Booking status checked',
        status: booking.paymentStatus,
        timePending: Math.round(timeDiff / 1000) + ' seconds',
        bookingId: bookingId
      });
    } catch (error: any) {
      console.error('Failed to check booking status:', error);
      res.status(500).json({ message: 'Failed to check status', error: error.message });
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
        (Date.now() - new Date(b.createdAt || new Date()).getTime()) < 5 * 60 * 1000 // 5 minutes
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

      // Calculate total amount with dynamic pricing (including convenience fee)
      const subtotal = bookingData.ticketCount * ticketPrice;
      const discountAmount = Math.round((subtotal * couponDiscount) / 100);
      const convenienceFeePerTicket = parseFloat(config.convenientFee || '0');
      const convenienceFeeTotal = bookingData.ticketCount * convenienceFeePerTicket;
      const totalAmount = subtotal - discountAmount + convenienceFeeTotal;
      
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
          paymentStatus: booking.paymentStatus || 'pending'
        });
        console.log(`✅ Booking confirmation email sent to ${booking.email}`);
      } catch (emailError: any) {
        console.error('Failed to send booking confirmation email:', emailError);
        // Don't fail the booking if email fails
      }

      // Create Cashfree payment order with dynamic base URL
      const paymentResult = await paymentService.createPaymentOrder({
        bookingId: booking.id,
        amount: totalAmount,
        customerName: booking.name,
        customerEmail: booking.email,
        customerPhone: booking.phone,
        baseUrl: getPublicBaseUrl(req), // Pass request-based URL with correct port
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
          
          <a href="${upi}" class="btn">Pay with UPI Apps</a>
          <br>
          <small>Payment will be automatically verified - no screenshot needed!</small>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
        <script>
          QRCode.toCanvas(document.getElementById('qrcode'), '${upi}', {width: 250}, function(error) {
            if (error) console.error(error);
          });

          // Automatic verification - no manual steps required
        </script>
      </body>
      </html>
    `;
    
    res.send(html);
  });

  // DISABLED: Screenshot upload route - all payments now processed automatically via Cashfree webhooks
  app.post('/api/bookings/:id/payment-proof', (req, res) => {
    return res.status(410).json({ 
      message: 'Screenshot upload is no longer supported. All payments are automatically processed via Cashfree webhooks.' 
    });
  });

  // DISABLED: Manual payment verification route - payments are now automatically processed by Cashfree webhook
  // app.post('/api/bookings/:id/verify-payment', authenticate, requirePermission(PERMISSIONS.VERIFY_PAYMENTS), async (req, res) => {
  //   // This route has been disabled as payments are now automatically verified via webhook
  //   return res.status(410).json({ 
  //     message: 'Manual payment verification is no longer supported. Payments are automatically processed by the payment gateway.' 
  //   });
  // });

  // Emergency manual payment verification - only for webhook failures
  app.post('/api/admin/emergency-verify-payment', authenticate, requirePermission(PERMISSIONS.VERIFY_PAYMENTS), async (req, res) => {
    try {
      const { bookingId } = req.body;
      
      if (!bookingId || typeof bookingId !== 'number') {
        return res.status(400).json({ message: 'Valid booking ID is required' });
      }

      // Get booking details
      const booking = await storage.getBooking(bookingId);
      if (!booking) {
        return res.status(404).json({ message: 'Booking not found' });
      }

      // Enhanced idempotency protection for emergency verification
      const finalizedStatuses = ['verified', 'failed', 'refunded'] as const;
      if (finalizedStatuses.includes(booking.paymentStatus as any)) {
        console.log(`🛡️ Emergency verification blocked: Booking ${bookingId} already ${booking.paymentStatus}`);
        return res.status(409).json({ 
          message: `Cannot verify payment: Booking is already ${booking.paymentStatus}`,
          currentStatus: booking.paymentStatus,
          bookingId: bookingId,
          reason: 'ALREADY_FINALIZED',
          finalizedAt: booking.updatedAt
        });
      }

      // Check if booking has payment ID
      if (!booking.paymentId) {
        return res.status(400).json({ 
          message: 'No payment ID found for this booking. Cannot verify payment.' 
        });
      }

      console.log(`🚨 EMERGENCY: Admin ${req.user?.username} manually verifying payment for booking ${bookingId} with payment ID ${booking.paymentId}`);

      // Verify payment with Cashfree
      const verificationResult = await paymentService.verifyPaymentWithMapping(booking.paymentId);
      
      if (!verificationResult.success) {
        console.error(`❌ Emergency verification failed for booking ${bookingId}:`, verificationResult.error);
        return res.status(500).json({ 
          message: `Payment verification failed: ${verificationResult.userMessage || verificationResult.error}` 
        });
      }

      console.log(`📊 Emergency verification result for booking ${bookingId}: ${verificationResult.status} -> ${verificationResult.mappedStatus}`);

      // Update booking status based on verification result
      if (verificationResult.mappedStatus === 'verified') {
        // Payment is verified - update booking and send tickets
        await storage.updateBookingPaymentStatus(bookingId, 'verified');
        
        // Generate tickets and send email
        try {
          const bookingData = toBookingData(booking);
          await enhancedEmailService.sendTicketEmails(bookingData);
          console.log(`✅ Emergency verification successful: Tickets sent for booking ${bookingId}`);
          
          // Sync to Google Sheets
          try {
            await googleSheetsService.addBookingToSheet(booking);
            console.log(`📊 Booking ${bookingId} synced to Google Sheets after emergency verification`);
          } catch (sheetError) {
            console.warn(`⚠️ Failed to sync booking ${bookingId} to Google Sheets:`, sheetError);
          }

          return res.json({
            success: true,
            message: `Emergency verification successful! Payment verified and tickets sent to ${booking.email}`,
            paymentStatus: 'verified',
            verificationMethod: 'emergency_manual',
            verifiedBy: req.user?.username,
            verifiedAt: new Date().toISOString()
          });

        } catch (emailError: any) {
          console.error(`❌ Emergency verification: Payment verified but ticket sending failed for booking ${bookingId}:`, emailError);
          return res.status(500).json({
            message: `Payment verified but failed to send tickets: ${emailError.message}. Please try sending tickets manually.`,
            paymentStatus: 'verified',
            ticketsSent: false
          });
        }

      } else if (verificationResult.mappedStatus === 'failed') {
        // Payment failed - update status
        await storage.updateBookingPaymentStatus(bookingId, 'failed');
        console.log(`❌ Emergency verification: Payment failed for booking ${bookingId}`);
        
        return res.json({
          success: false,
          message: `Payment verification failed. Payment status: ${verificationResult.status}`,
          paymentStatus: 'failed',
          verificationMethod: 'emergency_manual',
          verifiedBy: req.user?.username,
          verifiedAt: new Date().toISOString()
        });

      } else {
        // Payment still pending
        console.log(`⏳ Emergency verification: Payment still pending for booking ${bookingId}`);
        return res.json({
          success: false,
          message: `Payment is still pending. Current status: ${verificationResult.status}`,
          paymentStatus: 'pending',
          verificationMethod: 'emergency_manual',
          checkedBy: req.user?.username,
          checkedAt: new Date().toISOString()
        });
      }

    } catch (error: any) {
      console.error(`❌ Emergency verification error for booking ${req.body.bookingId}:`, error);
      return res.status(500).json({ 
        message: `Emergency verification failed: ${error.message}` 
      });
    }
  });

  // Check payment status from Cashfree - Returns status comparison without automatic verification
  app.post('/api/admin/check-cashfree-status', authenticate, requirePermission(PERMISSIONS.VERIFY_PAYMENTS), async (req, res) => {
    try {
      const { bookingId } = req.body;
      
      if (!bookingId || typeof bookingId !== 'number') {
        return res.status(400).json({ message: 'Valid booking ID is required' });
      }

      // Get booking details
      const booking = await storage.getBooking(bookingId);
      if (!booking) {
        return res.status(404).json({ message: 'Booking not found' });
      }

      // Check if booking has payment ID
      if (!booking.paymentId) {
        return res.status(400).json({ 
          message: 'No payment ID found for this booking. Cannot check status with Cashfree.',
          localStatus: booking.paymentStatus,
          cashfreeStatus: 'NO_PAYMENT_ID'
        });
      }

      const localStatus = booking.paymentStatus;
      console.log(`🔍 Checking Cashfree status for booking ${bookingId} (local: ${localStatus}) with payment ID ${booking.paymentId}`);

      try {
        // Check payment status with Cashfree
        const verificationResult = await paymentService.verifyPaymentWithMapping(booking.paymentId);
        
        if (!verificationResult.success) {
          console.error(`❌ Cashfree status check failed for booking ${bookingId}:`, verificationResult.error);
          return res.status(500).json({ 
            message: `Failed to fetch status from Cashfree: ${verificationResult.userMessage || verificationResult.error}`,
            localStatus,
            cashfreeStatus: 'CHECK_FAILED',
            error: verificationResult.error
          });
        }

        const cashfreeStatus = verificationResult.mappedStatus;
        const rawCashfreeStatus = verificationResult.status;

        console.log(`📊 Status comparison for booking ${bookingId}: Local=${localStatus}, Cashfree=${cashfreeStatus} (raw: ${rawCashfreeStatus})`);

        // Check if there's a mismatch that needs correction
        let statusUpdated = false;
        let ticketsSent = false;
        let message = '';

        if (localStatus !== cashfreeStatus) {
          if (cashfreeStatus === 'verified' && (localStatus === 'pending' || localStatus === 'failed')) {
            // Payment is verified on Cashfree but not locally - update and send tickets
            await storage.updateBookingPaymentStatus(bookingId, 'verified');
            statusUpdated = true;

            try {
              const bookingData = toBookingData(booking);
              await enhancedEmailService.sendTicketEmails(bookingData);
              ticketsSent = true;
              console.log(`✅ Status sync: Tickets sent for booking ${bookingId} after Cashfree verification`);
              
              // Sync to Google Sheets
              try {
                await googleSheetsService.addBookingToSheet(booking);
                console.log(`📊 Booking ${bookingId} synced to Google Sheets after status correction`);
              } catch (sheetError) {
                console.warn(`⚠️ Failed to sync booking ${bookingId} to Google Sheets:`, sheetError);
              }

              message = `✅ Status Corrected: Payment was verified on Cashfree! Local status updated and tickets sent to ${booking.email}`;
            } catch (emailError: any) {
              console.error(`❌ Status sync: Payment verified but ticket sending failed for booking ${bookingId}:`, emailError);
              message = `✅ Status Corrected: Payment verified on Cashfree, but ticket sending failed: ${emailError.message}`;
            }
          } else if (cashfreeStatus === 'failed' && localStatus === 'pending') {
            // Payment failed on Cashfree but still pending locally
            await storage.updateBookingPaymentStatus(bookingId, 'failed');
            statusUpdated = true;
            message = `❌ Status Updated: Payment failed on Cashfree. Local status updated to failed.`;
          } else {
            // Other status mismatches
            message = `⚠️ Status Mismatch Detected: Local status (${localStatus}) differs from Cashfree (${cashfreeStatus}). Review required.`;
          }
        } else {
          // Statuses match
          if (cashfreeStatus === 'verified') {
            message = `✅ Status Confirmed: Payment is verified on both local and Cashfree systems.`;
          } else if (cashfreeStatus === 'pending') {
            message = `⏳ Status Confirmed: Payment is still pending on both local and Cashfree systems.`;
          } else if (cashfreeStatus === 'failed') {
            message = `❌ Status Confirmed: Payment has failed on both local and Cashfree systems.`;
          } else {
            message = `🔍 Status Confirmed: Both systems show status as ${cashfreeStatus}.`;
          }
        }

        return res.json({
          success: true,
          message,
          localStatus,
          cashfreeStatus,
          rawCashfreeStatus,
          statusUpdated,
          ticketsSent,
          checkedBy: req.user?.username,
          checkedAt: new Date().toISOString(),
          bookingId,
          paymentId: booking.paymentId
        });

      } catch (cashfreeError: any) {
        console.error(`❌ Cashfree API error for booking ${bookingId}:`, cashfreeError);
        return res.status(500).json({ 
          message: `Failed to connect to Cashfree API: ${cashfreeError.message}`,
          localStatus,
          cashfreeStatus: 'API_ERROR',
          error: cashfreeError.message
        });
      }

    } catch (error: any) {
      console.error(`❌ Check Cashfree status error for booking ${req.body.bookingId}:`, error);
      return res.status(500).json({ 
        message: `Failed to check Cashfree status: ${error.message}`,
        error: error.message
      });
    }
  });

  // Manual payment verification - BYPASSES gateway entirely
  app.post('/api/admin/manual-verify-payment', authenticate, requirePermission(PERMISSIONS.VERIFY_PAYMENTS), async (req, res) => {
    try {
      const { bookingId } = req.body;
      const adminUser = req.user;
      
      if (!bookingId || typeof bookingId !== 'number') {
        return res.status(400).json({ message: 'Valid booking ID is required' });
      }

      // Get booking details
      const booking = await storage.getBooking(bookingId);
      if (!booking) {
        return res.status(404).json({ message: 'Booking not found' });
      }

      // Enhanced idempotency protection for manual verification
      const finalizedStatuses = ['verified', 'failed', 'refunded'] as const;
      if (finalizedStatuses.includes(booking.paymentStatus as any)) {
        console.log(`🛡️ Manual verification blocked: Booking ${bookingId} already ${booking.paymentStatus}`);
        return res.status(409).json({ 
          message: `Cannot manually verify payment: Booking is already ${booking.paymentStatus}. Manual verification is only allowed for pending/paid bookings.`,
          currentStatus: booking.paymentStatus,
          bookingId: bookingId,
          reason: 'ALREADY_FINALIZED',
          finalizedAt: booking.updatedAt,
          warning: 'Manual verification bypasses payment gateway checks and should only be used for confirmed payments.'
        });
      }

      console.log(`🚨 MANUAL OVERRIDE: Admin ${adminUser?.username} (${adminUser?.role}) manually verifying payment for booking ${bookingId} WITHOUT gateway verification`);
      console.log(`📋 Booking details: ${booking.name} (${booking.email}) - ${booking.ticketCount} tickets - Amount: ₹${booking.totalAmount}`);
      console.log(`⚠️  WARNING: This bypasses all payment gateway verification checks`);

      // CRITICAL: Update booking status directly to verified WITHOUT checking gateway
      await storage.updateBookingPaymentStatus(bookingId, 'verified');
      console.log(`✅ Booking ${bookingId} payment status manually set to 'verified'`);

      // Generate guest codes and pass IDs if not already generated
      let updatedBooking = await storage.getBooking(bookingId);
      let guestCodes = updatedBooking!.guestCodes;
      let passIds = updatedBooking!.passIds;
      
      if (!guestCodes || guestCodes.length === 0) {
        const { generateGuestCodes } = await import('./services/emailService');
        guestCodes = generateGuestCodes(updatedBooking!.ticketCount);
        console.log(`🎯 Generated guest codes: ${guestCodes.join(', ')}`);
      }
      
      if (!passIds || passIds.length === 0) {
        const { generatePassIds } = await import('./services/emailService');
        passIds = generatePassIds(updatedBooking!.id, updatedBooking!.ticketCount);
        console.log(`🎫 Generated pass IDs: ${passIds.join(', ')}`);
      }

      // Update booking with codes if needed
      if (guestCodes !== updatedBooking!.guestCodes || passIds !== updatedBooking!.passIds) {
        await storage.updateBookingQRCodes(bookingId, [], passIds, guestCodes);
        console.log(`📝 Updated booking codes in database`);
      }

      // Generate and send tickets
      try {
        const ticketGenerationService = new TicketGenerationService();
        await ticketGenerationService.generateTicketsForBooking(bookingId);
        console.log(`🎫 Manual verification: Tickets generated and sent for booking ${bookingId}`);
        
        // Sync to Google Sheets
        try {
          const finalBooking = await storage.getBooking(bookingId);
          if (finalBooking) {
            await googleSheetsService.addBookingToSheet(finalBooking);
            console.log(`📊 Booking ${bookingId} synced to Google Sheets after manual verification`);
          }
        } catch (sheetError) {
          console.warn(`⚠️ Failed to sync booking ${bookingId} to Google Sheets:`, sheetError);
        }

        return res.json({
          success: true,
          message: `Manual verification complete! Payment marked as verified and tickets sent to ${booking.email}`,
          paymentStatus: 'verified',
          verificationMethod: 'manual_bypass',
          verifiedBy: adminUser?.username,
          verifiedAt: new Date().toISOString(),
          warning: 'Payment gateway verification was bypassed - admin manually confirmed payment received'
        });

      } catch (emailError: any) {
        console.error(`❌ Manual verification: Booking verified but ticket sending failed for booking ${bookingId}:`, emailError);
        return res.status(500).json({
          message: `Manual verification completed but failed to send tickets: ${emailError.message}. Please try sending tickets manually.`,
          paymentStatus: 'verified',
          ticketsSent: false,
          verificationMethod: 'manual_bypass',
          verifiedBy: adminUser?.username
        });
      }

    } catch (error: any) {
      console.error(`❌ Manual verification error for booking ${req.body.bookingId}:`, error);
      return res.status(500).json({ 
        message: `Manual verification failed: ${error.message}` 
      });
    }
  });

  // Send payment rejection email
  app.post('/api/admin/send-rejection-email', authenticate, requirePermission(PERMISSIONS.VERIFY_PAYMENTS), async (req, res) => {
    try {
      const { bookingId } = req.body;
      
      if (!bookingId || typeof bookingId !== 'number') {
        return res.status(400).json({ message: 'Valid booking ID is required' });
      }

      // Get booking details
      const booking = await storage.getBooking(bookingId);
      if (!booking) {
        return res.status(404).json({ message: 'Booking not found' });
      }

      // Check if booking has failed payment status
      if (booking.paymentStatus !== 'failed') {
        return res.status(400).json({ 
          message: `Cannot send rejection email: Payment status is '${booking.paymentStatus}'. Rejection emails can only be sent for failed payments.`,
          currentStatus: booking.paymentStatus
        });
      }

      console.log(`📧 Admin ${req.user?.username} sending rejection email for booking ${bookingId} to ${booking.email}`);

      // Send payment failure email
      const bookingData = toBookingData(booking);
      await enhancedEmailService.sendPaymentFailureEmail(bookingData);
      
      console.log(`✅ Rejection email sent successfully for booking ${bookingId}`);

      res.json({
        success: true,
        message: `Payment rejection email sent to ${booking.email}`,
        bookingId: bookingId,
        sentTo: booking.email,
        sentBy: req.user?.username,
        sentAt: new Date().toISOString()
      });

    } catch (error: any) {
      console.error(`❌ Failed to send rejection email for booking ${req.body.bookingId}:`, error);
      res.status(500).json({ 
        message: `Failed to send rejection email: ${error.message}` 
      });
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

  // Toggle coupon active status (PATCH)
  app.patch('/api/coupons/:id', authenticate, requirePermission(PERMISSIONS.MANAGE_COUPONS), async (req, res) => {
    try {
      const couponId = parseInt(req.params.id);
      const { isActive } = req.body;
      
      if (!couponId) {
        return res.status(400).json({ message: 'Invalid coupon ID' });
      }
      
      const updatedCoupon = await storage.updateCoupon(couponId, { isActive });
      res.json(updatedCoupon);
    } catch (error) {
      console.error('Error toggling coupon status:', error);
      res.status(500).json({ message: 'Failed to update coupon status' });
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

      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ 
          valid: false, 
          discount: 0, 
          message: 'Email address is required for coupon validation' 
        });
      }
      const validation = await storage.validateCoupon(code.trim().toUpperCase(), email.trim());
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
        // CRITICAL FIX: Check actual payment status from Cashfree instead of direct verification
        if (!booking.paymentId) {
          return res.status(400).json({ 
            message: 'Cannot verify payment: No payment ID found. Payment may not have been initiated through Cashfree.',
            requiresManualCheck: true 
          });
        }

        // Use the new centralized payment verification with proper status mapping
        console.log(`🔍 Admin verification: Checking actual payment status for booking ${bookingId} with payment ID ${booking.paymentId}`);
        const verificationResult = await paymentService.verifyPaymentWithMapping(booking.paymentId);
        
        if (!verificationResult.success) {
          return res.status(400).json({ 
            message: `Payment verification failed: ${verificationResult.userMessage || verificationResult.error}`,
            error: verificationResult.error 
          });
        }

        const cashfreeStatus = verificationResult.status;
        const mappedStatus = verificationResult.mappedStatus;
        
        // Only allow verification if payment is actually successful
        if (mappedStatus !== 'verified') {
          let userMessage = '';
          if (mappedStatus === 'pending') {
            if (cashfreeStatus === 'ACTIVE') {
              userMessage = 'Payment link is still active but payment has not been completed yet. Customer needs to complete the payment first.';
            } else if (cashfreeStatus === 'PENDING' || cashfreeStatus === 'CREATED') {
              userMessage = 'Payment is still pending - not yet completed by customer.';
            } else {
              userMessage = `Payment is still in progress (${cashfreeStatus}). Cannot verify until payment is completed.`;
            }
          } else if (mappedStatus === 'failed') {
            userMessage = `Payment has failed (${cashfreeStatus}). Cannot verify a failed payment.`;
          }
          
          return res.status(400).json({
            message: `Cannot verify: ${userMessage}`,
            currentStatus: cashfreeStatus,
            mappedStatus: mappedStatus,
            canVerify: false
          });
        }

        // Payment is actually successful - proceed with verification
        console.log(`✅ Admin verification: Payment ${booking.paymentId} is confirmed successful (${cashfreeStatus}). Proceeding with verification.`);
        await storage.updateBookingPaymentStatus(bookingId, 'verified');
        
        // Use existing guest codes if available, otherwise generate new ones
        const guestCodes = booking.guestCodes && (booking.guestCodes as string[]).length > 0 
          ? (booking.guestCodes as string[])
          : generateGuestCodes(booking.ticketCount);
        const passIds = generatePassIds(bookingId, booking.ticketCount);
        
        // Update booking with generated codes
        await storage.updateBookingQRCodes(bookingId, [], passIds, guestCodes);
        
        // Get updated booking and send enhanced email with QR codes
        const updatedBooking = await storage.getBooking(bookingId);
        if (updatedBooking) {
          try {
            await enhancedEmailService.sendTicketEmails(toBookingData(updatedBooking));
            console.log(`✅ QR tickets sent successfully to ${updatedBooking.email}`);
          } catch (emailError) {
            console.error('Email sending failed (non-critical):', emailError);
            // Don't fail the verification if email fails
          }
        }

        res.json({ 
          message: 'Payment verified successfully!', 
          cashfreeStatus,
          mappedStatus,
          guestCodes,
          passIds 
        });
        
      } else if (action === 'reject') {
        // For rejection, we can still allow manual status change to pending
        await storage.updateBookingPaymentStatus(bookingId, 'pending');
        res.json({ message: 'Booking status set to pending' });
      } else {
        res.status(400).json({ message: 'Invalid action. Use "verify" or "reject"' });
      }
      
    } catch (error: unknown) {
      console.error('Admin verification error:', error);
      res.status(500).json({ 
        message: 'Verification failed due to system error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.post('/api/admin/bookings/:id/send-ticket', authenticate, requirePermission(PERMISSIONS.SEND_TICKETS), async (req, res) => {
    try {
      const bookingId = parseInt(req.params.id);
      const booking = await storage.getBooking(bookingId);
      
      if (!booking) {
        return res.status(404).json({ message: 'Booking not found' });
      }

      // Allow sending tickets even if payment not verified - admin override capability
      if (booking.paymentStatus !== 'verified' && booking.paymentStatus !== 'pending') {
        return res.status(400).json({ message: 'Payment failed or refunded - cannot send tickets' });
      }

      // Check if QR codes already exist - if so, reuse them instead of generating new ones
      const hasExistingQRCodes = booking.qrCodes && booking.qrCodes.length > 0;
      const hasExistingGuestCodes = booking.guestCodes && booking.guestCodes.length > 0;
      
      if (hasExistingQRCodes && hasExistingGuestCodes) {
        // Tickets already generated - just resend the existing email
        console.log(`♻️ Reusing existing QR codes for booking ${bookingId}`);
        
        try {
          await enhancedEmailService.sendTicketEmails(toBookingData(booking));
          
          // Auto-verify payment when tickets are successfully sent by admin
          if (booking.paymentStatus !== 'verified') {
            console.log(`🔄 Auto-verifying payment for booking ${bookingId} after successful ticket resend`);
            await storage.updateBookingPaymentStatus(bookingId, 'verified');
          }
          
          return res.json({ 
            message: 'Existing tickets resent successfully!',
            guestCodes: booking.guestCodes,
            passIds: booking.passIds,
            note: 'Used existing QR codes',
            paymentAutoVerified: booking.paymentStatus !== 'verified'
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
        // Auto-verify payment when tickets are successfully sent by admin
        if (booking.paymentStatus !== 'verified') {
          console.log(`🔄 Auto-verifying payment for booking ${bookingId} after successful ticket generation`);
          await storage.updateBookingPaymentStatus(bookingId, 'verified');
        }
        
        res.json({ 
          message: 'New tickets generated and sent successfully!',
          guestCodes: result.guestCodes,
          passIds: result.passIds,
          note: 'Generated new QR codes',
          paymentAutoVerified: booking.paymentStatus !== 'verified'
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

  // Payment sync endpoint - Check old pending payments against Cashfree API
  app.post('/api/admin/sync-payment-statuses', authenticate, requirePermission(PERMISSIONS.VERIFY_PAYMENTS), async (req, res) => {
    try {
      console.log('🔄 Starting payment status sync with Cashfree API...');
      
      // Get all bookings with pending payment status that have a paymentId
      const allBookings = await storage.getAllBookings();
      const pendingBookings = allBookings.filter(booking => 
        booking.paymentStatus === 'pending' && 
        booking.paymentId && 
        booking.paymentId.trim() !== ''
      );
      
      console.log(`🔍 Found ${pendingBookings.length} pending payments to check`);
      
      if (pendingBookings.length === 0) {
        return res.json({ 
          message: 'No pending payments found to sync',
          checked: 0,
          updated: 0,
          errors: []
        });
      }
      
      const results = {
        checked: 0,
        updated: 0,
        errors: [] as string[],
        details: [] as any[]
      };
      
      // Import CashfreeService
      const { CashfreeService } = await import('./services/cashfreeService');
      const cashfreeService = new CashfreeService();
      
      // Process bookings in batches to avoid rate limiting
      const batchSize = 5;
      for (let i = 0; i < pendingBookings.length; i += batchSize) {
        const batch = pendingBookings.slice(i, i + batchSize);
        
        // Process batch with delay between API calls
        for (const booking of batch) {
          try {
            console.log(`📊 Checking payment status for booking ${booking.id} (order: ${booking.paymentId})`);
            results.checked++;
            
            // Check order status with Cashfree (we've already filtered for non-null paymentIds)
            const orderStatus = await cashfreeService.getOrderStatus(booking.paymentId!);
            
            // Check if payment was successful
            if (orderStatus.order_status === 'PAID' || orderStatus.order_status === 'SUCCESS') {
              console.log(`✅ Payment verified for booking ${booking.id} - updating status`);
              
              // Update payment status to verified
              await storage.updateBookingPaymentStatus(booking.id, 'verified');
              results.updated++;
              
              results.details.push({
                bookingId: booking.id,
                name: booking.name,
                email: booking.email,
                orderId: booking.paymentId,
                oldStatus: 'pending',
                newStatus: 'verified',
                cashfreeStatus: orderStatus.order_status,
                action: 'updated'
              });
              
              console.log(`📧 Booking ${booking.id} for ${booking.name} marked as verified`);
            } else {
              results.details.push({
                bookingId: booking.id,
                name: booking.name,
                email: booking.email,
                orderId: booking.paymentId,
                oldStatus: 'pending',
                newStatus: 'pending',
                cashfreeStatus: orderStatus.order_status,
                action: 'no_change'
              });
              
              console.log(`⏳ Booking ${booking.id} still pending - Cashfree status: ${orderStatus.order_status}`);
            }
            
            // Add small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 200));
            
          } catch (error: any) {
            console.error(`❌ Error checking booking ${booking.id}:`, error);
            const errorMsg = `Booking ${booking.id}: ${error.message}`;
            results.errors.push(errorMsg);
            
            results.details.push({
              bookingId: booking.id,
              name: booking.name,
              email: booking.email,
              orderId: booking.paymentId,
              oldStatus: 'pending',
              newStatus: 'pending',
              error: error.message,
              action: 'error'
            });
          }
        }
        
        // Add delay between batches
        if (i + batchSize < pendingBookings.length) {
          console.log(`⏳ Waiting before next batch...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      console.log(`✅ Payment sync completed - Checked: ${results.checked}, Updated: ${results.updated}, Errors: ${results.errors.length}`);
      
      res.json({
        message: `Payment sync completed successfully`,
        checked: results.checked,
        updated: results.updated,
        errors: results.errors,
        details: results.details
      });
      
    } catch (error: any) {
      console.error('❌ Payment sync failed:', error);
      res.status(500).json({ 
        message: 'Payment sync failed', 
        error: error.message 
      });
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
      const isGuestCode = booking.guestCodes && Array.isArray(booking.guestCodes) && (booking.guestCodes as string[]).includes(code.toUpperCase());
      
      if (isGuestCode) {
        // Individual guest check-in logic
        const guestCode = code.toUpperCase();
        const guestIndex = (booking.guestCodes || []).indexOf(guestCode);
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
      res.status(500).json({ message: 'Test email failed', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // REMOVED: Screenshot upload route - payments now fully automated via Cashfree webhooks


  // Manual verification - changes status from pending to verified  
  // REMOVED: Manual payment verification - Now fully automated via webhooks
  app.post('/api/admin/verify-payment/:id', authenticate, requirePermission(PERMISSIONS.VERIFY_PAYMENTS), async (req, res) => {
    res.status(410).json({ 
      message: 'Manual verification removed - All payments are now automatically processed via webhooks',
      automation: true
    });
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

  // Public route to delete failed booking
  app.delete('/api/public/bookings/:id/delete-failed', async (req, res) => {
    try {
      const bookingId = parseInt(req.params.id);
      const booking = await storage.getBooking(bookingId);
      
      if (!booking) {
        return res.status(404).json({ message: 'Booking not found' });
      }
      
      // Only allow deletion if payment failed or is pending
      if (booking.paymentStatus === 'verified') {
        return res.status(400).json({ message: 'Cannot delete verified booking' });
      }
      
      // Delete from database
      await storage.deleteBooking(bookingId);
      
      // SAFEGUARD: Only send failure email if payment is actually failed, not verified
      const paymentStatus = booking.paymentStatus as 'pending' | 'paid' | 'verified' | 'failed' | 'refunded' | null;
      if (paymentStatus !== 'verified' && paymentStatus !== null) {
        try {
          console.log(`📧 Sending deletion notification for failed booking ${bookingId} with status: ${booking.paymentStatus}`);
          const { EnhancedEmailService } = await import('./services/enhancedEmailService');
          const enhancedEmailService = new EnhancedEmailService();
          await enhancedEmailService.sendPaymentFailureEmail(toBookingData(booking));
        } catch (emailError) {
          console.error('Failed to send payment failure email:', emailError);
        }
      } else {
        console.log(`🛡️ Skipping failure email for verified booking ${bookingId} that was marked for deletion`);
      }
      
      console.log(`📋 Failed booking ${bookingId} deleted for ${booking.name}`);
      
      res.json({
        message: `Failed booking has been cancelled and deleted.`,
        deletedBooking: { id: booking.id, name: booking.name }
      });
    } catch (error: any) {
      console.error('Failed booking deletion error:', error);
      res.status(500).json({ message: error.message || 'Failed to delete booking' });
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
  // REMOVED: Manual payment verification - Now fully automated via webhooks
  app.post('/api/admin/verify-payment', authenticate, requirePermission(PERMISSIONS.VERIFY_PAYMENTS), async (req, res) => {
    res.status(410).json({ 
      message: 'Manual verification removed - All payments are now automatically processed via webhooks',
      automation: true
    });
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
      const totalTickets = promoterBookings.reduce((sum, b) => sum + (b.ticketCount || 0), 0);
      const commissionRate = parseFloat(promoter.commission || '5'); // Commission is stored as percentage
      const commissionEarned = (totalRevenue * commissionRate) / 100;
      
      const stats = {
        totalBookings: promoterBookings.length,
        totalTickets: totalTickets,
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
        })).sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
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

  // Delete promoter
  app.delete('/api/admin/promoters/:id', authenticate, requirePermission(PERMISSIONS.MANAGE_USERS), async (req, res) => {
    try {
      const promoterId = parseInt(req.params.id);

      if (isNaN(promoterId)) {
        return res.status(400).json({ message: 'Invalid promoter ID' });
      }

      await storage.deletePromoter(promoterId);
      res.json({ message: 'Promoter deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting promoter:', error);
      if (error.message.includes('Cannot delete promoter with existing bookings')) {
        res.status(409).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Failed to delete promoter' });
      }
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
    // Force JSON response headers immediately
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache');
    
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
      
      // Verify webhook signature for production
      const isTestMode = process.env.NODE_ENV === 'development';
      
      if (!isTestMode && signature && timestamp) {
        try {
          const isValid = await cashfreeService.verifyWebhook(signature, timestamp, rawBody);
          if (!isValid) {
            console.error(`❌ [${webhookId}] Webhook signature verification failed`);
            return res.status(200).send(); // Still return 200 as per Cashfree requirements
          }
          console.log(`✅ [${webhookId}] Webhook signature verified successfully`);
        } catch (verifyError) {
          console.error(`❌ [${webhookId}] Webhook signature verification error:`, verifyError);
          return res.status(200).send(); // Still return 200 as per Cashfree requirements
        }
      } else {
        console.log(`⚠️ [${webhookId}] Skipping webhook signature verification (dev mode or missing headers)`);
      }
      
      const { order_id, order_status, payment_amount, cf_payment_id, payment_method } = req.body;
      
      if (!order_id) {
        console.error(`❌ [${webhookId}] Missing order_id in webhook payload`);
        return res.status(200).send(); // Return 200 even for invalid payloads per Cashfree requirements
      }
      
      // Find booking by payment ID with detailed logging
      console.log(`🔍 [${webhookId}] Looking up booking for order_id: ${order_id}`);
      const booking = await storage.getBookingByPaymentId(order_id);
      
      if (!booking) {
        console.error(`❌ [${webhookId}] No booking found for order_id: ${order_id}`);
        return res.status(200).send(); // Return 200 even for missing bookings per Cashfree requirements
      }
      
      console.log(`📊 [${webhookId}] Found booking ${booking.id} for ${booking.email} with current status: ${booking.paymentStatus}`);
      
      // Check for duplicate webhook processing (idempotency)
      if (booking.paymentStatus === 'verified' && order_status === 'PAID') {
        console.log(`⚠️ [${webhookId}] Duplicate webhook - booking ${booking.id} already verified`);
        return res.status(200).send(); // Return 200 for duplicate webhooks
      }
      
      // Process different webhook events
      let newStatus = booking.paymentStatus || 'pending';
      let actionTaken = 'none';
      
      try {
        // CONSISTENCY FIX: Use centralized status mapping for webhook processing
        const mappedStatus = paymentService.mapCashfreeStatusToInternal(order_status);
        newStatus = mappedStatus;
        
        switch (mappedStatus) {
          case 'verified':
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
            
          case 'failed':
            actionTaken = 'payment_failed';
            
            console.log(`💸 [${webhookId}] Payment failed for booking ${booking.id} (status: ${order_status}), updating status to failed`);
            
            // SAFEGUARD: Double-check payment status before marking as failed
            // This prevents false failures due to webhook race conditions
            try {
              console.log(`🔍 [${webhookId}] Double-checking payment status before marking booking ${booking.id} as failed`);
              const doubleCheckResult = await paymentService.verifyPaymentWithMapping(order_id);
              
              if (doubleCheckResult.success && doubleCheckResult.mappedStatus === 'verified') {
                console.log(`🚨 [${webhookId}] CRITICAL PROTECTION: Payment ${order_id} is actually VERIFIED, not failed! Preventing false failure`);
                // This payment is actually successful - treat as verified instead
                await storage.updateBookingPaymentStatus(booking.id, 'verified');
                
                // Generate tickets for the verified payment
                try {
                  const { TicketGenerationService } = await import('./services/ticketGenerationService');
                  const ticketService = new TicketGenerationService();
                  await ticketService.generateTicketsForBooking(booking.id);
                  console.log(`🎫 [${webhookId}] Tickets generated for falsely-failed booking ${booking.id} that was actually verified`);
                  actionTaken = 'false_failure_corrected_to_verified';
                } catch (ticketError) {
                  console.error(`❌ [${webhookId}] Failed to generate tickets for corrected booking ${booking.id}:`, ticketError);
                }
                break; // Exit the failed case since payment is actually verified
              }
            } catch (doubleCheckError) {
              console.log(`⚠️ [${webhookId}] Double-check verification failed, proceeding with original failed status: ${doubleCheckError}`);
            }
            
            // Only proceed with failed status if double-check confirms it's actually failed
            await storage.updateBookingPaymentStatus(booking.id, 'failed');
            
            // Clear any QR codes/tickets that may have been mistakenly generated
            // TODO: Implement clearBookingTickets method in storage interface
            
            // SAFEGUARD: Only send failure email if booking wasn't already marked as verified
            if (booking.paymentStatus !== 'verified') {
              try {
                console.log(`📧 [${webhookId}] Sending failure email to ${booking.email} for confirmed failed payment`);
                const { EnhancedEmailService } = await import('./services/enhancedEmailService');
                const enhancedEmailService = new EnhancedEmailService();
                await enhancedEmailService.sendPaymentFailureEmail(toBookingData(booking));
                console.log(`✅ [${webhookId}] Payment failure email sent to ${booking.email} for booking ${booking.id}`);
                actionTaken = 'payment_failed_email_sent';
              } catch (emailError: any) {
                console.error(`❌ [${webhookId}] Failed to send payment failure email for booking ${booking.id}:`, emailError);
                actionTaken = 'payment_failed_email_error';
                // Don't fail the webhook if email sending fails
              }
            } else {
              console.log(`🛡️ [${webhookId}] Skipping failure email for booking ${booking.id} - payment was already verified`);
              actionTaken = 'failure_email_skipped_already_verified';
            }
            
            // Update Google Sheets with payment failure
            try {
              const { GoogleSheetsService } = await import('./services/googleSheets');
              const googleSheetsService = new GoogleSheetsService();
              await googleSheetsService.updateBookingPaymentStatus(booking.id, 'failed');
              console.log(`📊 [${webhookId}] Google Sheets updated with payment failure for booking ${booking.id}`);
            } catch (sheetsError: any) {
              console.error(`❌ [${webhookId}] Google Sheets update failed for booking ${booking.id}:`, sheetsError);
              // Don't fail the webhook if sheets update fails
            }
            break;
            
          case 'pending':
            console.log(`⏳ [${webhookId}] Payment still pending for booking ${booking.id} (status: ${order_status}), no action taken`);
            if (order_status === 'ACTIVE') {
              console.log(`✅ CRITICAL FIX: 'ACTIVE' status correctly kept as 'pending' instead of incorrectly mapping to 'verified'`);
            }
            actionTaken = 'status_logged';
            break;
            
          default:
            console.warn(`⚠️ [${webhookId}] Unknown order status: ${order_status} mapped to ${mappedStatus} for booking ${booking.id}`);
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
        
        // Cashfree only cares about HTTP 200 status code - response body is ignored
        res.status(200).send();
        
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
      
      // Even on processing errors, return 200 to prevent Cashfree retries for valid webhooks
      // Only return non-200 for truly invalid webhook requests
      res.status(200).send();
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
          await enhancedEmailService.sendTicketEmails(toBookingData(booking));
          
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

  // Iframe route for Telugu Night frontend
  app.get('/iframe', (req, res) => {
    const iframeHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Telugu Night</title>
    <style>
        body { margin: 0; padding: 0; overflow: hidden; }
        .iframe-container { width: 100vw; height: 100vh; }
        .iframe-container iframe { width: 100%; height: 100%; border: none; }
        .loading { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 1000; }
        .hidden { display: none; }
    </style>
</head>
<body>
    <div id="loading" class="loading">
        <p>Loading Telugu Night frontend...</p>
    </div>
    
    <div class="iframe-container">
        <iframe 
            src="https://v0-telugunightlanding3k.vercel.app/" 
            title="Telugu Night Frontend"
            onload="document.getElementById('loading').classList.add('hidden')"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-downloads allow-top-navigation"
        ></iframe>
    </div>
    
    <script>
        // Hide loading after 5 seconds max
        setTimeout(() => {
            document.getElementById('loading').classList.add('hidden');
        }, 5000);
        
        // Handle iframe errors
        window.addEventListener('message', function(event) {
            if (event.origin !== 'https://v0-telugunightlanding3k.vercel.app') return;
            console.log('Message from frontend:', event.data);
        });
    </script>
</body>
</html>`;
    
    res.setHeader('Content-Type', 'text/html');
    res.send(iframeHTML);
  });

  // Register webhook monitoring routes
  registerWebhookMonitoringRoutes(app);
  
  console.log('🔧 All webhook system improvements activated');

  // Home page now served by React SPA (handled by vite fallback)

  return app;
}
