import { useState } from "react";
import { TicketBookingForm } from "@/components/TicketBookingForm";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const Index = () => {
  const [showBookingForm, setShowBookingForm] = useState(false);


  const LandingPage = () => (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center space-y-8">
          <h1 className="text-6xl font-bold bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
            Telugu Night 2.0
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Experience the ultimate Telugu DJ night at DTR, Manipal! 
            Join us for an unforgettable evening of music, dance, and celebration.
          </p>
          
          <div className="grid md:grid-cols-3 gap-8 mt-16">
            <Card className="bg-white/10 border-white/20 backdrop-blur-sm">
              <CardContent className="p-6 text-center">
                <div className="text-4xl mb-4">🎵</div>
                <h3 className="text-xl font-bold mb-2">DJ Night</h3>
                <p className="text-gray-300">Telugu hits all night long</p>
              </CardContent>
            </Card>
            
            <Card className="bg-white/10 border-white/20 backdrop-blur-sm">
              <CardContent className="p-6 text-center">
                <div className="text-4xl mb-4">🍽️</div>
                <h3 className="text-xl font-bold mb-2">Food Included</h3>
                <p className="text-gray-300">₹200 food coupon included</p>
              </CardContent>
            </Card>
            
            <Card className="bg-white/10 border-white/20 backdrop-blur-sm">
              <CardContent className="p-6 text-center">
                <div className="text-4xl mb-4">🎫</div>
                <h3 className="text-xl font-bold mb-2">QR Tickets</h3>
                <p className="text-gray-300">Digital tickets via email</p>
              </CardContent>
            </Card>
          </div>
          
          <div className="mt-16">
            <Button 
              onClick={() => setShowBookingForm(true)}
              className="bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700 text-black px-12 py-6 text-xl font-bold rounded-full shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
            >
              🎫 Book Tickets Now - ₹300
            </Button>
          </div>
        </div>
      </div>
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
