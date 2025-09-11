import { QueryClient, type QueryKey } from "@tanstack/react-query";

const defaultQueryFn = async ({ queryKey }: { queryKey: QueryKey }) => {
  const url = queryKey[0] as string;
  
  // Get admin token for protected routes
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  // Add authorization for admin routes
  if (url.includes('/api/admin/')) {
    // Try multiple possible token sources
    const adminToken = localStorage.getItem('adminToken') || 
                      localStorage.getItem('admin_token') ||
                      localStorage.getItem('token');
    if (adminToken) {
      headers['Authorization'] = `Bearer ${adminToken}`;
    }
  }
  
  const response = await fetch(url, { headers });
  
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

export const apiRequest = async (method: string, url: string, data?: any, headers?: Record<string, string>, timeoutMs: number = 30000) => {
  console.log(`🌐 [API_REQUEST] Starting ${method} request to ${url}`);
  console.log(`🌐 [API_REQUEST] Request data:`, data);
  console.log(`🌐 [API_REQUEST] Timeout set to:`, timeoutMs, 'ms');
  
  // Create AbortController for timeout handling
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.log(`🌐 [API_REQUEST] Request timed out after ${timeoutMs}ms`);
    controller.abort();
  }, timeoutMs);

  try {
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers,
    };
    
    // Add authorization for admin routes
    if (url.includes('/api/admin/')) {
      // Try multiple possible token sources
      const adminToken = localStorage.getItem('adminToken') || 
                        localStorage.getItem('admin_token') ||
                        localStorage.getItem('token');
      if (adminToken) {
        requestHeaders['Authorization'] = `Bearer ${adminToken}`;
      }
    }
    
    console.log(`🌐 [API_REQUEST] Request headers:`, requestHeaders);
    console.log(`🌐 [API_REQUEST] Making fetch request with timeout...`);
    
    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: data ? JSON.stringify(data) : undefined,
      signal: controller.signal, // Add abort signal for timeout
    });

    // Clear timeout since request completed
    clearTimeout(timeoutId);
    
    console.log(`🌐 [API_REQUEST] Fetch completed. Status: ${response.status} ${response.statusText}`);
    console.log(`🌐 [API_REQUEST] Response headers:`, Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      let errorMessage;
      try {
        const errorData = await response.json();
        console.log(`🌐 [API_REQUEST] Error response data:`, errorData);
        errorMessage = errorData.message || `HTTP ${response.status}`;
      } catch (parseError) {
        console.log(`🌐 [API_REQUEST] Failed to parse error response as JSON:`, parseError);
        try {
          errorMessage = await response.text() || `HTTP ${response.status}`;
          console.log(`🌐 [API_REQUEST] Error response text:`, errorMessage);
        } catch (textError) {
          console.log(`🌐 [API_REQUEST] Failed to get error text:`, textError);
          errorMessage = `HTTP ${response.status}`;
        }
      }
      throw new Error(errorMessage);
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const jsonData = await response.json();
      console.log(`🌐 [API_REQUEST] Success response data:`, jsonData);
      return jsonData;
    } else {
      const textData = await response.text();
      console.log(`🌐 [API_REQUEST] Success response text:`, textData);
      return textData;
    }
  } catch (error: any) {
    // Clear timeout in case of error
    clearTimeout(timeoutId);
    
    console.error(`🌐 [API_REQUEST] Request failed:`, error);
    console.error(`🌐 [API_REQUEST] Error type:`, error.constructor.name);
    console.error(`🌐 [API_REQUEST] Error message:`, error.message);
    console.error(`🌐 [API_REQUEST] Error stack:`, error.stack);
    
    // Handle specific error types
    if (error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs / 1000} seconds. Please try again.`);
    }
    
    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      throw new Error('Network connection failed. Please check your internet connection and try again.');
    }
    
    // Re-throw with additional context
    throw new Error(`Network request failed: ${error.message}`);
  }
};