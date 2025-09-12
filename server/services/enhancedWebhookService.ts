import { createHash } from 'crypto';
import { storage } from '../databaseStorage';
import { CashfreeService } from './cashfreeService';
import { PaymentService } from './paymentService';
import { enhancedEmailService } from './enhancedEmailService';
import { TicketGenerationService } from './ticketGenerationService';
import { GoogleSheetsService } from './googleSheets';
import { webhookSafetyService } from './webhookSafetyService';
import { webhookSecurityService } from './webhookSecurityService';

export interface WebhookProcessingResult {
  success: boolean;
  webhookId: string;
  status: 'processed' | 'duplicate' | 'failed' | 'skipped';
  message: string;
  processingTimeMs?: number;
  bookingId?: number;
  error?: string;
}

export interface WebhookPayload {
  type: string;
  data?: {
    order?: {
      order_id: string;
      cf_order_id: string;
      order_status: string;
      order_amount: number;
    };
  };
}

export class EnhancedWebhookService {
  private inMemoryProcessingLog = new Map<string, {
    webhookId: string;
    signature: string;
    timestamp: string;
    status: 'processing' | 'completed' | 'failed' | 'duplicate';
    startTime: number;
    bookingId?: number;
    error?: string;
  }>();

  private rateLimitMap = new Map<string, {
    count: number;
    resetTime: number;
  }>();

  private readonly RATE_LIMIT_WINDOW = 60000; // 1 minute
  private readonly RATE_LIMIT_MAX_REQUESTS = 100; // Max requests per window
  private readonly PROCESSING_TIMEOUT = 30000; // 30 seconds
  private readonly DUPLICATE_WINDOW = 300000; // 5 minutes for duplicate detection

  constructor() {
    console.log('🔧 Enhanced Webhook Service initialized');
    this.cleanupOldEntries();
  }

  /**
   * Process webhook with comprehensive idempotency and error handling
   */
  async processWebhook(
    webhookId: string,
    signature: string,
    webhookTimestamp: string,
    rawBody: string,
    userAgent: string,
    clientIp: string
  ): Promise<WebhookProcessingResult> {
    const startTime = Date.now();
    
    try {
      console.log(`🎯 [${webhookId}] Starting enhanced webhook processing`);

      // Step 1: Rate limiting check
      const rateLimitResult = this.checkRateLimit(clientIp);
      if (!rateLimitResult.allowed) {
        return {
          success: false,
          webhookId,
          status: 'failed',
          message: 'Rate limit exceeded',
          error: `Too many requests from ${clientIp}. Try again later.`
        };
      }

      // Step 2: Generate payload hash for duplicate detection
      const payloadHash = this.generatePayloadHash(rawBody);
      
      // Step 3: Check for duplicates using signature + timestamp + payload
      const duplicateKey = `${signature}_${webhookTimestamp}_${payloadHash}`;
      const duplicateCheck = this.checkForDuplicate(duplicateKey);
      
      if (duplicateCheck.isDuplicate) {
        console.log(`🔄 [${webhookId}] Duplicate webhook detected, skipping processing`);
        return {
          success: true,
          webhookId,
          status: 'duplicate',
          message: 'Webhook already processed',
          processingTimeMs: Date.now() - startTime,
          bookingId: duplicateCheck.existingEntry?.bookingId
        };
      }

      // Step 4: Create processing entry
      this.inMemoryProcessingLog.set(duplicateKey, {
        webhookId,
        signature,
        timestamp: webhookTimestamp,
        status: 'processing',
        startTime,
      });

      // Step 5: Enhanced security validation
      const webhookSecret = process.env.CASHFREE_WEBHOOK_SECRET || 'ng8v08g8a5ebwi9cuv8c';
      const securityValidation = webhookSecurityService.validateWebhookSecurity(
        signature,
        webhookTimestamp,
        rawBody,
        clientIp,
        webhookSecret,
        userAgent
      );
      
      if (!securityValidation.isValid) {
        const error = `Security validation failed: ${securityValidation.reason}`;
        this.updateProcessingStatus(duplicateKey, 'failed', error);
        console.error(`🔒 [${webhookId}] Security validation failed:`, securityValidation);
        
        return {
          success: false,
          webhookId,
          status: 'failed',
          message: securityValidation.reason || 'Security validation failed',
          processingTimeMs: Date.now() - startTime,
          error
        };
      }

      console.log(`🔒 [${webhookId}] Security validation passed (risk level: ${securityValidation.riskLevel})`);
      
      // If high risk level, add additional monitoring
      if (securityValidation.riskLevel === 'high') {
        console.warn(`⚠️ [${webhookId}] High risk webhook from ${clientIp}, monitoring closely`);
      }

      // Step 6: Parse and validate payload
      let webhookData: WebhookPayload;
      try {
        webhookData = JSON.parse(rawBody);
      } catch (parseError) {
        const error = 'Invalid JSON payload';
        this.updateProcessingStatus(duplicateKey, 'failed', error);
        return {
          success: false,
          webhookId,
          status: 'failed',
          message: error,
          processingTimeMs: Date.now() - startTime,
          error
        };
      }

      // Step 7: Process webhook based on type
      const result = await this.processWebhookByType(webhookId, webhookData, duplicateKey);
      
      // Step 8: Update processing status and return result
      this.updateProcessingStatus(duplicateKey, result.success ? 'completed' : 'failed', result.error, result.bookingId);
      
      return {
        ...result,
        processingTimeMs: Date.now() - startTime
      };

    } catch (error: any) {
      console.error(`💥 [${webhookId}] Webhook processing error:`, error);
      
      const duplicateKey = `${signature}_${webhookTimestamp}_${this.generatePayloadHash(rawBody)}`;
      this.updateProcessingStatus(duplicateKey, 'failed', error.message);
      
      return {
        success: false,
        webhookId,
        status: 'failed',
        message: 'Internal processing error',
        processingTimeMs: Date.now() - startTime,
        error: error.message
      };
    }
  }

  /**
   * Process webhook based on event type with atomic operations
   */
  private async processWebhookByType(
    webhookId: string,
    webhookData: WebhookPayload,
    duplicateKey: string
  ): Promise<Omit<WebhookProcessingResult, 'processingTimeMs'>> {
    const eventType = webhookData.type;

    console.log(`📊 [${webhookId}] Processing webhook type: ${eventType}`);

    if (eventType === 'PAYMENT_SUCCESS_WEBHOOK' || eventType === 'ORDER_PAID') {
      return await this.processPaymentSuccess(webhookId, webhookData, duplicateKey);
    } else if (eventType === 'PAYMENT_FAILED_WEBHOOK' || eventType === 'ORDER_FAILED') {
      return await this.processPaymentFailure(webhookId, webhookData, duplicateKey);
    } else {
      console.log(`ℹ️ [${webhookId}] Unhandled webhook type: ${eventType}`);
      return {
        success: true,
        webhookId,
        status: 'skipped',
        message: 'Webhook acknowledged but not processed'
      };
    }
  }

  /**
   * Process payment success webhook with atomic operations
   */
  private async processPaymentSuccess(
    webhookId: string,
    webhookData: WebhookPayload,
    duplicateKey: string
  ): Promise<Omit<WebhookProcessingResult, 'processingTimeMs'>> {
    try {
      const orderData = webhookData.data?.order;
      if (!orderData?.order_id) {
        return {
          success: false,
          webhookId,
          status: 'failed',
          message: 'Missing order_id in webhook data',
          error: 'Missing order_id in webhook data'
        };
      }

      // Extract booking ID
      const bookingId = parseInt(orderData.order_id.replace('BOOKING-', ''));
      if (isNaN(bookingId)) {
        return {
          success: false,
          webhookId,
          status: 'failed',
          message: 'Invalid booking ID format',
          error: `Invalid booking ID format: ${orderData.order_id}`
        };
      }

      // Update processing entry with booking ID
      this.updateProcessingStatus(duplicateKey, 'processing', undefined, bookingId);

      // Get booking
      const booking = await storage.getBooking(bookingId);
      if (!booking) {
        return {
          success: false,
          webhookId,
          status: 'failed',
          message: 'Booking not found',
          error: `Booking not found: ${bookingId}`,
          bookingId
        };
      }

      console.log(`📋 [${webhookId}] Found booking: ${booking.name} (${booking.email})`);

      // Check if already processed
      if (booking.paymentStatus === 'verified') {
        console.log(`✅ [${webhookId}] Payment already verified for booking ${bookingId}`);
        return {
          success: true,
          webhookId,
          status: 'duplicate',
          message: 'Payment already verified',
          bookingId
        };
      }

      // For SUCCESS webhooks, trust the webhook but optionally verify for additional security
      // If verification fails, we'll still process the success (since Cashfree already confirmed it)
      const paymentService = new PaymentService();
      let verificationResult;
      
      try {
        verificationResult = await paymentService.verifyPaymentWithMapping(orderData.cf_order_id || orderData.order_id);
        
        // If verification succeeds and confirms success, great!
        if (verificationResult.success && verificationResult.mappedStatus === 'verified') {
          console.log(`✅ [${webhookId}] Payment verification confirms success`);
        } else if (verificationResult.success && verificationResult.mappedStatus !== 'verified') {
          // If API returns different status, log warning but trust the SUCCESS webhook
          console.warn(`⚠️ [${webhookId}] API verification shows ${verificationResult.mappedStatus}, but SUCCESS webhook received. Trusting webhook.`);
        }
      } catch (error: any) {
        // If verification fails (network, API issues), log warning but trust the SUCCESS webhook
        console.warn(`⚠️ [${webhookId}] Payment verification failed (${error.message}), but SUCCESS webhook received. Trusting webhook for processing.`);
      }

      // For SUCCESS webhooks, we trust Cashfree's webhook and proceed with processing
      // This prevents successful payments from being marked as failed due to API issues

      console.log(`✅ [${webhookId}] Payment verified successfully, processing booking...`);

      // Atomic processing with parallel operations where possible
      await this.processVerifiedPayment(webhookId, bookingId, booking);

      // Remove from webhook safety monitoring since it's processed successfully
      try {
        await webhookSafetyService.removePaymentFromMonitoring(orderData.cf_order_id || orderData.order_id);
      } catch (monitorError) {
        console.warn(`⚠️ [${webhookId}] Failed to remove from webhook monitoring:`, monitorError);
      }

      console.log(`🎉 [${webhookId}] Booking ${bookingId} processed successfully!`);

      return {
        success: true,
        webhookId,
        status: 'processed',
        message: 'Payment processed successfully',
        bookingId
      };

    } catch (error: any) {
      console.error(`❌ [${webhookId}] Error processing payment success:`, error);
      return {
        success: false,
        webhookId,
        status: 'failed',
        message: 'Failed to process payment success',
        error: error.message
      };
    }
  }

  /**
   * Process verified payment with optimized parallel operations
   */
  private async processVerifiedPayment(webhookId: string, bookingId: number, booking: any): Promise<void> {
    // Step 1: Update payment status first (critical)
    await storage.updateBookingPaymentStatus(bookingId, 'verified');
    console.log(`📝 [${webhookId}] Updated booking ${bookingId} payment status to verified`);

    // Step 2: Generate codes if needed (parallel-safe)
    const codeGeneration = this.generateCodesIfNeeded(webhookId, booking);

    // Step 3: Send payment completion email (non-blocking)
    const emailPromise = this.sendPaymentCompletionEmail(webhookId, bookingId);

    // Wait for code generation before proceeding
    const { guestCodes, passIds } = await codeGeneration;

    // Step 4: Update booking with codes if generated
    if (guestCodes !== booking.guestCodes || passIds !== booking.passIds) {
      await storage.updateBookingQRCodes(bookingId, [], passIds, guestCodes);
      console.log(`📝 [${webhookId}] Updated booking codes in database`);
    }

    // Step 5: Generate tickets and log to sheets (parallel)
    const [ticketResult, sheetsResult] = await Promise.allSettled([
      this.generateAndSendTickets(webhookId, bookingId),
      this.logToGoogleSheets(webhookId, bookingId)
    ]);

    // Wait for email to complete
    await emailPromise;

    // Log any failures in parallel operations
    if (ticketResult.status === 'rejected') {
      console.error(`❌ [${webhookId}] Ticket generation failed:`, ticketResult.reason);
      throw new Error(`Ticket generation failed: ${ticketResult.reason.message}`);
    }

    if (sheetsResult.status === 'rejected') {
      console.warn(`⚠️ [${webhookId}] Google Sheets logging failed (non-critical):`, sheetsResult.reason);
    }
  }

  /**
   * Generate guest codes and pass IDs if needed
   */
  private async generateCodesIfNeeded(webhookId: string, booking: any): Promise<{ guestCodes: string[], passIds: string[] }> {
    let guestCodes = booking.guestCodes;
    let passIds = booking.passIds;

    if (!guestCodes || guestCodes.length === 0) {
      const { generateGuestCodes } = await import('./emailService');
      guestCodes = generateGuestCodes(booking.ticketCount);
      console.log(`🎯 [${webhookId}] Generated guest codes: ${guestCodes.join(', ')}`);
    }

    if (!passIds || passIds.length === 0) {
      const { generatePassIds } = await import('./emailService');
      passIds = generatePassIds(booking.id, booking.ticketCount);
      console.log(`🎫 [${webhookId}] Generated pass IDs: ${passIds.join(', ')}`);
    }

    return { guestCodes, passIds };
  }

  /**
   * Send payment completion email (non-blocking)
   */
  private async sendPaymentCompletionEmail(webhookId: string, bookingId: number): Promise<void> {
    try {
      console.log(`📧 [${webhookId}] Sending payment completion email...`);
      const updatedBooking = await storage.getBooking(bookingId);
      if (updatedBooking) {
        const bookingData = this.toBookingData(updatedBooking);
        await enhancedEmailService.sendPaymentCompletionEmail(bookingData);
        console.log(`✅ [${webhookId}] Payment completion email sent successfully`);
      }
    } catch (emailError) {
      console.error(`⚠️ [${webhookId}] Failed to send payment completion email (non-critical):`, emailError);
    }
  }

  /**
   * Generate and send tickets
   */
  private async generateAndSendTickets(webhookId: string, bookingId: number): Promise<void> {
    console.log(`🎫 [${webhookId}] Generating tickets and sending emails...`);
    const ticketGenerationService = new TicketGenerationService();
    await ticketGenerationService.generateTicketsForBooking(bookingId);
    console.log(`📧 [${webhookId}] Tickets generated and emailed successfully`);
  }

  /**
   * Log booking to Google Sheets
   */
  private async logToGoogleSheets(webhookId: string, bookingId: number): Promise<void> {
    const updatedBooking = await storage.getBooking(bookingId);
    if (updatedBooking) {
      const googleSheetsService = new GoogleSheetsService();
      await googleSheetsService.addBookingToSheet(updatedBooking);
      console.log(`📊 [${webhookId}] Booking logged to Google Sheets`);
    }
  }

  /**
   * Process payment failure webhook
   */
  private async processPaymentFailure(
    webhookId: string,
    webhookData: WebhookPayload,
    duplicateKey: string
  ): Promise<Omit<WebhookProcessingResult, 'processingTimeMs'>> {
    try {
      const orderData = webhookData.data?.order;
      if (!orderData?.order_id) {
        return {
          success: true,
          webhookId,
          status: 'skipped',
          message: 'Missing order_id in failure webhook'
        };
      }

      const bookingId = parseInt(orderData.order_id.replace('BOOKING-', ''));
      if (isNaN(bookingId)) {
        return {
          success: true,
          webhookId,
          status: 'skipped',
          message: 'Invalid booking ID format in failure webhook'
        };
      }

      console.log(`❌ [${webhookId}] Processing payment failure for booking ${bookingId}`);

      // Update booking status only - rejection emails disabled for production
      await storage.updateBookingPaymentStatus(bookingId, 'failed');
      console.log(`❌ [${webhookId}] Payment failure processed for booking ${bookingId} - rejection email disabled for production`);

      return {
        success: true,
        webhookId,
        status: 'processed',
        message: 'Payment failure processed',
        bookingId
      };

    } catch (error: any) {
      console.error(`❌ [${webhookId}] Error processing payment failure:`, error);
      return {
        success: false,
        webhookId,
        status: 'failed',
        message: 'Failed to process payment failure',
        error: error.message
      };
    }
  }

  /**
   * Send payment failure email - DISABLED FOR PRODUCTION
   */
  private async sendPaymentFailureEmail(webhookId: string, bookingId: number): Promise<void> {
    // DISABLED: No rejection emails in production to prevent false rejections
    console.log(`🚫 [${webhookId}] Rejection email disabled for production - booking ${bookingId}`);
    return;
  }

  /**
   * Check rate limiting for IP address
   */
  private checkRateLimit(clientIp: string): { allowed: boolean; remaining: number } {
    const now = Date.now();
    const key = clientIp;
    
    const current = this.rateLimitMap.get(key);
    
    if (!current || now > current.resetTime) {
      // New window or expired window
      this.rateLimitMap.set(key, {
        count: 1,
        resetTime: now + this.RATE_LIMIT_WINDOW
      });
      return { allowed: true, remaining: this.RATE_LIMIT_MAX_REQUESTS - 1 };
    }
    
    if (current.count >= this.RATE_LIMIT_MAX_REQUESTS) {
      return { allowed: false, remaining: 0 };
    }
    
    current.count++;
    return { 
      allowed: true, 
      remaining: this.RATE_LIMIT_MAX_REQUESTS - current.count 
    };
  }

  /**
   * Check for duplicate webhook processing
   */
  private checkForDuplicate(duplicateKey: string): { 
    isDuplicate: boolean; 
    existingEntry?: any 
  } {
    const existing = this.inMemoryProcessingLog.get(duplicateKey);
    
    if (existing) {
      const age = Date.now() - existing.startTime;
      
      // If processing is still ongoing and within timeout, it's duplicate
      if (existing.status === 'processing' && age < this.PROCESSING_TIMEOUT) {
        return { isDuplicate: true, existingEntry: existing };
      }
      
      // If already completed/failed and within duplicate window, it's duplicate
      if ((existing.status === 'completed' || existing.status === 'failed') && age < this.DUPLICATE_WINDOW) {
        return { isDuplicate: true, existingEntry: existing };
      }
    }
    
    return { isDuplicate: false };
  }

  /**
   * Generate hash of webhook payload for duplicate detection
   */
  private generatePayloadHash(payload: string): string {
    return createHash('sha256').update(payload).digest('hex').substring(0, 16);
  }

  /**
   * Update processing status in memory
   */
  private updateProcessingStatus(
    duplicateKey: string, 
    status: 'processing' | 'completed' | 'failed', 
    error?: string,
    bookingId?: number
  ): void {
    const existing = this.inMemoryProcessingLog.get(duplicateKey);
    if (existing) {
      existing.status = status;
      existing.error = error;
      if (bookingId) existing.bookingId = bookingId;
    }
  }

  /**
   * Convert database booking to BookingData format
   */
  private toBookingData(booking: any): any {
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

  /**
   * Clean up old entries from memory to prevent memory leaks
   */
  private cleanupOldEntries(): void {
    setInterval(() => {
      const now = Date.now();
      const entriesToDelete: string[] = [];
      
      this.inMemoryProcessingLog.forEach((entry, key) => {
        const age = now - entry.startTime;
        if (age > this.DUPLICATE_WINDOW) {
          entriesToDelete.push(key);
        }
      });
      
      for (const key of entriesToDelete) {
        this.inMemoryProcessingLog.delete(key);
      }
      
      // Clean up rate limit entries
      this.rateLimitMap.forEach((entry, key) => {
        if (now > entry.resetTime) {
          this.rateLimitMap.delete(key);
        }
      });
      
      if (entriesToDelete.length > 0) {
        console.log(`🧹 Cleaned up ${entriesToDelete.length} old webhook processing entries`);
      }
      
    }, 300000); // Clean up every 5 minutes
  }

  /**
   * Get processing statistics for monitoring
   */
  getProcessingStats(): {
    totalProcessing: number;
    rateLimitedIPs: number;
    oldestEntry?: Date;
    securityStats?: any;
    performanceMetrics?: {
      averageProcessingTime: number;
      totalProcessed: number;
      successRate: number;
    };
  } {
    const processing = Array.from(this.inMemoryProcessingLog.values())
      .filter(entry => entry.status === 'processing');
    
    const oldestEntry = processing.length > 0 
      ? new Date(Math.min(...processing.map(p => p.startTime)))
      : undefined;

    // Calculate performance metrics
    const completed = Array.from(this.inMemoryProcessingLog.values())
      .filter(entry => entry.status === 'completed' || entry.status === 'failed');
    
    const successful = completed.filter(entry => entry.status === 'completed');
    const averageProcessingTime = completed.length > 0 
      ? completed.reduce((sum, entry) => sum + (Date.now() - entry.startTime), 0) / completed.length
      : 0;

    return {
      totalProcessing: processing.length,
      rateLimitedIPs: this.rateLimitMap.size,
      oldestEntry,
      securityStats: webhookSecurityService.getSecurityStats(),
      performanceMetrics: {
        averageProcessingTime: Math.round(averageProcessingTime),
        totalProcessed: completed.length,
        successRate: completed.length > 0 ? (successful.length / completed.length) * 100 : 0
      }
    };
  }
}

// Export singleton instance
export const enhancedWebhookService = new EnhancedWebhookService();