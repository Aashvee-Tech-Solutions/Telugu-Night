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
    retry: 1, // Don't retry too much for failed payments
  });

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
    // Delete the failed booking and redirect to home for new booking
    deleteBookingMutation.mutate();
    setTimeout(() => {
      window.location.href = '/';
    }, 2000);
  };

  if (!bookingId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="text-center p-8">
            <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Failure Header */}
          <Card className="mb-6 border-red-200 bg-red-50">
            <CardContent className="text-center p-8">
              <XCircle className="h-20 w-20 text-red-500 mx-auto mb-4" />
              <h1 className="text-3xl font-bold text-red-600 mb-2">
                Payment Failed ❌
              </h1>
              <p className="text-gray-700 text-lg">
                Unfortunately, your payment could not be processed.
              </p>
              {booking && (
                <div className="mt-4 bg-red-100 border border-red-300 rounded-lg p-3 inline-block">
                  <p className="text-red-800 font-medium">
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
                  disabled={deleteBookingMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {deleteBookingMutation.isPending ? (
                    <>
                      <RotateCcw className="h-4 w-4 mr-2 animate-spin" />
                      Cancelling...
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
                  onClick={() => window.location.href = '/'}
                  variant="outline"
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