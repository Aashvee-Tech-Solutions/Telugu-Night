import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { usePricing, PricingConfig } from '@/hooks/usePricing';
import { 
  Calendar, 
  MapPin, 
  Users, 
  DollarSign, 
  Settings,
  Play,
  Pause,
  Clock,
  Star,
  TrendingUp,
  Zap
} from 'lucide-react';

interface AdminConfigPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminConfigPanel = ({ isOpen, onClose }: AdminConfigPanelProps) => {
  const { toast } = useToast();
  const { config, updateConfig, togglePhase } = usePricing();
  
  const [eventData, setEventData] = useState({
    eventTitle: "Telugu Night 2.0",
    eventDescription: "",
    venue: "Hyderabad",
    eventDate: "",
    maxCapacity: 500,
    bookingOpen: true,
    earlyBirdPrice: config.earlyBirdPrice,
    phase1Price: config.phase1Price,
    phase2Price: config.phase2Price,
    earlyBirdLimit: config.earlyBirdLimit,
    phase1Limit: config.phase1Limit,
    phase2Limit: config.phase2Limit,
    convenienceFee: config.convenienceFee,
  });

  // Update form data when config changes
  useEffect(() => {
    setEventData(prev => ({
      ...prev,
      earlyBirdPrice: config.earlyBirdPrice,
      phase1Price: config.phase1Price,
      phase2Price: config.phase2Price,
      earlyBirdLimit: config.earlyBirdLimit,
      phase1Limit: config.phase1Limit,
      phase2Limit: config.phase2Limit,
      convenienceFee: config.convenienceFee,
    }));
  }, [config]);

  const handleSaveConfig = () => {
    // Update the pricing configuration
    const newConfig: Partial<PricingConfig> = {
      earlyBirdPrice: eventData.earlyBirdPrice,
      phase1Price: eventData.phase1Price,
      phase2Price: eventData.phase2Price,
      convenienceFee: eventData.convenienceFee,
      earlyBirdLimit: eventData.earlyBirdLimit,
      phase1Limit: eventData.phase1Limit,
      phase2Limit: eventData.phase2Limit,
    };

    updateConfig(newConfig);
    
    toast({
      title: "Configuration updated",
      description: "Telugu Night 2.0 settings have been saved successfully",
    });
  };

  const handleToggleBooking = () => {
    setEventData(prev => ({ ...prev, bookingOpen: !prev.bookingOpen }));
    
    toast({
      title: eventData.bookingOpen ? "Bookings stopped" : "Bookings started",
      description: eventData.bookingOpen ? "Booking has been disabled" : "Customers can now book tickets",
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-background rounded-lg shadow-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Telugu Night 2.0 - Admin Configuration</h2>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>

          <div className="space-y-6">
            {/* Event Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Event Status
                </CardTitle>
                <CardDescription>Single event management system</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Badge 
                      variant={eventData.bookingOpen ? "default" : "secondary"}
                      className="text-lg px-4 py-2"
                    >
                      {eventData.bookingOpen ? "LIVE" : "STOPPED"}
                    </Badge>
                  </div>
                  <Button
                    onClick={handleToggleBooking}
                    variant={eventData.bookingOpen ? "destructive" : "default"}
                    size="lg"
                    data-testid="button-toggle-booking"
                  >
                    {eventData.bookingOpen ? (
                      <>
                        <Pause className="w-5 h-5 mr-2" />
                        Stop Bookings
                      </>
                    ) : (
                      <>
                        <Play className="w-5 h-5 mr-2" />
                        Start Bookings
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Sales Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Sales Overview
                </CardTitle>
                <CardDescription>Current ticket sales by phase</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 border rounded-lg">
                    <Star className="w-8 h-8 mx-auto mb-2 text-yellow-500" />
                    <p className="font-semibold text-lg">{config.currentSold.earlyBird}</p>
                    <p className="text-sm text-gray-500">Early Bird</p>
                    <p className="text-xs text-gray-400">of {config.earlyBirdLimit} limit</p>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <Clock className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                    <p className="font-semibold text-lg">{config.currentSold.phase1}</p>
                    <p className="text-sm text-gray-500">Phase 1</p>
                    <p className="text-xs text-gray-400">of {config.phase1Limit} limit</p>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <Zap className="w-8 h-8 mx-auto mb-2 text-orange-500" />
                    <p className="font-semibold text-lg">{config.currentSold.phase2}</p>
                    <p className="text-sm text-gray-500">Phase 2</p>
                    <p className="text-xs text-gray-400">of {config.phase2Limit} limit</p>
                  </div>
                  <div className="text-center p-4 border rounded-lg bg-primary/10">
                    <Users className="w-8 h-8 mx-auto mb-2 text-primary" />
                    <p className="font-semibold text-lg">
                      {config.currentSold.earlyBird + config.currentSold.phase1 + config.currentSold.phase2}
                    </p>
                    <p className="text-sm text-gray-500">Total Sold</p>
                    <p className="text-xs text-gray-400">of {eventData.maxCapacity} capacity</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Phase Management */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Phase Management
                </CardTitle>
                <CardDescription>Control active phases and pricing (Only one phase can be active at a time)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Early Bird Phase */}
                  <div className="border rounded-lg p-4">
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex items-center gap-2">
                        <Star className="w-5 h-5 text-yellow-500" />
                        <h3 className="font-medium">Early Bird</h3>
                      </div>
                      <Switch
                        checked={config.isEarlyBirdActive}
                        onCheckedChange={(checked) => togglePhase('earlyBird', checked)}
                        data-testid="switch-early-bird"
                      />
                    </div>
                    <div className="space-y-2">
                      <p className="text-lg font-semibold">₹{config.earlyBirdPrice}</p>
                      <p className="text-sm text-gray-500">{config.currentSold.earlyBird} / {config.earlyBirdLimit} sold</p>
                      <Badge variant={config.isEarlyBirdActive ? "default" : "secondary"}>
                        {config.isEarlyBirdActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </div>

                  {/* Phase 1 */}
                  <div className="border rounded-lg p-4">
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex items-center gap-2">
                        <Clock className="w-5 h-5 text-blue-500" />
                        <h3 className="font-medium">Phase 1</h3>
                      </div>
                      <Switch
                        checked={config.isPhase1Active}
                        onCheckedChange={(checked) => togglePhase('phase1', checked)}
                        data-testid="switch-phase-1"
                      />
                    </div>
                    <div className="space-y-2">
                      <p className="text-lg font-semibold">₹{config.phase1Price}</p>
                      <p className="text-sm text-gray-500">{config.currentSold.phase1} / {config.phase1Limit} sold</p>
                      <Badge variant={config.isPhase1Active ? "default" : "secondary"}>
                        {config.isPhase1Active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </div>

                  {/* Phase 2 */}
                  <div className="border rounded-lg p-4">
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex items-center gap-2">
                        <Zap className="w-5 h-5 text-orange-500" />
                        <h3 className="font-medium">Phase 2</h3>
                      </div>
                      <Switch
                        checked={config.isPhase2Active}
                        onCheckedChange={(checked) => togglePhase('phase2', checked)}
                        data-testid="switch-phase-2"
                      />
                    </div>
                    <div className="space-y-2">
                      <p className="text-lg font-semibold">₹{config.phase2Price}</p>
                      <p className="text-sm text-gray-500">{config.currentSold.phase2} / {config.phase2Limit} sold</p>
                      <Badge variant={config.isPhase2Active ? "default" : "secondary"}>
                        {config.isPhase2Active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Configuration Form */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Event Configuration
                </CardTitle>
                <CardDescription>Update event settings and pricing</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-medium mb-4">Pricing Configuration</h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="early-bird-price">Early Bird Price (₹)</Label>
                      <Input
                        id="early-bird-price"
                        type="number"
                        min="1"
                        value={eventData.earlyBirdPrice}
                        onChange={(e) => setEventData({...eventData, earlyBirdPrice: parseInt(e.target.value)})}
                        data-testid="input-early-bird-price"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="phase1-price">Phase 1 Price (₹)</Label>
                      <Input
                        id="phase1-price"
                        type="number"
                        min="1"
                        value={eventData.phase1Price}
                        onChange={(e) => setEventData({...eventData, phase1Price: parseInt(e.target.value)})}
                        data-testid="input-phase1-price"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="phase2-price">Phase 2 Price (₹)</Label>
                      <Input
                        id="phase2-price"
                        type="number"
                        min="1"
                        value={eventData.phase2Price}
                        onChange={(e) => setEventData({...eventData, phase2Price: parseInt(e.target.value)})}
                        data-testid="input-phase2-price"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="convenience-fee">Convenience Fee (₹)</Label>
                      <Input
                        id="convenience-fee"
                        type="number"
                        min="0"
                        step="0.01"
                        value={eventData.convenienceFee}
                        onChange={(e) => setEventData({...eventData, convenienceFee: parseFloat(e.target.value)})}
                        data-testid="input-convenience-fee"
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="font-medium mb-4">Ticket Limits</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="early-bird-limit">Early Bird Limit</Label>
                      <Input
                        id="early-bird-limit"
                        type="number"
                        min="1"
                        value={eventData.earlyBirdLimit}
                        onChange={(e) => setEventData({...eventData, earlyBirdLimit: parseInt(e.target.value)})}
                        data-testid="input-early-bird-limit"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="phase1-limit">Phase 1 Limit</Label>
                      <Input
                        id="phase1-limit"
                        type="number"
                        min="1"
                        value={eventData.phase1Limit}
                        onChange={(e) => setEventData({...eventData, phase1Limit: parseInt(e.target.value)})}
                        data-testid="input-phase1-limit"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="phase2-limit">Phase 2 Limit</Label>
                      <Input
                        id="phase2-limit"
                        type="number"
                        min="1"
                        value={eventData.phase2Limit}
                        onChange={(e) => setEventData({...eventData, phase2Limit: parseInt(e.target.value)})}
                        data-testid="input-phase2-limit"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button 
                    onClick={handleSaveConfig}
                    size="lg"
                    data-testid="button-save-config"
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Save Configuration
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};