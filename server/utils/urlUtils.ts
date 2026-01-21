import type { Request } from 'express';

/**
 * Constructs the correct public base URL from the request
 * Handles port 5000 in development and proper protocol detection
 * @param req - Express request object
 * @returns Complete base URL with protocol, host, and port
 */
export function getPublicBaseUrl(req: Request): string {
  // Get protocol from request
  const protocol = req.headers['x-forwarded-proto'] || 
                   (req.connection as any)?.encrypted ? 'https' : 
                   req.protocol || 'http';
  
  // Get host from request headers - handle array case
  const hostHeader = req.headers['x-forwarded-host'] || 
                     req.headers.host || 
                     'localhost';
  
  // Convert to string if it's an array (Express headers can be string | string[])
  const host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader;

  // In development, ensure we use port 5000 if not already specified
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV !== 'production') {
    // If host already has a port, use it as-is
    if (host.includes(':')) {
      return `${protocol}://${host}`;
    }
    // If localhost without port, add 5000
    if (host === 'localhost' || host.startsWith('127.0.0.1')) {
      return `${protocol}://${host}:5000`;
    }
  }

  // For production or when host already includes port
  return `${protocol}://${host}`;
}

/**
 * Get the public base URL with environment variable fallbacks
 * @param req - Express request object (optional)
 * @returns Complete base URL
 */
export function getPublicBaseUrlWithFallback(req?: Request): string {
  // Priority 1: Use APP_BASE_URL for production domain (most important for payment redirects)
  if (process.env.APP_BASE_URL) {
    const baseUrl = process.env.APP_BASE_URL.endsWith('/') 
      ? process.env.APP_BASE_URL.slice(0, -1)
      : process.env.APP_BASE_URL;
    console.log(`🌐 Using APP_BASE_URL for return URL: ${baseUrl}`);
    return baseUrl;
  }

  // Priority 2: Use FRONTEND_URL if set
  if (process.env.FRONTEND_URL) {
    return process.env.FRONTEND_URL.endsWith('/') 
      ? process.env.FRONTEND_URL.slice(0, -1)
      : process.env.FRONTEND_URL;
  }

  // Priority 3: If request is available, use it to construct URL
  if (req) {
    return getPublicBaseUrl(req);
  }

  // Priority 4: Use REPLIT_DEV_DOMAIN as fallback for development
  if (process.env.REPLIT_DEV_DOMAIN) {
    const baseUrl = `https://${process.env.REPLIT_DEV_DOMAIN}`;
    console.log(`🌐 Using Replit dev domain for return URL: ${baseUrl}`);
    return baseUrl;
  }

  // Priority 4: Development fallback - use HTTPS for payment providers that require it
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV !== 'production') {
    // Default to HTTPS for compatibility with payment providers, allow HTTP override
    const forceHttps = process.env.FORCE_HTTPS_LOCALHOST !== 'false'; // Default to true
    const protocol = forceHttps ? 'https' : 'http';
    return `${protocol}://localhost:5000`;
  }

  // Priority 5: Production fallback
  return 'https://events.qlora.in';
}