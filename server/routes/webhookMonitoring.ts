import type { Express } from "express";
import { enhancedWebhookService } from "../services/enhancedWebhookService";
import { webhookSafetyService } from "../services/webhookSafetyService";
import { webhookSecurityService } from "../services/webhookSecurityService";
import { authenticate, requirePermission } from "../middleware/authMiddleware";
import { PERMISSIONS } from "@shared/schema";

/**
 * Register webhook monitoring and admin routes
 */
export function registerWebhookMonitoringRoutes(app: Express): void {
  // Webhook monitoring dashboard (admin only)
  app.get('/api/admin/webhook-monitoring', authenticate, requirePermission(PERMISSIONS.VIEW_ANALYTICS), async (req, res) => {
    try {
      console.log('📊 Admin requesting webhook monitoring dashboard');

      // Get comprehensive monitoring data
      const [
        safetyStatus,
        processingStats,
        securityStats,
        suspiciousIPs
      ] = await Promise.all([
        webhookSafetyService.getMonitoringStatus(),
        enhancedWebhookService.getProcessingStats(),
        webhookSecurityService.getSecurityStats(),
        webhookSecurityService.getSuspiciousIPs()
      ]);

      const monitoringData = {
        timestamp: new Date().toISOString(),
        summary: {
          systemHealth: safetyStatus.systemHealth,
          pendingPayments: safetyStatus.pendingPayments,
          processingWebhooks: processingStats.totalProcessing,
          securityViolations: securityStats.recentViolations,
          successRate: processingStats.performanceMetrics?.successRate || 0
        },
        webhookSafety: {
          pendingPayments: safetyStatus.pendingPayments,
          totalAttempts: safetyStatus.totalAttempts,
          oldestPending: safetyStatus.oldestPending,
          recentRecoveries: safetyStatus.recentRecoveries,
          systemHealth: safetyStatus.systemHealth,
          alerts: safetyStatus.alerts,
          performanceMetrics: safetyStatus.performanceMetrics
        },
        webhookProcessing: {
          totalProcessing: processingStats.totalProcessing,
          rateLimitedIPs: processingStats.rateLimitedIPs,
          oldestEntry: processingStats.oldestEntry,
          performanceMetrics: processingStats.performanceMetrics
        },
        security: {
          stats: securityStats,
          suspiciousIPs: suspiciousIPs,
          topViolations: getTopViolations(suspiciousIPs)
        }
      };

      res.json({
        success: true,
        data: monitoringData,
        meta: {
          generatedAt: new Date().toISOString(),
          dataFreshness: 'real-time'
        }
      });

    } catch (error: any) {
      console.error('❌ Error generating webhook monitoring dashboard:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate monitoring dashboard',
        details: error.message
      });
    }
  });

  // Manual webhook recovery trigger (super admin only)
  app.post('/api/admin/webhook-recovery/:orderId', authenticate, requirePermission(PERMISSIONS.SYSTEM_SETTINGS), async (req, res) => {
    try {
      const { orderId } = req.params;
      
      if (!orderId) {
        return res.status(400).json({
          success: false,
          error: 'Order ID is required'
        });
      }

      console.log(`🔧 Admin triggering manual recovery for order: ${orderId}`);

      // Trigger manual check
      const result = await webhookSafetyService.manualCheck(orderId);

      if (result) {
        res.json({
          success: true,
          message: `Manual recovery triggered for order ${orderId}`,
          orderId
        });
      } else {
        res.status(404).json({
          success: false,
          error: `Order ${orderId} not found in monitoring queue`
        });
      }

    } catch (error: any) {
      console.error('❌ Error triggering manual recovery:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to trigger manual recovery',
        details: error.message
      });
    }
  });

  // Webhook processing statistics (admin only)
  app.get('/api/admin/webhook-stats', authenticate, requirePermission(PERMISSIONS.VIEW_ANALYTICS), async (req, res) => {
    try {
      const stats = enhancedWebhookService.getProcessingStats();
      const securityStats = webhookSecurityService.getSecurityStats();
      
      res.json({
        success: true,
        data: {
          processing: stats,
          security: securityStats,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error: any) {
      console.error('❌ Error getting webhook stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get webhook statistics',
        details: error.message
      });
    }
  });

  // Webhook health check endpoint (public, for monitoring systems)
  app.get('/api/webhooks/health', async (req, res) => {
    try {
      const stats = enhancedWebhookService.getProcessingStats();
      const safetyStatus = await webhookSafetyService.getMonitoringStatus();
      
      const health = {
        status: safetyStatus.systemHealth,
        timestamp: new Date().toISOString(),
        metrics: {
          processingWebhooks: stats.totalProcessing,
          pendingPayments: safetyStatus.pendingPayments,
          successRate: stats.performanceMetrics?.successRate || 100
        }
      };

      // Return appropriate HTTP status based on health
      const statusCode = safetyStatus.systemHealth === 'critical' ? 503 :
                        safetyStatus.systemHealth === 'warning' ? 200 : 200;

      res.status(statusCode).json(health);

    } catch (error: any) {
      console.error('❌ Error checking webhook health:', error);
      res.status(503).json({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: 'Health check failed'
      });
    }
  });

  // Security incidents report (super admin only)
  app.get('/api/admin/webhook-security', authenticate, requirePermission(PERMISSIONS.SYSTEM_SETTINGS), async (req, res) => {
    try {
      const suspiciousIPs = webhookSecurityService.getSuspiciousIPs();
      const securityStats = webhookSecurityService.getSecurityStats();
      
      res.json({
        success: true,
        data: {
          overview: securityStats,
          suspiciousIPs,
          recommendations: getSecurityRecommendations(suspiciousIPs, securityStats),
          timestamp: new Date().toISOString()
        }
      });

    } catch (error: any) {
      console.error('❌ Error getting security report:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate security report',
        details: error.message
      });
    }
  });

  console.log('📊 Webhook monitoring routes registered');
}

/**
 * Helper function to get top violations
 */
function getTopViolations(suspiciousIPs: any[]): Array<{ type: string; count: number }> {
  const violationCounts: Record<string, number> = {};
  
  suspiciousIPs.forEach(ip => {
    ip.violations.forEach((violation: string) => {
      violationCounts[violation] = (violationCounts[violation] || 0) + 1;
    });
  });

  return Object.entries(violationCounts)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

/**
 * Helper function to generate security recommendations
 */
function getSecurityRecommendations(suspiciousIPs: any[], securityStats: any): string[] {
  const recommendations: string[] = [];

  if (suspiciousIPs.length > 10) {
    recommendations.push('Consider implementing additional IP filtering due to high number of suspicious IPs');
  }

  if (securityStats.recentViolations > 20) {
    recommendations.push('Recent security violations are elevated, review webhook endpoint security');
  }

  if (suspiciousIPs.some((ip: any) => ip.violations.includes('rapid_requests'))) {
    recommendations.push('Implement additional rate limiting to prevent rapid request attacks');
  }

  if (recommendations.length === 0) {
    recommendations.push('Security status is normal, continue monitoring');
  }

  return recommendations;
}