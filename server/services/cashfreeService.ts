import { createHash, createHmac } from 'crypto';

// Custom error types for better error handling
export class CashfreeAPIError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public errorCode?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'CashfreeAPIError';
  }
}

export class PaymentRetryError extends Error {
  constructor(message: string, public attempts: number) {
    super(message);
    this.name = 'PaymentRetryError';
  }
}

export interface CashfreePaymentRequest {
  order_amount: number;
  order_currency: string;
  order_id: string;
  customer_details: {
    customer_id: string;
    customer_name: string;
    customer_email: string;
    customer_phone: string;
  };
  order_meta?: {
    return_url?: string;
    notify_url?: string;
  };
}

export interface CashfreeOrderResponse {
  cf_order_id: string;
  order_id: string;
  payment_link: string;
  order_status: string;
  order_amount: number;
  order_currency: string;
}

export interface CashfreeRefundRequest {
  refund_amount: number;
  refund_id: string;
  refund_note?: string;
}

export interface CashfreeRefundResponse {
  cf_payment_id: string;
  cf_refund_id: string;
  refund_id: string;
  order_id: string;
  refund_amount: number;
  refund_status: string;
  refund_note?: string;
}

export class CashfreeService {
  private appId: string;
  private secretKey: string;
  private webhookSecret: string;
  private baseUrl: string;
  private maxRetries: number = 3;
  private retryDelay: number = 1000;
  private timeout: number = 30000;

  constructor() {
    this.appId = process.env.CASHFREE_APP_ID!;
    this.secretKey = process.env.CASHFREE_SECRET_KEY!;
    this.webhookSecret = process.env.CASHFREE_WEBHOOK_SECRET || 'ng8v08g8a5ebwi9cuv8c';
    
    if (!this.appId || !this.secretKey) {
      throw new Error('Cashfree credentials not found in environment variables');
    }

    // Use production environment
    this.baseUrl = 'https://api.cashfree.com/pg';
  }

  private generateSignature(data: string): string {
    return createHmac('sha256', this.secretKey).update(data).digest('base64');
  }

  private async makeRequest(
    url: string,
    method: 'GET' | 'POST',
    headers: Record<string, string>,
    body?: string
  ): Promise<any> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        let errorDetails;
        try {
          errorDetails = JSON.parse(errorText);
        } catch {
          errorDetails = { message: errorText };
        }

        throw new CashfreeAPIError(
          errorDetails.message || `API request failed with status ${response.status}`,
          response.status,
          errorDetails.error_code,
          errorDetails
        );
      }

      return await response.json();
    } catch (error: any) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new CashfreeAPIError('Request timeout', 408);
      }
      
      if (error instanceof CashfreeAPIError) {
        throw error;
      }
      
      throw new CashfreeAPIError(
        'Network error occurred',
        0,
        'NETWORK_ERROR',
        { originalError: error.message }
      );
    }
  }

  private async retryRequest<T>(
    operation: () => Promise<T>,
    retryableErrors: number[] = [429, 500, 502, 503, 504]
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;
        
        if (error instanceof CashfreeAPIError && retryableErrors.includes(error.statusCode)) {
          if (attempt < this.maxRetries) {
            console.log(`Retrying request (attempt ${attempt}/${this.maxRetries}) after error:`, error.message);
            await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));
            continue;
          }
        }
        
        break;
      }
    }
    
    throw new PaymentRetryError(
      `Failed after ${this.maxRetries} attempts: ${lastError.message}`,
      this.maxRetries
    );
  }

  async createOrder(paymentData: CashfreePaymentRequest): Promise<CashfreeOrderResponse> {
    return this.retryRequest(async () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      
      // Create signature string
      const signatureData = `POST\n/pg/orders\n${timestamp}`;
      const signature = this.generateSignature(signatureData);

      const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'x-api-version': '2023-08-01',
        'x-client-id': this.appId,
        'x-client-secret': this.secretKey,
        'x-idempotency-key': paymentData.order_id,
      };

      console.log(`Creating Cashfree order for booking ${paymentData.order_id} with amount ₹${paymentData.order_amount}`);
      
      const result = await this.makeRequest(
        `${this.baseUrl}/orders`,
        'POST',
        headers,
        JSON.stringify(paymentData)
      );

      console.log(`✅ Cashfree order created successfully: ${result.cf_order_id}`);
      
      // Return payment session ID for SDK integration
      return {
        ...result,
        payment_link: result.payment_session_id // Use session ID for SDK
      };
    });
  }

  async getOrderStatus(orderId: string): Promise<any> {
    return this.retryRequest(async () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const signatureData = `GET\n/pg/orders/${orderId}\n${timestamp}`;
      const signature = this.generateSignature(signatureData);

      const headers = {
        'Accept': 'application/json',
        'x-api-version': '2023-08-01',
        'x-client-id': this.appId,
        'x-client-secret': this.secretKey,
      };

      console.log(`Checking order status for: ${orderId}`);
      
      const result = await this.makeRequest(
        `${this.baseUrl}/orders/${orderId}`,
        'GET',
        headers
      );

      console.log(`📊 Order status for ${orderId}: ${result.order_status}`);
      return result;
    });
  }

  async verifyWebhook(signature: string, timestamp: string, rawBody: string): Promise<boolean> {
    try {
      if (!signature || !timestamp || !rawBody) {
        console.error('Missing webhook verification parameters');
        return false;
      }

      const signatureData = timestamp + rawBody;
      const expectedSignature = createHmac('sha256', this.webhookSecret).update(signatureData).digest('base64');
      
      const isValid = signature === expectedSignature;
      
      if (!isValid) {
        console.error('Webhook signature verification failed', {
          receivedSignature: signature,
          expectedSignature,
          timestamp,
          bodyLength: rawBody.length
        });
      } else {
        console.log('✅ Webhook signature verified successfully');
      }
      
      return isValid;
    } catch (error) {
      console.error('Error verifying webhook:', error);
      return false;
    }
  }

  generateOrderId(bookingId: number): string {
    const timestamp = Date.now();
    return `ORDER_${bookingId}_${timestamp}`;
  }

  generateRefundId(orderId: string): string {
    const timestamp = Date.now();
    return `REFUND_${orderId}_${timestamp}`;
  }

  async createRefund(orderId: string, refundData: CashfreeRefundRequest): Promise<CashfreeRefundResponse> {
    return this.retryRequest(async () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const signatureData = `POST\n/pg/orders/${orderId}/refunds\n${timestamp}`;
      const signature = this.generateSignature(signatureData);

      const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'x-api-version': '2023-08-01',
        'x-client-id': this.appId,
        'x-client-secret': this.secretKey,
        'x-idempotency-key': refundData.refund_id,
      };

      console.log(`Creating refund for order ${orderId} with amount ₹${refundData.refund_amount}`);
      
      const result = await this.makeRequest(
        `${this.baseUrl}/orders/${orderId}/refunds`,
        'POST',
        headers,
        JSON.stringify(refundData)
      );

      console.log(`✅ Refund created successfully: ${result.cf_refund_id}`);
      return result;
    });
  }

  async getRefundStatus(orderId: string, refundId: string): Promise<any> {
    return this.retryRequest(async () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const signatureData = `GET\n/pg/orders/${orderId}/refunds/${refundId}\n${timestamp}`;
      const signature = this.generateSignature(signatureData);

      const headers = {
        'Accept': 'application/json',
        'x-api-version': '2023-08-01',
        'x-client-id': this.appId,
        'x-client-secret': this.secretKey,
      };

      console.log(`Checking refund status for order ${orderId}, refund ${refundId}`);
      
      const result = await this.makeRequest(
        `${this.baseUrl}/orders/${orderId}/refunds/${refundId}`,
        'GET',
        headers
      );

      console.log(`📊 Refund status for ${refundId}: ${result.refund_status}`);
      return result;
    });
  }

  // Helper method to get user-friendly error messages
  getUserFriendlyError(error: any): string {
    if (error instanceof CashfreeAPIError) {
      switch (error.statusCode) {
        case 400:
          return 'Invalid payment information provided. Please check your details and try again.';
        case 401:
          return 'Payment service authentication failed. Please contact support.';
        case 403:
          return 'Payment not authorized. Please contact support.';
        case 404:
          return 'Payment order not found. Please check your order details.';
        case 408:
          return 'Payment request timed out. Please try again.';
        case 429:
          return 'Too many payment requests. Please wait a moment and try again.';
        case 500:
        case 502:
        case 503:
        case 504:
          return 'Payment service is temporarily unavailable. Please try again in a few minutes.';
        default:
          return error.details?.message || 'Payment processing failed. Please try again or contact support.';
      }
    }
    
    if (error instanceof PaymentRetryError) {
      return 'Payment failed after multiple attempts. Please check your internet connection and try again.';
    }
    
    return 'An unexpected error occurred during payment processing. Please contact support.';
  }

  calculateAmount(ticketCount: number, ticketPrice: number, couponDiscount: number = 0): number {
    let totalAmount = ticketCount * ticketPrice;

    // Apply coupon discount
    if (couponDiscount > 0) {
      totalAmount = totalAmount * (1 - couponDiscount / 100);
    }

    return Math.round(totalAmount * 100) / 100; // Round to 2 decimal places
  }

  // Health check method to verify service connectivity
  async healthCheck(): Promise<boolean> {
    try {
      // Test connectivity with a minimal API call
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const signatureData = `GET\n/pg/orders\n${timestamp}`;
      const signature = this.generateSignature(signatureData);

      const headers = {
        'Accept': 'application/json',
        'x-api-version': '2023-08-01',
        'x-client-id': this.appId,
        'x-client-secret': this.secretKey,
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout for health check

      const response = await fetch(`${this.baseUrl}/orders?limit=1`, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      
      // 200 or 400 (bad request) both indicate the service is responsive
      return response.status === 200 || response.status === 400;
    } catch (error) {
      console.error('Cashfree health check failed:', error);
      return false;
    }
  }
}