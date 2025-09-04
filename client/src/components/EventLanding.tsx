import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Users, Ticket, Clock, Star, Settings, AlertCircle } from "lucide-react";
import { TicketBookingForm } from "./TicketBookingForm";
import { AdminConfigPanel } from "./AdminConfigPanel";
import { usePricing } from "@/hooks/usePricing";
import eventHero from "@/assets/event-hero.jpg";

export const EventLanding = () => {
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const { getCurrentTier, config } = usePricing();

  const currentTier = getCurrentTier();
  const totalSold = config.currentSold.earlyBird + config.currentSold.phase1 + config.currentSold.phase2;

  const eventDetails = {
    title: "Telugu Night",
    date: "December 15, 2024",
    time: "8:00 PM - 2:00 AM",
    venue: "DTR, Down to Road Manipal",
    totalTickets: 500,
    soldTickets: totalSold,
    description: "Join us for an amazing Telugu DJ night filled with vibrant Telugu songs, dance, and joy at DTR, Down to Road Manipal!"
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
    <>
      <AdminConfigPanel 
        isOpen={showAdminPanel} 
        onClose={() => setShowAdminPanel(false)} 
      />
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
          <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-primary bg-clip-text text-transparent animate-fade-in">
            {eventDetails.title}
          </h1>
          <p className="text-xl md:text-2xl text-foreground/80 mb-8 animate-slide-up">
            {eventDetails.description}
          </p>
          
          {/* Pricing Display */}
          {currentTier ? (
            <div className="mb-6 animate-slide-up">
              <div className="inline-flex items-center gap-3 bg-background/20 backdrop-blur-sm rounded-lg px-6 py-3">
                <Badge variant="secondary" className="text-lg px-3 py-1">
                  {currentTier.name}
                </Badge>
                <span className="text-2xl font-bold text-white">
                  ₹{currentTier.price}
                </span>
                <span className="text-sm text-white/80">
                  {currentTier.available} left
                </span>
              </div>
            </div>
          ) : (
            <div className="mb-6 animate-slide-up">
              <div className="inline-flex items-center gap-2 bg-destructive/20 backdrop-blur-sm rounded-lg px-6 py-3">
                <AlertCircle className="w-5 h-5 text-destructive" />
                <span className="text-white font-medium">Tickets Currently Unavailable</span>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-slide-up">
            <Button 
              variant="gradient" 
              size="lg" 
              className="text-lg px-8 py-6"
              onClick={() => setShowBookingForm(true)}
              disabled={!currentTier}
            >
              <Ticket className="mr-2" />
              Book Your Tickets
            </Button>
            
            <Button 
              variant="outline" 
              size="lg" 
              className="text-lg px-6 py-6 bg-background/20 backdrop-blur-sm border-white/20 text-white hover:bg-background/30"
              onClick={() => setShowAdminPanel(true)}
            >
              <Settings className="mr-2" />
              Admin Panel
            </Button>
          </div>
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
                    <h3 className="font-semibold">Current Price</h3>
                    {currentTier ? (
                      <div className="flex items-center gap-2">
                        <p className="text-muted-foreground">₹{currentTier.price}</p>
                        <Badge variant="outline" className="text-xs">{currentTier.name}</Badge>
                      </div>
                    ) : (
                      <p className="text-destructive">Unavailable</p>
                    )}
                  </div>
                </div>
              </div>

            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-secondary/20 py-8 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <h3 className="text-xl md:text-2xl font-bold mb-4 text-primary">Telugu Night</h3>
          <p className="text-sm md:text-base text-muted-foreground mb-6">Experience the vibrant culture of Telugu music and dance</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-8 text-sm text-muted-foreground">
            <div className="p-3 bg-background/50 rounded-lg">
              <p className="font-semibold text-primary">Venue</p>
              <p className="text-xs md:text-sm">DTR, Down to Road Manipal</p>
            </div>
            <div className="p-3 bg-background/50 rounded-lg">
              <p className="font-semibold text-primary">Date</p>
              <p className="text-xs md:text-sm">December 15, 2024</p>
            </div>
            <div className="p-3 bg-background/50 rounded-lg">
              <p className="font-semibold text-primary">Time</p>
              <p className="text-xs md:text-sm">8:00 PM - 2:00 AM</p>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t border-border/50">
            <p className="text-xs text-muted-foreground">© 2024 Telugu Night Event Management</p>
          </div>
        </div>
      </footer>
    </div>
    </>
  );
};