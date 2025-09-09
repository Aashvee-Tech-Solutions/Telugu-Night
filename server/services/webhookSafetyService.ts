import { storage } from '../storage.js';
import { CashfreeService } from './cashfreeService.js';
import { enhancedEmailService } from './enhancedEmailService.js';

export interface PaymentMonitoringEntry {
  orderId: string;
  bookingId: number;
  createdAt: Date;
  lastChecked?: Date;
  attempts: number;
  status: 'pending' | 'resolved' | 'failed';
}

export class WebhookSafetyService {
  private pendingPayments = new Map<string, PaymentMonitoringEntry>();
  private cashfreeService = new CashfreeService();
  private monitoringInterval: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL = 60000; // Check every minute
  private readonly MAX_MONITORING_TIME = 3600000; // 1 hour maximum

  constructor() {
    console.log('🛡️ Webhook Safety Service initialized');
    this.startMonitoring();
  }

  /**
   * Add a payment for monitoring in case webhook fails
   */
  async addPaymentForMonitoring(orderId: string, bookingId: number): Promise<void> {
    const entry: PaymentMonitoringEntry = {
      orderId,
      bookingId,
      createdAt: new Date(),
      attempts: 0,
      status: 'pending'
    };

    this.pendingPayments.set(orderId, entry);
    console.log(`🔍 Added payment ${orderId} (booking ${bookingId}) to monitoring queue`);
  }

  /**
   * Remove payment from monitoring (webhook was successful)
   */
  async removePaymentFromMonitoring(orderId: string): Promise<void> {
    if (this.pendingPayments.has(orderId)) {
      this.pendingPayments.delete(orderId);
      console.log(`✅ Removed payment ${orderId} from monitoring (webhook successful)`);
    }
  }

  /**
   * Start the monitoring service
   */
  private startMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    this.monitoringInterval = setInterval(() => {
      this.checkPendingPayments();
    }, this.CHECK_INTERVAL);

    console.log('🔄 Webhook safety monitoring started');
  }

  /**
   * Check all pending payments for status updates
   */
  private async checkPendingPayments(): Promise<void> {
    if (this.pendingPayments.size === 0) {
      return;
    }

    console.log(`🔍 Checking ${this.pendingPayments.size} pending payments for webhook failures`);

    const entries = Array.from(this.pendingPayments.entries());
    for (const [orderId, entry] of entries) {
      try {
        await this.checkSinglePayment(orderId, entry);
      } catch (error: any) {
        console.error(`❌ Error checking payment ${orderId}:`, error.message);
      }
    }
  }

  /**
   * Check a single payment for status updates
   */
  private async checkSinglePayment(orderId: string, entry: PaymentMonitoringEntry): Promise<void> {
    const now = new Date();
    const elapsed = now.getTime() - entry.createdAt.getTime();

    // Stop monitoring after maximum time
    if (elapsed > this.MAX_MONITORING_TIME) {
      console.log(`⏰ Payment ${orderId} monitoring timeout (${elapsed}ms elapsed)`);
      await this.handleMonitoringTimeout(orderId, entry);
      return;
    }

    entry.attempts++;
    entry.lastChecked = now;

    try {
      // Check payment status with Cashfree
      const paymentStatus = await this.cashfreeService.getOrderStatus(orderId);
      
      if (paymentStatus.order_status === 'PAID') {
        console.log(`💰 Found successful payment via monitoring: ${orderId}`);
        await this.handleSuccessfulPayment(orderId, entry, paymentStatus);
      } else if (paymentStatus.order_status === 'FAILED' || paymentStatus.order_status === 'CANCELLED') {
        console.log(`❌ Found failed payment via monitoring: ${orderId} (${paymentStatus.order_status})`);
        await this.handleFailedPayment(orderId, entry, paymentStatus);
      } else {
        console.log(`⏳ Payment ${orderId} still pending: ${paymentStatus.order_status} (attempt ${entry.attempts})`);
      }

    } catch (error: any) {
      console.error(`❌ Error checking payment status for ${orderId}:`, error.message);
      
      // If we can't check status after many attempts, flag for manual review
      if (entry.attempts >= 10) {
        await this.handleMonitoringError(orderId, entry, error);
      }
    }
  }

  /**
   * Handle successful payment found via monitoring
   */
  private async handleSuccessfulPayment(orderId: string, entry: PaymentMonitoringEntry, paymentData: any): Promise<void> {
    try {
      console.log(`🎯 Processing delayed webhook for successful payment ${orderId}`);

      // Update booking status
      const booking = await storage.getBooking(entry.bookingId);
      if (!booking) {
        throw new Error(`Booking ${entry.bookingId} not found`);
      }

      await storage.updateBookingStatus(entry.bookingId, 'confirmed');

      // Send confirmation email and tickets
      await enhancedEmailService.sendPaymentConfirmationEmail(booking);

      // Remove from monitoring
      this.pendingPayments.delete(orderId);
      
      console.log(`✅ Successfully processed delayed payment ${orderId} via monitoring`);

      // Notify admins about the recovery
      await this.notifyAdminsOfRecovery(orderId, entry, 'SUCCESS_VIA_MONITORING');

    } catch (error: any) {
      console.error(`❌ Error processing delayed successful payment ${orderId}:`, error.message);
      await this.handleMonitoringError(orderId, entry, error);
    }
  }

  /**
   * Handle failed payment found via monitoring
   */
  private async handleFailedPayment(orderId: string, entry: PaymentMonitoringEntry, paymentData: any): Promise<void> {
    try {
      // Update booking status to failed
      await storage.updateBookingStatus(entry.bookingId, 'payment_failed');

      // Remove from monitoring
      this.pendingPayments.delete(orderId);
      
      console.log(`❌ Payment ${orderId} confirmed as failed via monitoring`);

      // Notify admins
      await this.notifyAdminsOfRecovery(orderId, entry, 'FAILED_VIA_MONITORING');

    } catch (error: any) {
      console.error(`❌ Error processing failed payment ${orderId}:`, error.message);
    }
  }

  /**
   * Handle monitoring timeout
   */
  private async handleMonitoringTimeout(orderId: string, entry: PaymentMonitoringEntry): Promise<void> {
    entry.status = 'failed';
    this.pendingPayments.delete(orderId);
    
    console.log(`⏰ Payment monitoring timeout for ${orderId} after ${entry.attempts} attempts`);
    await this.notifyAdminsOfRecovery(orderId, entry, 'MONITORING_TIMEOUT');
  }

  /**
   * Handle monitoring errors
   */
  private async handleMonitoringError(orderId: string, entry: PaymentMonitoringEntry, error: any): Promise<void> {
    entry.status = 'failed';
    this.pendingPayments.delete(orderId);
    
    console.log(`❌ Payment monitoring error for ${orderId}: ${error.message}`);
    await this.notifyAdminsOfRecovery(orderId, entry, 'MONITORING_ERROR');
  }

  /**
   * Notify admins about payment recovery or issues
   */
  private async notifyAdminsOfRecovery(orderId: string, entry: PaymentMonitoringEntry, type: string): Promise<void> {
    try {
      const booking = await storage.getBooking(entry.bookingId);
      const message = this.getRecoveryMessage(type, orderId, entry, booking);
      
      console.log(`📧 Admin notification: ${message}`);
      
      // In a real implementation, you would send this to admin emails
      // For now, we just log it for monitoring
      
    } catch (error: any) {
      console.error(`❌ Error sending admin notification:`, error.message);
    }
  }

  /**
   * Get recovery message for admin notifications
   */
  private getRecoveryMessage(type: string, orderId: string, entry: PaymentMonitoringEntry, booking: any): string {
    const baseInfo = `Order: ${orderId}, Booking: ${entry.bookingId}, Customer: ${booking?.customerName || 'Unknown'}`;
    
    switch (type) {
      case 'SUCCESS_VIA_MONITORING':
        return `✅ RECOVERED: Payment processed successfully via monitoring. Webhook failed but payment confirmed. ${baseInfo}`;
      case 'FAILED_VIA_MONITORING':
        return `❌ CONFIRMED FAILED: Payment confirmed as failed via monitoring. ${baseInfo}`;
      case 'MONITORING_TIMEOUT':
        return `⏰ MANUAL REVIEW NEEDED: Payment monitoring timeout. Please manually verify status. ${baseInfo}`;
      case 'MONITORING_ERROR':
        return `🚨 URGENT: Payment monitoring error. Manual verification required immediately. ${baseInfo}`;
      default:
        return `❓ UNKNOWN: Payment monitoring issue. ${baseInfo}`;
    }
  }

  /**
   * Get monitoring status for admin dashboard
   */
  async getMonitoringStatus(): Promise<{
    pendingPayments: number;
    totalAttempts: number;
    oldestPending?: Date;
  }> {
    const pending = Array.from(this.pendingPayments.values());
    const totalAttempts = pending.reduce((sum, entry) => sum + entry.attempts, 0);
    const oldestPending = pending.length > 0 
      ? new Date(Math.min(...pending.map(p => p.createdAt.getTime())))
      : undefined;

    return {
      pendingPayments: this.pendingPayments.size,
      totalAttempts,
      oldestPending
    };
  }

  /**
   * Manually trigger check for specific payment
   */
  async manualCheck(orderId: string): Promise<boolean> {
    const entry = this.pendingPayments.get(orderId);
    if (!entry) {
      console.log(`Payment ${orderId} not found in monitoring queue`);
      return false;
    }

    console.log(`🔍 Manual check triggered for payment ${orderId}`);
    await this.checkSinglePayment(orderId, entry);
    return true;
  }

  /**
   * Stop monitoring service
   */
  destroy(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    console.log('🛡️ Webhook Safety Service stopped');
  }
}

// Export singleton instance
export const webhookSafetyService = new WebhookSafetyService();