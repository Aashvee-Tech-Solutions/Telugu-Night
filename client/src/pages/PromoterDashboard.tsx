import React, { useEffect, useState } from 'react';
import { useParams } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { Users, LogOut, RefreshCw, Share2, Copy, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface PromoterStats {
  totalBookings: number;
  promoterInfo: {
    name: string;
    email: string;
    promoCode: string;
    isActive: boolean;
    createdAt: string;
    lastLoginAt: string;
  };
  referralUrl: string;
  bookings: {
    id: number;
    name: string;
    email: string;
    phone: string;
    ticketCount: number;
    totalAmount: string;
    paymentStatus: string;
    createdAt: string;
  }[];
}

export default function PromoterDashboard() {
  const { promoCode } = useParams<{ promoCode: string }>();
  const [promoterSession, setPromoterSession] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    const session = localStorage.getItem('promoterSession');
    if (session) {
      setPromoterSession(JSON.parse(session));
    } else {
      // Redirect to login if no session
      window.location.href = '/promoter/login';
    }
  }, []);

  const { data: stats, isLoading, error, refetch } = useQuery({
    queryKey: ['/api/promoter/dashboard', promoCode],
    queryFn: async () => {
      const response = await fetch(`/api/promoter/dashboard/${promoCode}`);
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data');
      }
      return response.json();
    },
    enabled: !!promoCode && !!promoterSession,
    retry: 1,
  });

  const handleLogout = () => {
    localStorage.removeItem('promoterSession');
    window.location.href = '/promoter/login';
  };

  const copyReferralUrl = async () => {
    const url = stats?.stats?.referralUrl || `https://events.qlora.in/book?ref=${promoterSession?.promoCode}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({
        title: "Copied to clipboard!",
        description: "Your referral URL has been copied.",
      });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Please copy the URL manually.",
        variant: "destructive",
      });
    }
  };

  const shareOnSocial = (platform: string) => {
    const url = stats?.stats?.referralUrl || `https://events.qlora.in/book?ref=${promoterSession?.promoCode}`;
    const text = 'Join me at Telugu Night! Book your tickets now!';
    
    let shareUrl = '';
    switch (platform) {
      case 'whatsapp':
        shareUrl = `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`;
        break;
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
        break;
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
        break;
      default:
        return;
    }
    
    window.open(shareUrl, '_blank', 'width=600,height=400');
  };

  const getPaymentStatusBadge = (status: string) => {
    const statusMap = {
      'pending': { variant: 'secondary' as const, text: 'Pending' },
      'verified': { variant: 'default' as const, text: 'Verified' },
      'failed': { variant: 'destructive' as const, text: 'Failed' },
    };
    const config = statusMap[status as keyof typeof statusMap] || statusMap.pending;
    return <Badge variant={config.variant}>{config.text}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <RefreshCw className="animate-spin h-8 w-8 mx-auto mb-4" />
          <p>Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Card className="w-96">
          <CardContent className="pt-6">
            <div className="text-center text-red-600">
              <p>Failed to load dashboard</p>
              <Button onClick={() => refetch()} className="mt-4">Try Again</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statsData = stats?.stats as PromoterStats;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Promoter Dashboard
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Welcome back, {promoterSession?.name}! 
              <span className="font-semibold text-purple-600 ml-2">#{promoterSession?.promoCode}</span>
            </p>
          </div>
          <Button
            onClick={handleLogout}
            variant="outline"
            className="flex items-center gap-2"
            data-testid="button-logout"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-1 gap-6 mb-8 max-w-md">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Bookings</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-bookings">
                {statsData?.totalBookings || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Total referrals made
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Referral URL Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5" />
              Your Referral URL
            </CardTitle>
            <CardDescription>
              Share this URL to track your referrals and help people book tickets!
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <code className="bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded text-sm block">
                    {statsData?.referralUrl || `https://events.qlora.in/book?ref=${promoterSession?.promoCode}`}
                  </code>
                </div>
                <Button
                  onClick={copyReferralUrl}
                  variant="outline"
                  data-testid="button-copy-url"
                  className="flex items-center gap-2"
                >
                  <Copy className="h-4 w-4" />
                  Copy URL
                </Button>
              </div>
              
              {/* Social Sharing Buttons */}
              <div className="flex gap-3 pt-2">
                <Button
                  onClick={() => shareOnSocial('whatsapp')}
                  variant="outline"
                  size="sm"
                  className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                  data-testid="button-share-whatsapp"
                >
                  <svg className="h-4 w-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91C21.95 6.45 17.5 2 12.04 2M12.05 20.15c-1.4 0-2.75-.38-3.93-1.09l-.28-.17-2.91.77.78-2.84-.19-.29c-.78-1.23-1.19-2.65-1.19-4.09 0-4.27 3.47-7.74 7.74-7.74s7.74 3.47 7.74 7.74-3.47 7.71-7.76 7.71M16.6 13.99c-.23-.12-1.37-.68-1.58-.76-.21-.08-.36-.12-.51.12-.15.24-.6.76-.73.91-.13.15-.27.17-.5.06-.23-.12-.98-.36-1.87-1.16-.69-.62-1.16-1.38-1.29-1.61-.13-.23-.01-.36.1-.47.11-.11.23-.27.34-.41.12-.14.16-.23.24-.39.08-.15.04-.29-.02-.41-.06-.12-.51-1.23-.7-1.69-.18-.44-.37-.38-.51-.39-.13-.01-.28-.01-.43-.01-.15 0-.39.06-.59.29-.2.23-.77.75-.77 1.83s.79 2.12.9 2.27c.11.15 1.56 2.38 3.78 3.34.53.23.94.37 1.26.47.53.17 1.01.14 1.39.09.42-.06 1.37-.56 1.56-1.1.19-.54.19-1.01.13-1.1-.06-.09-.21-.15-.44-.27"/>
                  </svg>
                  WhatsApp
                </Button>
                
                <Button
                  onClick={() => shareOnSocial('facebook')}
                  variant="outline"
                  size="sm"
                  className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
                  data-testid="button-share-facebook"
                >
                  <svg className="h-4 w-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                  Facebook
                </Button>
                
                <Button
                  onClick={() => shareOnSocial('twitter')}
                  variant="outline"
                  size="sm"
                  className="bg-sky-50 hover:bg-sky-100 text-sky-700 border-sky-200"
                  data-testid="button-share-twitter"
                >
                  <svg className="h-4 w-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                  </svg>
                  Twitter
                </Button>
              </div>
              
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm text-amber-800">
                  <strong>💡 Pro Tip:</strong> Share your referral link to help people book tickets and track your referrals!
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bookings Table */}
        <Card>
          <CardHeader>
            <CardTitle>Your Referral Bookings</CardTitle>
            <CardDescription>All bookings made through your referral code</CardDescription>
          </CardHeader>
          <CardContent>
            {statsData?.bookings?.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Tickets</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {statsData.bookings.map((booking, index) => (
                    <TableRow key={booking.id} data-testid={`row-booking-${index}`}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{booking.name}</p>
                          <p className="text-sm text-gray-500">{booking.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>{booking.phone}</TableCell>
                      <TableCell>{booking.ticketCount}</TableCell>
                      <TableCell>₹{booking.totalAmount}</TableCell>
                      <TableCell>{getPaymentStatusBadge(booking.paymentStatus)}</TableCell>
                      <TableCell>
                        {format(new Date(booking.createdAt), 'MMM dd, yyyy')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No referral bookings yet</p>
                <p className="text-sm">Share your referral URL to start earning!</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}