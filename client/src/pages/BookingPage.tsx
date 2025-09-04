import React, { useEffect, useState } from 'react';
import { TicketBookingForm } from '@/components/TicketBookingForm';

export default function BookingPage() {
  const [referralCode, setReferralCode] = useState<string>('');

  useEffect(() => {
    // Extract referral code from URL parameters
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) {
      setReferralCode(ref.toUpperCase());
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
            Telugu Night
          </h1>
          <p className="text-xl text-blue-100">
            Book Your Tickets Now!
          </p>
          {referralCode && (
            <div className="mt-4 bg-green-600/20 border border-green-400 rounded-lg p-3 inline-block">
              <p className="text-green-300 text-sm">
                🎯 Referral Code Applied: <span className="font-bold">{referralCode}</span>
              </p>
            </div>
          )}
        </div>

        {/* Booking Form */}
        <TicketBookingForm 
          referralCode={referralCode} 
          eventDetails={{
            title: "Telugu Night",
            price: 300
          }}
        />
      </div>
    </div>
  );
}