import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Users, CreditCard, Tag } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TicketBookingFormProps {
  onBack: () => void;
  eventDetails: {
    title: string;
    price: number;
  };
}

export const TicketBookingForm = ({ onBack, eventDetails }: TicketBookingFormProps) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    ticketCount: 1,
    guests: [] as string[],
    couponCode: "",
    couponDiscount: 0
  });
  const { toast } = useToast();

  const handleTicketCountChange = (count: number) => {
    const newGuests = Array(Math.max(0, count - 1)).fill("");
    setFormData(prev => ({
      ...prev,
      ticketCount: count,
      guests: newGuests
    }));
  };

  const handleGuestNameChange = (index: number, name: string) => {
    const newGuests = [...formData.guests];
    newGuests[index] = name;
    setFormData(prev => ({ ...prev, guests: newGuests }));
  };

  const applyCoupon = () => {
    // Mock coupon validation
    const validCoupons = {
      "SAVE10": 10,
      "EARLY20": 20,
      "STUDENT15": 15
    };
    
    const discount = validCoupons[formData.couponCode as keyof typeof validCoupons];
    if (discount) {
      setFormData(prev => ({ ...prev, couponDiscount: discount }));
      toast({
        title: "Coupon Applied!",
        description: `${discount}% discount applied successfully.`,
      });
    } else {
      toast({
        title: "Invalid Coupon",
        description: "Please check your coupon code and try again.",
        variant: "destructive",
      });
    }
  };

  const calculateTotal = () => {
    let total = formData.ticketCount * eventDetails.price;
    
    // Special offer: 11 tickets for the price of 10
    if (formData.ticketCount >= 11) {
      const freeTickets = Math.floor(formData.ticketCount / 11);
      total -= freeTickets * eventDetails.price;
    }
    
    // Apply coupon discount
    if (formData.couponDiscount > 0) {
      total -= (total * formData.couponDiscount) / 100;
    }
    
    return total;
  };

  const handleNextStep = () => {
    if (step === 1) {
      if (!formData.name || !formData.email || !formData.phone) {
        toast({
          title: "Missing Information",
          description: "Please fill in all required fields.",
          variant: "destructive",
        });
        return;
      }
    }
    
    if (step === 2 && formData.ticketCount > 1) {
      const emptyGuests = formData.guests.filter(guest => !guest.trim());
      if (emptyGuests.length > 0) {
        toast({
          title: "Guest Names Required",
          description: "Please enter names for all guests.",
          variant: "destructive",
        });
        return;
      }
    }
    
    setStep(step + 1);
  };

  const handlePayment = () => {
    // Here you would integrate with your payment system
    toast({
      title: "Redirecting to Payment",
      description: "You will be redirected to the payment gateway.",
    });
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto">
        <Button variant="ghost" onClick={onBack} className="mb-6">
          <ArrowLeft className="mr-2" />
          Back to Event
        </Button>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-6 w-6" />
              Book Tickets - {eventDetails.title}
            </CardTitle>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Step {step} of 4</span>
              <span>₹{eventDetails.price} per ticket</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Step Progress */}
            <div className="flex justify-between mb-8">
              {[1, 2, 3, 4].map((num) => (
                <div
                  key={num}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    num <= step
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {num}
                </div>
              ))}
            </div>

            {/* Step 1: Personal Details */}
            {step === 1 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Personal Details</h3>
                <div className="grid gap-4">
                  <div>
                    <Label htmlFor="name">Full Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Enter your full name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email Address *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="Enter your email"
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone Number *</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="Enter your phone number"
                    />
                  </div>
                  <div>
                    <Label htmlFor="tickets">Number of Tickets</Label>
                    <Input
                      id="tickets"
                      type="number"
                      min="1"
                      max="20"
                      value={formData.ticketCount}
                      onChange={(e) => handleTicketCountChange(parseInt(e.target.value) || 1)}
                    />
                    {formData.ticketCount >= 11 && (
                      <p className="text-sm text-success mt-2">
                        🎉 Special offer applied! You'll pay for only {formData.ticketCount - Math.floor(formData.ticketCount / 11)} tickets.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Guest Details */}
            {step === 2 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Guest Details</h3>
                {formData.ticketCount === 1 ? (
                  <p className="text-muted-foreground">No additional guests for single ticket.</p>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Please enter names for your guests ({formData.ticketCount - 1} additional guests):
                    </p>
                    {formData.guests.map((guest, index) => (
                      <div key={index}>
                        <Label htmlFor={`guest-${index}`}>Guest {index + 1} Name *</Label>
                        <Input
                          id={`guest-${index}`}
                          value={guest}
                          onChange={(e) => handleGuestNameChange(index, e.target.value)}
                          placeholder={`Enter guest ${index + 1} name`}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Coupon Code */}
            {step === 3 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Apply Coupon Code</h3>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter coupon code"
                    value={formData.couponCode}
                    onChange={(e) => setFormData(prev => ({ ...prev, couponCode: e.target.value }))}
                  />
                  <Button onClick={applyCoupon} variant="outline">
                    <Tag className="mr-2 h-4 w-4" />
                    Apply
                  </Button>
                </div>
                {formData.couponDiscount > 0 && (
                  <div className="p-3 bg-success/10 border border-success/20 rounded-md">
                    <p className="text-success text-sm">
                      Coupon applied! {formData.couponDiscount}% discount
                    </p>
                  </div>
                )}
                <div className="bg-muted p-4 rounded-md">
                  <h4 className="font-medium mb-2">Available Coupons:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• SAVE10 - 10% off</li>
                    <li>• EARLY20 - 20% off (Early bird)</li>
                    <li>• STUDENT15 - 15% off (Student discount)</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Step 4: Payment Summary */}
            {step === 4 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Payment Summary</h3>
                <div className="bg-muted p-4 rounded-md space-y-2">
                  <div className="flex justify-between">
                    <span>Tickets ({formData.ticketCount})</span>
                    <span>₹{formData.ticketCount * eventDetails.price}</span>
                  </div>
                  {formData.ticketCount >= 11 && (
                    <div className="flex justify-between text-success">
                      <span>Special Offer Discount</span>
                      <span>-₹{Math.floor(formData.ticketCount / 11) * eventDetails.price}</span>
                    </div>
                  )}
                  {formData.couponDiscount > 0 && (
                    <div className="flex justify-between text-success">
                      <span>Coupon Discount ({formData.couponDiscount}%)</span>
                      <span>-₹{Math.round((formData.ticketCount * eventDetails.price) * formData.couponDiscount / 100)}</span>
                    </div>
                  )}
                  <hr className="my-2" />
                  <div className="flex justify-between font-semibold text-lg">
                    <span>Total Amount</span>
                    <span>₹{calculateTotal()}</span>
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-4">
                    You will be redirected to UPI payment gateway
                  </p>
                  <p className="text-xs text-muted-foreground">
                    After payment, upload screenshot for verification
                  </p>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between pt-6">
              {step > 1 && (
                <Button variant="outline" onClick={() => setStep(step - 1)}>
                  Previous
                </Button>
              )}
              <div className="ml-auto">
                {step < 4 ? (
                  <Button onClick={handleNextStep} variant="gradient">
                    Next Step
                  </Button>
                ) : (
                  <Button onClick={handlePayment} variant="gradient" className="px-8">
                    <CreditCard className="mr-2" />
                    Proceed to Payment
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};