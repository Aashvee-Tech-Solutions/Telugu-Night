import type { User, InsertUser, Booking, Coupon, InsertCoupon, Promoter, InsertPromoter, Event, EventPhase, TicketType } from '@shared/schema';
import { db } from './db';
import { users, bookings, coupons, teluguNightCounter, teluguNightConfig, promoters, events, eventPhases, ticketTypes, ROLE_PERMISSIONS } from '@shared/schema';
import { eq, desc, sql } from 'drizzle-orm';

interface AdminSession {
  id: string;
  username: string;
  role: string;
  permissions: string[];
  createdAt: Date;
  expiresAt: Date;
}

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(insertUser: InsertUser): Promise<User>;

  // Booking operations
  createBooking(bookingData: any): Promise<Booking>;
  getBooking(id: number): Promise<Booking | undefined>;
  getAllBookings(): Promise<Booking[]>;
  updateBookingPaymentStatus(id: number, status: string, screenshot?: string): Promise<void>;
  updateBookingQRCodes(id: number, qrCodes: string[], passIds: string[], guestCodes: string[]): Promise<void>;
  scanTicket(id: number, scannedBy: number): Promise<void>;
  updateBookingVerification(id: number, status: string, guestCodes: string[]): Promise<void>;
  updateBookingScannedGuests(id: number, scannedGuests: string[]): Promise<void>;
  deleteBooking(id: number): Promise<void>;

  // Ticket counting operations
  getTicketCounts(): Promise<{ earlyBirdCount: number; earlyBirdLimit: number; phase1Count: number }>;
  updateTicketCounts(ticketType: string, ticketCount: number): Promise<void>;
  updateEarlyBirdLimit(limit: number): Promise<void>;
  
  // Ticket configuration operations
  getTicketConfig(): Promise<any>;
  getTeluguNightConfig(): Promise<any>; // Alias for getTicketConfig
  updateTicketConfig(config: any, updatedBy: number): Promise<void>;
  initializeTicketConfig(): Promise<void>;

  // Coupon operations
  createCoupon(insertCoupon: InsertCoupon): Promise<Coupon>;
  getCouponByCode(code: string): Promise<Coupon | undefined>;
  updateCouponUsage(code: string): Promise<void>;
  validateCoupon(code: string, email: string): Promise<{ valid: boolean; discount: number; message: string }>;
  getAllCoupons(): Promise<Coupon[]>;
  updateCoupon(id: number, updateData: Partial<Coupon>): Promise<Coupon>;
  deleteCoupon(id: number): Promise<void>;

  // User management
  updateUserLastLogin(id: number): Promise<void>;
  updateUserRole(id: number, role: string, permissions?: string[]): Promise<User>;

  // Payment operations
  updateBookingPaymentId(id: number, paymentId: string): Promise<void>;
  getBookingByPaymentId(paymentId: string): Promise<Booking | undefined>;

  // Promoter operations
  createPromoter(promoterData: InsertPromoter): Promise<Promoter>;
  getPromoterByCode(promoCode: string): Promise<Promoter | undefined>;
  getPromoterByEmail(email: string): Promise<Promoter | undefined>;
  updatePromoterStats(id: number, revenue: number): Promise<void>;
  getAllPromoters(): Promise<Promoter[]>;
  updatePromoterLoginTime(id: number): Promise<void>;

  // Event management operations
  createEvent(eventData: any): Promise<Event>;
  getEvent(id: number): Promise<Event | undefined>;
  getAllEvents(): Promise<Event[]>;
  updateEventBookingStatus(id: number, bookingOpen: boolean): Promise<void>;
  createEventPhase(phaseData: any): Promise<EventPhase>;
  createTicketType(ticketData: any): Promise<TicketType>;
  getEventPhases(eventId: number): Promise<EventPhase[]>;
  getTicketTypes(eventId: number, phaseId?: number): Promise<TicketType[]>;
}

export class DatabaseStorage implements IStorage {
  private adminSessions: Map<string, AdminSession>;
  private temporaryCoupons: Map<number, Coupon>;
  private currentCouponId: number;
  private ticketCountCache: { 
    earlyBirdCount: number; 
    earlyBirdLimit: number; 
    phase1Count: number;
    phase1Limit: number;
    phase2Count: number;
    phase2Limit: number;
    phase3Count: number;
    phase3Limit: number;
    phase4Count: number;
    phase4Limit: number;
    totalSold: number;
    maxCapacity: number;
    lastUpdated: number;
  } | null = null;
  private bookingsCache: { data: Booking[]; lastUpdated: number } | null = null;
  private readonly CACHE_TTL = 30000; // 30 seconds cache

  constructor() {
    this.adminSessions = new Map();
    this.temporaryCoupons = new Map();
    this.currentCouponId = 1;

    // Initialize default admin user
    this.initializeDefaultUser();
    
    // Initialize ticket counter
    this.initializeTicketCounter();
  }

  private async initializeDefaultUser() {
    try {
      // Check if admin user exists
      const adminUser = await this.getUserByUsername('aashvee');
      if (!adminUser) {
        // Require ADMIN_PASSWORD in production - fail hard if missing
        const adminPassword = process.env.ADMIN_PASSWORD;
        if (!adminPassword) {
          throw new Error('ADMIN_PASSWORD environment variable is required to initialize admin user');
        }
        const hashedPassword = await import('bcryptjs').then(bcrypt => bcrypt.hashSync(adminPassword, 10));
        await db.insert(users).values({
          username: 'aashvee',
          password: hashedPassword,
          role: 'super_admin',
          permissions: []
        });
        console.log('✅ Default admin user created');
      }
    } catch (error) {
      console.error('❌ Admin user initialization failed:', error);
      throw error; // Fail startup if admin initialization fails
    }
  }

  private async initializeTicketCounter() {
    try {
      const existingCounter = await db.select().from(teluguNightCounter).limit(1);
      if (existingCounter.length === 0) {
        await db.insert(teluguNightCounter).values({
          earlyBirdCount: 0,
          phase1Count: 0,
          phase2Count: 0,
          totalSold: 0
        });
        console.log('✅ Telugu Night counter initialized');
      }
    } catch (error) {
      console.log('Telugu Night counter initialization error:', error);
    }
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  // Booking operations - Now using database
  async createBooking(bookingData: any): Promise<Booking> {
    try {
      console.log('📝 Creating booking with data:', JSON.stringify(bookingData, null, 2));
      
      // Find promoter if referrer is provided
      let promoterId = null;
      if (bookingData.referrer) {
        try {
          const promoter = await this.getPromoterByCode(bookingData.referrer.toUpperCase());
          if (promoter && promoter.isActive) {
            promoterId = promoter.id;
            console.log(`🔗 Found active promoter: ${promoter.name} (ID: ${promoter.id})`);
          }
        } catch (error) {
          console.log('⚠️ Error finding promoter:', error);
        }
      }

      const [booking] = await db
        .insert(bookings)
        .values({
          name: bookingData.name,
          email: bookingData.email,
          phone: bookingData.phone,
          gender: bookingData.gender || null,
          ticketCount: bookingData.ticketCount,
          guests: bookingData.guests || [],
          guestGenders: bookingData.guestGenders || [],
          guestCodes: bookingData.guestCodes || [],
          couponCode: bookingData.couponCode || null,
          totalAmount: bookingData.totalAmount || "0",
          paymentStatus: bookingData.paymentStatus || "pending",
          couponDiscount: bookingData.couponDiscount || 0,
          promoterId,
          promoCode: bookingData.referrer || null,
          paymentId: bookingData.paymentId || null,
          paymentMethod: bookingData.paymentMethod || null,
        })
        .returning();
      
      console.log(`✅ Booking created successfully with ID: ${booking.id}`);
      
      // Invalidate bookings cache
      this.bookingsCache = null;
      
      return booking;
    } catch (error: unknown) {
      console.error('❌ Error creating booking:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to create booking: ${errorMessage}`);
    }
  }

  async getBooking(id: number): Promise<Booking | undefined> {
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, id));
    return booking || undefined;
  }

  async getAllBookings(): Promise<Booking[]> {
    // Check cache first
    if (this.bookingsCache && Date.now() - this.bookingsCache.lastUpdated < this.CACHE_TTL) {
      return this.bookingsCache.data;
    }

    const result = await db.select().from(bookings);
    
    // Update cache
    this.bookingsCache = {
      data: result,
      lastUpdated: Date.now()
    };
    
    return result;
  }

  async updateBookingPaymentStatus(id: number, status: string, screenshot?: string): Promise<void> {
    const updateData: any = {
      paymentStatus: status as any,
      updatedAt: new Date(),
    };
    if (screenshot) updateData.paymentScreenshot = screenshot;
    
    await db.update(bookings).set(updateData).where(eq(bookings.id, id));
    
    // Invalidate bookings cache when data changes
    this.bookingsCache = null;
  }

  // Delete booking
  async deleteBooking(id: number): Promise<void> {
    // First get the booking to know how many tickets to subtract
    const bookingToDelete = await this.getBooking(id);
    
    if (!bookingToDelete) {
      throw new Error('Booking not found');
    }
    
    const [deletedBooking] = await db
      .delete(bookings)
      .where(eq(bookings.id, id))
      .returning();
    
    if (!deletedBooking) {
      throw new Error('Booking not found');
    }
    
    // Update ticket counts by subtracting the deleted tickets
    try {
      // Update Telugu Night counter based on ticket type  
      const ticketType = bookingToDelete.ticketType;
      const ticketCount = bookingToDelete.ticketCount;
      
      if (ticketType === 'early_bird') {
        await db
          .update(teluguNightCounter)
          .set({
            earlyBirdCount: sql`early_bird_count - ${ticketCount}`,
            totalSold: sql`total_sold - ${ticketCount}`,
            lastUpdated: new Date()
          });
      } else if (ticketType === 'phase_1') {
        await db
          .update(teluguNightCounter)
          .set({
            phase1Count: sql`phase1_count - ${ticketCount}`,
            totalSold: sql`total_sold - ${ticketCount}`,
            lastUpdated: new Date()
          });
      } else if (ticketType === 'phase_2') {
        await db
          .update(teluguNightCounter)
          .set({
            phase2Count: sql`phase2_count - ${ticketCount}`,
            totalSold: sql`total_sold - ${ticketCount}`,
            lastUpdated: new Date()
          });
      }
      
      console.log(`✅ Booking ${id} deleted from database and ${ticketCount} ${ticketType} tickets returned to inventory`);
    } catch (error) {
      console.error('Failed to update ticket counts after deletion:', error);
      // Still proceed with deletion even if count update fails
    }
    
    // Invalidate bookings cache when data changes
    this.bookingsCache = null;
  }

  async updateBookingQRCodes(id: number, qrCodes: string[], passIds: string[], guestCodes: string[]): Promise<void> {
    await db.update(bookings).set({
      qrCodes,
      passIds,
      guestCodes,
      updatedAt: new Date(),
    }).where(eq(bookings.id, id));
  }

  async scanTicket(id: number, scannedBy: number): Promise<void> {
    await db.update(bookings).set({
      isScanned: true,
      scannedAt: new Date(),
      scannedBy,
      updatedAt: new Date(),
    }).where(eq(bookings.id, id));
  }

  async updateBookingVerification(id: number, status: string, guestCodes: string[]): Promise<void> {
    await db.update(bookings).set({
      paymentStatus: status as any,
      guestCodes,
      updatedAt: new Date(),
    }).where(eq(bookings.id, id));
  }

  // Coupon operations
  async createCoupon(insertCoupon: InsertCoupon): Promise<Coupon> {
    const [coupon] = await db
      .insert(coupons)
      .values({
        ...insertCoupon,
        usageCount: 0,
      })
      .returning();
    return coupon;
  }

  async getCouponByCode(code: string): Promise<Coupon | undefined> {
    const [coupon] = await db.select().from(coupons).where(eq(coupons.code, code.toUpperCase()));
    if (!coupon || !coupon.isActive) {
      return undefined;
    }
    if (coupon.usageLimit && (coupon.usageCount || 0) >= coupon.usageLimit) {
      return undefined;
    }
    return coupon;
  }

  async updateCouponUsage(code: string): Promise<void> {
    const [coupon] = await db.select().from(coupons).where(eq(coupons.code, code.toUpperCase()));
    if (coupon) {
      await db.update(coupons).set({
        usageCount: (coupon.usageCount || 0) + 1,
      }).where(eq(coupons.id, coupon.id));
      console.log(`Coupon ${code} usage updated: ${(coupon.usageCount || 0) + 1}/${coupon.usageLimit || 'unlimited'}`);
    }
  }

  async validateCoupon(code: string, email: string): Promise<{ valid: boolean; discount: number; message: string }> {
    try {
      // Define allowed email list for coupons
      const allowedEmails = [
        'admin@aashveetech.com',
        'mis@aashveetech.com',
        'test@aashveetech.com',
        'hemanthvardhan.cse21@gmail.com',
        'support@aashveetech.com'
      ];

      // Check if email is in allowed list
      if (!allowedEmails.includes(email.toLowerCase())) {
        return { valid: false, discount: 0, message: 'Coupon not available for this email address' };
      }

      // Check if coupon code is valid format (at least 3 characters)
      if (!code || code.length < 3) {
        return { valid: false, discount: 0, message: 'Invalid coupon code format' };
      }

      // For allowed emails, provide flat discounts based on coupon code
      const couponDiscounts: { [key: string]: number } = {
        'ADMIN20': 20,
        'STAFF15': 15,
        'VIP30': 30,
        'FRIEND10': 10,
        'SPECIAL25': 25
      };

      const discount = couponDiscounts[code.toUpperCase()];
      if (!discount) {
        return { valid: false, discount: 0, message: 'Invalid coupon code' };
      }

      // All checks passed - coupon is valid
      return { 
        valid: true, 
        discount: discount, 
        message: `${discount}% discount applied` 
      };
    } catch (error) {
      console.error('Coupon validation error:', error);
      return { valid: false, discount: 0, message: 'Validation failed' };
    }
  }

  async getAllCoupons(): Promise<Coupon[]> {
    return await db.select().from(coupons);
  }

  async updateCoupon(id: number, updateData: Partial<Coupon>): Promise<Coupon> {
    const [coupon] = await db
      .update(coupons)
      .set(updateData)
      .where(eq(coupons.id, id))
      .returning();
    return coupon;
  }

  async deleteCoupon(id: number): Promise<void> {
    await db.delete(coupons).where(eq(coupons.id, id));
  }

  // User management methods
  async updateUserLastLogin(id: number): Promise<void> {
    await db.update(users).set({
      lastLogin: new Date(),
    }).where(eq(users.id, id));
  }

  async updateUserRole(id: number, role: string, permissions?: string[]): Promise<User> {
    const updateData: any = { role };
    if (permissions) {
      updateData.permissions = permissions;
    }
    
    const [user] = await db.update(users).set(updateData).where(eq(users.id, id)).returning();
    return user;
  }

  async updateBookingScannedGuests(id: number, scannedGuests: string[]): Promise<void> {
    try {
      await db.update(bookings).set({
        scannedGuests,
        updatedAt: new Date(),
      }).where(eq(bookings.id, id));
      
      // Invalidate bookings cache when data changes
      this.bookingsCache = null;
      
      console.log(`✅ Updated scanned guests for booking ${id}: ${scannedGuests.join(', ')}`);
    } catch (error) {
      console.error(`❌ Failed to update scanned guests for booking ${id}:`, error);
      throw new Error('Failed to update scanned guests');
    }
  }



  // Ticket counting operations
  async getTicketCounts(): Promise<{ 
    earlyBirdCount: number; 
    earlyBirdLimit: number; 
    phase1Count: number;
    phase1Limit: number;
    phase2Count: number;
    phase2Limit: number;
    phase3Count: number;
    phase3Limit: number;
    phase4Count: number;
    phase4Limit: number;
    totalSold: number;
    maxCapacity: number;
  }> {
    // Check cache first
    if (this.ticketCountCache && Date.now() - this.ticketCountCache.lastUpdated < this.CACHE_TTL) {
      return {
        earlyBirdCount: this.ticketCountCache.earlyBirdCount,
        earlyBirdLimit: this.ticketCountCache.earlyBirdLimit,
        phase1Count: this.ticketCountCache.phase1Count,
        phase1Limit: this.ticketCountCache.phase1Limit || 200,
        phase2Count: this.ticketCountCache.phase2Count || 0,
        phase2Limit: this.ticketCountCache.phase2Limit || 210,
        phase3Count: this.ticketCountCache.phase3Count || 0,
        phase3Limit: this.ticketCountCache.phase3Limit || 100,
        phase4Count: this.ticketCountCache.phase4Count || 0,
        phase4Limit: this.ticketCountCache.phase4Limit || 100,
        totalSold: this.ticketCountCache.totalSold || 0,
        maxCapacity: this.ticketCountCache.maxCapacity || 500
      };
    }

    try {
      const [counter] = await db.select().from(teluguNightCounter).limit(1);
      const [config] = await db.select().from(teluguNightConfig).limit(1);
      
      const result = {
        earlyBirdCount: counter ? (counter.earlyBirdCount || 0) : 0,
        earlyBirdLimit: config ? (config.earlyBirdLimit || 90) : 90,
        phase1Count: counter ? (counter.phase1Count || 0) : 0,
        phase1Limit: config ? (config.phase1Limit || 200) : 200,
        phase2Count: counter ? (counter.phase2Count || 0) : 0,
        phase2Limit: config ? (config.phase2Limit || 210) : 210,
        phase3Count: counter ? (counter.phase3Count || 0) : 0,
        phase3Limit: config ? (config.phase3Limit || 100) : 100,
        phase4Count: counter ? (counter.phase4Count || 0) : 0,
        phase4Limit: config ? (config.phase4Limit || 100) : 100,
        totalSold: counter ? (counter.totalSold || 0) : 0,
        maxCapacity: config ? (config.maxCapacity || 500) : 500,
      };

      // Update cache
      this.ticketCountCache = {
        ...result,
        lastUpdated: Date.now()
      };

      return result;
    } catch (error) {
      console.error('Failed to get ticket counts:', error);
      return { 
        earlyBirdCount: 0, 
        earlyBirdLimit: 90, 
        phase1Count: 0,
        phase1Limit: 200,
        phase2Count: 0,
        phase2Limit: 210,
        phase3Count: 0,
        phase3Limit: 100,
        phase4Count: 0,
        phase4Limit: 100,
        totalSold: 0,
        maxCapacity: 500
      };
    }
  }

  async updateEarlyBirdLimit(limit: number): Promise<void> {
    try {
      await db.update(teluguNightConfig).set({
        earlyBirdLimit: limit,
        updatedAt: new Date()
      });
      console.log(`✅ Updated early bird limit to: ${limit}`);
      // Invalidate ticket count cache
      this.ticketCountCache = null;
    } catch (error) {
      console.error('Failed to update early bird limit:', error);
      throw new Error('Failed to update early bird limit');
    }
  }

  async updateTicketCounts(ticketType: string, ticketCount: number): Promise<void> {
    try {
      let updateField: string;
      if (ticketType === 'early_bird') {
        updateField = 'earlyBirdCount';
      } else if (ticketType === 'phase_1') {
        updateField = 'phase1Count';
      } else if (ticketType === 'phase_2') {
        updateField = 'phase2Count';
      } else if (ticketType === 'phase_3') {
        updateField = 'phase3Count';
      } else if (ticketType === 'phase_4') {
        updateField = 'phase4Count';
      } else {
        throw new Error(`Invalid ticket type: ${ticketType}`);
      }
      
      const currentCounts = await this.getTicketCounts();
      const currentCount = currentCounts[updateField === 'earlyBirdCount' ? 'earlyBirdCount' : 
                                         updateField === 'phase1Count' ? 'phase1Count' : 
                                         updateField === 'phase2Count' ? 'phase2Count' :
                                         updateField === 'phase3Count' ? 'phase3Count' : 
                                         updateField === 'phase4Count' ? 'phase4Count' : 'earlyBirdCount'] as number;
      const newCount = currentCount + ticketCount;
      const newTotalSold = currentCounts.totalSold + ticketCount;
      
      const updateData: any = {
        [updateField]: newCount,
        totalSold: newTotalSold,
        lastUpdated: new Date()
      };
      
      // Get or create counter record
      const [existingCounter] = await db.select().from(teluguNightCounter).limit(1);
      
      if (existingCounter) {
        await db.update(teluguNightCounter).set(updateData);
      } else {
        await db.insert(teluguNightCounter).values({
          earlyBirdCount: updateField === 'earlyBirdCount' ? newCount : 0,
          phase1Count: updateField === 'phase1Count' ? newCount : 0,
          phase2Count: updateField === 'phase2Count' ? newCount : 0,
          phase3Count: updateField === 'phase3Count' ? newCount : 0,
          phase4Count: updateField === 'phase4Count' ? newCount : 0,
          totalSold: newTotalSold
        });
      }
      
      // Invalidate ticket count cache
      this.ticketCountCache = null;
      
      console.log(`✅ Updated ${updateField}: ${newCount} (added ${ticketCount}), totalSold: ${newTotalSold}`);
    } catch (error) {
      console.error('Failed to update ticket counts:', error);
      throw new Error('Failed to update ticket counts');
    }
  }

  async decreaseTicketCounts(ticketType: string, ticketCount: number): Promise<void> {
    try {
      let updateField: string;
      if (ticketType === 'early_bird') {
        updateField = 'earlyBirdCount';
      } else if (ticketType === 'phase_1') {
        updateField = 'phase1Count';
      } else if (ticketType === 'phase_2') {
        updateField = 'phase2Count';
      } else if (ticketType === 'phase_3') {
        updateField = 'phase3Count';
      } else if (ticketType === 'phase_4') {
        updateField = 'phase4Count';
      } else {
        throw new Error(`Invalid ticket type: ${ticketType}`);
      }
      
      const currentCounts = await this.getTicketCounts();
      const currentCount = currentCounts[updateField === 'earlyBirdCount' ? 'earlyBirdCount' : 
                                         updateField === 'phase1Count' ? 'phase1Count' : 
                                         updateField === 'phase2Count' ? 'phase2Count' :
                                         updateField === 'phase3Count' ? 'phase3Count' : 
                                         updateField === 'phase4Count' ? 'phase4Count' : 'earlyBirdCount'] as number;
      const newCount = Math.max(0, currentCount - ticketCount); // Ensure count doesn't go negative
      const newTotalSold = Math.max(0, currentCounts.totalSold - ticketCount);
      
      const updateData: any = {
        [updateField]: newCount,
        totalSold: newTotalSold,
        lastUpdated: new Date()
      };
      
      await db.update(teluguNightCounter).set(updateData);
      
      // Invalidate ticket count cache
      this.ticketCountCache = null;
      
      console.log(`✅ Decreased ${updateField}: ${newCount} (removed ${ticketCount})`);
    } catch (error) {
      console.error('Failed to decrease ticket counts:', error);
      throw new Error('Failed to decrease ticket counts');
    }
  }

  // Ticket configuration methods
  async getTicketConfig(): Promise<any> {
    try {
      const [config] = await db.select().from(teluguNightConfig).limit(1);
      return config || {
        earlyBirdPrice: 300,
        phase1Price: 350, 
        phase2Price: 400,
        earlyBirdLimit: 90,
        phase1Limit: 200,
        phase2Limit: 210,
        isEarlyBirdActive: true,
        isPhase1Active: false,
        isPhase2Active: false,
        convenientFee: "12.96",
        eventTitle: "Telugu Night 2.0",
        venue: "Hyderabad",
        maxCapacity: 500,
        bookingOpen: false
      };
    } catch (error) {
      console.error('Failed to get ticket config:', error);
      return {
        earlyBirdPrice: 300,
        phase1Price: 350,
        phase2Price: 400,
        earlyBirdLimit: 90,
        phase1Limit: 200,
        phase2Limit: 210,
        isEarlyBirdActive: true,
        isPhase1Active: false,
        isPhase2Active: false,
        convenientFee: "12.96",
        eventTitle: "Telugu Night 2.0",
        venue: "Hyderabad",
        maxCapacity: 500,
        bookingOpen: false
      };
    }
  }

  // Alias method for backward compatibility
  async getTeluguNightConfig(): Promise<any> {
    return this.getTicketConfig();
  }

  async updateTicketConfig(config: any, updatedBy: number): Promise<void> {
    try {
      const [existingConfig] = await db.select().from(teluguNightConfig).limit(1);
      
      // Handle timestamp fields properly - remove any problematic timestamp fields from update
      const cleanConfig = { ...config };
      
      // Remove timestamp fields that might cause issues
      delete cleanConfig.updatedAt;
      delete cleanConfig.createdAt;
      
      // Handle eventDate specifically - convert string to Date if needed
      if (cleanConfig.eventDate !== undefined) {
        if (cleanConfig.eventDate === '' || cleanConfig.eventDate === null) {
          // Remove empty string or null to avoid timestamp errors
          delete cleanConfig.eventDate;
        } else if (typeof cleanConfig.eventDate === 'string') {
          try {
            const parsedDate = new Date(cleanConfig.eventDate);
            if (isNaN(parsedDate.getTime())) {
              // Invalid date, remove it
              delete cleanConfig.eventDate;
            } else {
              cleanConfig.eventDate = parsedDate;
            }
          } catch (error) {
            delete cleanConfig.eventDate;
          }
        } else if (!(cleanConfig.eventDate instanceof Date)) {
          // If it's not a string or Date, remove it to avoid errors
          delete cleanConfig.eventDate;
        }
      }

      // Handle pricing fields - ensure they are valid integers
      if (cleanConfig.earlyBirdPrice !== undefined && cleanConfig.earlyBirdPrice !== '') {
        const parsed = parseInt(cleanConfig.earlyBirdPrice);
        cleanConfig.earlyBirdPrice = isNaN(parsed) ? 300 : parsed;
      }
      if (cleanConfig.phase1Price !== undefined && cleanConfig.phase1Price !== '') {
        const parsed = parseInt(cleanConfig.phase1Price);
        cleanConfig.phase1Price = isNaN(parsed) ? 350 : parsed;
      }
      if (cleanConfig.phase2Price !== undefined && cleanConfig.phase2Price !== '') {
        const parsed = parseInt(cleanConfig.phase2Price);
        cleanConfig.phase2Price = isNaN(parsed) ? 400 : parsed;
      }
      
      // Handle numeric fields properly for convenience fee
      if (cleanConfig.convenientFee !== undefined && cleanConfig.convenientFee !== '') {
        const parsed = parseFloat(cleanConfig.convenientFee);
        cleanConfig.convenientFee = (isNaN(parsed) ? 12.96 : parsed).toString();
      }
      
      // Handle limit fields - ensure they are valid integers
      if (cleanConfig.earlyBirdLimit !== undefined && cleanConfig.earlyBirdLimit !== '') {
        const parsed = parseInt(cleanConfig.earlyBirdLimit);
        cleanConfig.earlyBirdLimit = isNaN(parsed) ? 90 : parsed;
      }
      if (cleanConfig.phase1Limit !== undefined && cleanConfig.phase1Limit !== '') {
        const parsed = parseInt(cleanConfig.phase1Limit);
        cleanConfig.phase1Limit = isNaN(parsed) ? 200 : parsed;
      }
      if (cleanConfig.phase2Limit !== undefined && cleanConfig.phase2Limit !== '') {
        const parsed = parseInt(cleanConfig.phase2Limit);
        cleanConfig.phase2Limit = isNaN(parsed) ? 210 : parsed;
      }
      if (cleanConfig.maxCapacity !== undefined && cleanConfig.maxCapacity !== '') {
        const parsed = parseInt(cleanConfig.maxCapacity);
        cleanConfig.maxCapacity = isNaN(parsed) ? 500 : parsed;
      }
      
      // Remove any undefined, null, or empty string values that might cause issues
      Object.keys(cleanConfig).forEach(key => {
        if (cleanConfig[key] === undefined || cleanConfig[key] === null || cleanConfig[key] === '') {
          delete cleanConfig[key];
        }
      });
      
      console.log('🔄 Updating ticket configuration with data:', {
        cleanConfig,
        updatedBy,
        hasExistingConfig: !!existingConfig
      });

      if (existingConfig) {
        await db.update(teluguNightConfig).set({
          ...cleanConfig,
          updatedAt: new Date(),
          updatedBy
        });
        console.log('✅ Updated existing ticket configuration');
      } else {
        await db.insert(teluguNightConfig).values({
          ...cleanConfig,
          updatedBy
        });
        console.log('✅ Inserted new ticket configuration');
      }
    } catch (error) {
      console.error('Failed to update ticket config:', error);
      throw new Error('Failed to update ticket configuration');
    }
  }

  async initializeTicketConfig(): Promise<void> {
    try {
      const [existingConfig] = await db.select().from(teluguNightConfig).limit(1);
      
      if (!existingConfig) {
        await db.insert(teluguNightConfig).values({
          earlyBirdPrice: 300,
          phase1Price: 350,
          earlyBirdLimit: 90,
          phase1Limit: 200,
          isEarlyBirdActive: true,
          isPhase1Active: true,
          convenientFee: "12.96"
        });
        console.log('✅ Initialized default ticket configuration');
      }
    } catch (error) {
      console.error('Failed to initialize ticket config:', error);
    }
  }

  // Admin session management (in-memory for now)
  async createAdminSession(sessionData: { userId: number; token: string; expiresAt: Date }): Promise<void> {
    // For now, use in-memory sessions - can be moved to database later
    const session = {
      id: `${sessionData.userId}-${Date.now()}`,
      userId: sessionData.userId,
      token: sessionData.token,
      expiresAt: sessionData.expiresAt,
      createdAt: new Date()
    };
    this.adminSessions.set(sessionData.token, session as any);
  }

  async getAdminSessionByToken(token: string): Promise<any> {
    return this.adminSessions.get(token);
  }

  async deleteAdminSessionByToken(token: string): Promise<void> {
    this.adminSessions.delete(token);
  }

  async deleteExpiredSessions(): Promise<void> {
    const now = new Date();
    for (const [token, session] of Array.from(this.adminSessions.entries())) {
      if (session.expiresAt < now) {
        this.adminSessions.delete(token);
      }
    }
  }

  // Payment operations
  async updateBookingPaymentId(id: number, paymentId: string): Promise<void> {
    try {
      await db.update(bookings)
        .set({ paymentId: paymentId, updatedAt: new Date() })
        .where(eq(bookings.id, id));
      console.log(`Updated booking ${id} with payment ID: ${paymentId}`);
    } catch (error) {
      console.error('Failed to update booking payment ID:', error);
      throw error;
    }
  }

  async getBookingByPaymentId(paymentId: string): Promise<Booking | undefined> {
    try {
      const [booking] = await db.select().from(bookings).where(eq(bookings.paymentId, paymentId));
      return booking;
    } catch (error) {
      console.error('Failed to get booking by payment ID:', error);
      throw error;
    }
  }

  // Promoter operations
  async createPromoter(promoterData: InsertPromoter, plainPassword?: string): Promise<Promoter> {
    const bcrypt = await import('bcryptjs');
    const passwordToHash = plainPassword || Math.random().toString(36).slice(-8);
    const hashedPassword = bcrypt.hashSync(passwordToHash, 10);
    
    // Generate promo code if not provided
    const promoCode = promoterData.promoCode || this.generatePromoCode(promoterData.name);
    
    const [promoter] = await db
      .insert(promoters)
      .values({
        promoCode: promoCode,
        email: promoterData.email,
        name: promoterData.name,
        commission: promoterData.commission?.toString() || "0",
        password: hashedPassword,
      })
      .returning();
    return promoter;
  }

  private generatePromoCode(name: string): string {
    // Take first 3 chars of name and add random numbers
    const namePrefix = name.replace(/[^A-Za-z]/g, '').substring(0, 3).toUpperCase();
    const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${namePrefix}${randomSuffix}`;
  }

  async getPromoterByCode(promoCode: string): Promise<Promoter | undefined> {
    const [promoter] = await db.select().from(promoters).where(eq(promoters.promoCode, promoCode.toUpperCase()));
    return promoter;
  }

  async getPromoterByEmail(email: string): Promise<Promoter | undefined> {
    const [promoter] = await db.select().from(promoters).where(eq(promoters.email, email));
    return promoter;
  }

  async updatePromoterStats(id: number, revenue: number): Promise<void> {
    try {
      const currentPromoter = await db.select().from(promoters).where(eq(promoters.id, id));
      if (currentPromoter[0]) {
        const newTotalBookings = (currentPromoter[0].totalBookings || 0) + 1;
        const newTotalRevenue = parseFloat(currentPromoter[0].totalRevenue || "0") + revenue;
        
        await db.update(promoters).set({
          totalBookings: newTotalBookings,
          totalRevenue: newTotalRevenue.toString(),
          updatedAt: new Date(),
        }).where(eq(promoters.id, id));
        
        console.log(`✅ Updated promoter ${id} stats: ${newTotalBookings} bookings, ₹${newTotalRevenue} revenue`);
      }
    } catch (error) {
      console.error(`❌ Failed to update promoter stats for ID ${id}:`, error);
      throw error;
    }
  }

  async getAllPromoters(): Promise<Promoter[]> {
    return db.select().from(promoters).orderBy(desc(promoters.createdAt));
  }

  async updatePromoterStatus(id: number, isActive: boolean): Promise<Promoter> {
    const [promoter] = await db.update(promoters)
      .set({ 
        isActive: isActive,
        updatedAt: new Date()
      })
      .where(eq(promoters.id, id))
      .returning();
    
    if (!promoter) {
      throw new Error('Promoter not found');
    }
    
    console.log(`✅ Promoter ${id} status updated: ${isActive ? 'Active' : 'Inactive'}`);
    return promoter;
  }

  async deletePromoter(id: number): Promise<void> {
    // Check if promoter has any bookings first
    const bookingsWithPromoter = await db.select().from(bookings).where(eq(bookings.promoterId, id));
    
    if (bookingsWithPromoter.length > 0) {
      throw new Error('Cannot delete promoter with existing bookings. Please deactivate instead.');
    }
    
    await db.delete(promoters).where(eq(promoters.id, id));
    console.log(`✅ Promoter ${id} deleted successfully`);
  }

  async updatePromoterLoginTime(id: number): Promise<void> {
    await db.update(promoters).set({
      lastLoginAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(promoters.id, id));
  }

  // Event management operations
  async createEvent(eventData: any): Promise<Event> {
    const [event] = await db
      .insert(events)
      .values(eventData)
      .returning();
    return event;
  }

  async getEvent(id: number): Promise<Event | undefined> {
    const [event] = await db.select().from(events).where(eq(events.id, id));
    return event;
  }

  async getAllEvents(): Promise<Event[]> {
    return db.select().from(events).orderBy(desc(events.createdAt));
  }

  async updateEventBookingStatus(id: number, bookingOpen: boolean): Promise<void> {
    await db.update(events).set({
      bookingOpen,
      updatedAt: new Date(),
    }).where(eq(events.id, id));
  }

  async createEventPhase(phaseData: any): Promise<EventPhase> {
    const [phase] = await db
      .insert(eventPhases)
      .values(phaseData)
      .returning();
    return phase;
  }

  async createTicketType(ticketData: any): Promise<TicketType> {
    const [ticketType] = await db
      .insert(ticketTypes)
      .values(ticketData)
      .returning();
    return ticketType;
  }

  async getEventPhases(eventId: number): Promise<EventPhase[]> {
    return db.select().from(eventPhases)
      .where(eq(eventPhases.eventId, eventId))
      .orderBy(eventPhases.phaseOrder);
  }

  async getTicketTypes(eventId: number, phaseId?: number): Promise<TicketType[]> {
    if (phaseId) {
      return db.select().from(ticketTypes)
        .where(eq(ticketTypes.eventId, eventId) && eq(ticketTypes.phaseId, phaseId));
    }
    return db.select().from(ticketTypes)
      .where(eq(ticketTypes.eventId, eventId));
  }
}

export const storage = new DatabaseStorage();