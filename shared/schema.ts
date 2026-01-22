import { pgTable, text, serial, integer, boolean, timestamp, numeric, jsonb, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from 'drizzle-orm';

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role", { enum: ["super_admin", "admin", "organizer", "scanner", "viewer", "vendor"] }).notNull().default("scanner"),
  permissions: jsonb("permissions").$type<string[]>().default([]),
  isActive: boolean("is_active").default(true),
  lastLogin: timestamp("last_login"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  // Vendor specific fields
  companyName: text("company_name"),
  contactEmail: text("contact_email"),
  phoneNumber: text("phone_number"),
});

// Admin sessions for better security
export const adminSessions = pgTable("admin_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  token: text("token").unique().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Events table for multi-vendor event management
export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  venue: text("venue").notNull(),
  eventDate: timestamp("event_date").notNull(),
  vendorId: integer("vendor_id").references(() => users.id),
  isActive: boolean("is_active").default(true),
  maxCapacity: integer("max_capacity").default(500),
  bookingOpen: boolean("booking_open").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Event phases for flexible ticket pricing
export const eventPhases = pgTable("event_phases", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").references(() => events.id),
  phaseName: text("phase_name").notNull(), // "Early Bird", "Phase 1", "Phase 2", etc.
  phaseOrder: integer("phase_order").notNull(), // 1, 2, 3, etc.
  isActive: boolean("is_active").default(false),
  maxTickets: integer("max_tickets").default(0),
  soldTickets: integer("sold_tickets").default(0),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Flexible ticket types per event
export const ticketTypes = pgTable("ticket_types", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").references(() => events.id),
  phaseId: integer("phase_id").references(() => eventPhases.id),
  typeName: text("type_name").notNull(), // "General", "VIP", "Student", etc.
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  isActive: boolean("is_active").default(true),
  maxQuantity: integer("max_quantity"),
  soldQuantity: integer("sold_quantity").default(0),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const bookings = pgTable("bookings", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").references(() => events.id),
  phaseId: integer("phase_id").references(() => eventPhases.id),
  ticketTypeId: integer("ticket_type_id").references(() => ticketTypes.id),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  gender: text("gender", { enum: ["male", "female", "other"] }),
  ticketCount: integer("ticket_count").notNull(),
  guests: jsonb("guests").$type<string[]>().default([]),
  guestGenders: jsonb("guest_genders").$type<string[]>().default([]),
  guestCodes: jsonb("guest_codes").$type<string[]>().default([]), // 6-digit alphanumeric codes
  couponCode: text("coupon_code"),
  couponDiscount: integer("coupon_discount").default(0),
  promoterId: integer("promoter_id").references(() => promoters.id),
  promoCode: text("promo_code"), // Store the referral code used
  totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).notNull(),
  paymentStatus: text("payment_status", { enum: ["pending", "paid", "verified", "failed", "refunded"] }).default("pending"),
  paymentId: text("payment_id"), // Cashfree payment ID
  paymentMethod: text("payment_method"), // card, upi, netbanking
  paymentScreenshot: text("payment_screenshot"), // Payment screenshot URL
  ticketType: text("ticket_type", { enum: ["early_bird", "phase_1", "phase_2", "phase_3", "phase_4"] }), // Telugu Night ticket type
  qrCodes: jsonb("qr_codes").$type<string[]>().default([]),
  passIds: jsonb("pass_ids").$type<string[]>().default([]), // Unique pass IDs for dashboard
  isScanned: boolean("is_scanned").default(false),
  scannedAt: timestamp("scanned_at"),
  scannedBy: integer("scanned_by").references(() => users.id),
  scannedGuests: jsonb("scanned_guests").$type<string[]>().default([]), // Track which guests have been scanned
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const coupons = pgTable("coupons", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  discount: integer("discount").notNull(),
  isActive: boolean("is_active").default(true),
  usageLimit: integer("usage_limit"),
  usageCount: integer("usage_count").default(0),
  validFrom: timestamp("valid_from"),
  validTo: timestamp("valid_to"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Promoter table for referral system
export const promoters = pgTable("promoters", {
  id: serial("id").primaryKey(),
  promoCode: text("promo_code").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  isActive: boolean("is_active").default(true),
  totalBookings: integer("total_bookings").default(0),
  totalRevenue: numeric("total_revenue", { precision: 10, scale: 2 }).default("0"),
  commission: numeric("commission", { precision: 5, scale: 2 }).default("5"), // 5% default commission
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  role: true,
  permissions: true,
});

export const insertAdminSessionSchema = createInsertSchema(adminSessions).pick({
  userId: true,
  token: true,
  expiresAt: true,
});

// Telugu Night 3.0 Event Configuration
export const teluguNightConfig = pgTable("telugu_night_config", {
  id: serial("id").primaryKey(),
  eventTitle: text("event_title").default("Telugu Night 3.0"),
  eventDescription: text("event_description"),
  venue: text("venue").default("HI-point Lounge (SOHO)"),
  eventDate: timestamp("event_date"),
  maxCapacity: integer("max_capacity").default(500),
  bookingOpen: boolean("booking_open").default(false),
  
  // Phase configuration - aligned with actual database structure
  earlyBirdPrice: integer("early_bird_price").default(300),
  phase1Price: integer("phase1_price").default(350), 
  phase2Price: integer("phase2_price").default(400),
  phase3Price: integer("phase3_price").default(425),
  phase4Price: integer("phase4_price").default(450),
  
  earlyBirdLimit: integer("early_bird_limit").default(90),
  phase1Limit: integer("phase1_limit").default(200),
  phase2Limit: integer("phase2_limit").default(210),
  phase3Limit: integer("phase3_limit").default(100),
  phase4Limit: integer("phase4_limit").default(100),
  
  isEarlyBirdActive: boolean("is_early_bird_active").default(true),
  isPhase1Active: boolean("is_phase1_active").default(true),
  isPhase2Active: boolean("is_phase2_active").default(false),
  isPhase3Active: boolean("is_phase3_active").default(false),
  isPhase4Active: boolean("is_phase4_active").default(false),
  
  isEarlyBirdSoldOut: boolean("is_early_bird_sold_out").default(false),
  isPhase1SoldOut: boolean("is_phase1_sold_out").default(false),
  isPhase2SoldOut: boolean("is_phase2_sold_out").default(false),
  isPhase3SoldOut: boolean("is_phase3_sold_out").default(false),
  isPhase4SoldOut: boolean("is_phase4_sold_out").default(false),
  
  convenientFee: numeric("convenient_fee", { precision: 10, scale: 2 }).default("12.96"),
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedBy: integer("updated_by").references(() => users.id),
});

// Telugu Night ticket count tracking
export const teluguNightCounter = pgTable("telugu_night_counter", {
  id: serial("id").primaryKey(),
  earlyBirdCount: integer("early_bird_count").default(0),
  phase1Count: integer("phase1_count").default(0),
  phase2Count: integer("phase2_count").default(0),
  phase3Count: integer("phase3_count").default(0),
  phase4Count: integer("phase4_count").default(0),
  totalSold: integer("total_sold").default(0),
  lastUpdated: timestamp("updated_at").defaultNow(),
});

// Webhook processing log for idempotency and monitoring
export const webhookProcessingLog = pgTable("webhook_processing_log", {
  id: serial("id").primaryKey(),
  webhookId: text("webhook_id").notNull().unique(), // Generated webhook ID for tracking
  signature: text("signature").notNull(), // Webhook signature for verification
  webhookTimestamp: text("webhook_timestamp").notNull(), // Timestamp from webhook headers
  eventType: text("event_type").notNull(), // PAYMENT_SUCCESS_WEBHOOK, PAYMENT_FAILED_WEBHOOK, etc.
  orderId: text("order_id"), // Cashfree order ID
  bookingId: integer("booking_id").references(() => bookings.id), // Related booking
  status: text("status", { enum: ["processing", "completed", "failed", "duplicate"] }).default("processing"),
  processingStartedAt: timestamp("processing_started_at").defaultNow(),
  processingCompletedAt: timestamp("processing_completed_at"),
  processingTimeMs: integer("processing_time_ms"), // Processing time in milliseconds
  errorMessage: text("error_message"), // Error details if failed
  retryCount: integer("retry_count").default(0), // Number of retry attempts
  lastRetryAt: timestamp("last_retry_at"), // Last retry timestamp
  userAgent: text("user_agent"), // Request user agent for debugging
  clientIp: text("client_ip"), // Client IP for security monitoring
  payloadHash: text("payload_hash"), // Hash of webhook payload for duplicate detection
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertEventSchema = createInsertSchema(events).pick({
  title: true,
  description: true,
  venue: true,
  eventDate: true,
  vendorId: true,
  maxCapacity: true,
});

export const insertEventPhaseSchema = createInsertSchema(eventPhases).pick({
  eventId: true,
  phaseName: true,
  phaseOrder: true,
  isActive: true,
  maxTickets: true,
  startDate: true,
  endDate: true,
});

export const insertTicketTypeSchema = createInsertSchema(ticketTypes).pick({
  eventId: true,
  phaseId: true,
  typeName: true,
  price: true,
  maxQuantity: true,
  description: true,
});

export const insertBookingSchema = createInsertSchema(bookings).pick({
  eventId: true,
  phaseId: true,
  ticketTypeId: true,
  name: true,
  email: true,
  phone: true,
  gender: true,
  ticketCount: true,
  guests: true,
  guestGenders: true,
  couponCode: true,
  promoCode: true,
}).extend({
  // Enhanced validation
  name: z.string().min(2, "Name must be at least 2 characters").max(100, "Name must be less than 100 characters"),
  phone: z.string().regex(/^\d{10}$/, "Phone number must be exactly 10 digits"),
  email: z.string().email("Please enter a valid email address"),
  gender: z.enum(["male", "female", "other"], { required_error: "Gender is required" }),
  ticketCount: z.number().min(1, "Must select at least 1 ticket").max(15, "For bookings above 15 tickets, please contact mis@aashveetech.com"),
  couponCode: z.union([z.string(), z.null()]).optional(),
  guests: z.array(z.string().min(1, "Guest name cannot be empty")).optional(),
  guestGenders: z.array(z.enum(["male", "female", "other"])).optional(),
  promoCode: z.union([z.string(), z.null()]).optional(),
  referrer: z.union([z.string(), z.null()]).optional(),
  ticketType: z.enum(["early_bird", "phase_1", "phase_2", "phase_3", "phase_4"]).optional(),
}).refine((data) => {
  // If multiple tickets, ensure guest info is provided
  if (data.ticketCount > 1) {
    const guestCount = data.guests?.length || 0;
    const guestGenderCount = data.guestGenders?.length || 0;
    return guestCount === data.ticketCount - 1 && guestGenderCount === data.ticketCount - 1;
  }
  return true;
}, {
  message: "Guest information must be provided for all additional tickets",
  path: ["guests"]
});

export const insertCouponSchema = createInsertSchema(coupons).pick({
  code: true,
  discount: true,
  usageLimit: true,
  validFrom: true,
  validTo: true,
});

export const insertPromoterSchema = createInsertSchema(promoters).pick({
  promoCode: true,
  email: true,
  name: true,
  commission: true,
}).extend({
  email: z.string().email("Please enter a valid email address"),
  promoCode: z.string().min(3).max(20).regex(/^[A-Z0-9]+$/, "Promo code must contain only uppercase letters and numbers"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  commission: z.coerce.number().min(0).max(100).default(5),
});

export const insertTeluguNightConfigSchema = createInsertSchema(teluguNightConfig).pick({
  eventTitle: true,
  eventDescription: true,
  venue: true,
  eventDate: true,
  maxCapacity: true,
  bookingOpen: true,
  earlyBirdPrice: true,
  phase1Price: true,
  phase2Price: true,
  phase3Price: true,
  phase4Price: true,
  earlyBirdLimit: true,
  phase1Limit: true,
  phase2Limit: true,
  phase3Limit: true,
  phase4Limit: true,
  isEarlyBirdActive: true,
  isPhase1Active: true,
  isPhase2Active: true,
  isPhase3Active: true,
  isPhase4Active: true,
  convenientFee: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type AdminSession = typeof adminSessions.$inferSelect;
export type InsertAdminSession = z.infer<typeof insertAdminSessionSchema>;
export type Event = typeof events.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type EventPhase = typeof eventPhases.$inferSelect;
export type InsertEventPhase = z.infer<typeof insertEventPhaseSchema>;
export type TicketType = typeof ticketTypes.$inferSelect;
export type InsertTicketType = z.infer<typeof insertTicketTypeSchema>;
export type Booking = typeof bookings.$inferSelect;
export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type Coupon = typeof coupons.$inferSelect;
export type InsertCoupon = z.infer<typeof insertCouponSchema>;
export type Promoter = typeof promoters.$inferSelect;
export type InsertPromoter = z.infer<typeof insertPromoterSchema>;
export type TeluguNightConfig = typeof teluguNightConfig.$inferSelect;
export type InsertTeluguNightConfig = z.infer<typeof insertTeluguNightConfigSchema>;

export type WebhookProcessingLog = typeof webhookProcessingLog.$inferSelect;
export type InsertWebhookProcessingLog = typeof webhookProcessingLog.$inferInsert;

// Permission system constants
export const PERMISSIONS = {
  // Booking management
  VIEW_BOOKINGS: 'view_bookings',
  VERIFY_PAYMENTS: 'verify_payments', 
  SEND_TICKETS: 'send_tickets',
  DELETE_BOOKINGS: 'delete_bookings',
  MANAGE_BOOKINGS: 'manage_bookings',
  
  // Scanner access
  SCANNER_ACCESS: 'scanner_access',
  
  // User management
  MANAGE_USERS: 'manage_users',
  VIEW_USERS: 'view_users',
  
  // Event management
  CREATE_EVENTS: 'create_events',
  MANAGE_EVENTS: 'manage_events',
  VIEW_EVENTS: 'view_events',
  MANAGE_PHASES: 'manage_phases',
  MANAGE_TICKET_TYPES: 'manage_ticket_types',
  
  // Payment management
  MANAGE_PAYMENTS: 'manage_payments',
  VIEW_REPORTS: 'view_reports',
  
  // System settings
  MANAGE_COUPONS: 'manage_coupons',
  VIEW_ANALYTICS: 'view_analytics',
  SYSTEM_SETTINGS: 'system_settings',
} as const;

export const ROLE_PERMISSIONS = {
  super_admin: Object.values(PERMISSIONS),
  admin: [
    PERMISSIONS.VIEW_BOOKINGS,
    PERMISSIONS.VERIFY_PAYMENTS,
    PERMISSIONS.SEND_TICKETS,
    PERMISSIONS.DELETE_BOOKINGS,
    PERMISSIONS.MANAGE_BOOKINGS,
    PERMISSIONS.SCANNER_ACCESS,
    PERMISSIONS.MANAGE_COUPONS,
    PERMISSIONS.VIEW_ANALYTICS,
    PERMISSIONS.VIEW_USERS,
    PERMISSIONS.MANAGE_EVENTS,
    PERMISSIONS.MANAGE_PHASES,
    PERMISSIONS.MANAGE_TICKET_TYPES,
  ],
  organizer: [
    PERMISSIONS.VIEW_BOOKINGS,
    PERMISSIONS.VERIFY_PAYMENTS,
    PERMISSIONS.SEND_TICKETS,
    PERMISSIONS.VIEW_ANALYTICS,
  ],
  vendor: [
    PERMISSIONS.CREATE_EVENTS,
    PERMISSIONS.MANAGE_EVENTS,
    PERMISSIONS.VIEW_EVENTS,
    PERMISSIONS.MANAGE_PHASES,
    PERMISSIONS.MANAGE_TICKET_TYPES,
    PERMISSIONS.VIEW_BOOKINGS,
    PERMISSIONS.MANAGE_COUPONS,
    PERMISSIONS.VIEW_ANALYTICS,
  ],
  scanner: [
    PERMISSIONS.SCANNER_ACCESS,
  ],
  viewer: [
    PERMISSIONS.VIEW_BOOKINGS,
    PERMISSIONS.VIEW_ANALYTICS,
  ],
} as const;
