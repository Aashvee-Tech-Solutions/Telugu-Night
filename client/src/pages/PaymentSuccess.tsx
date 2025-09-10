import { useEffect, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Download, Calendar, MapPin, Clock, Users, AlertCircle, Loader2, FileDown, Share2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Booking } from '../../../shared/schema';

export default function PaymentSuccess() {
  const { toast } = useToast();
  const [bookingId, setBookingId] = useState<number | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [redirectMessage, setRedirectMessage] = useState('');
  const [loadingTimeout, setLoadingTimeout] = useState(false);

  // Extract booking ID from URL with enhanced validation
  useEffect(() => {
    console.log('🔍 PaymentSuccess: Extracting booking ID from URL:', window.location.search);
    const params = new URLSearchParams(window.location.search);
    const booking = params.get('booking');
    
    if (booking) {
      const parsedId = parseInt(booking);
      if (!isNaN(parsedId) && parsedId > 0) {
        console.log('✅ PaymentSuccess: Valid booking ID extracted:', parsedId);
        setBookingId(parsedId);
      } else {
        console.error('❌ PaymentSuccess: Invalid booking ID format:', booking);
      }
    } else {
      console.error('❌ PaymentSuccess: No booking parameter found in URL');
    }
  }, []);

  // Fetch booking details with enhanced error handling and timeout
  const { data: booking, isLoading, error } = useQuery<Booking>({
    queryKey: [`/api/bookings/${bookingId}`],
    enabled: !!bookingId,
    retry: 1, // Reduced retry to prevent infinite loading
    refetchOnWindowFocus: false,
    staleTime: 5000, // Reduced timeout
    gcTime: 5000,
  });

  // Add loading timeout to prevent infinite spinner
  useEffect(() => {
    if (isLoading && bookingId && !loadingTimeout) {
      console.log('⏱️ PaymentSuccess: Starting 15-second timeout for booking fetch');
      const timer = setTimeout(() => {
        console.error('❌ PaymentSuccess: Booking fetch timeout after 15 seconds');
        setLoadingTimeout(true);
      }, 15000); // 15 second timeout
      
      return () => clearTimeout(timer);
    }
  }, [isLoading, bookingId, loadingTimeout]);

  // Add logging for booking data fetch
  useEffect(() => {
    if (error) {
      console.error('❌ PaymentSuccess: Failed to fetch booking:', error);
    }
    if (booking) {
      console.log('✅ PaymentSuccess: Booking data fetched:', booking.id, 'Status:', booking.paymentStatus);
    }
    console.log('🐛 PaymentSuccess Debug - bookingId:', bookingId, 'isLoading:', isLoading, 'error:', error, 'booking:', booking);
  }, [booking, error, bookingId, isLoading]);

  // Send QR tickets mutation
  const sendTicketsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', `/api/public/bookings/${bookingId}/send-tickets`);
    },
    onSuccess: () => {
      toast({
        title: "🎫 QR Tickets Sent!",
        description: "Your QR tickets have been sent to your email address.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send tickets",
        description: error.message || "Please contact support for assistance.",
        variant: "destructive",
      });
    },
  });

  // Mutation to manually check payment status for stuck payments
  const checkStatusMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', `/api/bookings/${bookingId}/check-status`);
    },
    onSuccess: (data: any) => {
      if (data.status === 'failed') {
        toast({
          title: "Payment Timeout",
          description: "Your payment has timed out and will be marked as failed.",
          variant: "destructive",
        });
        setIsRedirecting(true);
        setRedirectMessage('Payment failed. Refreshing page...');
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        toast({
          title: "Status Checked",
          description: `Payment is still ${data.status}. Time pending: ${data.timePending}`,
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Check Failed",
        description: error.message || "Failed to check payment status.",
        variant: "destructive",
      });
    },
  });

  // Enhanced payment status handling with loading states
  useEffect(() => {
    if (!booking || isRedirecting) return;
    
    console.log('🔄 PaymentSuccess: Processing payment status:', booking.paymentStatus, 'for booking:', booking.id);
    
    if (booking.paymentStatus === 'failed') {
      console.log('❌ Payment failed, initiating redirect to failure page');
      setIsRedirecting(true);
      setRedirectMessage('Payment failed. Redirecting to failure page...');
      
      // Add a small delay to show the loading state
      setTimeout(() => {
        window.location.href = `/payment/failure?booking=${booking.id}`;
      }, 1500);
      return;
    }
    
    // For pending payments, check timeout
    if (booking.paymentStatus === 'pending') {
      const createdTime = new Date(booking.createdAt || '').getTime();
      const timeElapsed = Date.now() - createdTime;
      
      console.log('⏳ Payment pending for', Math.round(timeElapsed / 1000), 'seconds');
      
      // If payment has been pending for more than 5 minutes, redirect to failure
      if (timeElapsed > 5 * 60 * 1000) {
        console.log('⏰ Payment timeout detected, initiating redirect to failure page');
        setIsRedirecting(true);
        setRedirectMessage('Payment timed out. Redirecting to failure page...');
        
        setTimeout(() => {
          window.location.href = `/payment/failure?booking=${booking.id}`;
        }, 1500);
        return;
      }
    }
    
    // Show success message for verified payments
    if (booking.paymentStatus === 'verified') {
      console.log('🎊 Payment successful! Webhook processed tickets automatically.');
    }
  }, [booking?.id, booking?.paymentStatus, isRedirecting]);

  // Show redirecting state
  if (isRedirecting) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4" data-testid="page-redirecting">
        <Card className="max-w-md w-full">
          <CardContent className="text-center p-6 sm:p-8">
            <Loader2 className="h-12 w-12 sm:h-16 sm:w-16 text-blue-500 mx-auto mb-4 animate-spin" data-testid="spinner-redirect" />
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2" data-testid="text-redirect-title">Redirecting...</h2>
            <p className="text-gray-600 text-sm sm:text-base" data-testid="text-redirect-message">{redirectMessage}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!bookingId) {
    console.error('❌ PaymentSuccess: No booking ID provided');
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center" data-testid="page-invalid-link">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="text-center p-8">
            <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" data-testid="icon-error" />
            <h2 className="text-2xl font-bold text-red-600 mb-2" data-testid="text-error-title">Invalid Payment Link</h2>
            <p className="text-gray-600 mb-6" data-testid="text-error-description">The payment link is missing booking information.</p>
            <Button onClick={() => window.location.href = '/'} data-testid="button-home">
              Return to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    console.log('⏳ PaymentSuccess: Loading booking data for ID:', bookingId);
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4" data-testid="page-loading">
        <Card className="max-w-md w-full">
          <CardContent className="text-center p-6 sm:p-8">
            <Loader2 className="h-12 w-12 sm:h-16 sm:w-16 text-blue-500 mx-auto mb-4 animate-spin" data-testid="spinner-loading" />
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2" data-testid="text-loading-title">Processing Payment...</h2>
            <p className="text-gray-600 text-sm sm:text-base" data-testid="text-loading-description">Please wait while we confirm your payment and generate your tickets.</p>
            <p className="text-sm text-gray-500 mt-2" data-testid="text-booking-id">Booking ID: #{bookingId}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !booking || loadingTimeout) {
    console.error('❌ PaymentSuccess: Booking not found, error occurred, or loading timeout:', error, 'timeout:', loadingTimeout);
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center px-4" data-testid="page-error">
        <Card className="max-w-md w-full">
          <CardContent className="text-center p-6 sm:p-8">
            <AlertCircle className="h-12 w-12 sm:h-16 sm:w-16 text-red-500 mx-auto mb-4" data-testid="icon-error" />
            <h2 className="text-xl sm:text-2xl font-bold text-red-600 mb-2" data-testid="text-error-title">
              {loadingTimeout ? 'Payment Processing Delayed' : 'Booking Not Found'}
            </h2>
            <p className="text-gray-600 mb-6 text-sm sm:text-base" data-testid="text-error-description">
              {loadingTimeout 
                ? "Your payment may still be processing. Please wait a few minutes or contact support if the issue persists."
                : "We couldn't find your booking. Please contact support."
              }
            </p>
            <p className="text-sm text-gray-500 mb-4" data-testid="text-booking-id">Booking ID: #{bookingId}</p>
            <div className="flex flex-col sm:flex-row gap-3">
              {loadingTimeout && (
                <Button 
                  onClick={() => {
                    setLoadingTimeout(false);
                    window.location.reload();
                  }} 
                  className="w-full sm:w-auto"
                  data-testid="button-retry"
                >
                  🔄 Check Status Again
                </Button>
              )}
              <Button 
                onClick={() => sendTicketsMutation.mutate()} 
                disabled={sendTicketsMutation.isPending}
                variant="secondary"
                className="w-full sm:w-auto"
                data-testid="button-manual-send"
              >
                {sendTicketsMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Send Tickets Manually
                  </>
                )}
              </Button>
              <Button onClick={() => window.location.href = '/'} variant="outline" className="w-full sm:w-auto" data-testid="button-home">
                Return to Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }


  // Calculate how long we've been waiting in seconds
  const waitingTime = booking ? Math.round((Date.now() - new Date(booking.createdAt || '').getTime()) / 1000) : 0;

  // Show immediate success only for verified payments or very recent pending payments  
  // REMOVED: Early return that was causing blank page - use full success page below instead

  const isPaymentVerified = booking.paymentStatus === 'verified';
  const hasTickets = booking.qrCodes && Array.isArray(booking.qrCodes) && booking.qrCodes.length > 0;

  // Download functions
  const downloadQRCode = (qrCodeDataUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = qrCodeDataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadAllTickets = () => {
    if (booking && booking.qrCodes) {
      booking.qrCodes.forEach((qrCode, index) => {
        setTimeout(() => {
          downloadQRCode(qrCode, `telugu-night-ticket-${index + 1}.png`);
        }, index * 100); // Small delay to prevent browser blocking multiple downloads
      });
      toast({
        title: "📥 Downloading Tickets",
        description: `Downloading ${booking.qrCodes.length} QR ticket(s)...`,
      });
    }
  };

  const shareTicket = async () => {
    if (navigator.share && booking) {
      try {
        await navigator.share({
          title: 'Telugu Night Tickets',
          text: `My Telugu Night tickets are ready! Booking ID: #${booking.id}`,
          url: window.location.href
        });
      } catch (error) {
        // Fallback to copying URL
        navigator.clipboard.writeText(window.location.href);
        toast({
          title: "📋 Link Copied",
          description: "Payment link copied to clipboard",
        });
      }
    } else {
      // Fallback for browsers that don't support native sharing
      navigator.clipboard.writeText(window.location.href);
      toast({
        title: "📋 Link Copied",
        description: "Payment link copied to clipboard",
      });
    }
  };

  // Debug logging just before render
  console.log('🔍 PaymentSuccess: About to render - booking:', booking, 'isPaymentVerified:', booking ? booking.paymentStatus === 'verified' : 'no booking');
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Success Header */}
          <Card className="mb-6 border-green-200 bg-green-50">
            <CardContent className="text-center p-8">
              <CheckCircle className="h-20 w-20 text-green-500 mx-auto mb-4" />
              <h1 className="text-3xl font-bold text-green-600 mb-2">
                {isPaymentVerified ? 'Payment Successful! 🎉' : 'Payment Processing 🔄'}
              </h1>
              <p className="text-gray-700 text-lg">
                {isPaymentVerified 
                  ? 'Your booking for Telugu Night has been confirmed!' 
                  : 'Your booking is being processed. You will receive your tickets soon!'}
              </p>
              <div className="mt-4 bg-green-100 border border-green-300 rounded-lg p-3 inline-block">
                <p className="text-green-800 font-medium">
                  Booking ID: #{booking?.id || bookingId}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Booking Details */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Booking Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="font-medium text-gray-600">Name</p>
                  <p className="text-lg">{booking.name}</p>
                </div>
                <div>
                  <p className="font-medium text-gray-600">Email</p>
                  <p className="text-lg">{booking.email}</p>
                </div>
                <div>
                  <p className="font-medium text-gray-600">Phone</p>
                  <p className="text-lg">{booking.phone}</p>
                </div>
                <div>
                  <p className="font-medium text-gray-600">Tickets</p>
                  <p className="text-lg font-bold text-blue-600">{booking.ticketCount}</p>
                </div>
                <div>
                  <p className="font-medium text-gray-600">Total Amount</p>
                  <p className="text-lg font-bold text-green-600">₹{booking.totalAmount}</p>
                </div>
                <div>
                  <p className="font-medium text-gray-600">Payment Status</p>
                  <p className={`text-lg font-medium ${isPaymentVerified ? 'text-green-600' : 'text-yellow-600'}`}>
                    {isPaymentVerified ? '✓ Verified' : '⏳ Processing'}
                  </p>
                </div>
              </div>

              {booking.guestCodes && booking.guestCodes.length > 0 && (
                <div>
                  <p className="font-medium text-gray-600 mb-2">Guest Entry Codes</p>
                  <div className="flex flex-wrap gap-2">
                    {booking.guestCodes.map((code: string, index: number) => (
                      <span key={index} className="bg-blue-100 text-blue-800 px-3 py-1 rounded-lg font-mono">
                        {code}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Event Information */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Event Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-3">
                  <MapPin className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="font-medium">Venue</p>
                    <p className="text-sm text-gray-600">DTR, Down to Road Manipal</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="font-medium">Date</p>
                    <p className="text-sm text-gray-600">September 19, 2025</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-purple-500" />
                  <div>
                    <p className="font-medium">Time</p>
                    <p className="text-sm text-gray-600">6:30 PM - 11:00 PM</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* QR Tickets Status */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                QR Tickets
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isPaymentVerified ? (
                <div className="space-y-4">
                  {hasTickets ? (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-green-600 mb-2">
                        <CheckCircle className="h-5 w-5" />
                        <p className="font-medium">✅ Payment Successful!</p>
                      </div>
                      <p className="text-gray-600 text-sm mb-2">
                        🎫 Your QR tickets have been sent to <strong>{booking.email}</strong>
                      </p>
                      <p className="text-green-600 text-xs mb-3">
                        📧 Please check your email (including spam folder) for your QR tickets.
                      </p>
                      <div className="flex gap-2">
                        <Button 
                          onClick={() => sendTicketsMutation.mutate()} 
                          disabled={sendTicketsMutation.isPending}
                          size="sm"
                          className="flex items-center gap-2"
                          data-testid="button-resend-tickets"
                        >
                          {sendTicketsMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                          {sendTicketsMutation.isPending ? 'Sending...' : 'Resend Tickets'}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-blue-600 mb-2">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <p className="font-medium">📧 QR Tickets Being Sent...</p>
                      </div>
                      <p className="text-gray-600 text-sm mb-2">
                        Your QR tickets are being automatically generated and sent to <strong>{booking.email}</strong>
                      </p>
                      <p className="text-blue-600 text-xs mb-3">
                        ⏱️ This usually takes 1-2 minutes. Please check your email (including spam folder).
                      </p>
                      {sendTicketsMutation.isPending && (
                        <p className="text-blue-600 text-sm mt-2 font-medium">
                          🚀 Sending tickets now...
                        </p>
                      )}
                      <div className="flex gap-2 mt-3">
                        <Button 
                          onClick={() => sendTicketsMutation.mutate()} 
                          disabled={sendTicketsMutation.isPending}
                          size="sm"
                          variant="outline"
                          className="flex items-center gap-2"
                          data-testid="button-send-tickets"
                        >
                          {sendTicketsMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                          {sendTicketsMutation.isPending ? 'Sending...' : 'Send Tickets Now'}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-yellow-600 mb-2">
                    <Clock className="h-5 w-5" />
                    <p className="font-medium">⏳ Payment Processing...</p>
                  </div>
                  <p className="text-gray-600 text-sm mb-2">
                    Your payment is being confirmed. QR tickets will be automatically sent once verified.
                  </p>
                  <p className="text-yellow-600 text-xs">
                    💡 This page will update automatically. Please wait a moment.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Important Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Important Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-gray-600">
              <p>📧 <strong>Check your email:</strong> QR tickets have been sent to {booking.email}</p>
              <p>🚪 <strong>Entry requirement:</strong> Show your QR code at the venue for entry</p>
              <p>🎫 <strong>Guest codes:</strong> Each ticket has a unique guest code for individual entry</p>
              <p>📞 <strong>Support:</strong> Contact mis@aashveetech.com or +91 6281614117 for assistance</p>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="mt-6 flex justify-center gap-4">
            <Button 
              onClick={() => window.location.href = '/'}
              variant="outline"
            >
              Return to Home
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}