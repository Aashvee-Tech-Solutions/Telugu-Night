import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, Mail, Clock, ArrowRight } from 'lucide-react';

export default function PaymentSuccess() {
  const [bookingId, setBookingId] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(7);

  // Extract booking ID from URL
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

  // Auto-redirect countdown and redirect
  useEffect(() => {
    if (!bookingId) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // Redirect to home page
          console.log('🏠 PaymentSuccess: Auto-redirecting to home page');
          window.location.href = '/';
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [bookingId]);

  // Handle invalid booking ID
  if (!bookingId) {
    console.error('❌ PaymentSuccess: No booking ID provided');
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center px-4" data-testid="page-invalid-link">
        <Card className="max-w-md w-full">
          <CardContent className="text-center p-8">
            <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <ArrowRight className="h-8 w-8 text-red-500" data-testid="icon-error" />
            </div>
            <h2 className="text-2xl font-bold text-red-600 mb-2" data-testid="text-error-title">Invalid Payment Link</h2>
            <p className="text-gray-600 mb-6" data-testid="text-error-description">
              The payment link is missing booking information. You'll be redirected to the home page.
            </p>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700">
                Redirecting in {timeLeft} seconds...
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-100 flex items-center justify-center px-4" data-testid="page-processing">
      <Card className="max-w-lg w-full">
        <CardContent className="text-center p-8 sm:p-10">
          {/* Success Icon */}
          <div className="relative mb-6">
            <div className="h-20 w-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-12 w-12 text-green-500" data-testid="icon-success" />
            </div>
            <div className="absolute -top-2 -right-2 h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
              <Clock className="h-5 w-5 text-blue-500 animate-pulse" />
            </div>
          </div>

          {/* Main Message */}
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-3" data-testid="text-main-title">
            🎉 Payment Submitted Successfully!
          </h1>
          
          <p className="text-lg text-gray-700 mb-6" data-testid="text-main-description">
            Your payment for Telugu Night has been submitted and is being processed.
          </p>

          {/* Booking ID */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-blue-800 font-medium" data-testid="text-booking-id">
              Booking ID: #{bookingId}
            </p>
          </div>

          {/* Email Notification Info */}
          <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-6 mb-6">
            <div className="flex items-center justify-center gap-3 mb-3">
              <Mail className="h-6 w-6 text-green-600" data-testid="icon-email" />
              <h3 className="text-lg font-semibold text-green-800">We'll Update You Shortly</h3>
            </div>
            <div className="space-y-2 text-sm text-gray-700">
              <p data-testid="text-email-notification">
                ✅ <strong>Payment successful?</strong> You'll receive QR tickets via email within 2-3 minutes
              </p>
              <p data-testid="text-email-notification-failed">
                ❌ <strong>Payment failed?</strong> You'll receive a failure notification with next steps
              </p>
              <p className="text-green-700 font-medium mt-3" data-testid="text-email-promise">
                📧 Check your email inbox for the update!
              </p>
            </div>
          </div>

          {/* Auto-redirect Message */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p className="text-gray-600 text-sm" data-testid="text-redirect-info">
              This page will automatically close in <span className="font-bold text-blue-600">{timeLeft}</span> seconds
            </p>
            <p className="text-gray-500 text-xs mt-1">
              You can safely close this page now
            </p>
          </div>

          {/* Important Note */}
          <div className="mt-6 text-left bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="font-semibold text-yellow-800 mb-2">📋 Important:</h4>
            <ul className="text-sm text-yellow-700 space-y-1">
              <li>• Keep your Booking ID: #{bookingId}</li>
              <li>• Check email (including spam folder)</li>
              <li>• Contact support if no email within 10 minutes</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}