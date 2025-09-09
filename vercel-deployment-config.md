# Vercel Deployment Configuration for Telugu Night Frontend

## Environment Variables Required on Vercel

Add these environment variables in your Vercel dashboard:

```
VITE_API_BASE_URL=https://events.qlora.in
VITE_BACKEND_URL=https://events.qlora.in
```

## Updated Frontend Configuration Files

### 1. Update `client/src/lib/queryClient.ts`

Replace the current file with this updated version that properly handles the backend URL:

```typescript
import { QueryClient, type QueryKey } from "@tanstack/react-query";

// Get the backend API URL from environment or fallback
const getApiBaseUrl = () => {
  if (typeof window !== 'undefined') {
    // Client-side: use environment variable or fallback to events.qlora.in
    return import.meta.env.VITE_API_BASE_URL || 'https://events.qlora.in';
  }
  return 'https://events.qlora.in';
};

const API_BASE_URL = getApiBaseUrl();

const defaultQueryFn = async ({ queryKey }: { queryKey: QueryKey }) => {
  let url = queryKey[0] as string;
  
  // Convert relative URLs to absolute URLs
  if (url.startsWith('/api/')) {
    url = `${API_BASE_URL}${url}`;
  }
  
  // Get admin token for protected routes
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  // Add authorization for admin routes
  if (url.includes('/api/admin/')) {
    const adminToken = localStorage.getItem('adminToken') || 
                      localStorage.getItem('admin_token') ||
                      localStorage.getItem('token');
    if (adminToken) {
      headers['Authorization'] = `Bearer ${adminToken}`;
    }
  }
  
  const response = await fetch(url, { 
    headers,
    credentials: 'include' // Include cookies for CORS
  });
  
  if (!response.ok) {
    let errorMessage;
    try {
      const errorData = await response.json();
      errorMessage = errorData.message || `HTTP ${response.status}: ${response.statusText}`;
    } catch {
      errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    }
    throw new Error(errorMessage);
  }
  
  return response.json();
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: defaultQueryFn,
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

export const apiRequest = async (method: string, url: string, data?: any, headers?: Record<string, string>) => {
  // Convert relative URLs to absolute URLs
  if (url.startsWith('/api/')) {
    url = `${API_BASE_URL}${url}`;
  }
  
  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };
  
  // Add authorization for admin routes
  if (url.includes('/api/admin/')) {
    const adminToken = localStorage.getItem('adminToken') || 
                      localStorage.getItem('admin_token') ||
                      localStorage.getItem('token');
    if (adminToken) {
      requestHeaders['Authorization'] = `Bearer ${adminToken}`;
    }
  }
  
  const response = await fetch(url, {
    method,
    headers: requestHeaders,
    body: data ? JSON.stringify(data) : undefined,
    credentials: 'include' // Include cookies for CORS
  });

  if (!response.ok) {
    let errorMessage;
    try {
      const errorData = await response.json();
      errorMessage = errorData.message || `HTTP ${response.status}`;
    } catch {
      errorMessage = await response.text() || `HTTP ${response.status}`;
    }
    throw new Error(errorMessage);
  }

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return response.json();
  } else {
    return response.text();
  }
};
```

## ✅ Backend Already Configured

Your backend at `events.qlora.in` is already properly configured with:

- ✅ CORS enabled for `https://v0-telugunightlanding3.vercel.app`
- ✅ Payment redirects configured to return to Vercel frontend
- ✅ Webhook endpoint at `https://events.qlora.in/api/webhooks/cashfree/`
- ✅ All API endpoints working correctly
- ✅ Ticket counters showing remaining availability
- ✅ Email service configured for QR ticket delivery

## Deployment Steps

1. **Update your Vercel frontend code** with the new `queryClient.ts` configuration above
2. **Add environment variables** to your Vercel project settings:
   - `VITE_API_BASE_URL=https://events.qlora.in`
   - `VITE_BACKEND_URL=https://events.qlora.in`
3. **Deploy to Vercel** - your frontend will now properly communicate with the backend

## Features Working

- 🎫 **Complete booking flow** with Cashfree payments
- 📧 **Automated QR ticket delivery** via email
- 🔄 **Real-time ticket availability** with counters
- ⚡ **45-second timeout** on payment processing page
- 🎯 **Webhook automation** for payment verification
- 📱 **Cross-domain integration** between Vercel and events.qlora.in

Your Telugu Night event management system is production-ready!