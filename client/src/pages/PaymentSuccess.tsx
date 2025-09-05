import { useEffect, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Download, Calendar, MapPin, Clock, Users, AlertCircle, Loader2 } from 'lucide-react';
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

  // Fetch booking details
  const { data: booking, isLoading, error } = useQuery<Booking>({
    queryKey: [`/api/bookings/${bookingId}`],
    enabled: !!bookingId,
    retry: 3,
    retryDelay: 1000,
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

  // Automatically send tickets when booking is loaded and verified
  useEffect(() => {
    if (booking && booking.paymentStatus === 'verified') {
      // Check if QR codes don't exist or tickets haven't been sent
      if (!booking.qrCodes || booking.qrCodes.length === 0) {
        sendTicketsMutation.mutate();
      }
    }
  }, [booking]);

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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="text-center p-8">
            <Loader2 className="h-16 w-16 text-blue-500 mx-auto mb-4 animate-spin" />
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Processing Payment...</h2>
            <p className="text-gray-600">Please wait while we confirm your payment and generate your tickets.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="text-center p-8">
            <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-red-600 mb-2">Booking Not Found</h2>
            <p className="text-gray-600 mb-6">We couldn't find your booking. Please contact support.</p>
            <Button onClick={() => window.location.href = '/'}>
              Return to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isPaymentVerified = booking.paymentStatus === 'verified';
  const hasTickets = booking.qrCodes && booking.qrCodes.length > 0;

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
                    <p className="text-sm text-gray-600">December 15, 2024</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-purple-500" />
                  <div>
                    <p className="font-medium">Time</p>
                    <p className="text-sm text-gray-600">8:00 PM - 2:00 AM</p>
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
                      <div className="flex gap-3">
                        <Button 
                          onClick={() => sendTicketsMutation.mutate()}
                          disabled={sendTicketsMutation.isPending}
                          variant="outline"
                        >
                          {sendTicketsMutation.isPending ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4 mr-2" />
                          )}
                          Resend Tickets
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