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

  // Extract booking ID from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const booking = params.get('booking');
    if (booking) {
      setBookingId(parseInt(booking));
    }
  }, []);

  // Track how long we've been polling
  const [startTime] = useState(Date.now());
  const [hasTimedOut, setHasTimedOut] = useState(false);

  // Fetch booking details with polling for status updates
  const { data: booking, isLoading, error } = useQuery<Booking>({
    queryKey: [`/api/bookings/${bookingId}`],
    enabled: !!bookingId,
    retry: 3,
    retryDelay: 1000,
    refetchInterval: (data) => {
      // Check if we've been polling for more than 45 seconds
      const elapsed = Date.now() - startTime;
      if (elapsed > 45 * 1000) { // 45 seconds maximum
        setHasTimedOut(true);
        return false;
      }
      
      // Keep polling every 2 seconds if payment is still pending
      if ((data as Booking)?.paymentStatus === 'pending') {
        return 2000;
      }
      return false; // Stop polling once status is determined
    },
    refetchOnWindowFocus: true,
  });

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

  // Track if we've already shown status messages to prevent repeated toasts
  const [statusShown, setStatusShown] = useState({
    pending: false,
    failed: false
  });

  // Handle payment status and redirect accordingly
  useEffect(() => {
    if (booking) {
      if (booking.paymentStatus === 'failed') {
        console.log('❌ Payment failed, redirecting to failure page');
        window.location.href = `/payment/failure?booking=${booking.id}`;
        return;
      }
      
      if (booking.paymentStatus === 'verified') {
        // Check if QR codes don't exist or tickets haven't been sent
        if (!booking.qrCodes || booking.qrCodes.length === 0) {
          console.log('🎫 Booking verified but no QR codes found, generating tickets...');
          sendTicketsMutation.mutate();
        } else {
          console.log('✅ QR codes already exist for this booking');
        }
      } else if (booking.paymentStatus === 'pending') {
        console.log('⏳ Payment still pending, waiting for verification...');
        // Only show processing message, don't generate tickets yet
      }
    }
    
    // Handle timeout case - if stuck for more than 45 seconds
    if (hasTimedOut && booking && booking.paymentStatus === 'pending') {
      console.log('⏰ Payment processing timed out after 45 seconds, redirecting to failure page');
      window.location.href = `/payment/failure?booking=${booking.id}&reason=timeout`;
      return;
    }
  }, [booking?.id, booking?.paymentStatus, hasTimedOut]);

  if (!bookingId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="text-center p-8">
            <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-red-600 mb-2">Invalid Payment Link</h2>
            <p className="text-gray-600 mb-6">The payment link is missing booking information.</p>
            <Button onClick={() => window.location.href = '/'}>
              Return to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardContent className="text-center p-6 sm:p-8">
            <Loader2 className="h-12 w-12 sm:h-16 sm:w-16 text-blue-500 mx-auto mb-4 animate-spin" />
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2">Processing Payment...</h2>
            <p className="text-gray-600 text-sm sm:text-base">Please wait while we confirm your payment and generate your tickets.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardContent className="text-center p-6 sm:p-8">
            <AlertCircle className="h-12 w-12 sm:h-16 sm:w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl sm:text-2xl font-bold text-red-600 mb-2">Booking Not Found</h2>
            <p className="text-gray-600 mb-6 text-sm sm:text-base">We couldn't find your booking. Please contact support.</p>
            <Button onClick={() => window.location.href = '/'} className="w-full sm:w-auto">
              Return to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

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
        // Force a refetch to get updated status
        window.location.reload();
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

  // Calculate how long we've been waiting in seconds
  const waitingTime = booking ? Math.round((Date.now() - new Date(booking.createdAt || '').getTime()) / 1000) : 0;

  // Show processing state for pending payments
  if (booking && booking.paymentStatus === 'pending') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-100 flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardContent className="text-center p-6 sm:p-8">
            <Loader2 className="h-12 w-12 sm:h-16 sm:w-16 text-yellow-500 mx-auto mb-4 animate-spin" />
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2">Payment Processing</h2>
            <p className="text-gray-600 mb-4 text-sm sm:text-base">
              Your payment is being processed. This may take a few minutes.
            </p>
            <div className="bg-yellow-100 border border-yellow-300 rounded-lg p-3 inline-block mb-4">
              <p className="text-yellow-800 font-medium text-sm">
                Booking ID: #{booking.id}
              </p>
              <p className="text-yellow-700 text-xs mt-1">
                Waiting: {waitingTime} second{waitingTime !== 1 ? 's' : ''}
              </p>
            </div>
            
            {/* Show manual check button if waiting too long */}
            {waitingTime >= 30 && (
              <div className="mb-4">
                <Button 
                  onClick={() => checkStatusMutation.mutate()}
                  disabled={checkStatusMutation.isPending}
                  variant="outline"
                  size="sm"
                >
                  {checkStatusMutation.isPending ? 'Checking...' : 'Check Payment Status'}
                </Button>
              </div>
            )}
            
            <p className="text-gray-500 text-xs sm:text-sm">
              Please do not refresh this page. You will be redirected automatically once payment is confirmed.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Success Header */}
          <Card className="mb-6 border-green-200 bg-green-50">
            <CardContent className="text-center p-8">
              <CheckCircle className="h-20 w-20 text-green-500 mx-auto mb-4" />
              <h1 className="text-3xl font-bold text-green-600 mb-2">
                Payment Successful! 🎉
              </h1>
              <p className="text-gray-700 text-lg">
                Your booking for Telugu Night has been confirmed!
              </p>
              <div className="mt-4 bg-green-100 border border-green-300 rounded-lg p-3 inline-block">
                <p className="text-green-800 font-medium">
                  Booking ID: #{booking.id}
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
                        <p className="font-medium">QR Tickets Generated!</p>
                      </div>
                      <p className="text-gray-600 text-sm mb-4">
                        Your QR tickets have been sent to <strong>{booking.email}</strong>
                      </p>
                      
                      {/* QR Code Display */}
                      {booking.qrCodes && Array.isArray(booking.qrCodes) && booking.qrCodes.length > 0 && (
                        <div className="mb-4">
                          <h4 className="font-medium text-gray-700 mb-3">Your QR Ticket:</h4>
                          <div className="bg-white p-3 sm:p-4 rounded-lg border-2 border-gray-200 inline-block w-full max-w-xs mx-auto">
                            <img 
                              src={booking.qrCodes[0]} 
                              alt="QR Ticket"
                              className="w-40 h-40 sm:w-48 sm:h-48 mx-auto"
                              data-testid="qr-code-image"
                            />
                            <p className="text-center text-xs sm:text-sm text-gray-600 mt-2 font-mono">
                              Booking ID: #{booking.id}
                            </p>
                          </div>
                        </div>
                      )}
                      
                      {/* Action Buttons */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {booking.qrCodes && Array.isArray(booking.qrCodes) && booking.qrCodes.length > 0 && (
                          <Button 
                            onClick={() => downloadQRCode(booking.qrCodes[0], `telugu-night-ticket-${booking.id}.png`)}
                            variant="default"
                            className="w-full"
                            data-testid="button-download-qr"
                          >
                            <FileDown className="h-4 w-4 mr-2" />
                            Download Ticket
                          </Button>
                        )}
                        {booking.qrCodes && Array.isArray(booking.qrCodes) && booking.qrCodes.length > 1 && (
                          <Button 
                            onClick={downloadAllTickets}
                            variant="secondary"
                            className="w-full"
                            data-testid="button-download-all"
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Download All ({booking.qrCodes.length})
                          </Button>
                        )}
                        <Button 
                          onClick={shareTicket}
                          variant="outline"
                          className="w-full"
                          data-testid="button-share"
                        >
                          <Share2 className="h-4 w-4 mr-2" />
                          Share
                        </Button>
                        <Button 
                          onClick={() => sendTicketsMutation.mutate()}
                          disabled={sendTicketsMutation.isPending}
                          variant="outline"
                          className="w-full"
                          data-testid="button-resend-tickets"
                        >
                          {sendTicketsMutation.isPending ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4 mr-2" />
                          )}
                          Resend Email
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-blue-600 mb-2">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <p className="font-medium">Generating QR Tickets...</p>
                      </div>
                      <p className="text-gray-600 text-sm">
                        Your QR tickets are being generated and will be sent to your email shortly.
                      </p>
                      {sendTicketsMutation.isPending && (
                        <p className="text-blue-600 text-sm mt-2 font-medium">
                          Sending tickets now...
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-yellow-600 mb-2">
                    <Clock className="h-5 w-5" />
                    <p className="font-medium">Payment Processing...</p>
                  </div>
                  <p className="text-gray-600 text-sm">
                    Your payment is being processed. QR tickets will be sent once payment is confirmed.
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
              <p>📧 <strong>Check your email:</strong> Your QR tickets will be sent to {booking.email}</p>
              <p>📱 <strong>Save your tickets:</strong> Download and save the QR tickets to your phone</p>
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