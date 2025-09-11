import { CashfreeService, CashfreeAPIError, PaymentRetryError } from './cashfreeService';

export interface PaymentOrderData {
  bookingId: number;
  amount: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
}

export interface PaymentOrderResult {
  success: boolean;
  paymentLink?: string;
  orderId?: string;
  error?: string;
  userMessage?: string;
  diagnostics?: any;
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
  private fallbackEnabled: boolean = true;
  private maxFallbackAttempts: number = 2;
  private serviceHealthCache: Map<string, { healthy: boolean, lastChecked: number }> = new Map();
  private healthCacheTimeout: number = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.cashfree = new CashfreeService();
    
    // Initialize health monitoring
    this.initializeHealthMonitoring();
  }

  private async initializeHealthMonitoring(): Promise<void> {
    // Perform initial health check
    setInterval(() => {
      this.performBackgroundHealthCheck();
    }, 2 * 60 * 1000); // Check every 2 minutes
  }

  private async performBackgroundHealthCheck(): Promise<void> {
    try {
      const isHealthy = await this.cashfree.healthCheck();
      this.serviceHealthCache.set('cashfree', {
        healthy: isHealthy,
        lastChecked: Date.now()
      });
      
      if (!isHealthy) {
        console.warn('🚨 Background health check: Cashfree service is unhealthy');
      }
    } catch (error) {
      console.error('Background health check failed:', error);
    }
  }

  private async isServiceHealthy(service: string): Promise<boolean> {
    const cached = this.serviceHealthCache.get(service);
    
    if (cached && (Date.now() - cached.lastChecked) < this.healthCacheTimeout) {
      return cached.healthy;
    }
    
    // Perform fresh health check
    try {
      const isHealthy = await this.cashfree.healthCheck();
      this.serviceHealthCache.set(service, {
        healthy: isHealthy,
        lastChecked: Date.now()
      });
      return isHealthy;
    } catch (error) {
      console.error('Fresh health check failed:', error);
      return false;
    }
  }

  async createPaymentOrder(bookingData: PaymentOrderData): Promise<PaymentOrderResult> {
    const orderId = this.cashfree.generateOrderId(bookingData.bookingId);
    const operationId = `payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`🚀 [${operationId}] Starting payment order creation for booking ${bookingData.bookingId} with amount ₹${bookingData.amount}`);
    
    try {
      // Validate input data
      this.validatePaymentOrderData(bookingData);
      
      // Check service health before attempting
      const isHealthy = await this.isServiceHealthy('cashfree');
      if (!isHealthy) {
        console.warn(`⚠️ [${operationId}] Cashfree service appears unhealthy, proceeding with caution`);
      }
      
      // Primary attempt with Cashfree
      const result = await this.attemptCashfreePayment(bookingData, orderId, operationId);
      
      if (result.success) {
        console.log(`✅ [${operationId}] Payment order created successfully via primary method`);
        return result;
      }
      
      // If primary method fails and fallback is enabled, try fallback mechanisms
      if (this.fallbackEnabled) {
        console.log(`🔄 [${operationId}] Primary payment failed, attempting fallback mechanisms`);
        return await this.handlePaymentFallback(bookingData, result.error || 'Unknown payment error', operationId);
      }
      
      return result;
      
    } catch (error: any) {
      console.error(`❌ [${operationId}] Payment order creation failed critically:`, error);
      
      return {
        success: false,
        error: error.message,
        userMessage: 'Payment processing is temporarily unavailable. Please try again in a few minutes.',
      };
    }
  }
  
  private async attemptCashfreePayment(bookingData: PaymentOrderData, orderId: string, operationId: string): Promise<PaymentOrderResult> {
    try {
      console.log(`💳 [${operationId}] Attempting Cashfree payment creation`);
      
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
          return_url: `${process.env.FRONTEND_URL || 'https://events.qlora.in'}/payment/success?booking=${bookingData.bookingId}`,
          notify_url: this.getWebhookUrl(),
        },
      });

      return {
        success: true,
        paymentLink: orderResponse.payment_link,
        orderId: orderResponse.cf_order_id,
      };
      
    } catch (error: any) {
      console.error(`❌ [${operationId}] Cashfree payment creation failed:`, {
        error: error.message,
        statusCode: error.statusCode,
        errorCode: error.errorCode,
        bookingId: bookingData.bookingId
      });
      
      const userMessage = this.cashfree.getUserFriendlyError(error);
      
      return {
        success: false,
        error: error.message,
        userMessage,
      };
    }
  }
  
  private async handlePaymentFallback(bookingData: PaymentOrderData, primaryError: string, operationId: string): Promise<PaymentOrderResult> {
    console.log(`🔄 [${operationId}] Initiating payment fallback procedures`);
    
    // Fallback 1: Retry with network diagnostics
    try {
      console.log(`🔍 [${operationId}] Running network diagnostics before retry`);
      const diagnostics = await this.cashfree.performNetworkDiagnostics();
      
      console.log(`📊 [${operationId}] Network diagnostics completed:`, {
        dnsSuccess: diagnostics.diagnostics.dns.success,
        connectivitySuccess: diagnostics.diagnostics.connectivity.success,
        apiAccessSuccess: diagnostics.diagnostics.apiAccess.success,
        averageLatency: diagnostics.diagnostics.latency.average
      });
      
      // If diagnostics show the service should work, try once more
      if (diagnostics.diagnostics.apiAccess.success) {
        console.log(`🔂 [${operationId}] Diagnostics positive, retrying payment creation`);
        const retryResult = await this.attemptCashfreePayment(bookingData, 
          `${this.cashfree.generateOrderId(bookingData.bookingId)}_RETRY`, operationId);
        
        if (retryResult.success) {
          console.log(`✅ [${operationId}] Payment succeeded on diagnostic retry`);
          return retryResult;
        }
      }
      
    } catch (diagError: any) {
      console.error(`❌ [${operationId}] Diagnostic retry failed:`, diagError.message);
    }
    
    // Fallback 2: Graceful degradation - Return structured error for manual processing
    console.log(`🆘 [${operationId}] All payment methods failed, enabling manual processing mode`);
    
    return {
      success: false,
      error: primaryError,
      userMessage: this.generateFallbackUserMessage(operationId),
    };
  }
  
  private generateFallbackUserMessage(operationId: string): string {
    return `We're experiencing temporary payment processing issues. Your booking details have been saved. ` +
           `Please contact our support team with reference ID: ${operationId} to complete your payment manually. ` +
           `We apologize for the inconvenience and will process your booking priority.`;
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
  
  async generateDiagnosticReport(error?: any): Promise<any> {
    const report = {
      timestamp: new Date().toISOString(),
      error: error ? {
        message: error.message,
        statusCode: error.statusCode,
        errorCode: error.errorCode,
        type: error.constructor.name
      } : null,
      networkDiagnostics: null as any,
      serviceHealth: {
        cashfree: await this.isServiceHealthy('cashfree')
      },
      classification: error ? this.classifyPaymentError(error) : 'NO_ERROR'
    };
    
    try {
      report.networkDiagnostics = await this.cashfree.performNetworkDiagnostics();
    } catch (diagError) {
      report.networkDiagnostics = { error: 'Diagnostics failed' };
    }
    
    return report;
  }
  
  private classifyPaymentError(error: any): string {
    if (error instanceof CashfreeAPIError) {
      switch (error.statusCode) {
        case 0:
          return 'NETWORK_CONNECTIVITY_ISSUE';
        case 408:
          return 'TIMEOUT_ISSUE';
        case 429:
          return 'RATE_LIMITING_ISSUE';
        case 500:
        case 502:
        case 503:
        case 504:
          return 'API_SERVER_ISSUE';
        case 400:
        case 401:
        case 403:
          return 'API_AUTHENTICATION_OR_VALIDATION_ISSUE';
        default:
          return 'UNKNOWN_API_ISSUE';
      }
    }
    
    if (error instanceof PaymentRetryError) {
      return 'RETRY_EXHAUSTED_ISSUE';
    }
    
    return 'UNKNOWN_ERROR';
  }
  
  // Enhanced verification methods with better error handling
  async verifyPaymentEnhanced(orderId: string): Promise<PaymentVerificationResult & { diagnosticInfo?: any }> {
    const operationId = `verify_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      console.log(`🔍 [${operationId}] Enhanced payment verification for order: ${orderId}`);
      
      const result = await this.verifyPaymentWithMapping(orderId);
      
      if (!result.success) {
        // Generate diagnostic report for failed verification
        const diagnosticReport = await this.generateDiagnosticReport(new Error(result.error));
        return {
          ...result,
          diagnosticInfo: diagnosticReport
        };
      }
      
      return result;
      
    } catch (error: any) {
      console.error(`❌ [${operationId}] Enhanced payment verification failed:`, error);
      
      const diagnosticReport = await this.generateDiagnosticReport(error);
      
      return {
        success: false,
        error: error.message,
        userMessage: this.cashfree.getUserFriendlyError(error),
        diagnosticInfo: diagnosticReport
      };
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
      const webhookUrl = `${baseUrl}/api/webhooks/cashfree`;
      console.log(`🔗 Using configured SERVER_URL for webhooks: ${webhookUrl}`);
      return webhookUrl;
    }

    // Priority 2: Use APP_BASE_URL if set (alternative environment variable)
    if (process.env.APP_BASE_URL) {
      const baseUrl = process.env.APP_BASE_URL.endsWith('/') 
        ? process.env.APP_BASE_URL.slice(0, -1) 
        : process.env.APP_BASE_URL;
      const webhookUrl = `${baseUrl}/api/webhooks/cashfree`;
      console.log(`🔗 Using configured APP_BASE_URL for webhooks: ${webhookUrl}`);
      return webhookUrl;
    }

    // Priority 3: Use REPLIT_DOMAINS if available (Replit environment)
    if (process.env.REPLIT_DOMAINS) {
      const domain = process.env.REPLIT_DOMAINS.trim();
      const webhookUrl = `https://${domain}/api/webhooks/cashfree`;
      console.log(`🔗 Using Replit domain for webhooks: ${webhookUrl}`);
      return webhookUrl;
    }

    // Priority 4: Use REPLIT_URL if available (alternative Replit env var)
    if (process.env.REPLIT_URL) {
      const baseUrl = process.env.REPLIT_URL.endsWith('/') 
        ? process.env.REPLIT_URL.slice(0, -1) 
        : process.env.REPLIT_URL;
      const webhookUrl = `${baseUrl}/api/webhooks/cashfree`;
      console.log(`🔗 Using Replit URL for webhooks: ${webhookUrl}`);
      return webhookUrl;
    }

    // Priority 5: For development, use localhost with port 5000
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️ Using localhost webhook URL for development. This will not work for production webhooks!');
      console.warn('💡 Set SERVER_URL, APP_BASE_URL, or REPLIT_DOMAINS environment variable for production webhooks');
      return 'http://localhost:5000/api/webhooks/cashfree';
    }

    // Priority 6: Fallback to production URL (same as frontend base)
    const fallbackUrl = process.env.FRONTEND_URL || 'https://events.qlora.in';
    console.warn(`⚠️ CRITICAL: No webhook URL configured! Using fallback: ${fallbackUrl}`);
    console.warn('💡 This may cause webhook delivery failures. Set SERVER_URL, APP_BASE_URL, or REPLIT_DOMAINS environment variable');
    console.warn('📡 Expected webhook URL format: https://your-server-domain.com/api/webhooks/cashfree');
    
    const baseUrl = fallbackUrl.endsWith('/') 
      ? fallbackUrl.slice(0, -1) 
      : fallbackUrl;
    const webhookUrl = `${baseUrl}/api/webhooks/cashfree`;
    console.warn(`🔗 Using fallback webhook URL: ${webhookUrl}`);
    return webhookUrl;
  }
}