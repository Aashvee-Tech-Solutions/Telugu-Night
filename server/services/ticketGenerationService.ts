import { EventEmitter } from 'events';
import { PaymentService } from './paymentService';
import { EmailService } from './emailService';
import { storage } from '../databaseStorage';
import type { Booking } from '@shared/schema';
import QRCode from 'qrcode';

interface GenerationProgress {
  bookingId: number;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  progress: number;
  currentStep: string;
  qrCodes: string[];
  passIds: string[];
  guestCodes: string[];
  errors: string[];
  startTime: Date;
  completedAt?: Date;
}

interface BatchProgress {
  batchId: string;
  totalBookings: number;
  completed: number;
  failed: number;
  progress: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  bookings: GenerationProgress[];
  startTime: Date;
  completedAt?: Date;
}

export class TicketGenerationService extends EventEmitter {
  private paymentService: PaymentService;
  private emailService: EmailService;
  private activeBatches: Map<string, BatchProgress> = new Map();
  private processingQueue: number[] = [];
  private isProcessing = false;

  constructor() {
    super();
    this.paymentService = new PaymentService();
    this.emailService = new EmailService();
  }

  // Generate tickets for a single booking with progress tracking
  async generateTicketsForBooking(bookingId: number): Promise<GenerationProgress> {
    const booking = await storage.getBooking(bookingId);
    if (!booking) {
      throw new Error('Booking not found');
    }

    const progress: GenerationProgress = {
      bookingId,
      status: 'pending',
      progress: 0,
      currentStep: 'Initializing ticket generation',
      qrCodes: [],
      passIds: [],
      guestCodes: [],
      errors: [],
      startTime: new Date()
    };

    this.emit('progress', progress);

    try {
      // Check if QR codes already exist - if so, reuse them
      const hasExistingQRCodes = booking.qrCodes && booking.qrCodes.length > 0;
      const hasExistingGuestCodes = booking.guestCodes && booking.guestCodes.length > 0;
      
      if (hasExistingQRCodes && hasExistingGuestCodes) {
        console.log(`♻️ Reusing existing QR codes for booking ${bookingId}`);
        
        progress.status = 'completed';
        progress.progress = 100;
        progress.currentStep = 'Reusing existing QR codes';
        progress.qrCodes = booking.qrCodes || [];
        progress.passIds = booking.passIds || [];
        progress.guestCodes = booking.guestCodes || [];
        progress.completedAt = new Date();
        
        // Send existing tickets via email
        try {
          const { EnhancedEmailService } = await import('./enhancedEmailService');
          const enhancedEmailService = new EnhancedEmailService();
          await enhancedEmailService.sendTicketEmails({
            ...booking,
            guests: booking.guests || [],
            guestCodes: booking.guestCodes || [],
            qrCodes: booking.qrCodes || [],
            passIds: booking.passIds || [],
            paymentStatus: booking.paymentStatus || 'verified'
          });
          console.log(`✅ Existing QR tickets resent successfully to ${booking.email}`);
        } catch (emailError) {
          console.error('Failed to resend existing tickets:', emailError);
          progress.errors.push('Failed to resend existing tickets');
        }
        
        this.emit('progress', progress);
        return progress;
      }

      // Step 1: Generate Pass IDs (only if new tickets needed)
      progress.status = 'generating';
      progress.currentStep = 'Generating pass IDs';
      progress.progress = 10;
      this.emit('progress', progress);

      const { generatePassIds } = await import('./emailService');
      const passIds = generatePassIds(booking.id, booking.ticketCount);
      progress.passIds = passIds;
      progress.progress = 25;
      this.emit('progress', progress);

      // Step 2: Generate QR Codes
      progress.currentStep = 'Generating QR codes';
      progress.progress = 40;
      this.emit('progress', progress);

      const qrCodes: string[] = [];
      for (let i = 0; i < booking.ticketCount; i++) {
        const guestCode = booking.guestCodes?.[i] || `GUEST${booking.id}_${i + 1}`;
        // QR code should contain only the guest code for direct scanning
        const qrData = guestCode;

        const qrCodeImage = await QRCode.toDataURL(qrData, {
          width: 300,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });
        qrCodes.push(qrCodeImage);
        
        progress.progress = 40 + (i + 1) * (30 / booking.ticketCount);
        progress.currentStep = `Generated QR code ${i + 1} of ${booking.ticketCount}`;
        this.emit('progress', progress);
      }

      progress.qrCodes = qrCodes;
      progress.guestCodes = booking.guestCodes || [];

      // Step 3: Update booking in storage
      progress.currentStep = 'Updating booking records';
      progress.progress = 75;
      this.emit('progress', progress);

      await storage.updateBookingQRCodes(bookingId, qrCodes, passIds, booking.guestCodes || []);

      // Step 4: Send email with tickets
      progress.currentStep = 'Sending tickets via email';
      progress.progress = 85;
      this.emit('progress', progress);

      try {
        // Import enhanced email service for consolidated email handling
        const { enhancedEmailService } = await import('./enhancedEmailService');
        await enhancedEmailService.sendTicketEmails({
          ...booking,
          guests: booking.guests || [],
          guestCodes: progress.guestCodes,
          qrCodes: progress.qrCodes,
          passIds: progress.passIds,
          paymentStatus: booking.paymentStatus || 'verified'
        });
      } catch (emailError: any) {
        progress.errors.push(`Email delivery failed: ${emailError.message}`);
        console.error('Email delivery failed:', emailError);
      }

      // Step 5: Complete
      progress.status = 'completed';
      progress.currentStep = 'Ticket generation completed';
      progress.progress = 100;
      progress.completedAt = new Date();
      this.emit('progress', progress);

      return progress;

    } catch (error: any) {
      progress.status = 'failed';
      progress.errors.push(error.message);
      progress.completedAt = new Date();
      this.emit('progress', progress);
      throw error;
    }
  }

  // Batch process multiple bookings with smart queuing
  async generateTicketsBatch(bookingIds: number[]): Promise<string> {
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const batchProgress: BatchProgress = {
      batchId,
      totalBookings: bookingIds.length,
      completed: 0,
      failed: 0,
      progress: 0,
      status: 'pending',
      bookings: [],
      startTime: new Date()
    };

    // Initialize individual booking progress
    for (const bookingId of bookingIds) {
      batchProgress.bookings.push({
        bookingId,
        status: 'pending',
        progress: 0,
        currentStep: 'Queued for processing',
        qrCodes: [],
        passIds: [],
        guestCodes: [],
        errors: [],
        startTime: new Date()
      });
    }

    this.activeBatches.set(batchId, batchProgress);
    this.emit('batchProgress', batchProgress);

    // Process bookings with controlled concurrency
    this.processBatch(batchId, bookingIds);

    return batchId;
  }

  private async processBatch(batchId: string, bookingIds: number[]) {
    const batch = this.activeBatches.get(batchId);
    if (!batch) return;

    batch.status = 'processing';
    this.emit('batchProgress', batch);

    const concurrency = 3; // Process 3 bookings simultaneously
    const chunks = this.chunkArray(bookingIds, concurrency);

    for (const chunk of chunks) {
      const promises = chunk.map(async (bookingId) => {
        try {
          const bookingProgress = batch.bookings.find(b => b.bookingId === bookingId);
          if (!bookingProgress) return;

          // Set up progress tracking for individual booking
          const progressHandler = (progress: GenerationProgress) => {
            Object.assign(bookingProgress, progress);
            this.updateBatchProgress(batchId);
          };

          this.on('progress', progressHandler);

          await this.generateTicketsForBooking(bookingId);
          batch.completed++;

          this.removeListener('progress', progressHandler);
        } catch (error) {
          batch.failed++;
          const bookingProgress = batch.bookings.find(b => b.bookingId === bookingId);
          if (bookingProgress) {
            bookingProgress.status = 'failed';
            bookingProgress.errors.push(error instanceof Error ? error.message : 'Unknown error');
          }
        }
      });

      await Promise.all(promises);
    }

    // Complete batch
    batch.status = batch.failed > 0 ? 'completed' : 'completed';
    batch.progress = 100;
    batch.completedAt = new Date();
    this.emit('batchProgress', batch);
  }

  private updateBatchProgress(batchId: string) {
    const batch = this.activeBatches.get(batchId);
    if (!batch) return;

    const totalProgress = batch.bookings.reduce((sum, booking) => sum + booking.progress, 0);
    batch.progress = Math.round(totalProgress / batch.totalBookings);

    this.emit('batchProgress', batch);
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  // Get progress for a specific batch
  getBatchProgress(batchId: string): BatchProgress | null {
    return this.activeBatches.get(batchId) || null;
  }

  // Get all active batches
  getActiveBatches(): BatchProgress[] {
    return Array.from(this.activeBatches.values());
  }

  // Auto-generate tickets for verified payments
  async autoGenerateForVerifiedPayments(): Promise<string[]> {
    const allBookings = await storage.getAllBookings();
    const verifiedBookings = allBookings.filter(booking => booking.paymentStatus === 'verified');
    const bookingsNeedingTickets = verifiedBookings.filter((booking: Booking) => 
      !booking.qrCodes || booking.qrCodes.length === 0
    );

    if (bookingsNeedingTickets.length === 0) {
      return [];
    }

    const batchIds: string[] = [];
    
    // Process in batches of 10 for better performance
    const batchSize = 10;
    for (let i = 0; i < bookingsNeedingTickets.length; i += batchSize) {
      const batchBookings = bookingsNeedingTickets.slice(i, i + batchSize);
      const batchId = await this.generateTicketsBatch(batchBookings.map((b: Booking) => b.id));
      batchIds.push(batchId);
    }

    return batchIds;
  }

  // Cleanup completed batches older than 1 hour
  cleanupOldBatches() {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    for (const [batchId, batch] of Array.from(this.activeBatches.entries())) {
      if (batch.completedAt && batch.completedAt < oneHourAgo) {
        this.activeBatches.delete(batchId);
      }
    }
  }
}

export const ticketGenerationService = new TicketGenerationService();

// Cleanup old batches every 30 minutes
setInterval(() => {
  ticketGenerationService.cleanupOldBatches();
}, 30 * 60 * 1000);