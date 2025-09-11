import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, Clock, XCircle, Loader2, Mail, AlertCircle } from 'lucide-react';

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

  // Fetch booking status from API
  const { data: bookingStatus, isLoading, error } = useQuery({
    queryKey: ['/api/bookings', bookingId, 'check-status'],
    queryFn: async () => {
      if (!bookingId) return null;
      const response = await fetch(`/api/bookings/${bookingId}/check-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch booking status');
      }
      return response.json();
    },
    enabled: !!bookingId,
    refetchInterval: 5000, // Refetch every 5 seconds
    retry: 3
  });

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

  // Get payment status from booking data
  const paymentStatus = bookingStatus?.status || bookingStatus?.paymentStatus;
  const isVerified = paymentStatus === 'verified' || paymentStatus === 'paid';
  const isFailed = paymentStatus === 'failed';
  const isPending = paymentStatus === 'pending';

  // Determine styling based on status
  const getStatusStyles = () => {
    if (isLoading || isPending) {
      return {
        background: 'from-blue-50 to-sky-100',
        cardBg: 'bg-blue-50',
        cardBorder: 'border-blue-200',
        iconColor: 'text-blue-500',
        titleColor: 'text-blue-600',
        badgeBg: 'bg-blue-100',
        badgeBorder: 'border-blue-300',
        badgeText: 'text-blue-800'
      };
    } else if (isFailed) {
      return {
        background: 'from-red-50 to-rose-100',
        cardBg: 'bg-red-50',
        cardBorder: 'border-red-200',
        iconColor: 'text-red-500',
        titleColor: 'text-red-600',
        badgeBg: 'bg-red-100',
        badgeBorder: 'border-red-300',
        badgeText: 'text-red-800'
      };
    } else {
      // Verified or default
      return {
        background: 'from-green-50 to-emerald-100',
        cardBg: 'bg-green-50',
        cardBorder: 'border-green-200',
        iconColor: 'text-green-500',
        titleColor: 'text-green-600',
        badgeBg: 'bg-green-100',
        badgeBorder: 'border-green-300',
        badgeText: 'text-green-800'
      };
    }
  };

  const styles = getStatusStyles();

  // Get appropriate icon
  const getStatusIcon = () => {
    if (isLoading) {
      return <Loader2 className={`h-20 w-20 ${styles.iconColor} mx-auto mb-6 animate-spin`} data-testid="icon-loading" />;
    } else if (isFailed) {
      return <XCircle className={`h-20 w-20 ${styles.iconColor} mx-auto mb-6`} data-testid="icon-failed" />;
    } else {
      return <CheckCircle className={`h-20 w-20 ${styles.iconColor} mx-auto mb-6`} data-testid="icon-success" />;
    }
  };

  // Get appropriate title and message
  const getStatusContent = () => {
    if (isLoading) {
      return {
        title: 'Checking Payment Status...',
        message: 'Please wait while we verify your payment.'
      };
    } else if (error) {
      return {
        title: 'Unable to Check Status',
        message: 'We could not verify your payment status. Please contact support if needed.'
      };
    } else if (isFailed) {
      return {
        title: 'Payment Rejected',
        message: 'Payment is rejected. We will send you a notification email shortly.'
      };
    } else if (isPending) {
      return {
        title: 'Payment Processing...',
        message: 'Your payment is being processed. We will update you shortly.'
      };
    } else {
      return {
        title: 'Payment Received! 🎉',
        message: 'We will send your tickets to your email shortly.'
      };
    }
  };

  const content = getStatusContent();

  // Get email alert content based on status
  const getEmailAlertContent = () => {
    if (isLoading) {
      return {
        message: "📧 We'll send updates to your email",
        subMessage: "Please keep checking your inbox for payment status updates",
        alertBg: "bg-blue-600",
        alertBorder: "border-blue-500",
        alertText: "text-white"
      };
    } else if (isFailed) {
      return {
        message: "📧 CHECK YOUR EMAIL!",
        subMessage: "Payment failed - we've sent you a detailed notification email",
        alertBg: "bg-red-600",
        alertBorder: "border-red-500",
        alertText: "text-white"
      };
    } else if (isPending) {
      return {
        message: "📧 CHECK YOUR EMAIL!",
        subMessage: "We'll send payment confirmation and tickets to your email shortly",
        alertBg: "bg-orange-600",
        alertBorder: "border-orange-500",
        alertText: "text-white"
      };
    } else {
      // Verified or success
      return {
        message: "📧 CHECK YOUR EMAIL!",
        subMessage: "Your tickets have been sent to your email address",
        alertBg: "bg-green-600",
        alertBorder: "border-green-500",
        alertText: "text-white"
      };
    }
  };

  const emailAlert = getEmailAlertContent();

  return (
    <div className={`min-h-screen bg-gradient-to-br ${styles.background} flex flex-col items-center justify-center px-4 py-8`} data-testid="page-payment-success">
      {/* Prominent Email Alert Box */}
      <div className={`w-full max-w-lg mb-6 ${emailAlert.alertBg} ${emailAlert.alertBorder} border-2 rounded-xl shadow-2xl transform hover:scale-105 transition-transform duration-200`} data-testid="alert-check-email">
        <div className="p-6 text-center">
          <div className="flex items-center justify-center mb-4">
            <Mail className={`h-12 w-12 ${emailAlert.alertText} animate-bounce`} />
            <AlertCircle className={`h-8 w-8 ${emailAlert.alertText} ml-2 animate-pulse`} />
          </div>
          <h2 className={`text-2xl font-bold ${emailAlert.alertText} mb-2 uppercase tracking-wide`} data-testid="text-email-alert-title">
            {emailAlert.message}
          </h2>
          <p className={`text-lg ${emailAlert.alertText} opacity-90`} data-testid="text-email-alert-message">
            {emailAlert.subMessage}
          </p>
        </div>
      </div>

      <Card className={`max-w-md w-full ${styles.cardBorder} ${styles.cardBg}`}>
        <CardContent className="text-center p-8">
          {getStatusIcon()}
          
          <h1 className={`text-3xl font-bold ${styles.titleColor} mb-4`} data-testid="text-status-title">
            {content.title}
          </h1>
          
          <p className="text-gray-700 text-lg mb-6" data-testid="text-status-message">
            {content.message}
          </p>

          {bookingId && (
            <div className={`mb-6 ${styles.badgeBg} ${styles.badgeBorder} border rounded-lg p-3 inline-block`}>
              <p className={`${styles.badgeText} font-medium`} data-testid="text-booking-id">
                Booking ID: #{bookingId}
              </p>
            </div>
          )}

          {error && (
            <div className="mb-6 bg-yellow-100 border border-yellow-300 rounded-lg p-3">
              <p className="text-yellow-800 text-sm" data-testid="text-error">
                Error: {error.message}
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