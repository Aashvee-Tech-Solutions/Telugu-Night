import { useState, useEffect } from "react";
import { useRealTimePricing } from "@/hooks/usePricing";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Users, CreditCard, Tag, Upload, Clock, Star, Mail } from "lucide-react";
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
        description: error.message,
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
          email: formData.email,
          ticketPrice: basePrice,
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
        description: "The coupon code you entered is invalid or expired.",
        variant: "destructive",
      });
    },
  });


  const handleTicketCountChange = (count: number) => {
    // Allow 0-15 tickets, but adjust guests accordingly  
    const validCount = Math.max(0, Math.min(15, count));
    
    // Adjust guest arrays to match ticket count (guest arrays are 1 less than ticket count)
    const guestArraySize = Math.max(0, validCount - 1);
    const newGuests = [...formData.guests];
    const newGuestGenders = [...formData.guestGenders];
    
    // Ensure arrays are properly sized - pad with empty strings if needed
    while (newGuests.length < guestArraySize) {
      newGuests.push('');
    }
    while (newGuestGenders.length < guestArraySize) {
      newGuestGenders.push('');
    }
    
    // Set ticket type based on available tiers
    let ticketType = formData.ticketType;
    if (isEarlyBirdAvailable) {
      ticketType = "early_bird";
    } else if (isPhase1Available) {
      ticketType = "phase_1";
    }
    
    setFormData(prev => ({
      ...prev,
      ticketCount: validCount,
      guests: newGuests.slice(0, guestArraySize),
      guestGenders: newGuestGenders.slice(0, guestArraySize),
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
      if (!formData.name.trim()) {
        toast({
          title: "Name Required",
          description: "Please enter your full name.",
          variant: "destructive",
        });
        return;
      }
      
      if (!formData.email.trim() || !/\S+@\S+\.\S+/.test(formData.email)) {
        toast({
          title: "Valid Email Required",
          description: "Please enter a valid email address.",
          variant: "destructive",
        });
        return;
      }
      
      if (!formData.phone.trim() || formData.phone.length !== 10 || !/^\d{10}$/.test(formData.phone)) {
        toast({
          title: "Valid Phone Required",
          description: "Please enter a valid 10-digit phone number.",
          variant: "destructive",
        });
        return;
      }

      if (!formData.gender.trim()) {
        toast({
          title: "Gender Required",
          description: "Please select your gender.",
          variant: "destructive",
        });
        return;
      }

      if (formData.ticketCount < 1) {
        toast({
          title: "Select Tickets",
          description: "Please select at least one ticket.",
          variant: "destructive",
        });
        return;
      }
      
      setStep(2);
    } else if (step === 2) {
      // Validate guest details if multiple tickets
      if (formData.ticketCount > 1) {
        const expectedGuestCount = formData.ticketCount - 1;
        
        // Check if we have the correct number of guest entries
        if (formData.guests.length !== expectedGuestCount || formData.guestGenders.length !== expectedGuestCount) {
          toast({
            title: "Guest Details Incomplete",
            description: "Please refresh the form and try again.",
            variant: "destructive",
          });
          return;
        }
        
        const emptyGuests = formData.guests.filter(g => !g.trim());
        const emptyGenders = formData.guestGenders.filter(g => !g.trim());
        
        if (emptyGuests.length > 0 || emptyGenders.length > 0) {
          toast({
            title: "Guest Details Required",
            description: `Please enter all guest names and genders for ${expectedGuestCount} guest${expectedGuestCount > 1 ? 's' : ''}.`,
            variant: "destructive",
          });
          return;
        }
      }
      setStep(3);
    } else if (step === 3) {
      setStep(4);
    }
  };

  const handleBooking = () => {
    if (formData.ticketCount < 1) {
      toast({
        title: "No Tickets Selected",
        description: "Please select at least one ticket before booking.",
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
        <Button variant="ghost" onClick={() => window.location.href = '/'} className="mb-6">
          <ArrowLeft className="mr-2" />
          Back to Home
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
                </div>
                    
                {/* Comprehensive Ticket Selection */}
                {pricing.config && (
                  <div className="mb-4">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Select Tickets</h3>
                    <div className="space-y-3">
                      {/* Early Bird Tickets */}
                      {pricing.config?.earlyBird.capacity > 1 && (
                        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                                <div className="flex flex-col">
                                  <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                                    Early Bird
                                  </h4>
                                </div>
                                {(pricing.config?.earlyBird.soldCount ?? 0) >= (pricing.config?.earlyBird.capacity ?? 0) ? (
                                  <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors border-transparent bg-destructive text-destructive-foreground w-fit">Sold Out</span>
                                ) : !pricing.config?.earlyBird.isActive ? (
                                  <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors border-transparent bg-secondary text-secondary-foreground w-fit">Coming Soon</span>
                                ) : (
                                  <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors border-transparent bg-green-600 text-white w-fit">Available</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center justify-between sm:gap-4">
                              <div className="">
                                <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
                                  Rs. {pricing.config?.earlyBird.price || 0}
                                </div>
                              </div>
                              <Input
                                type="number"
                                min="0"
                                max="15"
                                className="w-20 text-center"
                                value={pricing.config?.earlyBird.isActive && pricing.config?.earlyBird.soldCount < pricing.config?.earlyBird.capacity && pricing.currentTier?.id === 'early_bird' ? formData.ticketCount.toString() : "0"}
                                onChange={(e) => {
                                  const value = parseInt(e.target.value) || 0;
                                  if (pricing.config?.earlyBird.isActive && pricing.config?.earlyBird.soldCount < pricing.config?.earlyBird.capacity && pricing.currentTier?.id === 'early_bird' && value >= 0 && value <= 15) {
                                    handleTicketCountChange(value);
                                  }
                                }}
                                disabled={!pricing.config?.earlyBird.isActive || (pricing.config?.earlyBird.soldCount ?? 0) >= (pricing.config?.earlyBird.capacity ?? 0) || pricing.currentTier?.id !== 'early_bird'}
                                data-testid="input-early-bird-quantity"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Phase 1 Tickets */}
                      {pricing.config?.phase1.capacity > 1 && (
                        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                                <div className="flex flex-col">
                                  <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                                    Phase 1
                                  </h4>
                                </div>
                                {(pricing.config?.phase1.soldCount ?? 0) >= (pricing.config?.phase1.capacity ?? 0) || (pricing.config?.phase1.capacity ?? 0) === 0 ? (
                                  <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors border-transparent bg-destructive text-destructive-foreground w-fit">Sold Out</span>
                                ) : !pricing.config?.phase1.isActive ? (
                                  <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors border-transparent bg-secondary text-secondary-foreground w-fit">Coming Soon</span>
                                ) : (
                                  <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors border-transparent bg-green-600 text-white w-fit">Available</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center justify-between sm:gap-4">
                              <div className="">
                                <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
                                  Rs. {pricing.config?.phase1.price || 0}
                                </div>
                              </div>
                              <Input
                                type="number"
                                min="0"
                                max="15"
                                className="w-20 text-center"
                                value={pricing.config?.phase1.isActive && pricing.config?.phase1.soldCount < pricing.config?.phase1.capacity && pricing.currentTier?.id === 'phase_1' ? formData.ticketCount.toString() : "0"}
                                onChange={(e) => {
                                  const value = parseInt(e.target.value) || 0;
                                  if (pricing.config?.phase1.isActive && pricing.config?.phase1.soldCount < pricing.config?.phase1.capacity && pricing.currentTier?.id === 'phase_1' && value >= 0 && value <= 15) {
                                    handleTicketCountChange(value);
                                  }
                                }}
                                disabled={!pricing.config?.phase1.isActive || (pricing.config?.phase1.soldCount ?? 0) >= (pricing.config?.phase1.capacity ?? 0) || pricing.currentTier?.id !== 'phase_1'}
                                data-testid="input-phase1-quantity"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Phase 2 Tickets */}
                      {pricing.config?.phase2.capacity > 1 && (
                        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                                <div className="flex flex-col">
                                  <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                                    Phase 2
                                  </h4>
                                </div>
                                {(pricing.config?.phase2.soldCount ?? 0) >= (pricing.config?.phase2.capacity ?? 0) ? (
                                  <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors border-transparent bg-destructive text-destructive-foreground w-fit">Sold Out</span>
                                ) : !pricing.config?.phase2.isActive ? (
                                  <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors border-transparent bg-secondary text-secondary-foreground w-fit">Coming Soon</span>
                                ) : (
                                  <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors border-transparent bg-green-600 text-white w-fit">Available</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center justify-between sm:gap-4">
                              <div className="">
                                <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
                                  Rs. {pricing.config?.phase2.price || 0}
                                </div>
                              </div>
                              <Select 
                                value={pricing.config?.phase2.isActive && pricing.config?.phase2.soldCount < pricing.config?.phase2.capacity && pricing.currentTier?.id === 'phase_2' ? formData.ticketCount.toString() : "0"}
                                onValueChange={(value) => {
                                  if (pricing.config?.phase2.isActive && pricing.config?.phase2.soldCount < pricing.config?.phase2.capacity && pricing.currentTier?.id === 'phase_2') {
                                    handleTicketCountChange(parseInt(value));
                                  }
                                }}
                                disabled={!pricing.config?.phase2.isActive || (pricing.config?.phase2.soldCount ?? 0) >= (pricing.config?.phase2.capacity ?? 0) || pricing.currentTier?.id !== 'phase_2'}
                              >
                                <SelectTrigger className="w-20">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Array.from({ length: 16 }, (_, i) => (
                                    <SelectItem key={i} value={i.toString()}>{i}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Phase 3 Tickets */}
                      {pricing.config?.phase3.capacity > 1 && (
                        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                                <div className="flex flex-col">
                                  <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                                    Phase 3 - Premium Access
                                  </h4>
                                </div>
                                {(pricing.config?.phase3.soldCount ?? 0) >= (pricing.config?.phase3.capacity ?? 0) ? (
                                  <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors border-transparent bg-destructive text-destructive-foreground w-fit">Sold Out</span>
                                ) : !pricing.config?.phase3.isActive ? (
                                  <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors border-transparent bg-secondary text-secondary-foreground w-fit">Coming Soon</span>
                                ) : (
                                  <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors border-transparent bg-green-600 text-white w-fit">Available</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center justify-between sm:gap-4">
                              <div className="">
                                <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
                                  Rs. {pricing.config?.phase3.price || 0}
                                </div>
                              </div>
                              <Select 
                                value={pricing.config?.phase3.isActive && pricing.config?.phase3.soldCount < pricing.config?.phase3.capacity && pricing.currentTier?.id === 'phase_3' ? formData.ticketCount.toString() : "0"}
                                onValueChange={(value) => {
                                  if (pricing.config?.phase3.isActive && pricing.config?.phase3.soldCount < pricing.config?.phase3.capacity && pricing.currentTier?.id === 'phase_3') {
                                    handleTicketCountChange(parseInt(value));
                                  }
                                }}
                                disabled={!pricing.config?.phase3.isActive || (pricing.config?.phase3.soldCount ?? 0) >= (pricing.config?.phase3.capacity ?? 0) || pricing.currentTier?.id !== 'phase_3'}
                              >
                                <SelectTrigger className="w-20">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Array.from({ length: 16 }, (_, i) => (
                                    <SelectItem key={i} value={i.toString()}>{i}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Phase 4 Tickets */}
                      {pricing.config?.phase4.capacity > 1 && (
                        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                                <div className="flex flex-col">
                                  <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                                    Phase 4 - VIP Access
                                  </h4>
                                </div>
                                {(pricing.config?.phase4.soldCount ?? 0) >= (pricing.config?.phase4.capacity ?? 0) ? (
                                  <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors border-transparent bg-destructive text-destructive-foreground w-fit">Sold Out</span>
                                ) : !pricing.config?.phase4.isActive ? (
                                  <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors border-transparent bg-secondary text-secondary-foreground w-fit">Coming Soon</span>
                                ) : (
                                  <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors border-transparent bg-green-600 text-white w-fit">Available</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center justify-between sm:gap-4">
                              <div className="">
                                <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
                                  Rs. {pricing.config?.phase4.price || 0}
                                </div>
                              </div>
                              <Select 
                                value={pricing.config?.phase4.isActive && pricing.config?.phase4.soldCount < pricing.config?.phase4.capacity && pricing.currentTier?.id === 'phase_4' ? formData.ticketCount.toString() : "0"}
                                onValueChange={(value) => {
                                  if (pricing.config?.phase4.isActive && pricing.config?.phase4.soldCount < pricing.config?.phase4.capacity && pricing.currentTier?.id === 'phase_4') {
                                    handleTicketCountChange(parseInt(value));
                                  }
                                }}
                                disabled={!pricing.config?.phase4.isActive || (pricing.config?.phase4.soldCount ?? 0) >= (pricing.config?.phase4.capacity ?? 0) || pricing.currentTier?.id !== 'phase_4'}
                              >
                                <SelectTrigger className="w-20">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Array.from({ length: 16 }, (_, i) => (
                                    <SelectItem key={i} value={i.toString()}>{i}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                      )}

                    </div>

                    {/* Current Selection Summary */}
                    {pricing.currentTier && formData.ticketCount > 0 && (
                      <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <div className="text-center">
                          <span className="text-sm text-blue-700 dark:text-blue-300">
                            Selected: {formData.ticketCount} × {pricing.currentTier.name} tickets = ₹{(formData.ticketCount * pricing.currentTier.price).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Small Email Notification Box */}
                {formData.ticketCount > 0 && (
                  <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <Mail className="h-4 w-4" />
                      <span>Tickets will be delivered to your email after payment</span>
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
                
                {/* Pricing Summary */}
                <div className="bg-card border rounded-lg p-4 space-y-2">
                  <h4 className="text-lg font-semibold">Booking Summary</h4>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between items-center">
                      <span>Tickets ({formData.ticketCount} × ₹{basePrice})</span>
                      <span className="font-medium">₹{totalTicketsPrice.toFixed(2)}</span>
                    </div>
                    
                    {formData.couponDiscount > 0 && (
                      <div className="flex justify-between items-center text-green-600 dark:text-green-400">
                        <span>🎟️ Coupon Discount ({formData.couponDiscount}%)</span>
                        <span className="font-medium">-₹{discountAmount.toFixed(2)}</span>
                      </div>
                    )}
                    
                    <div className="flex justify-between items-center text-orange-600 dark:text-orange-400">
                      <span>💳 Convenience Fee ({formData.ticketCount} × {pricing.formatCurrency(pricingCalculation.convenienceFee / formData.ticketCount)})</span>
                      <span className="font-medium">{pricing.formatCurrency(pricingCalculation.convenienceFee)}</span>
                    </div>
                    
                    <hr className="my-2" />
                    
                    <div className="flex justify-between items-center text-lg font-bold text-purple-700 dark:text-purple-300">
                      <span>Total Amount</span>
                      <span>₹{calculateTotalWithFee().toFixed(2)}</span>
                    </div>
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
                          mode: "production" // Production mode for live payments
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
                            // Redirect to payment success page on same domain to avoid cross-domain issues
                            window.location.href = `${window.location.protocol}//${window.location.host}/payment/success?booking=${bookingId}`;
                          },
                          onFailure: function(data: any) {
                            console.log('Payment failed:', data);
                            // Redirect to payment failure page
                            window.location.href = `/payment/failure?booking=${bookingId}`;
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