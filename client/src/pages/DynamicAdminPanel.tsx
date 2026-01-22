import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { PermissionGuard, RoleGuard } from "@/components/PermissionGuard";
import { apiRequest } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { 
  Users, 
  CreditCard, 
  Ticket, 
  Settings, 
  Shield, 
  Eye,
  CheckCircle,
  XCircle,
  Send,
  LogOut,
  Activity,
  Zap,
  Trash2,
  X,
  Download,
  Star,
  Clock,
  Tag,
  Plus,
  Edit,
  Percent
} from "lucide-react";
import { TicketGenerationPanel } from "@/components/TicketGenerationPanel";
import Scanner from "@/components/Scanner";
import TeluguNightEventManagement from "@/components/TeluguNightEventManagement";
import PromoterManagement from "@/components/PromoterManagement";
import CouponManagement from "@/components/CouponManagement";

interface UserData {
  id: number;
  username: string;
  role: string;
  permissions: string[];
  isActive: boolean;
  lastLogin: string | null;
}

interface Booking {
  id: number;
  name: string;
  email: string;
  phone: string;
  gender?: string;
  ticketCount: number;
  ticketType?: string;
  totalAmount: string;
  paymentStatus: string;
  paymentScreenshot?: string;
  isScanned: boolean;
  guestCodes?: string[];
  passIds?: string[];
  guests?: string[];
  guestGenders?: string[];
  scannedGuests?: string[];
  couponCode?: string;
  couponDiscount?: number;
  promoCode?: string;
  createdAt: string;
}

interface Analytics {
  totalBookings: number;
  totalTicketsSold: number;
  totalRevenue: number;
  verifiedBookings: number;
  pendingBookings: number;
  scannedTickets: number;
  genderBreakdown: {
    male: number;
    female: number;
    other: number;
  };
  ticketTypes: {
    earlyBird: number;
    phase1: number;
  };
  earlyBirdLimit: number;
  recentBookings: Booking[];
}

interface Coupon {
  id: number;
  code: string;
  discount: number;
  isActive: boolean;
  usageLimit: number | null;
  usageCount: number;
  createdAt: string;
}

interface DynamicAdminPanelProps {
  user: UserData;
  onLogout: () => void;
}

export default function DynamicAdminPanel({ user: propUser, onLogout }: DynamicAdminPanelProps) {
  const [user, setUser] = useState<UserData | null>(propUser);
  const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Load user data from localStorage or fetch from API
  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    const userData = localStorage.getItem('adminUser');
    
    if (token && userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  // Fetch analytics data
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['/api/admin/analytics'],
    queryFn: async () => {
      const token = localStorage.getItem('adminToken');
      const response = await fetch('/api/admin/analytics', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch analytics');
      }
      return response.json();
    },
    enabled: user?.permissions.includes('view_analytics') || false,
    retry: false,
  });

  // Fetch bookings data
  const { data: bookings, isLoading: bookingsLoading } = useQuery({
    queryKey: ['/api/admin/bookings'],
    queryFn: async () => {
      const token = localStorage.getItem('adminToken');
      const response = await fetch('/api/admin/bookings', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch bookings');
      }
      return response.json();
    },
    enabled: user?.permissions.includes('view_bookings') || false,
    retry: false,
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: async () => {
      const token = localStorage.getItem('adminToken');
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
      }
    },
    onSuccess: () => {
      localStorage.removeItem('adminLoggedIn');
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminUser');
      window.location.reload();
    },
  });

  // Removed old payment verification mutation - no longer needed as payments are handled automatically

  // Fetch ticket configuration
  const { data: ticketConfig, isLoading: configLoading } = useQuery({
    queryKey: ['/api/admin/ticket-config'],
    queryFn: async () => {
      const token = localStorage.getItem('adminToken');
      const response = await fetch('/api/admin/ticket-config', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch ticket config');
      return response.json();
    },
  });



  // Update ticket configuration mutation
  const updateTicketConfigMutation = useMutation({
    mutationFn: async (config: any) => {
      const token = localStorage.getItem('adminToken');
      const response = await fetch('/api/admin/ticket-config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ config })
      });
      if (!response.ok) {
        throw new Error('Failed to update ticket configuration');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/ticket-config'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/analytics'] });
      toast({ title: 'Success', description: 'Ticket configuration updated successfully' });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to update ticket configuration',
        variant: 'destructive' 
      });
    },
  });

  // Update early bird limit mutation
  const updateEarlyBirdLimitMutation = useMutation({
    mutationFn: async (limit: number) => {
      const token = localStorage.getItem('adminToken');
      const response = await fetch('/api/admin/early-bird-limit', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ limit })
      });
      if (!response.ok) {
        throw new Error('Failed to update early bird limit');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/analytics'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/ticket-config'] });
      toast({ title: 'Success', description: 'Early bird limit updated successfully' });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to update early bird limit',
        variant: 'destructive' 
      });
    },
  });

  // Send ticket mutation
  const sendTicketMutation = useMutation({
    mutationFn: async (bookingId: number) => {
      return apiRequest('POST', `/api/admin/bookings/${bookingId}/send-ticket`);
    },
    onSuccess: (data: any) => {
      toast({ 
        title: '🎫 Tickets Sent Successfully!', 
        description: data.paymentAutoVerified ? 'Payment verified and tickets sent' : 'Tickets sent to customer email'
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/bookings'] });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to send tickets', 
        description: error.message || 'Please check booking details and try again',
        variant: 'destructive' 
      });
    },
  });

  // Sync to Google Sheets mutation
  const syncSheetsMutation = useMutation({
    mutationFn: async () => {
      const token = localStorage.getItem('adminToken');
      const response = await fetch('/api/admin/sync-sheets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) {
        throw new Error('Failed to sync with Google Sheets');
      }
      return await response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Sync Successful",
        description: `Synced ${data.syncedCount} bookings to Google Sheets`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Sync Failed", 
        description: error.message || "Failed to sync with Google Sheets",
        variant: "destructive",
      });
    }
  });

  // Reset Google Sheets mutation
  const resetSheetsMutation = useMutation({
    mutationFn: async () => {
      const token = localStorage.getItem('adminToken');
      const response = await fetch('/api/admin/reset-sheets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) {
        throw new Error('Failed to reset Google Sheets');
      }
      return await response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Reset Successful",
        description: `Google Sheet reset and ${data.syncedCount} bookings synced fresh`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Reset Failed", 
        description: error.message || "Failed to reset Google Sheets",
        variant: "destructive",
      });
    }
  });

  // Delete booking mutation
  const deleteBookingMutation = useMutation({
    mutationFn: async (bookingId: number) => {
      const token = localStorage.getItem('adminToken');
      return await apiRequest('DELETE', `/api/admin/bookings/${bookingId}`, {}, {
        Authorization: `Bearer ${token}`
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/bookings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/analytics'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/ticket-config'] });
      toast({ 
        title: 'Booking Deleted', 
        description: data.message || 'Booking deleted successfully and removed from Google Sheets' 
      });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Delete Failed', 
        description: error.message || 'Failed to delete booking',
        variant: 'destructive' 
      });
    },
  });

  // Check payment status from Cashfree - compares local vs gateway status
  const checkCashfreeStatusMutation = useMutation({
    mutationFn: async (bookingId: number) => {
      const token = localStorage.getItem('adminToken');
      return await apiRequest('POST', `/api/admin/check-cashfree-status`, { bookingId }, {
        Authorization: `Bearer ${token}`
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/bookings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/analytics'] });
      
      // Show appropriate toast based on result
      if (data.statusUpdated) {
        toast({ 
          title: '✅ Status Updated from Cashfree', 
          description: data.message || 'Status synchronized successfully'
        });
      } else {
        toast({ 
          title: '🔍 Status Check Complete', 
          description: data.message || 'Status compared with Cashfree successfully'
        });
      }
    },
    onError: (error: any) => {
      toast({ 
        title: 'Cashfree Status Check Failed', 
        description: error.message || 'Failed to check status with Cashfree',
        variant: 'destructive' 
      });
    },
  });

  // Manual payment verification - BYPASSES gateway entirely
  const manualVerifyMutation = useMutation({
    mutationFn: async (bookingId: number) => {
      const token = localStorage.getItem('adminToken');
      return await apiRequest('POST', `/api/admin/manual-verify-payment`, { bookingId }, {
        Authorization: `Bearer ${token}`
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/bookings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/analytics'] });
      toast({ 
        title: '⚠️ Manual Verification Complete', 
        description: data.message || 'Payment manually verified and tickets sent (bypassed gateway)'
      });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Manual Verification Failed', 
        description: error.message || 'Failed to manually verify payment',
        variant: 'destructive' 
      });
    },
  });

  // Send rejection email mutation
  const sendRejectionEmailMutation = useMutation({
    mutationFn: async (bookingId: number) => {
      const token = localStorage.getItem('adminToken');
      return await apiRequest('POST', `/api/admin/send-rejection-email`, { bookingId }, {
        Authorization: `Bearer ${token}`
      });
    },
    onSuccess: (data: any) => {
      toast({ 
        title: '📧 Rejection Email Sent', 
        description: data.message || 'Payment rejection email sent to customer'
      });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Email Failed', 
        description: error.message || 'Failed to send rejection email',
        variant: 'destructive' 
      });
    },
  });

  // Removed manual payment verification - payments are now automatically processed by payment gateway

  // Removed ticket generation - tickets are automatically generated by payment gateway webhook

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'super_admin': return 'bg-red-500';
      case 'admin': return 'bg-blue-500';
      case 'organizer': return 'bg-green-500';
      case 'scanner': return 'bg-yellow-500';
      case 'viewer': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'verified': return 'bg-green-500';
      case 'pending': return 'bg-yellow-500';
      case 'rejected': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Event Management - Admin Panel</h1>
          <p className="text-muted-foreground">
            Welcome back, {user.username}!
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Badge className={getRoleColor(user.role)}>
            <Shield className="w-3 h-3 mr-1" />
            {user.role.replace('_', ' ').toUpperCase()}
          </Badge>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>

      {/* Permission-based Tabs */}
      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="dashboard">
            <Activity className="w-4 h-4 mr-2" />
            Dashboard
          </TabsTrigger>
          
          <PermissionGuard 
            permissions={['view_bookings']} 
            userPermissions={user.permissions}
            fallback={<div />}
          >
            <TabsTrigger value="bookings">
              <Ticket className="w-4 h-4 mr-2" />
              Bookings
            </TabsTrigger>
          </PermissionGuard>

          <PermissionGuard 
            permissions={['manage_coupons']} 
            userPermissions={user.permissions}
            fallback={<div />}
          >
            <TabsTrigger value="coupons">
              <Tag className="w-4 h-4 mr-2" />
              Coupons
            </TabsTrigger>
          </PermissionGuard>

          <PermissionGuard 
            permissions={['scanner_access']} 
            userPermissions={user.permissions}
            fallback={<div />}
          >
            <TabsTrigger value="scanner">
              <Eye className="w-4 h-4 mr-2" />
              Scanner
            </TabsTrigger>
          </PermissionGuard>

          <PermissionGuard 
            permissions={['verify_payments']} 
            userPermissions={user.permissions}
            fallback={<div />}
          >
            <TabsTrigger value="smart-tickets">
              <Zap className="w-4 h-4 mr-2" />
              Smart Tickets
            </TabsTrigger>
          </PermissionGuard>

          <PermissionGuard 
            permissions={['create_events', 'manage_events']} 
            userPermissions={user.permissions}
            fallback={<div />}
          >
            <TabsTrigger value="events">
              <Star className="w-4 h-4 mr-2" />
              Telugu Night 3.0
            </TabsTrigger>
          </PermissionGuard>

          <PermissionGuard 
            permissions={['manage_users', 'view_promoters']} 
            userPermissions={user.permissions}
            requireAll={false}
            fallback={<div />}
          >
            <TabsTrigger value="promoters">
              <Users className="w-4 h-4 mr-2" />
              Promoters
            </TabsTrigger>
          </PermissionGuard>

          <PermissionGuard 
            permissions={['manage_users', 'system_settings']} 
            userPermissions={user.permissions}
            fallback={<div />}
          >
            <TabsTrigger value="settings">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </TabsTrigger>
          </PermissionGuard>
        </TabsList>

        {/* Analytics Dashboard Tab */}
        <TabsContent value="dashboard" className="space-y-6">
          {analyticsLoading ? (
            <div className="flex justify-center p-8">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          ) : analytics && (
            <>
              {/* Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Bookings</CardTitle>
                    <Ticket className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{analytics.totalBookings}</div>
                    <p className="text-xs text-muted-foreground">
                      {analytics.verifiedBookings} verified • {analytics.pendingBookings} pending
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Tickets Sold</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{analytics.totalTicketsSold}</div>
                    <p className="text-xs text-muted-foreground">
                      Early Bird: {analytics.ticketTypes.earlyBird} • Phase 1: {analytics.ticketTypes.phase1}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Revenue</CardTitle>
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">₹{analytics.totalRevenue.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">
                      Total collection
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Attendance</CardTitle>
                    <Activity className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{analytics.scannedTickets}</div>
                    <p className="text-xs text-muted-foreground">
                      {analytics.scannedTickets} of {analytics.totalTicketsSold} attended
                    </p>
                    <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-green-500 h-2 rounded-full transition-all" 
                        style={{ 
                          width: `${analytics.totalTicketsSold > 0 ? (analytics.scannedTickets / analytics.totalTicketsSold) * 100 : 0}%` 
                        }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {analytics.totalTicketsSold > 0 ? ((analytics.scannedTickets / analytics.totalTicketsSold) * 100).toFixed(1) : 0}% attendance rate
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Enhanced Ticket Management System */}
              <PermissionGuard 
                permissions={['system_settings']} 
                userPermissions={user.permissions}
              >
                <Card>
                  <CardHeader>
                    <CardTitle>Ticket Management System</CardTitle>
                    <CardDescription>
                      Configure ticket pricing, limits, and sales phases for the event
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Current Sales Overview */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-orange-600">Early Bird Sales</label>
                        <div className="text-2xl font-bold text-orange-600">
                          {analytics.ticketTypes.earlyBird} / {ticketConfig?.config?.earlyBirdLimit || analytics.earlyBirdLimit}
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-orange-500 h-2 rounded-full transition-all" 
                            style={{ 
                              width: `${Math.min((analytics.ticketTypes.earlyBird / (ticketConfig?.config?.earlyBirdLimit || analytics.earlyBirdLimit)) * 100, 100)}%` 
                            }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {(ticketConfig?.config?.earlyBirdLimit || analytics.earlyBirdLimit) - analytics.ticketTypes.earlyBird} remaining
                        </p>
                        <Badge variant="outline" className={`text-xs ${ticketConfig?.config?.isEarlyBirdActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {ticketConfig?.config?.isEarlyBirdActive ? 'ACTIVE' : 'STOPPED'}
                        </Badge>
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-blue-600">Phase 1 Sales</label>
                        <div className="text-2xl font-bold text-blue-600">
                          {analytics.ticketTypes.phase1} / {ticketConfig?.config?.phase1Limit || 200}
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-500 h-2 rounded-full transition-all" 
                            style={{ 
                              width: `${analytics.ticketTypes.phase1 > 0 ? (analytics.ticketTypes.phase1 / (ticketConfig?.config?.phase1Limit || 200)) * 100 : 0}%` 
                            }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {(ticketConfig?.config?.phase1Limit || 200) - analytics.ticketTypes.phase1} remaining
                        </p>
                        <Badge variant="outline" className={`text-xs ${ticketConfig?.config?.isPhase1Active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {ticketConfig?.config?.isPhase1Active ? 'ACTIVE' : 'STOPPED'}
                        </Badge>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-green-600">Total Revenue</label>
                        <div className="text-2xl font-bold text-green-600">
                          ₹{analytics.totalRevenue.toLocaleString()}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          From {analytics.totalTicketsSold} tickets sold
                        </div>
                      </div>
                    </div>


                    {/* Ticket Sales Status */}
                    <div className="border-t pt-4">
                      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <h4 className="text-sm font-semibold mb-2">Current Sales Status</h4>
                        <p className="text-sm text-muted-foreground">
                          {analytics.ticketTypes.earlyBird >= analytics.earlyBirdLimit ? (
                            <>
                              🔥 <strong>Early Bird SOLD OUT</strong> - Now selling Phase 1 tickets at ₹350 each
                            </>
                          ) : (
                            <>
                              ⭐ <strong>Early Bird ACTIVE</strong> - {analytics.earlyBirdLimit - analytics.ticketTypes.earlyBird} tickets remaining at ₹300 each
                            </>
                          )}
                        </p>
                        <div className="mt-2 text-xs text-muted-foreground">
                          Each ticket includes ₹200 food coupon + ₹100 entertainment + convenience fee
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </PermissionGuard>

              {/* Gender & Attendance Analytics */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Gender Breakdown</CardTitle>
                    <CardDescription>Attendee demographics</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Male</span>
                        <span className="font-medium">{analytics.genderBreakdown.male}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-500 h-2 rounded-full" 
                          style={{ 
                            width: `${(analytics.genderBreakdown.male / analytics.totalBookings) * 100}%` 
                          }}
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Female</span>
                        <span className="font-medium">{analytics.genderBreakdown.female}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-pink-500 h-2 rounded-full" 
                          style={{ 
                            width: `${(analytics.genderBreakdown.female / analytics.totalBookings) * 100}%` 
                          }}
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Other</span>
                        <span className="font-medium">{analytics.genderBreakdown.other}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-purple-500 h-2 rounded-full" 
                          style={{ 
                            width: `${(analytics.genderBreakdown.other / analytics.totalBookings) * 100}%` 
                          }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Attendance Analytics</CardTitle>
                    <CardDescription>Event entry statistics</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-4 bg-green-50 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">
                          {analytics.scannedTickets}
                        </div>
                        <p className="text-sm text-green-600">Tickets Scanned</p>
                      </div>
                      
                      <div className="text-center p-4 bg-blue-50 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">
                          {analytics.totalTicketsSold - analytics.scannedTickets}
                        </div>
                        <p className="text-sm text-blue-600">Not Yet Entered</p>
                      </div>
                    </div>
                    
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div 
                        className="bg-green-500 h-3 rounded-full" 
                        style={{ 
                          width: `${(analytics.scannedTickets / analytics.totalTicketsSold) * 100}%` 
                        }}
                      />
                    </div>
                    
                    <p className="text-sm text-muted-foreground text-center">
                      {((analytics.scannedTickets / analytics.totalTicketsSold) * 100).toFixed(1)}% attendance rate
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Recent Bookings */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Bookings</CardTitle>
                  <CardDescription>Latest 5 bookings</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analytics.recentBookings.map((booking: Booking) => (
                      <div key={booking.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <Badge className={getStatusColor(booking.paymentStatus)}>
                            {booking.paymentStatus}
                          </Badge>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{booking.name}</p>
                              {booking.gender && (
                                <Badge 
                                  variant="outline" 
                                  className={`text-xs ${
                                    booking.gender.toLowerCase() === 'male' 
                                      ? 'bg-blue-50 text-blue-700 border-blue-200' 
                                      : booking.gender.toLowerCase() === 'female'
                                      ? 'bg-pink-50 text-pink-700 border-pink-200'
                                      : 'bg-purple-50 text-purple-700 border-purple-200'
                                  }`}
                                >
                                  {booking.gender}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">{booking.phone}</p>
                            <p className="text-sm text-muted-foreground">
                              {booking.ticketCount} tickets • {booking.ticketType === 'early_bird' ? 'Early Bird' : 'Phase 1'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">₹{booking.totalAmount}</p>
                          <p className="text-sm text-muted-foreground">
                            {booking.scannedGuests?.length || 0} entered
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Bookings Tab */}
        <PermissionGuard 
          permissions={['view_bookings']} 
          userPermissions={user.permissions}
        >
          <TabsContent value="bookings" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Booking Management</CardTitle>
                  <CardDescription>
                    View bookings - All payments and tickets are processed automatically via Cashfree webhook
                  </CardDescription>
                </div>
                <PermissionGuard 
                  permissions={['delete_bookings']} 
                  userPermissions={user.permissions}
                >
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => syncSheetsMutation.mutate()}
                      disabled={syncSheetsMutation.isPending}
                    >
                      {syncSheetsMutation.isPending ? (
                        <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                      ) : (
                        <Activity className="w-4 h-4 mr-2" />
                      )}
                      Sync to Google Sheets
                    </Button>
                    
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        if (confirm('This will completely reset the Google Sheet and sync all current bookings. Continue?')) {
                          resetSheetsMutation.mutate();
                        }
                      }}
                      disabled={resetSheetsMutation.isPending}
                    >
                      {resetSheetsMutation.isPending ? (
                        <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                      ) : (
                        <Trash2 className="w-4 h-4 mr-2" />
                      )}
                      Reset & Sync Fresh
                    </Button>
                  </div>
                </PermissionGuard>
              </CardHeader>
              <CardContent>
                {bookingsLoading ? (
                  <div className="flex justify-center p-4">
                    <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {Array.isArray(bookings) && bookings.map((booking: Booking) => (
                      <div key={booking.id} className="border rounded-lg p-4 space-y-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-semibold">{booking.name}</h3>
                            <p className="text-sm text-muted-foreground">{booking.email}</p>
                            <p className="text-sm text-muted-foreground">{booking.phone}</p>
                            <p className="text-sm">
                              {booking.ticketCount} tickets • ₹{booking.totalAmount}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className={`text-xs ${
                                booking.couponCode 
                                  ? 'bg-green-50 text-green-700 border-green-200'
                                  : 'bg-gray-50 text-gray-600 border-gray-200'
                              }`}>
                                🎟️ {booking.couponCode || 'No coupon code'}
                              </Badge>
                              <Badge variant="outline" className={`text-xs ${
                                booking.promoCode 
                                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                                  : 'bg-gray-50 text-gray-600 border-gray-200'
                              }`}>
                                🔗 {booking.promoCode || 'No referral'}
                              </Badge>
                            </div>
                            {booking.gender && (
                              <div className="flex items-center gap-2 mt-1">
                                <Badge 
                                  variant="outline" 
                                  className={`text-xs ${
                                    booking.gender.toLowerCase() === 'male' 
                                      ? 'bg-blue-50 text-blue-700 border-blue-200' 
                                      : booking.gender.toLowerCase() === 'female'
                                      ? 'bg-pink-50 text-pink-700 border-pink-200'
                                      : 'bg-purple-50 text-purple-700 border-purple-200'
                                  }`}
                                >
                                  👤 {booking.gender}
                                </Badge>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={getStatusColor(booking.paymentStatus)}>
                              {booking.paymentStatus}
                            </Badge>
                            {booking.isScanned && (
                              <Badge variant="outline">Scanned</Badge>
                            )}
                          </div>
                        </div>
                        
                        {/* Show detailed guest entry status */}
                        {booking.guestCodes && booking.guestCodes.length > 0 && (
                          <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Guest Entry Status:
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {booking.scannedGuests?.length || 0} / {booking.ticketCount} Entered
                              </Badge>
                            </div>
                            
                            <div className="space-y-2">
                              {booking.guestCodes.map((guestCode: string, index: number) => {
                                // Get guest name - if it's the first ticket, use booking name, otherwise use guest names
                                let guestName;
                                let guestGender;
                                if (index === 0) {
                                  guestName = booking.name; // Primary ticket holder
                                  guestGender = booking.gender; // Primary ticket holder gender
                                } else {
                                  guestName = booking.guests?.[index - 1] || `Guest ${index + 1}`;
                                  guestGender = booking.guestGenders?.[index - 1]; // Guest gender from array
                                }
                                
                                const isScanned = booking.scannedGuests?.includes(guestCode);
                                
                                return (
                                  <div 
                                    key={index} 
                                    className={`flex items-center justify-between p-2 rounded border ${
                                      isScanned 
                                        ? 'bg-green-50 dark:bg-green-900 border-green-200 dark:border-green-700' 
                                        : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600'
                                    }`}
                                  >
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                          {guestName}
                                        </span>
                                        <Badge 
                                          variant="outline" 
                                          className={`text-xs ${
                                            guestGender && guestGender.toLowerCase() === 'male' 
                                              ? 'bg-blue-50 text-blue-700 border-blue-200' 
                                              : guestGender && guestGender.toLowerCase() === 'female'
                                              ? 'bg-pink-50 text-pink-700 border-pink-200'
                                              : guestGender && guestGender.toLowerCase() !== 'male' && guestGender.toLowerCase() !== 'female'
                                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                                              : 'bg-gray-50 text-gray-600 border-gray-200'
                                          }`}
                                        >
                                          👤 {guestGender || 'No gender'}
                                        </Badge>
                                      </div>
                                      <span className="text-xs font-mono text-gray-600 dark:text-gray-400">
                                        {guestCode}
                                      </span>
                                    </div>
                                    
                                    <Badge 
                                      variant={isScanned ? "default" : "outline"} 
                                      className={`text-xs ${
                                        isScanned 
                                          ? "bg-green-600 text-white" 
                                          : "bg-gray-200 text-gray-700 border-gray-400"
                                      }`}
                                    >
                                      {isScanned ? "✓ Entered" : "⏳ Pending"}
                                    </Badge>
                                  </div>
                                );
                              })}
                            </div>
                            
                            {booking.scannedGuests && booking.scannedGuests.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                                <p className="text-xs text-gray-600 dark:text-gray-400">
                                  <strong>Progress:</strong> {((booking.scannedGuests.length / booking.ticketCount) * 100).toFixed(0)}% of group has entered
                                </p>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="flex gap-2 mt-3">
                          {/* Automated Processing Status */}
                          <div className="w-full bg-green-50 border border-green-200 rounded-lg p-3 mb-2">
                            <div className="flex items-center gap-2 text-green-800">
                              <span className="text-lg">✅</span>
                              <div className="text-sm">
                                <p className="font-medium">Automated Processing Active</p>
                                <p className="text-xs text-green-600">
                                  Payments are automatically verified via Cashfree webhook. Tickets sent automatically upon successful payment.
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Automated Status Info */}
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
                            <div className="flex items-center gap-2 text-blue-800">
                              <Clock className="w-4 h-4" />
                              <div className="text-xs">
                                <p className="font-medium">Payment Status: {booking.paymentStatus === 'verified' ? 'Verified Automatically' : booking.paymentStatus === 'pending' ? 'Processing...' : booking.paymentStatus}</p>
                                <p className="text-blue-600">
                                  {booking.paymentStatus === 'verified' 
                                    ? 'Tickets automatically sent to customer email' 
                                    : 'Payment verification in progress via webhook'
                                  }
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Show automated ticket status */}
                          <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                            <div className="flex items-center gap-2 text-gray-700">
                              <Zap className="w-4 h-4" />
                              <div className="text-xs">
                                <p className="font-medium">
                                  {booking.paymentStatus === 'verified' 
                                    ? '✅ Tickets Sent Automatically' 
                                    : booking.paymentStatus === 'pending'
                                    ? '⏳ Awaiting Payment Verification'
                                    : '❌ Payment Issue'
                                  }
                                </p>
                                <p className="text-gray-600">
                                  {booking.paymentStatus === 'verified' 
                                    ? 'Delivered via automated webhook processing' 
                                    : 'Will auto-send once payment is confirmed'
                                  }
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Check Status from Cashfree - Compare local vs gateway status */}
                          {(booking.paymentStatus === 'pending' || booking.paymentStatus === 'failed') && (
                            <PermissionGuard 
                              permissions={['verify_payments']} 
                              userPermissions={user.permissions}
                            >
                              <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-3">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-blue-600 text-sm font-medium">🔍 STATUS VERIFICATION</span>
                                </div>
                                <p className="text-xs text-blue-700 mb-3">
                                  Check the actual payment status directly from Cashfree and compare with local database. 
                                  This will automatically sync status and send tickets if payment is verified on Cashfree.
                                </p>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="bg-blue-500 hover:bg-blue-600 text-white border-blue-600 hover:border-blue-700"
                                  onClick={() => {
                                    if (confirm(`Check payment status from Cashfree for ${booking.name}?\n\nThis will:\n• Query Cashfree directly for current payment status\n• Compare with local database status\n• Update status and send tickets if payment is verified on Cashfree\n\nProceed with status check?`)) {
                                      checkCashfreeStatusMutation.mutate(booking.id);
                                    }
                                  }}
                                  disabled={checkCashfreeStatusMutation.isPending}
                                  data-testid={`button-check-cashfree-status-${booking.id}`}
                                >
                                  {checkCashfreeStatusMutation.isPending ? (
                                    <>
                                      <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                                      Checking...
                                    </>
                                  ) : (
                                    <>
                                      <Activity className="w-4 h-4 mr-2" />
                                      CHECK STATUS FROM CASHFREE
                                    </>
                                  )}
                                </Button>
                                <p className="text-xs text-blue-600 mt-2 font-medium">
                                  🔗 Verify against Cashfree Gateway
                                </p>
                              </div>
                            </PermissionGuard>
                          )}

                          {/* Manual Payment Verification Button - BYPASSES gateway completely */}
                          {(booking.paymentStatus === 'pending' || booking.paymentStatus === 'failed') && (
                            <PermissionGuard 
                              permissions={['verify_payments']} 
                              userPermissions={user.permissions}
                            >
                              <div className="bg-red-50 border-2 border-red-300 rounded-lg p-3">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-red-600 text-sm font-medium">⚠️ MANUAL OVERRIDE</span>
                                </div>
                                <p className="text-xs text-red-700 mb-3">
                                  <strong>WARNING:</strong> This completely bypasses payment gateway verification. 
                                  Use only when payment gateway fails but you have confirmed payment was actually received.
                                </p>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="bg-red-500 hover:bg-red-600 text-white border-red-600 hover:border-red-700"
                                  onClick={() => {
                                    if (confirm(`⚠️ MANUAL OVERRIDE: Bypass gateway verification for ${booking.name}?\n\n🚨 WARNING: This will mark payment as verified WITHOUT checking the payment gateway.\n\nOnly proceed if:\n✅ You have confirmed payment was actually received\n✅ Payment gateway verification is completely broken\n✅ Customer needs immediate assistance\n\nThis action will:\n• Mark payment as verified immediately\n• Generate and send tickets\n• Update Google Sheets\n• Cannot be easily undone\n\nProceed with manual override?`)) {
                                      manualVerifyMutation.mutate(booking.id);
                                    }
                                  }}
                                  disabled={manualVerifyMutation.isPending}
                                  data-testid={`button-manual-verify-${booking.id}`}
                                >
                                  {manualVerifyMutation.isPending ? (
                                    <>
                                      <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                                      Overriding...
                                    </>
                                  ) : (
                                    <>
                                      <X className="w-4 h-4 mr-2" />
                                      MANUAL VERIFY (BYPASS GATEWAY)
                                    </>
                                  )}
                                </Button>
                                <p className="text-xs text-red-600 mt-2 font-medium">
                                  ⚠️ Gateway Bypass - Admin Override Mode
                                </p>
                              </div>
                            </PermissionGuard>
                          )}

                          {/* Send Rejection Email Button */}
                          {booking.paymentStatus === 'failed' && (
                            <PermissionGuard 
                              permissions={['verify_payments']} 
                              userPermissions={user.permissions}
                            >
                              <div className="bg-orange-50 border-2 border-orange-300 rounded-lg p-3">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-orange-600 text-sm font-medium">📧 PAYMENT REJECTION EMAIL</span>
                                </div>
                                <p className="text-xs text-orange-700 mb-3">
                                  Send payment rejection notification email to customer. This will inform them that their payment was rejected and provide next steps.
                                </p>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="bg-orange-500 hover:bg-orange-600 text-white border-orange-600 hover:border-orange-700"
                                  onClick={() => {
                                    if (confirm(`Send payment rejection email to ${booking.name} at ${booking.email}?\n\nThis will notify the customer that their payment was rejected.`)) {
                                      sendRejectionEmailMutation.mutate(booking.id);
                                    }
                                  }}
                                  disabled={sendRejectionEmailMutation.isPending}
                                  data-testid={`button-send-rejection-email-${booking.id}`}
                                >
                                  {sendRejectionEmailMutation.isPending ? (
                                    <>
                                      <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                                      Sending...
                                    </>
                                  ) : (
                                    <>
                                      <Send className="w-4 h-4 mr-2" />
                                      SEND REJECTION EMAIL
                                    </>
                                  )}
                                </Button>
                                <p className="text-xs text-orange-600 mt-2 font-medium">
                                  📧 Notify customer of payment rejection
                                </p>
                              </div>
                            </PermissionGuard>
                          )}

                          <PermissionGuard 
                            permissions={['delete_bookings']} 
                            userPermissions={user.permissions}
                          >
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                if (confirm(`Delete booking for ${booking.name}? This cannot be undone.`)) {
                                  deleteBookingMutation.mutate(booking.id);
                                }
                              }}
                              disabled={deleteBookingMutation.isPending}
                            >
                              <Trash2 className="w-4 h-4 mr-1" />
                              {deleteBookingMutation.isPending ? 'Deleting...' : 'Delete'}
                            </Button>
                          </PermissionGuard>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {!Array.isArray(bookings) && !bookingsLoading && (
                  <div className="text-center py-8 text-muted-foreground">
                    No bookings found
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </PermissionGuard>

        {/* Scanner Tab */}
        <PermissionGuard 
          permissions={['scanner_access']} 
          userPermissions={user.permissions}
        >
          <TabsContent value="scanner">
            <Card>
              <CardHeader>
                <CardTitle>QR Code Scanner</CardTitle>
                <CardDescription>
                  Scan tickets at the event entrance
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Scanner embedded={true} />
              </CardContent>
            </Card>
          </TabsContent>
        </PermissionGuard>

        {/* Coupons Tab */}
        <PermissionGuard 
          permissions={['manage_coupons']} 
          userPermissions={user.permissions}
        >
          <TabsContent value="coupons" className="space-y-4">
            <CouponManagement />
          </TabsContent>
        </PermissionGuard>

        {/* Smart Ticket Generation Tab */}
        <PermissionGuard 
          permissions={['verify_payments']} 
          userPermissions={user.permissions}
        >
          <TabsContent value="smart-tickets" className="space-y-4">
            <TicketGenerationPanel 
              bookings={Array.isArray(bookings) ? bookings : []} 
              onRefresh={() => queryClient.invalidateQueries({ queryKey: ['/api/admin/bookings'] })}
            />
          </TabsContent>
        </PermissionGuard>

        {/* Telugu Night 3.0 Management Tab */}
        <PermissionGuard 
          permissions={['create_events', 'manage_events']} 
          userPermissions={user.permissions}
          requireAll={false}
        >
          <TabsContent value="events">
            <TeluguNightEventManagement />
          </TabsContent>
        </PermissionGuard>

        {/* Promoters Management Tab */}
        <PermissionGuard 
          permissions={['manage_users', 'view_promoters']} 
          userPermissions={user.permissions}
          requireAll={false}
        >
          <TabsContent value="promoters" className="space-y-4">
            <PromoterManagement />
          </TabsContent>
        </PermissionGuard>

        {/* Settings Tab */}
        <PermissionGuard 
          permissions={['manage_users', 'system_settings']} 
          userPermissions={user.permissions}
          requireAll={false}
        >
          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>System Settings</CardTitle>
                <CardDescription>
                  Manage ticket phases and system configuration
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Phase Sold Out Controls */}
                <div className="border rounded-lg p-4">
                  <h3 className="text-lg font-semibold mb-4">Phase Sold Out Controls</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Manually mark phases as "Sold Out" to stop sales even if capacity is available.
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Early Bird Sold Out */}
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">Early Bird</p>
                        <p className="text-xs text-muted-foreground">
                          {ticketConfig?.config?.isEarlyBirdSoldOut ? 'Marked as Sold Out' : 'Available for sale'}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant={ticketConfig?.config?.isEarlyBirdSoldOut ? 'destructive' : 'outline'}
                        onClick={() => {
                          updateTicketConfigMutation.mutate({
                            isEarlyBirdSoldOut: !ticketConfig?.config?.isEarlyBirdSoldOut
                          });
                        }}
                        disabled={updateTicketConfigMutation.isPending}
                      >
                        {ticketConfig?.config?.isEarlyBirdSoldOut ? 'Sold Out' : 'Mark Sold'}
                      </Button>
                    </div>

                    {/* Phase 1 Sold Out */}
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">Phase 1</p>
                        <p className="text-xs text-muted-foreground">
                          {ticketConfig?.config?.isPhase1SoldOut ? 'Marked as Sold Out' : 'Available for sale'}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant={ticketConfig?.config?.isPhase1SoldOut ? 'destructive' : 'outline'}
                        onClick={() => {
                          updateTicketConfigMutation.mutate({
                            isPhase1SoldOut: !ticketConfig?.config?.isPhase1SoldOut
                          });
                        }}
                        disabled={updateTicketConfigMutation.isPending}
                      >
                        {ticketConfig?.config?.isPhase1SoldOut ? 'Sold Out' : 'Mark Sold'}
                      </Button>
                    </div>

                    {/* Phase 2 Sold Out */}
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">Phase 2</p>
                        <p className="text-xs text-muted-foreground">
                          {ticketConfig?.config?.isPhase2SoldOut ? 'Marked as Sold Out' : 'Available for sale'}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant={ticketConfig?.config?.isPhase2SoldOut ? 'destructive' : 'outline'}
                        onClick={() => {
                          updateTicketConfigMutation.mutate({
                            isPhase2SoldOut: !ticketConfig?.config?.isPhase2SoldOut
                          });
                        }}
                        disabled={updateTicketConfigMutation.isPending}
                      >
                        {ticketConfig?.config?.isPhase2SoldOut ? 'Sold Out' : 'Mark Sold'}
                      </Button>
                    </div>

                    {/* Phase 3 Sold Out */}
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">Phase 3</p>
                        <p className="text-xs text-muted-foreground">
                          {ticketConfig?.config?.isPhase3SoldOut ? 'Marked as Sold Out' : 'Available for sale'}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant={ticketConfig?.config?.isPhase3SoldOut ? 'destructive' : 'outline'}
                        onClick={() => {
                          updateTicketConfigMutation.mutate({
                            isPhase3SoldOut: !ticketConfig?.config?.isPhase3SoldOut
                          });
                        }}
                        disabled={updateTicketConfigMutation.isPending}
                      >
                        {ticketConfig?.config?.isPhase3SoldOut ? 'Sold Out' : 'Mark Sold'}
                      </Button>
                    </div>

                    {/* Phase 4 Sold Out */}
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">Phase 4</p>
                        <p className="text-xs text-muted-foreground">
                          {ticketConfig?.config?.isPhase4SoldOut ? 'Marked as Sold Out' : 'Available for sale'}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant={ticketConfig?.config?.isPhase4SoldOut ? 'destructive' : 'outline'}
                        onClick={() => {
                          updateTicketConfigMutation.mutate({
                            isPhase4SoldOut: !ticketConfig?.config?.isPhase4SoldOut
                          });
                        }}
                        disabled={updateTicketConfigMutation.isPending}
                      >
                        {ticketConfig?.config?.isPhase4SoldOut ? 'Sold Out' : 'Mark Sold'}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Additional Settings Placeholder */}
                <div className="text-center py-4 border rounded-lg">
                  <Settings className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-muted-foreground text-sm">
                    Additional settings will be available here
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </PermissionGuard>
      </Tabs>
    </div>
  );
}