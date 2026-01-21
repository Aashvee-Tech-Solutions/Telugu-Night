import { useState } from "react";
import { TicketBookingForm } from "@/components/TicketBookingForm";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { usePricing } from "@/hooks/usePricing";

const Index = () => {
  const [showBookingForm, setShowBookingForm] = useState(false);
  const { currentTier, isLoading: pricingLoading, formatCurrency } = usePricing();


  const LandingPage = () => (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white relative">
      {/* Floating Book Now Button */}
      <a 
        href="/book"
        className="fixed bottom-6 right-6 z-50 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black font-bold py-4 px-8 rounded-full shadow-2xl transform hover:scale-105 transition-all duration-300 animate-pulse hover:animate-none flex items-center gap-2"
        style={{ boxShadow: '0 0 20px rgba(234, 179, 8, 0.5)' }}
      >
        <span className="text-lg">🎟️</span>
        <span className="text-lg">Book Now</span>
      </a>
      
      {/* Embedded iframe */}
      <div className="w-full h-screen">
        <iframe
          src="https://landing-page-telugu-night.vercel.app/"
          className="w-full h-full border-0"
          title="Telugu Night Landing Page"
          data-testid="iframe-landing"
        />
      </div>
      
      {/* Footer */}
      <footer className="bg-slate-800 dark:bg-slate-900 text-white py-12 px-4 border-t-4 border-yellow-500 shadow-2xl">
        <div className="max-w-6xl mx-auto text-center">
          <h3 className="text-2xl md:text-3xl font-bold mb-6 text-white">Telugu Night 3.0</h3>
          <p className="text-base md:text-lg text-slate-200 mb-8">Experience the ultimate Telugu DJ night at HI-point Lounge (SOHO)</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8 text-sm mb-8">
            <div className="p-4 bg-slate-700/50 dark:bg-slate-800/50 rounded-lg shadow-md border border-slate-600">
              <p className="font-bold text-yellow-400 text-base mb-2">📍 Venue</p>
              <p className="text-slate-200 text-sm">HI-point Lounge (SOHO)</p>
            </div>
            <div className="p-4 bg-slate-700/50 dark:bg-slate-800/50 rounded-lg shadow-md border border-slate-600">
              <p className="font-bold text-yellow-400 text-base mb-2">📅 Date</p>
              <p className="text-slate-200 text-sm">January 25, 2026</p>
            </div>
            <div className="p-4 bg-slate-700/50 dark:bg-slate-800/50 rounded-lg shadow-md border border-slate-600">
              <p className="font-bold text-yellow-400 text-base mb-2">🕐 Time</p>
              <p className="text-slate-200 text-sm">7:00 PM onwards</p>
            </div>
            <div className="p-4 bg-slate-700/50 dark:bg-slate-800/50 rounded-lg shadow-md border border-slate-600">
              <p className="font-bold text-yellow-400 text-base mb-2">💰 Price</p>
              <p className="text-slate-200 text-sm">
                {pricingLoading ? (
                  'Loading...'
                ) : currentTier ? (
                  <>
                    ₹{currentTier.price} <span className="text-yellow-300">({currentTier.name})</span>
                  </>
                ) : (
                  'Price unavailable'
                )}
              </p>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t-2 border-slate-600">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-6">
              <a 
                href="/terms-and-conditions" 
                className="text-sm text-slate-300 hover:text-yellow-400 transition-colors underline font-medium"
                data-testid="link-terms-conditions"
              >
                Terms & Conditions
              </a>
              <span className="hidden sm:inline text-slate-400 text-lg">|</span>
              <a 
                href="/privacy-policy" 
                className="text-sm text-slate-300 hover:text-yellow-400 transition-colors underline font-medium"
                data-testid="link-privacy-policy"
              >
                Privacy Policy
              </a>
            </div>
            <p className="text-sm text-slate-300 text-center leading-relaxed">
              © 2024 <strong className="text-white">telugunight.manipal.app</strong> - Designed and Developed by <strong className="text-yellow-400">Aashvee Tech Solutions Pvt Ltd</strong>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );

  if (showBookingForm) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Button 
          onClick={() => setShowBookingForm(false)}
          variant="outline"
          className="mb-4"
        >
          ← Back to Event Page
        </Button>
        <TicketBookingForm 
          onBack={() => setShowBookingForm(false)}
          eventDetails={{
            title: "Telugu Night 3.0",
            price: 300
          }}
        />
      </div>
    );
  }

  // Using the native Telugu Night landing page
  return <LandingPage />;
};

export default Index;
