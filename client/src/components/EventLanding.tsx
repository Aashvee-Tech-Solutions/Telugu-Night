import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, MapPin, Users, Ticket, Clock, Star } from "lucide-react";
import { TicketBookingForm } from "./TicketBookingForm";
import eventHero from "@/assets/event-hero.jpg";

export const EventLanding = () => {
  const [showBookingForm, setShowBookingForm] = useState(false);

  const eventDetails = {
    title: "Telugu Night",
    date: "December 15, 2024",
    time: "8:00 PM - 2:00 AM",
    venue: "DTR, Down to Road Manipal",
    price: 300,
    totalTickets: 500,
    soldTickets: 324,
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
  );
};