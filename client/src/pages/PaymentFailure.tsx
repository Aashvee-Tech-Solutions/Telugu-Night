import { useEffect, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { XCircle, AlertTriangle, RotateCcw, Home } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Booking } from '../../../shared/schema';

export default function PaymentFailure() {
  const { toast } = useToast();
  const [bookingId, setBookingId] = useState<number | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [redirectMessage, setRedirectMessage] = useState('');

  // Extract booking ID from URL with enhanced validation
  useEffect(() => {
    console.log('🔍 PaymentFailure: Extracting booking ID from URL:', window.location.search);
    const params = new URLSearchParams(window.location.search);
    const booking = params.get('booking');
    
    if (booking) {
      const parsedId = parseInt(booking);
      if (!isNaN(parsedId) && parsedId > 0) {
        console.log('✅ PaymentFailure: Valid booking ID extracted:', parsedId);
        setBookingId(parsedId);
      } else {
        console.error('❌ PaymentFailure: Invalid booking ID format:', booking);
      }
    } else {
      console.error('❌ PaymentFailure: No booking parameter found in URL');
    }
  }, []);

  // Fetch booking details with enhanced error handling
  const { data: booking, isLoading, error } = useQuery<Booking>({
    queryKey: [`/api/bookings/${bookingId}`],
    enabled: !!bookingId,
    retry: 1
  });

  // Add logging for booking data fetch
  useEffect(() => {
    if (error) {
      console.error('❌ PaymentFailure: Failed to fetch booking:', error);
    }
    if (booking) {
      console.log('✅ PaymentFailure: Booking data fetched:', booking.id, 'Status:', booking.paymentStatus);
    }
  }, [booking, error]);

  // Delete failed booking mutation
  const deleteBookingMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('DELETE', `/api/public/bookings/${bookingId}/delete-failed`);
    },
    onSuccess: () => {
      toast({
        title: "Booking Cancelled",
        description: "Your failed booking has been removed. You can try booking again.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to cancel booking.",
        variant: "destructive",
      });
    },
  });

  const handleRetryPayment = () => {
    console.log('🔄 PaymentFailure: Starting retry payment process for booking:', bookingId);
    // Delete the failed booking and redirect to home for new booking
    deleteBookingMutation.mutate();
    setIsRedirecting(true);
    setRedirectMessage('Cancelling failed booking and redirecting to home...');
    setTimeout(() => {
      window.location.href = '/';
    }, 2000);
  };

  const handleHomeRedirect = () => {
    console.log('🏠 PaymentFailure: Redirecting to home page');
    setIsRedirecting(true);
    setRedirectMessage('Returning to home page...');
    setTimeout(() => {
      window.location.href = '/';
    }, 1000);
  };

  // Show redirecting state
  if (isRedirecting) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4" data-testid="page-redirecting">
        <Card className="max-w-md w-full">
          <CardContent className="text-center p-6 sm:p-8">
            <RotateCcw className="h-12 w-12 sm:h-16 sm:w-16 text-blue-500 mx-auto mb-4 animate-spin" data-testid="spinner-redirect" />
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2" data-testid="text-redirect-title">Processing...</h2>
            <p className="text-gray-600 text-sm sm:text-base" data-testid="text-redirect-message">{redirectMessage}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!bookingId) {
    console.error('❌ PaymentFailure: No booking ID provided');
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center px-4" data-testid="page-invalid-link">
        <Card className="max-w-md w-full">
          <CardContent className="text-center p-6 sm:p-8">
            <AlertTriangle className="h-12 w-12 sm:h-16 sm:w-16 text-red-500 mx-auto mb-4" data-testid="icon-error" />
            <h2 className="text-xl sm:text-2xl font-bold text-red-600 mb-2" data-testid="text-error-title">Invalid Payment Link</h2>
            <p className="text-gray-600 mb-6 text-sm sm:text-base" data-testid="text-error-description">The payment link is missing booking information.</p>
            <Button onClick={handleHomeRedirect} className="w-full sm:w-auto" data-testid="button-home">
              Return to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    console.log('⏳ PaymentFailure: Loading booking data for ID:', bookingId);
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center px-4" data-testid="page-loading">
        <Card className="max-w-md w-full">
          <CardContent className="text-center p-6 sm:p-8">
            <AlertTriangle className="h-12 w-12 sm:h-16 sm:w-16 text-red-500 mx-auto mb-4 animate-pulse" data-testid="spinner-loading" />
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2" data-testid="text-loading-title">Loading Payment Details...</h2>
            <p className="text-gray-600 text-sm sm:text-base" data-testid="text-loading-description">Please wait while we fetch your payment information.</p>
            <p className="text-sm text-gray-500 mt-2" data-testid="text-booking-id">Booking ID: #{bookingId}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !booking) {
    console.error('❌ PaymentFailure: Booking not found or error occurred:', error);
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center px-4" data-testid="page-error">
        <Card className="max-w-md w-full">
          <CardContent className="text-center p-6 sm:p-8">
            <XCircle className="h-12 w-12 sm:h-16 sm:w-16 text-red-500 mx-auto mb-4" data-testid="icon-error" />
            <h2 className="text-xl sm:text-2xl font-bold text-red-600 mb-2" data-testid="text-error-title">Booking Not Found</h2>
            <p className="text-gray-600 mb-6 text-sm sm:text-base" data-testid="text-error-description">We couldn't find your booking details. Please contact support.</p>
            <p className="text-sm text-gray-500 mb-4" data-testid="text-booking-id">Booking ID: #{bookingId}</p>
            <Button onClick={handleHomeRedirect} className="w-full sm:w-auto" data-testid="button-home">
              Return to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Failure Header */}
          <Card className="mb-6 border-red-200 bg-red-50" data-testid="card-failure-header">
            <CardContent className="text-center p-8">
              <XCircle className="h-20 w-20 text-red-500 mx-auto mb-4" data-testid="icon-failure" />
              <h1 className="text-3xl font-bold text-red-600 mb-2" data-testid="text-failure-title">
                Payment Failed ❌
              </h1>
              <p className="text-gray-700 text-lg" data-testid="text-failure-description">
                Unfortunately, your payment could not be processed.
              </p>
              {booking && (
                <div className="mt-4 bg-red-100 border border-red-300 rounded-lg p-3 inline-block" data-testid="container-booking-id">
                  <p className="text-red-800 font-medium" data-testid="text-booking-id">
                    Booking ID: #{booking.id}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Booking Details (if available) */}
          {booking && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-600">
                  <AlertTriangle className="h-5 w-5" />
                  Failed Booking Details
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
                    <p className="font-medium text-gray-600">Tickets</p>
                    <p className="text-lg">{booking.ticketCount}</p>
                  </div>
                  <div>
                    <p className="font-medium text-gray-600">Amount</p>
                    <p className="text-lg text-red-600 font-bold">₹{booking.totalAmount}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Failure Reasons */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Common Reasons for Payment Failure</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-700">
              <p>• <strong>Insufficient funds:</strong> Your account may not have enough balance</p>
              <p>• <strong>Network issues:</strong> Poor internet connection during payment</p>
              <p>• <strong>Bank restrictions:</strong> Your bank may have declined the transaction</p>
              <p>• <strong>Card issues:</strong> Expired card or incorrect details</p>
              <p>• <strong>Payment timeout:</strong> Transaction took too long to complete</p>
            </CardContent>
          </Card>

          {/* Action Options */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>What would you like to do?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-800 mb-2">Option 1: Try Booking Again</h4>
                <p className="text-sm text-gray-600 mb-3">
                  We'll cancel this failed booking and you can create a new one with the same details.
                </p>
                <Button 
                  onClick={handleRetryPayment}
                  disabled={deleteBookingMutation.isPending || isRedirecting}
                  className="bg-blue-600 hover:bg-blue-700"
                  data-testid="button-retry-payment"
                >
                  {deleteBookingMutation.isPending || isRedirecting ? (
                    <>
                      <RotateCcw className="h-4 w-4 mr-2 animate-spin" />
                      {isRedirecting ? 'Redirecting...' : 'Cancelling...'}
                    </>
                  ) : (
                    <>
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Cancel & Try Again
                    </>
                  )}
                </Button>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-800 mb-2">Option 2: Return to Home</h4>
                <p className="text-sm text-gray-600 mb-3">
                  Go back to the main page without making any changes.
                </p>
                <Button 
                  onClick={handleHomeRedirect}
                  variant="outline"
                  disabled={isRedirecting}
                  data-testid="button-home"
                >
                  <Home className="h-4 w-4 mr-2" />
                  Return to Home
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Support Information */}
          <Card>
            <CardHeader>
              <CardTitle>Need Help?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-gray-600">
              <p>📧 <strong>Email Support:</strong> mis@aashveetech.com</p>
              <p>📞 <strong>Phone Support:</strong> +91 6281614117</p>
              <p>💬 <strong>What to include:</strong> Your booking ID #{booking?.id} and payment details</p>
              <p>⏰ <strong>Response Time:</strong> We typically respond within 2-4 hours</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}