import { createHmac, createHash } from 'crypto';

export interface SecurityValidationResult {
  isValid: boolean;
  reason?: string;
  riskLevel: 'low' | 'medium' | 'high';
  details?: {
    signatureValid?: boolean;
    timestampValid?: boolean;
    replayAttack?: boolean;
    ipWhitelisted?: boolean;
    rateLimited?: boolean;
  };
}

export interface WebhookSecurityConfig {
  maxTimestampAge: number; // Maximum age for webhook timestamp (5 minutes default)
  trustedIpRanges: string[]; // CIDR ranges for trusted IPs
  enableReplayProtection: boolean;
  signatureAlgorithm: string;
  replayWindowMs: number; // Time window for replay detection
}

export class WebhookSecurityService {
  private processedSignatures = new Map<string, number>(); // signature -> timestamp
  private suspiciousIPs = new Map<string, {
    count: number;
    firstSeen: number;
    lastSeen: number;
    violations: string[];
  }>();
  
  private readonly config: WebhookSecurityConfig = {
    maxTimestampAge: 5 * 60 * 1000, // 5 minutes
    trustedIpRanges: [
      '52.66.0.0/16',    // Cashfree IP ranges (example)
      '13.234.0.0/16',   // AWS Mumbai (Cashfree region)
    ],
    enableReplayProtection: true,
    signatureAlgorithm: 'sha256',
    replayWindowMs: 10 * 60 * 1000, // 10 minutes
  };

  constructor() {
    console.log('🔒 Webhook Security Service initialized');
    this.startCleanupInterval();
  }

  /**
   * Comprehensive security validation for incoming webhooks
   */
  validateWebhookSecurity(
    signature: string,
    timestamp: string,
    payload: string,
    clientIp: string,
    webhookSecret: string,
    userAgent?: string
  ): SecurityValidationResult {
    const validationDetails = {
      signatureValid: false,
      timestampValid: false,
      replayAttack: false,
      ipWhitelisted: false,
      rateLimited: false,
    };

    // 1. Validate timestamp to prevent replay attacks
    const timestampValidation = this.validateTimestamp(timestamp);
    validationDetails.timestampValid = timestampValidation.isValid;
    
    if (!timestampValidation.isValid) {
      this.logSecurityViolation(clientIp, 'invalid_timestamp', { timestamp, reason: timestampValidation.reason });
      return {
        isValid: false,
        reason: `Invalid timestamp: ${timestampValidation.reason}`,
        riskLevel: 'high',
        details: validationDetails
      };
    }

    // 2. Validate webhook signature
    const signatureValidation = this.validateSignature(signature, timestamp, payload, webhookSecret);
    validationDetails.signatureValid = signatureValidation.isValid;
    
    if (!signatureValidation.isValid) {
      this.logSecurityViolation(clientIp, 'invalid_signature', { signature: signature.substring(0, 20) + '...' });
      return {
        isValid: false,
        reason: 'Invalid webhook signature',
        riskLevel: 'high',
        details: validationDetails
      };
    }

    // 3. Check for replay attacks
    if (this.config.enableReplayProtection) {
      const replayCheck = this.checkReplayAttack(signature, parseInt(timestamp));
      validationDetails.replayAttack = replayCheck.isReplay;
      
      if (replayCheck.isReplay) {
        this.logSecurityViolation(clientIp, 'replay_attack', { signature: signature.substring(0, 20) + '...' });
        return {
          isValid: false,
          reason: 'Potential replay attack detected',
          riskLevel: 'high',
          details: validationDetails
        };
      }
    }

    // 4. Validate IP source (if configured)
    const ipValidation = this.validateIPSource(clientIp);
    validationDetails.ipWhitelisted = ipValidation.isWhitelisted;
    
    // IP validation is informational, not blocking (unless explicitly configured)
    if (!ipValidation.isWhitelisted) {
      console.warn(`⚠️ Webhook from non-whitelisted IP: ${clientIp}`);
    }

    // 5. Check for suspicious patterns
    const suspiciousCheck = this.checkSuspiciousActivity(clientIp, userAgent);
    
    if (suspiciousCheck.isSuspicious) {
      this.logSecurityViolation(clientIp, 'suspicious_activity', suspiciousCheck.details);
      return {
        isValid: false,
        reason: 'Suspicious activity detected',
        riskLevel: suspiciousCheck.riskLevel,
        details: validationDetails
      };
    }

    // Mark signature as processed to prevent replay
    this.recordProcessedSignature(signature, parseInt(timestamp));

    return {
      isValid: true,
      riskLevel: ipValidation.isWhitelisted ? 'low' : 'medium',
      details: validationDetails
    };
  }

  /**
   * Validate webhook timestamp to prevent replay attacks
   */
  private validateTimestamp(timestamp: string): { isValid: boolean; reason?: string } {
    // Check if timestamp is a valid number
    const timestampMs = parseInt(timestamp);
    if (isNaN(timestampMs)) {
      return { isValid: false, reason: 'Timestamp is not a valid number' };
    }

    // Check if timestamp is not too old
    const now = Date.now();
    const age = Math.abs(now - timestampMs * 1000); // Convert to milliseconds
    
    if (age > this.config.maxTimestampAge) {
      return { 
        isValid: false, 
        reason: `Timestamp too old: ${Math.round(age / 1000)}s (max: ${this.config.maxTimestampAge / 1000}s)` 
      };
    }

    // Check if timestamp is not too far in the future (allow 5 minutes)
    const maxFutureAge = 5 * 60 * 1000; // 5 minutes
    if ((timestampMs * 1000) - now > maxFutureAge) {
      return { 
        isValid: false, 
        reason: 'Timestamp too far in the future' 
      };
    }

    return { isValid: true };
  }

  /**
   * Validate webhook signature using HMAC
   */
  private validateSignature(
    signature: string, 
    timestamp: string, 
    payload: string, 
    webhookSecret: string
  ): { isValid: boolean; expectedSignature?: string } {
    try {
      // Create expected signature (Cashfree format: timestamp + payload)
      const signatureData = timestamp + payload;
      const expectedSignature = createHmac(this.config.signatureAlgorithm, webhookSecret)
        .update(signatureData)
        .digest('hex');

      // Compare signatures using timing-safe comparison
      const isValid = this.timingSafeEquals(signature, expectedSignature);
      
      return { 
        isValid, 
        expectedSignature: isValid ? undefined : expectedSignature.substring(0, 20) + '...' 
      };
    } catch (error) {
      console.error('Signature validation error:', error);
      return { isValid: false };
    }
  }

  /**
   * Check for replay attacks by tracking processed signatures
   */
  private checkReplayAttack(signature: string, timestamp: number): { isReplay: boolean; details?: any } {
    const signatureHash = createHash('sha256').update(signature).digest('hex');
    const existingTimestamp = this.processedSignatures.get(signatureHash);
    
    if (existingTimestamp) {
      const timeDiff = Math.abs(timestamp - existingTimestamp);
      return {
        isReplay: true,
        details: {
          originalTimestamp: existingTimestamp,
          currentTimestamp: timestamp,
          timeDifference: timeDiff
        }
      };
    }

    return { isReplay: false };
  }

  /**
   * Validate IP source against whitelist
   */
  private validateIPSource(clientIp: string): { isWhitelisted: boolean; reason?: string } {
    // For development/testing, localhost is always allowed
    if (clientIp === '127.0.0.1' || clientIp === '::1' || clientIp === 'localhost') {
      return { isWhitelisted: true };
    }

    // Check against configured IP ranges
    // For production, implement proper CIDR matching
    // This is a simplified version
    for (const range of this.config.trustedIpRanges) {
      if (this.isIPInRange(clientIp, range)) {
        return { isWhitelisted: true };
      }
    }

    return { 
      isWhitelisted: false, 
      reason: `IP ${clientIp} not in whitelist` 
    };
  }

  /**
   * Check for suspicious activity patterns
   */
  private checkSuspiciousActivity(
    clientIp: string, 
    userAgent?: string
  ): { isSuspicious: boolean; riskLevel: 'low' | 'medium' | 'high'; details?: any } {
    const suspicious = this.suspiciousIPs.get(clientIp);
    const now = Date.now();

    if (!suspicious) {
      // First time seeing this IP
      this.suspiciousIPs.set(clientIp, {
        count: 1,
        firstSeen: now,
        lastSeen: now,
        violations: []
      });
      return { isSuspicious: false, riskLevel: 'low' };
    }

    // Update tracking
    suspicious.count++;
    suspicious.lastSeen = now;

    // Check for rapid requests (potential DoS)
    const timeWindow = 60 * 1000; // 1 minute
    const maxRequestsPerWindow = 50;
    
    if (suspicious.count > maxRequestsPerWindow && (now - suspicious.firstSeen) < timeWindow) {
      suspicious.violations.push('rapid_requests');
      return {
        isSuspicious: true,
        riskLevel: 'high',
        details: {
          reason: 'Too many requests in short time',
          count: suspicious.count,
          timeWindow: (now - suspicious.firstSeen) / 1000
        }
      };
    }

    // Check for suspicious user agent patterns
    if (userAgent) {
      const suspiciousPatterns = [
        /bot/i,
        /crawler/i,
        /scanner/i,
        /automated/i,
        /script/i
      ];

      for (const pattern of suspiciousPatterns) {
        if (pattern.test(userAgent)) {
          suspicious.violations.push('suspicious_user_agent');
          return {
            isSuspicious: true,
            riskLevel: 'medium',
            details: {
              reason: 'Suspicious user agent pattern',
              userAgent: userAgent.substring(0, 100)
            }
          };
        }
      }
    }

    return { isSuspicious: false, riskLevel: 'low' };
  }

  /**
   * Record processed signature to prevent replay
   */
  private recordProcessedSignature(signature: string, timestamp: number): void {
    const signatureHash = createHash('sha256').update(signature).digest('hex');
    this.processedSignatures.set(signatureHash, timestamp);
  }

  /**
   * Log security violations for monitoring and analysis
   */
  private logSecurityViolation(
    clientIp: string, 
    violationType: string, 
    details: any
  ): void {
    const violation = {
      timestamp: new Date().toISOString(),
      clientIp,
      violationType,
      details
    };

    console.warn(`🚨 Security violation detected:`, violation);

    // In production, you would also:
    // - Send to security monitoring system
    // - Update IP reputation database
    // - Trigger automated responses
    // - Alert security team if threshold exceeded
  }

  /**
   * Timing-safe string comparison to prevent timing attacks
   */
  private timingSafeEquals(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    
    return result === 0;
  }

  /**
   * Simple IP range check (for production, use a proper CIDR library)
   */
  private isIPInRange(ip: string, range: string): boolean {
    // Simplified version - in production, use a proper CIDR matching library
    // For now, just check if it starts with the network portion
    if (range.includes('/')) {
      const [network] = range.split('/');
      return ip.startsWith(network.split('.').slice(0, 2).join('.'));
    }
    return ip === range;
  }

  /**
   * Clean up old entries to prevent memory leaks
   */
  private startCleanupInterval(): void {
    setInterval(() => {
      const now = Date.now();
      const maxAge = this.config.replayWindowMs;

      // Clean up old processed signatures
      const signaturesToDelete: string[] = [];
      this.processedSignatures.forEach((timestamp, signature) => {
        if (now - (timestamp * 1000) > maxAge) {
          signaturesToDelete.push(signature);
        }
      });

      signaturesToDelete.forEach(signature => {
        this.processedSignatures.delete(signature);
      });

      // Clean up old suspicious IP tracking
      const ipsToClean: string[] = [];
      this.suspiciousIPs.forEach((data, ip) => {
        // Keep tracking for 24 hours
        if (now - data.lastSeen > 24 * 60 * 60 * 1000) {
          ipsToClean.push(ip);
        }
      });

      ipsToClean.forEach(ip => {
        this.suspiciousIPs.delete(ip);
      });

      if (signaturesToDelete.length > 0 || ipsToClean.length > 0) {
        console.log(`🧹 Security cleanup: ${signaturesToDelete.length} signatures, ${ipsToClean.length} IP records`);
      }

    }, 300000); // Clean up every 5 minutes
  }

  /**
   * Get security statistics for monitoring
   */
  getSecurityStats(): {
    processedSignatures: number;
    suspiciousIPs: number;
    recentViolations: number;
  } {
    const now = Date.now();
    const recentWindow = 60 * 60 * 1000; // 1 hour

    let recentViolations = 0;
    this.suspiciousIPs.forEach(data => {
      if (now - data.lastSeen < recentWindow && data.violations.length > 0) {
        recentViolations += data.violations.length;
      }
    });

    return {
      processedSignatures: this.processedSignatures.size,
      suspiciousIPs: this.suspiciousIPs.size,
      recentViolations
    };
  }

  /**
   * Get list of currently blocked/suspicious IPs
   */
  getSuspiciousIPs(): Array<{
    ip: string;
    violations: string[];
    firstSeen: Date;
    lastSeen: Date;
    requestCount: number;
  }> {
    const result: Array<any> = [];
    
    this.suspiciousIPs.forEach((data, ip) => {
      result.push({
        ip,
        violations: data.violations,
        firstSeen: new Date(data.firstSeen),
        lastSeen: new Date(data.lastSeen),
        requestCount: data.count
      });
    });

    return result.sort((a, b) => b.lastSeen.getTime() - a.lastSeen.getTime());
  }
}

// Export singleton instance
export const webhookSecurityService = new WebhookSecurityService();