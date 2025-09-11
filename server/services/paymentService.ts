import { CashfreeService, CashfreeAPIError, PaymentRetryError } from './cashfreeService';
import { getPublicBaseUrlWithFallback } from '../utils/urlUtils';

export interface PaymentOrderData {
  bookingId: number;
  amount: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  baseUrl?: string; // Optional base URL for return/success URLs
}

export interface PaymentOrderResult {
  success: boolean;
  paymentLink?: string;
  orderId?: string;
  error?: string;
  userMessage?: string;
}

export interface PaymentVerificationResult {
  success: boolean;
  status?: string;
  amount?: number;
  paymentId?: string;
  error?: string;
  userMessage?: string;
}

export interface RefundResult {
  success: boolean;
  refundId?: string;
  refundStatus?: string;
  refundAmount?: number;
  error?: string;
  userMessage?: string;
}

export class PaymentService {
  private cashfree: CashfreeService;

  constructor() {
    this.cashfree = new CashfreeService();
  }

  async createPaymentOrder(bookingData: PaymentOrderData): Promise<PaymentOrderResult> {
    const orderId = this.cashfree.generateOrderId(bookingData.bookingId);
    
    try {
      console.log(`💳 Creating payment order for booking ${bookingData.bookingId} with amount ₹${bookingData.amount}`);
      
      // Validate input data
      this.validatePaymentOrderData(bookingData);
      
      const orderResponse = await this.cashfree.createOrder({
        order_amount: bookingData.amount,
        order_currency: 'INR',
        order_id: orderId,
        customer_details: {
          customer_id: `customer_${bookingData.bookingId}`,
          customer_name: bookingData.customerName,
          customer_email: bookingData.customerEmail,
          customer_phone: bookingData.customerPhone,
        },
        order_meta: {
          return_url: `${bookingData.baseUrl || getPublicBaseUrlWithFallback()}/payment/success?booking=${bookingData.bookingId}`,
          notify_url: this.getWebhookUrl(),
        },
      });

      console.log(`✅ Payment order created successfully: ${orderResponse.cf_order_id}`);
      
      return {
        success: true,
        paymentLink: orderResponse.payment_link,
        orderId: orderResponse.cf_order_id,
      };
      
    } catch (error: any) {
      console.error(`❌ Payment order creation failed for booking ${bookingData.bookingId}:`, error);
      
      const userMessage = this.cashfree.getUserFriendlyError(error);
      
      return {
        success: false,
        error: error.message,
        userMessage,
      };
    }
  }

  async verifyPayment(orderId: string): Promise<PaymentVerificationResult> {
    try {
      console.log(`🔍 Verifying payment for order: ${orderId}`);
      
      if (!orderId?.trim()) {
        throw new Error('Order ID is required for payment verification');
      }
      
      const orderStatus = await this.cashfree.getOrderStatus(orderId);
      
      console.log(`📊 Payment verification result for ${orderId}: ${orderStatus.order_status}`);
      
      return {
        success: true,
        status: orderStatus.order_status,
        amount: orderStatus.order_amount,
        paymentId: orderStatus.cf_order_id,
      };
      
    } catch (error: any) {
      console.error(`❌ Payment verification failed for order ${orderId}:`, error);
      
      const userMessage = this.cashfree.getUserFriendlyError(error);
      
      return {
        success: false,
        error: error.message,
        userMessage,
      };
    }
  }

  async processRefund(orderId: string, refundAmount: number, refundNote?: string): Promise<RefundResult> {
    try {
      console.log(`💰 Processing refund for order ${orderId}, amount: ₹${refundAmount}`);
      
      if (!orderId?.trim()) {
        throw new Error('Order ID is required for refund processing');
      }
      
      if (!refundAmount || refundAmount <= 0) {
        throw new Error('Valid refund amount is required');
      }
      
      const refundRequest = {
        refund_amount: refundAmount,
        refund_id: this.cashfree.generateRefundId(orderId),
        refund_note: refundNote || `Refund for order ${orderId}`
      };
      
      const refundResponse = await this.cashfree.createRefund(orderId, refundRequest);
      
      console.log(`✅ Refund processed successfully: ${refundResponse.cf_refund_id}`);
      
      return {
        success: true,
        refundId: refundResponse.cf_refund_id,
        refundStatus: refundResponse.refund_status,
        refundAmount: refundResponse.refund_amount,
      };
      
    } catch (error: any) {
      console.error(`❌ Refund processing failed for order ${orderId}:`, error);
      
      const userMessage = this.cashfree.getUserFriendlyError(error);
      
      return {
        success: false,
        error: error.message,
        userMessage,
      };
    }
  }

  async getRefundStatus(orderId: string, refundId: string): Promise<RefundResult> {
    try {
      console.log(`🔍 Checking refund status for order ${orderId}, refund ${refundId}`);
      
      const refundStatus = await this.cashfree.getRefundStatus(orderId, refundId);
      
      return {
        success: true,
        refundId: refundStatus.cf_refund_id,
        refundStatus: refundStatus.refund_status,
        refundAmount: refundStatus.refund_amount,
      };
      
    } catch (error: any) {
      console.error(`❌ Refund status check failed:`, error);
      
      const userMessage = this.cashfree.getUserFriendlyError(error);
      
      return {
        success: false,
        error: error.message,
        userMessage,
      };
    }
  }

  async calculateAmount(ticketCount: number, ticketPrice: number, couponDiscount: number = 0): Promise<number> {
    return await this.cashfree.calculateAmount(ticketCount, ticketPrice, couponDiscount);
  }

  async healthCheck(): Promise<boolean> {
    try {
      const isHealthy = await this.cashfree.healthCheck();
      console.log(`🏥 Payment service health check: ${isHealthy ? 'healthy' : 'unhealthy'}`);
      return isHealthy;
    } catch (error) {
      console.error('Payment service health check failed:', error);
      return false;
    }
  }

  private validatePaymentOrderData(data: PaymentOrderData): void {
    const errors: string[] = [];
    
    if (!data.bookingId || data.bookingId <= 0) {
      errors.push('Valid booking ID is required');
    }
    
    if (!data.amount || data.amount <= 0) {
      errors.push('Valid payment amount is required');
    }
    
    if (!data.customerName?.trim()) {
      errors.push('Customer name is required');
    }
    
    if (!data.customerEmail?.trim() || !this.isValidEmail(data.customerEmail)) {
      errors.push('Valid customer email is required');
    }
    
    if (!data.customerPhone?.trim() || !this.isValidPhone(data.customerPhone)) {
      errors.push('Valid customer phone number is required');
    }
    
    if (errors.length > 0) {
      throw new Error(`Invalid payment data: ${errors.join(', ')}`);
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private isValidPhone(phone: string): boolean {
    // Accept any 10-digit phone number for flexibility
    const phoneRegex = /^\d{10}$/;
    return phoneRegex.test(phone.replace(/\D/g, ''));
  }

  /**
   * Centralized status mapping logic for consistent payment status handling
   * @param cashfreeStatus - The status from Cashfree API
   * @returns Internal payment status
   */
  mapCashfreeStatusToInternal(cashfreeStatus: string): 'pending' | 'verified' | 'failed' {
    const status = cashfreeStatus?.toUpperCase();
    
    // Definitive success states - only these should be mapped to 'verified'
    if (status === 'PAID' || status === 'SUCCESS') {
      return 'verified';
    }
    
    // Definitive failure states
    if (status === 'FAILED' || status === 'CANCELLED' || status === 'EXPIRED' || 
        status === 'TERMINATED' || status === 'USER_DROPPED') {
      return 'failed';
    }
    
    // In-progress or pending states - keep as pending
    // ACTIVE means payment link is open, NOT that payment is complete
    // CREATED, PENDING mean payment is not yet completed
    if (status === 'ACTIVE' || status === 'CREATED' || status === 'PENDING' || 
        status === 'INITIATED') {
      return 'pending';
    }
    
    // Unknown status - default to pending for safety
    console.warn(`⚠️ Unknown Cashfree status: ${status}. Defaulting to 'pending' for safety.`);
    return 'pending';
  }

  /**
   * Verify payment with proper status mapping
   * @param orderId - Cashfree order ID
   * @returns Payment verification result with mapped status
   */
  async verifyPaymentWithMapping(orderId: string): Promise<PaymentVerificationResult & { mappedStatus: string }> {
    try {
      console.log(`🔍 Verifying payment with status mapping for order: ${orderId}`);
      
      if (!orderId?.trim()) {
        throw new Error('Order ID is required for payment verification');
      }
      
      const orderStatus = await this.cashfree.getOrderStatus(orderId);
      const mappedStatus = this.mapCashfreeStatusToInternal(orderStatus.order_status);
      
      console.log(`📊 Payment verification for ${orderId}: ${orderStatus.order_status} -> ${mappedStatus}`);
      
      return {
        success: true,
        status: orderStatus.order_status,
        mappedStatus,
        amount: orderStatus.order_amount,
        paymentId: orderStatus.cf_order_id,
      };
      
    } catch (error: any) {
      console.error(`❌ Payment verification failed for order ${orderId}:`, error);
      
      const userMessage = this.cashfree.getUserFriendlyError(error);
      
      return {
        success: false,
        mappedStatus: 'pending', // Safe default
        error: error.message,
        userMessage,
      };
    }
  }

  private getWebhookUrl(): string {
    // Priority 1: Use SERVER_URL if explicitly set
    if (process.env.SERVER_URL) {
      const baseUrl = process.env.SERVER_URL.endsWith('/') 
        ? process.env.SERVER_URL.slice(0, -1) 
        : process.env.SERVER_URL;
      return `${baseUrl}/api/webhooks/cashfree`;
    }

    // Priority 2: Use APP_BASE_URL if set (alternative environment variable)
    if (process.env.APP_BASE_URL) {
      const baseUrl = process.env.APP_BASE_URL.endsWith('/') 
        ? process.env.APP_BASE_URL.slice(0, -1) 
        : process.env.APP_BASE_URL;
      return `${baseUrl}/api/webhooks/cashfree`;
    }

    // Priority 3: For development, use HTTPS localhost since Cashfree requires HTTPS
    if (process.env.NODE_ENV === 'development') {
      // Use HTTPS by default for Cashfree compatibility, allow HTTP override for testing
      const forceHttps = process.env.FORCE_HTTPS_LOCALHOST !== 'false'; // Default to true
      const protocol = forceHttps ? 'https' : 'http';
      
      if (protocol === 'https') {
        console.warn('⚠️ Using HTTPS localhost webhook URL for Cashfree compatibility.');
        console.warn('💡 If you need HTTP for local testing, set FORCE_HTTPS_LOCALHOST=false');
        console.warn('💡 For production webhooks, use SERVER_URL or APP_BASE_URL environment variables');
      } else {
        console.warn('⚠️ Using HTTP localhost webhook URL. This will not work with Cashfree in production mode!');
      }
      
      return `${protocol}://localhost:5000/api/webhooks/cashfree`;
    }

    // Priority 4: Fallback to production URL (same as frontend base)
    const fallbackUrl = process.env.FRONTEND_URL || 'https://events.qlora.in';
    console.warn(`⚠️ No SERVER_URL or APP_BASE_URL configured. Using fallback: ${fallbackUrl}`);
    console.warn('💡 For production, set SERVER_URL environment variable to your publicly accessible backend URL');
    
    const baseUrl = fallbackUrl.endsWith('/') 
      ? fallbackUrl.slice(0, -1) 
      : fallbackUrl;
    return `${baseUrl}/api/webhooks/cashfree`;
  }
}