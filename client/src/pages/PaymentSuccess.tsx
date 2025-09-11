import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, Clock } from 'lucide-react';

export default function PaymentSuccess() {
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(6);

  // Extract booking ID from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const booking = params.get('booking');
    if (booking) {
      setBookingId(booking);
    }
  }, []);

  // Auto-close countdown and page close
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Close the tab/window after countdown reaches 0
          window.close();
          // If window.close() doesn't work (blocked by browser), redirect to home
          setTimeout(() => {
            window.location.href = '/';
          }, 500);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center px-4" data-testid="page-payment-success">
      <Card className="max-w-md w-full border-green-200 bg-green-50">
        <CardContent className="text-center p-8">
          <CheckCircle className="h-20 w-20 text-green-500 mx-auto mb-6" data-testid="icon-success" />
          
          <h1 className="text-3xl font-bold text-green-600 mb-4" data-testid="text-success-title">
            Payment Received! 🎉
          </h1>
          
          <p className="text-gray-700 text-lg mb-6" data-testid="text-success-message">
            We will send your tickets to your email shortly.
          </p>

          {bookingId && (
            <div className="mb-6 bg-green-100 border border-green-300 rounded-lg p-3 inline-block">
              <p className="text-green-800 font-medium" data-testid="text-booking-id">
                Booking ID: #{bookingId}
              </p>
            </div>
          )}

          <div className="flex items-center justify-center gap-2 text-gray-600">
            <Clock className="h-4 w-4" />
            <p className="text-sm" data-testid="text-countdown">
              This page will close in {countdown} seconds
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}