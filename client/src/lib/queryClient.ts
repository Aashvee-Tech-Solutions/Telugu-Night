import { QueryClient, type QueryKey } from "@tanstack/react-query";

const defaultQueryFn = async ({ queryKey }: { queryKey: QueryKey }) => {
  const url = queryKey[0] as string;
  
  // Get admin token for protected routes
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  // Add authorization for admin routes
  if (url.includes('/api/admin/')) {
    const adminToken = localStorage.getItem('adminToken');
    if (adminToken) {
      headers['Authorization'] = `Bearer ${adminToken}`;
    }
  }
  
  const response = await fetch(url, { headers });
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
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
  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };
  
  // Add authorization for admin routes
  if (url.includes('/api/admin/')) {
    const adminToken = localStorage.getItem('adminToken');
    if (adminToken) {
      requestHeaders['Authorization'] = `Bearer ${adminToken}`;
    }
  }
  
  const response = await fetch(url, {
    method,
    headers: requestHeaders,
    body: data ? JSON.stringify(data) : undefined,
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