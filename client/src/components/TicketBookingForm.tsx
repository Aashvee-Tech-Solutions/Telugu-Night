import { useState, useEffect } from "react";
import { useRealTimePricing } from "@/hooks/usePricing";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Users, CreditCard, Tag, Upload, Clock, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface TicketBookingFormProps {
  onBack?: () => void;
  eventDetails?: {
    title: string;
    price: number;
  };
  referralCode?: string;
}

export const TicketBookingForm = ({ onBack, eventDetails, referralCode }: TicketBookingFormProps) => {
  const [step, setStep] = useState(1);
  const [bookingId, setBookingId] = useState<number | null>(null);
  const [paymentLink, setPaymentLink] = useState<string>("");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    gender: "",
    ticketCount: 0,
    guests: [] as string[],
    guestGenders: [] as string[],
    couponCode: "",
    couponDiscount: 0,
    ticketType: "early_bird" as "early_bird" | "phase_1",
    referrer: referralCode || ""
  });
  
  // Use real-time pricing hook for all pricing logic
  const pricing = useRealTimePricing();

  
  // Auto-set ticket type based on available tiers
  useEffect(() => {
    const currentTier = pricing.getCurrentTier();
    if (currentTier && currentTier.id !== formData.ticketType) {
      setFormData(prev => ({ ...prev, ticketType: currentTier.id as any }));
    }
  }, [pricing.currentTier, formData.ticketType]);

  const getTicketPrice = () => {
    const currentTier = pricing.getCurrentTier();
    return currentTier ? currentTier.price : 0;
  };

  const availableTiers = pricing.getAvailableTiers();
  const isAnyTicketAvailable = availableTiers.length > 0;
  const isEarlyBirdAvailable = pricing.currentTier?.id === 'early_bird';
  const isPhase1Available = pricing.currentTier?.id === 'phase_1';

  const basePrice = getTicketPrice();
  const pricingCalculation = pricing.calculateTotal(formData.ticketCount, formData.couponDiscount);
  const totalTicketsPrice = pricingCalculation.subtotal;
  const discountAmount = pricingCalculation.discount;
  const finalAmount = pricingCalculation.total;
  const { toast } = useToast();

  const createBookingMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Booking failed');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setBookingId(data.booking.id);
      setPaymentLink(data.paymentLink);
      setStep(4);
      toast({
        title: "Booking Created!",
        description: "Please complete payment using the secure payment link.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Booking Failed",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const validateCouponMutation = useMutation({
    mutationFn: async (code: string) => {
      if (!code || code.trim().length === 0) {
        throw new Error('Please enter a coupon code');
      }

      const response = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          code: code.trim().toUpperCase(),
          ticketType: formData.ticketType,
          ticketCount: formData.ticketCount
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Invalid coupon');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setFormData(prev => ({ ...prev, couponDiscount: data.discount }));
      toast({
        title: "Coupon Applied!",
        description: `${data.discount}% discount applied successfully.`,
      });
    },
    onError: () => {
      toast({
        title: "Invalid Coupon",
        description: "Please check your coupon code and try again.",
        variant: "destructive",
      });
    },
  });


  const handleTicketCountChange = (count: number) => {
    // Allow 0-15 tickets, but adjust guests accordingly  
    const validCount = Math.max(0, Math.min(15, count));
    const newGuests = Array(Math.max(0, validCount - 1)).fill("");
    const newGuestGenders = Array(Math.max(0, validCount - 1)).fill("");
    
    // Auto-determine ticket type based on admin configuration
    let ticketType = formData.ticketType;
    if (isEarlyBirdAvailable) {
      ticketType = "early_bird";
    } else if (isPhase1Available) {
      ticketType = "phase_1";
    }
    
    setFormData(prev => ({
      ...prev,
      ticketCount: validCount,
      guests: newGuests,
      guestGenders: newGuestGenders,
      ticketType
    }));
  };

  const handleGuestNameChange = (index: number, name: string) => {
    const newGuests = [...formData.guests];
    newGuests[index] = name;
    setFormData(prev => ({ ...prev, guests: newGuests }));
  };

  const handleGuestGenderChange = (index: number, gender: string) => {
    const newGuestGenders = [...formData.guestGenders];
    newGuestGenders[index] = gender;
    setFormData(prev => ({ ...prev, guestGenders: newGuestGenders }));
  };

  const applyCoupon = () => {
    if (formData.couponCode.trim()) {
      validateCouponMutation.mutate(formData.couponCode);
    }
  };



  const calculateTotal = () => {
    return totalTicketsPrice;
  };

  const calculateTotalWithFee = () => {
    return finalAmount;
  };

  const handleNextStep = () => {
    if (step === 1) {
      // Validate phone number (exactly 10 digits)
      const phoneRegex = /^\d{10}$/;
      if (!phoneRegex.test(formData.phone)) {
        toast({
          title: "Invalid Phone Number",
          description: "Phone number must be exactly 10 digits.",
          variant: "destructive",
        });
        return;
      }
      
      // Validate email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        toast({
          title: "Invalid Email",
          description: "Please enter a valid email address.",
          variant: "destructive",
        });
        return;
      }
      
      if (!formData.name || !formData.email || !formData.phone || !formData.gender) {
        toast({
          title: "Missing Information",
          description: "Please fill in all required fields including gender.",
          variant: "destructive",
        });
        return;
      }
      
      if (formData.ticketCount < 1) {
        toast({
          title: "Invalid Ticket Count",
          description: "Please select at least 1 ticket to proceed.",
          variant: "destructive",
        });
        return;
      }
    }
    
    if (step === 2 && formData.ticketCount > 1) {
      const emptyGuests = formData.guests.filter(guest => !guest.trim());
      const emptyGuestGenders = formData.guestGenders.filter(gender => !gender.trim());
      
      if (emptyGuests.length > 0) {
        toast({
          title: "Guest Names Required",
          description: "Please enter names for all guests.",
          variant: "destructive",
        });
        return;
      }
      
      if (emptyGuestGenders.length > 0) {
        toast({
          title: "Guest Genders Required",
          description: "Please select gender for all guests.",
          variant: "destructive",
        });
        return;
      }
    }
    
    setStep(step + 1);
  };

  const handleBooking = () => {
    if (formData.ticketCount < 1) {
      toast({
        title: "Cannot Create Booking",
        description: "Please select at least 1 ticket to create a booking.",
        variant: "destructive",
      });
      return;
    }
    
    if (!isAnyTicketAvailable) {
      toast({
        title: "Tickets Not Available",
        description: "Ticket sales are currently paused. Please check back later.",
        variant: "destructive",
      });
      return;
    }
    
    const bookingData = {
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      gender: formData.gender,
      ticketCount: formData.ticketCount,
      ticketType: formData.ticketType,
      guests: formData.guests.filter(g => g.trim()),
      guestGenders: formData.guestGenders.filter(g => g.trim()),
      couponCode: formData.couponCode || null,
      referrer: formData.referrer || referralCode || null,
    };
    
    createBookingMutation.mutate(bookingData);
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
              Book Tickets - {eventDetails?.title || "Telugu Night"}
            </CardTitle>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Step {step} of {step === 5 ? 5 : 4}</span>
              <span>₹{basePrice > 0 ? basePrice : (eventDetails?.price || 300)} per ticket</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Step Progress */}
            <div className="flex justify-between mb-8">
              {[1, 2, 3, 4, ...(step === 5 ? [5] : [])].map((num) => (
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
                
                {/* Current Phase Status */}
                {pricing.config && (
                  <div className={`p-4 rounded-lg border ${
                    pricing.currentTier?.id === 'early_bird'
                      ? 'bg-gradient-to-r from-orange-50 to-yellow-50 border-orange-200' 
                      : pricing.currentTier?.id === 'phase_1'
                      ? 'bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200'
                      : 'bg-gradient-to-r from-red-50 to-pink-50 border-red-200'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${
                          pricing.currentTier?.id === 'early_bird'
                            ? 'bg-orange-500' 
                            : pricing.currentTier?.id === 'phase_1'
                            ? 'bg-blue-500'
                            : 'bg-red-500'
                        }`}></div>
                        <span className={`font-semibold ${
                          pricing.currentTier?.id === 'early_bird'
                            ? 'text-orange-800' 
                            : pricing.currentTier?.id === 'phase_1'
                            ? 'text-blue-800'
                            : 'text-red-800'
                        }`}>
                          {pricing.currentTier?.id === 'early_bird'
                            ? '🎫 Early Bird Phase Active' 
                            : pricing.currentTier?.id === 'phase_1'
                            ? '🎫 Phase 1 Active'
                            : '⏸️ Ticket Sales Paused'}
                        </span>
                      </div>
                      <div className={`text-xl font-bold ${
                        pricing.currentTier?.id === 'early_bird'
                          ? 'text-orange-700' 
                          : pricing.currentTier?.id === 'phase_1'
                          ? 'text-blue-700'
                          : 'text-red-700'
                      }`}>
                        {pricing.currentTier ? pricing.formatCurrency(pricing.currentTier.price) : 'N/A'} per ticket
                      </div>
                    </div>
                    {pricing.currentTier?.id === 'early_bird' && (
                      <p className="text-orange-700 text-sm mt-2">🔥 Limited time offer - {pricing.currentTier.name} pricing active!</p>
                    )}
                    {pricing.currentTier?.id === 'phase_1' && (
                      <p className="text-blue-700 text-sm mt-2">
                        🎯 Regular pricing now active. Secure your spot for Telugu Night!
                      </p>
                    )}
                    {!isAnyTicketAvailable && (
                      <p className="text-red-700 text-sm mt-2">
                        🚫 Ticket sales are temporarily paused. Please check back later or contact support.
                      </p>
                    )}
                  </div>
                )}
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
                      placeholder="Enter your email address"
                      data-testid="input-email"
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone Number *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      maxLength={10}
                      value={formData.phone}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, ''); // Remove non-digits
                        setFormData(prev => ({ ...prev, phone: value }));
                      }}
                      placeholder="Enter 10-digit phone number"
                      data-testid="input-phone"
                    />
                  </div>
                  <div>
                    <Label htmlFor="gender">Gender *</Label>
                    <Select 
                      value={formData.gender} 
                      onValueChange={(value) => setFormData(prev => ({ ...prev, gender: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select your gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="tickets">Number of Tickets</Label>
                    <Input
                      id="tickets"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={formData.ticketCount.toString()}
                      onChange={(e) => {
                        const value = e.target.value;
                        // Allow only digits and empty string
                        if (value === '' || /^\d+$/.test(value)) {
                          const numValue = value === '' ? 0 : parseInt(value);
                          if (numValue >= 0 && numValue <= 15) { // Allow 0-15 tickets
                            handleTicketCountChange(numValue);
                          }
                        }
                      }}
                      onKeyDown={(e) => {
                        // Allow backspace, delete, tab, escape, enter
                        if ([8, 9, 27, 13, 46].indexOf(e.keyCode) !== -1 ||
                            // Allow Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
                            (e.keyCode === 65 && e.ctrlKey) ||
                            (e.keyCode === 67 && e.ctrlKey) ||
                            (e.keyCode === 86 && e.ctrlKey) ||
                            (e.keyCode === 88 && e.ctrlKey)) {
                          return;
                        }
                        // Ensure that it is a number and stop if not
                        if ((e.shiftKey || (e.keyCode < 48 || e.keyCode > 57)) && (e.keyCode < 96 || e.keyCode > 105)) {
                          e.preventDefault();
                        }
                      }}
                      onBlur={(e) => {
                        if (e.target.value === '') {
                          handleTicketCountChange(0);
                        }
                      }}
                      className="mb-3"
                      placeholder="Enter number of tickets (max 15)"
                    />
                    
                    {/* Booking Limit Message */}
                    <div className="text-sm text-muted-foreground mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <p className="font-medium text-blue-800 dark:text-blue-200 mb-1">📞 Need more than 15 tickets?</p>
                      <p className="text-blue-700 dark:text-blue-300">
                        For bulk bookings, contact us at <a href="mailto:mis@aashveetech.com" className="underline font-medium hover:text-blue-600 dark:hover:text-blue-200">mis@aashveetech.com</a>
                      </p>
                    </div>
                    
                    {/* Current Phase Display */}
                    {pricing.config && (
                      <div className="mb-4">
                        {pricing.currentTier ? (
                          <div className={`bg-gradient-to-r rounded-lg p-4 border-2 ${
                            pricing.currentTier.id === 'early_bird' 
                              ? 'from-orange-100 to-yellow-100 dark:from-orange-900 dark:to-yellow-900 border-orange-300' 
                              : pricing.currentTier.id === 'phase_1'
                              ? 'from-blue-100 to-indigo-100 dark:from-blue-900 dark:to-indigo-900 border-blue-300'
                              : 'from-purple-100 to-pink-100 dark:from-purple-900 dark:to-pink-900 border-purple-300'
                          }`}>
                            <div className="flex items-center justify-center gap-2 mb-2">
                              <Clock className={`w-5 h-5 ${
                                pricing.currentTier.id === 'early_bird' ? 'text-orange-600' 
                                : pricing.currentTier.id === 'phase_1' ? 'text-blue-600' 
                                : 'text-purple-600'
                              }`} />
                              <span className={`font-bold text-lg ${
                                pricing.currentTier.id === 'early_bird' ? 'text-orange-800 dark:text-orange-200' 
                                : pricing.currentTier.id === 'phase_1' ? 'text-blue-800 dark:text-blue-200' 
                                : 'text-purple-800 dark:text-purple-200'
                              }`}>🎫 {pricing.currentTier.name.toUpperCase()}</span>
                            </div>
                            <div className="text-center">
                              <div className={`text-3xl font-bold ${
                                pricing.currentTier.id === 'early_bird' ? 'text-orange-700 dark:text-orange-300' 
                                : pricing.currentTier.id === 'phase_1' ? 'text-blue-700 dark:text-blue-300' 
                                : 'text-purple-700 dark:text-purple-300'
                              }`}>₹{getTicketPrice()} per ticket</div>
                              <div className={`text-sm font-medium ${
                                pricing.currentTier.id === 'early_bird' ? 'text-orange-600 dark:text-orange-400' 
                                : pricing.currentTier.id === 'phase_1' ? 'text-blue-600 dark:text-blue-400' 
                                : 'text-purple-600 dark:text-purple-400'
                              }`}>{pricing.currentTier.description || 'Available now'}</div>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-gradient-to-r from-red-100 to-pink-100 dark:from-red-900 dark:to-pink-900 border-2 border-red-300 rounded-lg p-4">
                            <div className="flex items-center justify-center gap-2 mb-2">
                              <Clock className="w-5 h-5 text-red-600" />
                              <span className="font-bold text-lg text-red-800 dark:text-red-200">🚫 SALES PAUSED</span>
                            </div>
                            <div className="text-center">
                              <div className="text-sm text-red-600 dark:text-red-400 font-medium">Ticket sales are temporarily paused</div>
                              <div className="text-xs text-red-500 dark:text-red-500 mt-1">Please check back later or contact support</div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Ticket Count & Type Information */}
                    {isAnyTicketAvailable && (
                      <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-4 rounded-lg border border-purple-200">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-purple-700 dark:text-purple-300">
                                Current Selection: {formData.ticketCount} ticket{formData.ticketCount !== 1 ? 's' : ''}
                              </span>
                            </div>
                            <span className="text-lg font-bold text-purple-600">₹{basePrice} per ticket</span>
                          </div>
                          
                          {formData.ticketType === "early_bird" && (
                            <div className="text-sm text-green-600 dark:text-green-400">
                              🎉 You're getting Early Bird pricing! Save ₹50 per ticket
                            </div>
                          )}
                          
                          {formData.ticketType === "phase_1" && (
                            <div className="text-sm text-blue-600 dark:text-blue-400">
                              ⏰ Phase 1 Pricing - Early Bird sold out
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Dynamic Price Display */}
                    {isAnyTicketAvailable && formData.ticketCount > 0 && (
                      <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border">
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600 dark:text-gray-300">
                              {pricing.currentTier?.name || "Ticket"} Price ({pricing.formatCurrency(basePrice)} × {formData.ticketCount}):
                            </span>
                            <span className="font-medium">{pricing.formatCurrency(totalTicketsPrice)}</span>
                          </div>
                          
                          {formData.couponDiscount > 0 && (
                            <div className="flex justify-between items-center text-green-600 dark:text-green-400">
                              <span className="text-sm">
                                Discount ({formData.couponDiscount}%):
                              </span>
                              <span className="font-medium">-{pricing.formatCurrency(discountAmount)}</span>
                            </div>
                          )}
                          
                          <div className="flex justify-between items-center text-sm text-orange-600 dark:text-orange-400">
                            <span>Convenience Fee ({pricing.formatCurrency(pricingCalculation.convenienceFee / formData.ticketCount)} × {formData.ticketCount}):</span>
                            <span className="font-medium">{pricing.formatCurrency(pricingCalculation.convenienceFee)}</span>
                          </div>
                          
                          <div className="flex justify-between items-center text-lg font-bold text-purple-600 dark:text-purple-400 border-t pt-2 mt-2">
                            <span>Total Amount:</span>
                            <span>{pricing.formatCurrency(finalAmount)}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Guest Details */}
            {step === 2 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Guest Details</h3>
                {formData.ticketCount <= 1 ? (
                  <p className="text-muted-foreground">
                    {formData.ticketCount === 0 ? "No tickets selected - no guest details needed." : "Single ticket - you are Guest 1. No additional guest details needed."}
                  </p>
                ) : (
                  <div className="space-y-3">
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md border border-blue-200">
                      <p className="text-sm text-blue-800 dark:text-blue-200 font-medium">
                        📝 Note: You (the booking person) are Guest 1. Please enter names for additional guests:
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Additional guest details ({formData.ticketCount - 1} guest{formData.ticketCount > 2 ? 's' : ''}):
                    </p>
                    {formData.guests.map((guest, index) => (
                      <div key={index} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor={`guest-${index}`}>Guest {index + 2} Name *</Label>
                          <Input
                            id={`guest-${index}`}
                            value={guest}
                            onChange={(e) => handleGuestNameChange(index, e.target.value)}
                            placeholder={`Enter guest ${index + 2} name`}
                          />
                        </div>
                        <div>
                          <Label htmlFor={`guest-gender-${index}`}>Gender *</Label>
                          <Select 
                            value={formData.guestGenders[index] || ""} 
                            onValueChange={(value) => handleGuestGenderChange(index, value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select gender" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="male">Male</SelectItem>
                              <SelectItem value="female">Female</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
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
                    onChange={(e) => setFormData(prev => ({ ...prev, couponCode: e.target.value.toUpperCase() }))}
                    className="flex-1"
                  />
                  <Button 
                    onClick={applyCoupon} 
                    disabled={validateCouponMutation.isPending || !formData.couponCode.trim()}
                    variant="outline"
                    className="shrink-0"
                  >
                    <Tag className="mr-2 h-4 w-4" />
                    {validateCouponMutation.isPending ? "Validating..." : "Apply"}
                  </Button>
                </div>
                
                {formData.couponDiscount > 0 && (
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <p className="text-green-800 dark:text-green-200 font-medium flex items-center gap-2">
                      ✅ Coupon "{formData.couponCode}" applied! {formData.couponDiscount}% discount
                    </p>
                  </div>
                )}
                
                {validateCouponMutation.isError && (
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-red-800 dark:text-red-200 font-medium">
                      ❌ {validateCouponMutation.error?.message || 'Invalid coupon code'}
                    </p>
                  </div>
                )}
                
                
              </div>
            )}

            {/* Step 4: Payment */}
            {step === 4 && !bookingId && (
              <div className="space-y-4">
                <h3 className="text-lg md:text-xl font-semibold">Payment Summary</h3>
                <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 p-4 md:p-6 rounded-xl border border-blue-200 dark:border-blue-800 shadow-lg">
                  <div className="text-lg md:text-xl font-bold text-blue-800 dark:text-blue-200 mb-4 text-center">💰 Payment Breakdown</div>
                  
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-3 md:p-4 space-y-3 shadow-sm text-[#000000]">
                    <div className="text-xs md:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Per Ticket (₹{basePrice} each):</div>
                    <div className="flex justify-between items-center text-xs md:text-sm">
                      <span className="flex items-center gap-1 md:gap-2">
                        🍽️ <span className="break-words">Food Coupon (Redeemable)</span>
                      </span>
                      <span className="font-medium flex-shrink-0">₹200</span>
                    </div>
                    <div className="flex justify-between items-center text-xs md:text-sm">
                      <span className="flex items-center gap-1 md:gap-2">
                        🎫 <span className="break-words">Entry & Entertainment</span>
                      </span>
                      <span className="font-medium flex-shrink-0">₹{finalAmount.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-800 rounded-lg p-3 md:p-4 mt-4 shadow-sm">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs md:text-sm">
                        <span className="break-words">Subtotal ({formData.ticketCount} tickets × ₹{basePrice})</span>
                        <span className="font-medium flex-shrink-0">₹{totalTicketsPrice.toFixed(2)}</span>
                      </div>
                      
                      {formData.couponDiscount > 0 && (
                        <div className="flex justify-between items-center text-green-600 dark:text-green-400 text-xs md:text-sm">
                          <span className="break-words">🎟️ Coupon Discount ({formData.couponDiscount}%)</span>
                          <span className="font-medium flex-shrink-0">-₹{discountAmount.toFixed(2)}</span>
                        </div>
                      )}
                      
                      <div className="flex justify-between items-center text-xs md:text-sm text-orange-600 dark:text-orange-400">
                        <span className="break-words">💳 Convenience Fee ({formData.ticketCount} × ₹12.96)</span>
                        <span className="font-medium flex-shrink-0">₹{(formData.ticketCount * 12.96).toFixed(2)}</span>
                      </div>
                      
                      <hr className="border-gray-300 dark:border-gray-600" />
                      
                      <div className="flex justify-between items-center text-base md:text-lg font-bold text-purple-700 dark:text-purple-300">
                        <span className="break-words">Total Amount</span>
                        <span className="flex-shrink-0">₹{calculateTotalWithFee().toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/30 rounded-lg border border-green-200 dark:border-green-700">
                    <p className="text-xs text-green-800 dark:text-green-200 text-center">
                      ✨ Food coupon worth ₹200 can be redeemed for delicious food at the venue!
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: UPI Payment */}
            {step === 4 && bookingId && paymentLink && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Complete Payment</h3>
                <div className="bg-card border rounded-lg p-6 text-center space-y-4">
                  <div className="text-2xl font-bold text-primary">₹{calculateTotalWithFee().toFixed(2)}</div>
                  <p className="text-muted-foreground">
                    Click "Pay Now" to complete your payment securely through Cashfree
                  </p>
                  
                  <div className="space-y-4">
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-md border border-blue-200">
                      <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">📱 Payment Details</h4>
                      <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                        <p><strong>Amount:</strong> ₹{calculateTotalWithFee().toFixed(2)}</p>
                        <p><strong>Booking ID:</strong> {bookingId}</p>
                        <p><strong>Payment Gateway:</strong> Cashfree (Secure)</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-green-800 font-medium text-center">
                      ✅ Payment will be processed securely through Cashfree Gateway
                    </p>
                  </div>
                </div>
              </div>
            )}


            {/* Navigation Buttons */}
            <div className="flex flex-col sm:flex-row justify-between gap-3 pt-6">
              {step > 1 && step !== 5 && !bookingId && (
                <Button variant="outline" onClick={() => setStep(step - 1)} className="w-full sm:w-auto">
                  Previous
                </Button>
              )}
              <div className="sm:ml-auto w-full sm:w-auto">
                {step < 3 ? (
                  <Button onClick={handleNextStep} variant="gradient" className="w-full sm:w-auto">
                    Next Step
                  </Button>
                ) : step === 3 ? (
                  <Button onClick={handleNextStep} variant="gradient" className="w-full sm:w-auto">
                    Review & Pay
                  </Button>
                ) : step === 4 && !bookingId ? (
                  <Button 
                    onClick={handleBooking} 
                    variant="gradient" 
                    className="px-8 w-full sm:w-auto"
                    disabled={createBookingMutation.isPending}
                  >
                    <CreditCard className="mr-2" />
                    {createBookingMutation.isPending ? "Creating..." : "Create Booking"}
                  </Button>
                ) : step === 4 && bookingId ? (
                  <Button 
                    onClick={async () => {
                      try {
                        console.log('Pay Now clicked, paymentLink:', paymentLink);
                        console.log('PaymentLink type:', typeof paymentLink);
                        console.log('PaymentLink length:', paymentLink?.length);
                        
                        // Check if Cashfree SDK is loaded
                        if (!(window as any).Cashfree) {
                          console.error('Cashfree SDK not loaded');
                          toast({
                            title: "Payment Error",
                            description: "Payment system not loaded. Please refresh the page and try again.",
                            variant: "destructive"
                          });
                          return;
                        }
                        
                        // Initialize Cashfree SDK
                        const cashfree = (window as any).Cashfree({
                          mode: "sandbox" // Use "sandbox" for testing
                        });
                        
                        console.log('Cashfree SDK initialized:', cashfree);
                        
                        // Redirect to checkout
                        const checkoutOptions = {
                          paymentSessionId: paymentLink, // paymentLink now contains session ID
                          redirectTarget: "_blank"
                        };
                        
                        console.log('Opening checkout with options:', checkoutOptions);
                        console.log('Payment Session ID being used:', paymentLink);
                        
                        // Add payment callbacks for success/failure handling
                        const checkoutCallbacks = {
                          onSuccess: function(data: any) {
                            console.log('Payment successful:', data);
                            // Redirect to payment success page
                            window.location.href = `/payment/success?booking=${bookingId}`;
                          },
                          onFailure: function(data: any) {
                            console.log('Payment failed:', data);
                            toast({
                              title: "Payment Failed",
                              description: "Your payment was unsuccessful. Please try again or contact support.",
                              variant: "destructive"
                            });
                            // Stay on the same page to allow retry
                          },
                          onClose: function() {
                            console.log('Payment dialog closed');
                            // User closed the payment dialog - no action needed
                          }
                        };
                        
                        cashfree.checkout({
                          ...checkoutOptions,
                          callbacks: checkoutCallbacks
                        });
                      } catch (error) {
                        console.error('Payment initialization failed:', error);
                        toast({
                          title: "Payment Error",
                          description: "Failed to initialize payment. Please try again.",
                          variant: "destructive"
                        });
                      }
                    }}
                    variant="gradient" 
                    className="px-8 w-full sm:w-auto"
                  >
                    <CreditCard className="mr-2" />
                    Pay Now
                  </Button>
) : null}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TicketBookingForm;