import { useState } from "react";
import { TicketBookingForm } from "@/components/TicketBookingForm";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const Index = () => {
  const [showBookingForm, setShowBookingForm] = useState(false);


  const LandingPage = () => (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white">
      {/* Embedded iframe */}
      <div className="w-full h-screen">
        <iframe
          src="https://v0-telugunightlanding3k.vercel.app/"
          className="w-full h-full border-0"
          title="Telugu Night Landing Page"
          data-testid="iframe-landing"
        />
      </div>
      
      {/* Footer */}
      <footer className="bg-slate-800 dark:bg-slate-900 text-white py-12 px-4 border-t-4 border-yellow-500 shadow-2xl">
        <div className="max-w-6xl mx-auto text-center">
          <h3 className="text-2xl md:text-3xl font-bold mb-6 text-white">Telugu Night 2.0</h3>
          <p className="text-base md:text-lg text-slate-200 mb-8">Experience the ultimate Telugu DJ night at DTR, Manipal</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8 text-sm mb-8">
            <div className="p-4 bg-slate-700/50 dark:bg-slate-800/50 rounded-lg shadow-md border border-slate-600">
              <p className="font-bold text-yellow-400 text-base mb-2">📍 Venue</p>
              <p className="text-slate-200 text-sm">DTR, Down to Road Manipal</p>
            </div>
            <div className="p-4 bg-slate-700/50 dark:bg-slate-800/50 rounded-lg shadow-md border border-slate-600">
              <p className="font-bold text-yellow-400 text-base mb-2">📅 Date</p>
              <p className="text-slate-200 text-sm">September 19, 2025</p>
            </div>
            <div className="p-4 bg-slate-700/50 dark:bg-slate-800/50 rounded-lg shadow-md border border-slate-600">
              <p className="font-bold text-yellow-400 text-base mb-2">🕐 Time</p>
              <p className="text-slate-200 text-sm">7:00 PM - 11:00 PM</p>
            </div>
            <div className="p-4 bg-slate-700/50 dark:bg-slate-800/50 rounded-lg shadow-md border border-slate-600">
              <p className="font-bold text-yellow-400 text-base mb-2">💰 Price</p>
              <p className="text-slate-200 text-sm">₹300 (₹200 Food Coupon + ₹100)</p>
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
            title: "Telugu Night 2.0",
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
