import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
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
import { format } from 'date-fns';

interface TeluguNightConfig {
  id: number;
  eventTitle: string;
  eventDescription: string | null;
  venue: string;
  eventDate: string | null;
  maxCapacity: number;
  bookingOpen: boolean;
  earlyBirdPrice: string;
  phase1Price: string;
  phase2Price: string;
  earlyBirdLimit: number;
  phase1Limit: number;
  phase2Limit: number;
  isEarlyBirdActive: boolean;
  isPhase1Active: boolean;
  isPhase2Active: boolean;
  convenientFee: string;
}

export default function TeluguNightEventManagement() {
  const { toast } = useToast();
  
  // Fetch Telugu Night configuration
  const { data: config, isLoading, error: configError } = useQuery({
    queryKey: ['/api/admin/telugu-night-config'],
    retry: 1,
    refetchInterval: 30000, // Refetch every 30 seconds for real-time updates
  });

  // Fetch current ticket counts
  const { data: ticketCounts, error: countsError } = useQuery({
    queryKey: ['/api/admin/telugu-night-counts'],
    retry: 1,
    refetchInterval: 15000, // Refetch every 15 seconds for real-time counts
  });

  const [eventData, setEventData] = useState({
    eventTitle: "Telugu Night 2.0",
    eventDescription: "",
    venue: "Hyderabad",
    eventDate: "",
    maxCapacity: 500,
    earlyBirdPrice: 300,
    phase1Price: 350,
    phase2Price: 400,
    earlyBirdLimit: 90,
    phase1Limit: 200,
    phase2Limit: 210,
    convenientFee: 12.96,
  });

  // Update event configuration
  const updateConfigMutation = useMutation({
    mutationFn: async (configData: any) => {
      return apiRequest('PUT', '/api/admin/telugu-night-config', configData);
    },
    onSuccess: () => {
      toast({
        title: "Configuration updated",
        description: "Telugu Night 2.0 settings have been saved successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/telugu-night-config'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/telugu-night-counts'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Toggle booking status
  const toggleBookingMutation = useMutation({
    mutationFn: async (bookingOpen: boolean) => {
      return apiRequest('PATCH', '/api/admin/telugu-night-config/booking', { bookingOpen });
    },
    onSuccess: (data: any) => {
      toast({
        title: data.bookingOpen ? "Bookings started" : "Bookings stopped",
        description: data.bookingOpen ? "Customers can now book tickets" : "Booking has been disabled",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/telugu-night-config'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to toggle bookings",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Toggle phase activation
  const togglePhaseMutation = useMutation({
    mutationFn: async ({ phase, active }: { phase: string; active: boolean }) => {
      return apiRequest('PATCH', '/api/admin/telugu-night-config/phase', { 
        phase, 
        active 
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Phase updated",
        description: data.message || `Phase ${data.phase || 'phase'} ${data.active ? 'activated' : 'deactivated'} successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/telugu-night-config'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/telugu-night-counts'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to toggle phase",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSaveConfig = () => {
    // Clean the data before sending - remove empty strings and zero values
    const cleanedData = { ...eventData };
    if (cleanedData.eventDate === '' || !cleanedData.eventDate) {
      delete cleanedData.eventDate;
    }
    
    // Ensure all numeric values are valid
    const numericFields = ['earlyBirdPrice', 'phase1Price', 'phase2Price', 'earlyBirdLimit', 'phase1Limit', 'phase2Limit', 'maxCapacity', 'convenientFee'];
    numericFields.forEach(field => {
      if (cleanedData[field] === 0 || cleanedData[field] === '' || isNaN(cleanedData[field])) {
        delete cleanedData[field]; // Let the backend use defaults or current values
      }
    });
    
    console.log('🎯 Sending cleaned config data:', cleanedData);
    updateConfigMutation.mutate(cleanedData);
  };

  const currentConfig = (config as any)?.config as TeluguNightConfig;
  const counts = (ticketCounts as any)?.counts;

  // Update eventData when configuration is loaded
  useEffect(() => {
    if (currentConfig) {
      setEventData({
        eventTitle: currentConfig.eventTitle || "Telugu Night 2.0",
        eventDescription: currentConfig.eventDescription || "",
        venue: currentConfig.venue || "Hyderabad",
        eventDate: currentConfig.eventDate || "",
        maxCapacity: currentConfig.maxCapacity || 500,
        earlyBirdPrice: parseInt(currentConfig.earlyBirdPrice) || 300,
        phase1Price: parseInt(currentConfig.phase1Price) || 350,
        phase2Price: parseInt(currentConfig.phase2Price) || 400,
        earlyBirdLimit: currentConfig.earlyBirdLimit || 90,
        phase1Limit: currentConfig.phase1Limit || 200,
        phase2Limit: currentConfig.phase2Limit || 210,
        convenientFee: parseFloat(currentConfig.convenientFee) || 12.96,
      });
    }
  }, [currentConfig]);

  // Show error messages for authentication or API issues
  useEffect(() => {
    if (configError) {
      toast({
        title: "Configuration Error",
        description: configError.message || "Failed to load event configuration",
        variant: "destructive",
      });
    }
    if (countsError) {
      toast({
        title: "Counts Error", 
        description: countsError.message || "Failed to load ticket counts",
        variant: "destructive",
      });
    }
  }, [configError, countsError, toast]);

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (configError && configError.message.includes("Access denied")) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <div className="text-red-500 text-lg mb-4">Authentication Required</div>
        <div className="text-gray-600">Please log in to access the configuration panel</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Event Overview */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-2xl">Telugu Night 2.0</CardTitle>
              <CardDescription>Single event management system</CardDescription>
            </div>
            <div className="flex items-center gap-4">
              <Badge 
                variant={currentConfig?.bookingOpen ? "default" : "secondary"}
                className="text-lg px-4 py-2"
              >
                {currentConfig?.bookingOpen ? "LIVE" : "STOPPED"}
              </Badge>
              <Button
                onClick={() => toggleBookingMutation.mutate(!currentConfig?.bookingOpen)}
                disabled={toggleBookingMutation.isPending}
                variant={currentConfig?.bookingOpen ? "destructive" : "default"}
                size="lg"
                data-testid="button-toggle-booking"
              >
                {currentConfig?.bookingOpen ? (
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
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-blue-500" />
              <div>
                <p className="font-medium">Event Date</p>
                <p className="text-sm text-gray-500">
                  {currentConfig?.eventDate ? format(new Date(currentConfig.eventDate), 'MMM dd, yyyy') : 'Not set'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <MapPin className="w-5 h-5 text-green-500" />
              <div>
                <p className="font-medium">Venue</p>
                <p className="text-sm text-gray-500">{currentConfig?.venue || 'Hyderabad'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-purple-500" />
              <div>
                <p className="font-medium">Capacity</p>
                <p className="text-sm text-gray-500">{currentConfig?.maxCapacity || 500} total</p>
              </div>
            </div>
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
              <p className="font-semibold text-lg">{counts?.earlyBirdCount || 0}</p>
              <p className="text-sm text-gray-500">Early Bird</p>
              <p className="text-xs text-gray-400">of {currentConfig?.earlyBirdLimit} limit</p>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <Clock className="w-8 h-8 mx-auto mb-2 text-blue-500" />
              <p className="font-semibold text-lg">{counts?.phase1Count || 0}</p>
              <p className="text-sm text-gray-500">Phase 1</p>
              <p className="text-xs text-gray-400">of {currentConfig?.phase1Limit} limit</p>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <Zap className="w-8 h-8 mx-auto mb-2 text-orange-500" />
              <p className="font-semibold text-lg">{counts?.phase2Count || 0}</p>
              <p className="text-sm text-gray-500">Phase 2</p>
              <p className="text-xs text-gray-400">of {currentConfig?.phase2Limit} limit</p>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <Zap className="w-8 h-8 mx-auto mb-2 text-indigo-500" />
              <p className="font-semibold text-lg">{counts?.phase3Count || 0}</p>
              <p className="text-sm text-gray-500">Phase 3</p>
              <p className="text-xs text-gray-400">of {currentConfig?.phase3Limit} limit</p>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <Zap className="w-8 h-8 mx-auto mb-2 text-red-500" />
              <p className="font-semibold text-lg">{counts?.phase4Count || 0}</p>
              <p className="text-sm text-gray-500">Phase 4</p>
              <p className="text-xs text-gray-400">of {currentConfig?.phase4Limit} limit</p>
            </div>
            <div className="text-center p-4 border rounded-lg bg-primary/10">
              <Users className="w-8 h-8 mx-auto mb-2 text-primary" />
              <p className="font-semibold text-lg">{counts?.totalSold || 0}</p>
              <p className="text-sm text-gray-500">Total Sold</p>
              <p className="text-xs text-gray-400">of {currentConfig?.maxCapacity} capacity</p>
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
          <CardDescription>Control active phases and pricing</CardDescription>
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
                  checked={currentConfig?.isEarlyBirdActive}
                  onCheckedChange={(checked) => togglePhaseMutation.mutate({ phase: 'earlybird', active: checked })}
                  data-testid="switch-early-bird"
                />
              </div>
              <div className="space-y-2">
                <p className="text-lg font-semibold">₹{currentConfig?.earlyBirdPrice}</p>
                <p className="text-sm text-gray-500">{counts?.earlyBirdCount || 0} / {currentConfig?.earlyBirdLimit} sold</p>
                <Badge variant={currentConfig?.isEarlyBirdActive ? "default" : "secondary"}>
                  {currentConfig?.isEarlyBirdActive ? "Active" : "Inactive"}
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
                  checked={currentConfig?.isPhase1Active}
                  onCheckedChange={(checked) => togglePhaseMutation.mutate({ phase: 'phase1', active: checked })}
                  data-testid="switch-phase-1"
                />
              </div>
              <div className="space-y-2">
                <p className="text-lg font-semibold">₹{currentConfig?.phase1Price}</p>
                <p className="text-sm text-gray-500">{counts?.phase1Count || 0} / {currentConfig?.phase1Limit} sold</p>
                <Badge variant={currentConfig?.isPhase1Active ? "default" : "secondary"}>
                  {currentConfig?.isPhase1Active ? "Active" : "Inactive"}
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
                  checked={currentConfig?.isPhase2Active}
                  onCheckedChange={(checked) => togglePhaseMutation.mutate({ phase: 'phase2', active: checked })}
                  data-testid="switch-phase-2"
                />
              </div>
              <div className="space-y-2">
                <p className="text-lg font-semibold">₹{currentConfig?.phase2Price}</p>
                <p className="text-sm text-gray-500">{counts?.phase2Count || 0} / {currentConfig?.phase2Limit} sold</p>
                <Badge variant={currentConfig?.isPhase2Active ? "default" : "secondary"}>
                  {currentConfig?.isPhase2Active ? "Active" : "Inactive"}
                </Badge>
              </div>
            </div>

            {/* Phase 3 */}
            <div className="border rounded-lg p-4">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-indigo-500" />
                  <h3 className="font-medium">Phase 3</h3>
                </div>
                <Switch
                  checked={currentConfig?.isPhase3Active}
                  onCheckedChange={(checked) => togglePhaseMutation.mutate({ phase: 'phase3', active: checked })}
                  data-testid="switch-phase-3"
                />
              </div>
              <div className="space-y-2">
                <p className="text-lg font-semibold">₹{currentConfig?.phase3Price}</p>
                <p className="text-sm text-gray-500">{counts?.phase3Count || 0} / {currentConfig?.phase3Limit} sold</p>
                <Badge variant={currentConfig?.isPhase3Active ? "default" : "secondary"}>
                  {currentConfig?.isPhase3Active ? "Active" : "Inactive"}
                </Badge>
              </div>
            </div>

            {/* Phase 4 */}
            <div className="border rounded-lg p-4">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-red-500" />
                  <h3 className="font-medium">Phase 4</h3>
                </div>
                <Switch
                  checked={currentConfig?.isPhase4Active}
                  onCheckedChange={(checked) => togglePhaseMutation.mutate({ phase: 'phase4', active: checked })}
                  data-testid="switch-phase-4"
                />
              </div>
              <div className="space-y-2">
                <p className="text-lg font-semibold">₹{currentConfig?.phase4Price}</p>
                <p className="text-sm text-gray-500">{counts?.phase4Count || 0} / {currentConfig?.phase4Limit} sold</p>
                <Badge variant={currentConfig?.isPhase4Active ? "default" : "secondary"}>
                  {currentConfig?.isPhase4Active ? "Active" : "Inactive"}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Event Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Event Configuration</CardTitle>
          <CardDescription>Update event details and pricing</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="event-title">Event Title</Label>
              <Input
                id="event-title"
                placeholder="Telugu Night 2.0"
                value={eventData.eventTitle}
                onChange={(e) => setEventData({...eventData, eventTitle: e.target.value})}
                data-testid="input-event-title"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="venue">Venue</Label>
              <Input
                id="venue"
                placeholder="Hyderabad"
                value={eventData.venue}
                onChange={(e) => setEventData({...eventData, venue: e.target.value})}
                data-testid="input-venue"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="event-date">Event Date</Label>
              <Input
                id="event-date"
                type="datetime-local"
                value={eventData.eventDate}
                onChange={(e) => setEventData({...eventData, eventDate: e.target.value})}
                data-testid="input-event-date"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="max-capacity">Maximum Capacity</Label>
              <Input
                id="max-capacity"
                type="number"
                min="1"
                value={eventData.maxCapacity || ''}
                onChange={(e) => setEventData({...eventData, maxCapacity: parseInt(e.target.value) || 0})}
                data-testid="input-max-capacity"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="event-description">Event Description</Label>
            <Textarea
              id="event-description"
              placeholder="Describe your Telugu Night 2.0 event..."
              value={eventData.eventDescription}
              onChange={(e) => setEventData({...eventData, eventDescription: e.target.value})}
              data-testid="textarea-event-description"
            />
          </div>

          <Separator />

          <div>
            <h3 className="font-medium mb-4">Pricing Configuration</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="early-bird-price">Early Bird Price (₹)</Label>
                <Input
                  id="early-bird-price"
                  type="number"
                  min="1"
                  value={eventData.earlyBirdPrice || ''}
                  onChange={(e) => setEventData({...eventData, earlyBirdPrice: parseInt(e.target.value) || 0})}
                  data-testid="input-early-bird-price"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phase1-price">Phase 1 Price (₹)</Label>
                <Input
                  id="phase1-price"
                  type="number"
                  min="1"
                  value={eventData.phase1Price || ''}
                  onChange={(e) => setEventData({...eventData, phase1Price: parseInt(e.target.value) || 0})}
                  data-testid="input-phase1-price"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phase2-price">Phase 2 Price (₹)</Label>
                <Input
                  id="phase2-price"
                  type="number"
                  min="1"
                  value={eventData.phase2Price || ''}
                  onChange={(e) => setEventData({...eventData, phase2Price: parseInt(e.target.value) || 0})}
                  data-testid="input-phase2-price"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="convenient-fee">Convenience Fee (₹)</Label>
                <Input
                  id="convenient-fee"
                  type="number"
                  min="0"
                  step="0.01"
                  value={eventData.convenientFee || ''}
                  onChange={(e) => setEventData({...eventData, convenientFee: parseFloat(e.target.value) || 0})}
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
                  value={eventData.earlyBirdLimit || ''}
                  onChange={(e) => setEventData({...eventData, earlyBirdLimit: parseInt(e.target.value) || 0})}
                  data-testid="input-early-bird-limit"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phase1-limit">Phase 1 Limit</Label>
                <Input
                  id="phase1-limit"
                  type="number"
                  min="1"
                  value={eventData.phase1Limit || ''}
                  onChange={(e) => setEventData({...eventData, phase1Limit: parseInt(e.target.value) || 0})}
                  data-testid="input-phase1-limit"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phase2-limit">Phase 2 Limit</Label>
                <Input
                  id="phase2-limit"
                  type="number"
                  min="1"
                  value={eventData.phase2Limit || ''}
                  onChange={(e) => setEventData({...eventData, phase2Limit: parseInt(e.target.value) || 0})}
                  data-testid="input-phase2-limit"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button 
              onClick={handleSaveConfig}
              disabled={updateConfigMutation.isPending}
              size="lg"
              data-testid="button-save-config"
            >
              {updateConfigMutation.isPending ? (
                <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full mr-2" />
              ) : (
                <Settings className="w-4 h-4 mr-2" />
              )}
              {updateConfigMutation.isPending ? "Saving..." : "Save Configuration"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}