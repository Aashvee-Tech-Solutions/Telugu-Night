import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, MapPin, Users, Ticket, Clock, Star } from "lucide-react";
import { TicketBookingForm } from "./TicketBookingForm";
import eventHero from "@/assets/event-hero.jpg";

export const EventLanding = () => {
  const [showBookingForm, setShowBookingForm] = useState(false);

  const eventDetails = {
    title: "Telugu Night 2.0",
    date: "September 19, 2025",
    time: "7:00 PM - 11:00 PM",
    venue: "DTR, Down to Road Manipal",
    price: 300,
    totalTickets: 500,
    soldTickets: 324,
    description: "Join us for an amazing Telugu Night 2.0 DJ experience filled with vibrant Telugu songs, dance, and joy at DTR, Down to Road Manipal!"
  };

  const features = [
    { icon: Calendar, title: "Full Day Event", desc: "8 hours of content" },
    { icon: Users, title: "Expert Speakers", desc: "Industry leaders" },
    { icon: MapPin, title: "Prime Location", desc: "Easy to reach" },
    { icon: Star, title: "Networking", desc: "Connect with peers" }
  ];

  if (showBookingForm) {
    return <TicketBookingForm onBack={() => setShowBookingForm(false)} eventDetails={eventDetails} />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        <div 
          className="absolute inset-0 z-0"
          style={{
            backgroundImage: `url(${eventHero})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <div className="absolute inset-0 bg-gradient-hero"></div>
        </div>
        
        <div className="relative z-10 text-center max-w-4xl mx-auto px-6">
          <h1 className="text-5xl md:text-7xl font-bold mb-6 text-white animate-fade-in">
            {eventDetails.title}
          </h1>
          <p className="text-xl md:text-2xl text-foreground/80 mb-8 animate-slide-up">
            {eventDetails.description}
          </p>
          <Button 
            variant="gradient" 
            size="lg" 
            className="text-lg px-8 py-6 animate-slide-up"
            onClick={() => setShowBookingForm(true)}
          >
            <Ticket className="mr-2" />
            Book Your Tickets
          </Button>
        </div>
      </section>

      {/* Event Details */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <Card className="bg-gradient-card border-border/50 shadow-card mb-12">
            <CardHeader>
              <CardTitle className="text-3xl text-center mb-8">Event Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                <div className="flex items-center gap-4">
                  <Calendar className="h-8 w-8 text-primary" />
                  <div>
                    <h3 className="font-semibold">Date</h3>
                    <p className="text-muted-foreground">{eventDetails.date}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Clock className="h-8 w-8 text-primary" />
                  <div>
                    <h3 className="font-semibold">Time</h3>
                    <p className="text-muted-foreground">{eventDetails.time}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <MapPin className="h-8 w-8 text-primary" />
                  <div>
                    <h3 className="font-semibold">Venue</h3>
                    <p className="text-muted-foreground">{eventDetails.venue}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Ticket className="h-8 w-8 text-primary" />
                  <div>
                    <h3 className="font-semibold">Price</h3>
                    <p className="text-muted-foreground">₹{eventDetails.price}</p>
                    <p className="text-xs text-muted-foreground">₹200 Food Coupon + ₹100</p>
                  </div>
                </div>
              </div>

            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-800 dark:bg-slate-900 text-white py-12 px-4 border-t-4 border-primary shadow-2xl">
        <div className="max-w-6xl mx-auto text-center">
          <h3 className="text-2xl md:text-3xl font-bold mb-6 text-white">Telugu Night</h3>
          <p className="text-base md:text-lg text-slate-200 mb-8">Experience the vibrant culture of Telugu music and dance</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8 text-sm mb-8">
            <div className="p-4 bg-slate-700/50 dark:bg-slate-800/50 rounded-lg shadow-md border border-slate-600">
              <p className="font-bold text-primary text-base mb-2">📍 Venue</p>
              <p className="text-slate-200 text-sm">DTR, Down to Road Manipal</p>
            </div>
            <div className="p-4 bg-slate-700/50 dark:bg-slate-800/50 rounded-lg shadow-md border border-slate-600">
              <p className="font-bold text-primary text-base mb-2">📅 Date</p>
              <p className="text-slate-200 text-sm">December 15, 2024</p>
            </div>
            <div className="p-4 bg-slate-700/50 dark:bg-slate-800/50 rounded-lg shadow-md border border-slate-600">
              <p className="font-bold text-primary text-base mb-2">🕐 Time</p>
              <p className="text-slate-200 text-sm">8:00 PM - 2:00 AM</p>
            </div>
            <div className="p-4 bg-slate-700/50 dark:bg-slate-800/50 rounded-lg shadow-md border border-slate-600">
              <p className="font-bold text-primary text-base mb-2">💰 Price</p>
              <p className="text-slate-200 text-sm">₹300 (₹200 Food Coupon + ₹100)</p>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t-2 border-slate-600">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-6">
              <a 
                href="/terms-and-conditions" 
                className="text-sm text-slate-300 hover:text-primary transition-colors underline font-medium"
                data-testid="link-terms-conditions"
              >
                Terms & Conditions
              </a>
              <span className="hidden sm:inline text-slate-400 text-lg">|</span>
              <a 
                href="/privacy-policy" 
                className="text-sm text-slate-300 hover:text-primary transition-colors underline font-medium"
                data-testid="link-privacy-policy"
              >
                Privacy Policy
              </a>
            </div>
            <p className="text-sm text-slate-300 text-center leading-relaxed">
              © 2024 <strong className="text-white">events.qlora.in</strong> - Designed and Developed by <strong className="text-primary">Aashvee Tech Solutions Pvt Ltd</strong>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};