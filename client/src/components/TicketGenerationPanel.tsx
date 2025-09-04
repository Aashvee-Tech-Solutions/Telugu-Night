import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Zap, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Play, 
  Pause, 
  RefreshCw,
  Download,
  Users,
  Ticket
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Booking } from "@shared/schema";

interface GenerationProgress {
  bookingId: number;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  progress: number;
  currentStep: string;
  qrCodes: string[];
  passIds: string[];
  errors: string[];
  startTime: string;
  completedAt?: string;
}

interface BatchProgress {
  batchId: string;
  totalBookings: number;
  completed: number;
  failed: number;
  progress: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  bookings: GenerationProgress[];
  startTime: string;
  completedAt?: string;
}

interface TicketGenerationPanelProps {
  bookings: Booking[];
  onRefresh: () => void;
}

export const TicketGenerationPanel = ({ bookings, onRefresh }: TicketGenerationPanelProps) => {
  const { toast } = useToast();
  const [selectedBookings, setSelectedBookings] = useState<number[]>([]);
  const [activeBatches, setActiveBatches] = useState<BatchProgress[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentProgress, setCurrentProgress] = useState<GenerationProgress | null>(null);

  // Filter bookings that need ticket generation
  const verifiedBookingsNeedingTickets = bookings.filter(booking => 
    booking.paymentStatus === 'verified' && 
    (!booking.qrCodes || booking.qrCodes.length === 0)
  );

  const pendingBookings = bookings.filter(booking => 
    booking.paymentStatus === 'pending' && booking.paymentScreenshot
  );

  // Generate tickets for single booking
  const generateSingleTicket = async (bookingId: number) => {
    try {
      setIsProcessing(true);
      const response = await apiRequest('POST', `/api/admin/generate-tickets/${bookingId}`);
      
      toast({
        title: "Tickets Generated!",
        description: `Successfully generated ${response.qrCodes} tickets`,
      });
      
      onRefresh();
    } catch (error: any) {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate tickets",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Generate tickets for multiple bookings
  const generateBatchTickets = async () => {
    if (selectedBookings.length === 0) {
      toast({
        title: "No Bookings Selected",
        description: "Please select bookings to generate tickets for",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsProcessing(true);
      const response = await apiRequest('POST', '/api/admin/generate-tickets-batch', {
        bookingIds: selectedBookings
      });

      const batchId = response.batchId;
      
      // Start polling for progress
      pollBatchProgress(batchId);
      
      toast({
        title: "Batch Generation Started",
        description: `Processing ${selectedBookings.length} bookings`,
      });

      setSelectedBookings([]);
    } catch (error: any) {
      toast({
        title: "Batch Generation Failed",
        description: error.message || "Failed to start batch generation",
        variant: "destructive",
      });
      setIsProcessing(false);
    }
  };

  // Auto-generate tickets for all verified payments
  const autoGenerateAll = async () => {
    try {
      setIsProcessing(true);
      const response = await apiRequest('POST', '/api/admin/auto-generate-tickets');
      
      if (response.batchIds.length > 0) {
        // Poll progress for all batches
        response.batchIds.forEach((batchId: string) => pollBatchProgress(batchId));
        
        toast({
          title: "Auto-Generation Started",
          description: `Started ${response.totalBatches} batch(es) for ticket generation`,
        });
      } else {
        toast({
          title: "No Tickets Needed",
          description: "All verified bookings already have tickets",
        });
      }
    } catch (error: any) {
      toast({
        title: "Auto-Generation Failed",
        description: error.message || "Failed to start auto-generation",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Poll batch progress
  const pollBatchProgress = (batchId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const progress = await apiRequest('GET', `/api/admin/batch-progress/${batchId}`);
        
        setActiveBatches(prev => {
          const updated = prev.filter(batch => batch.batchId !== batchId);
          return [...updated, progress];
        });

        // Stop polling if completed
        if (progress.status === 'completed' || progress.status === 'failed') {
          clearInterval(pollInterval);
          setIsProcessing(false);
          onRefresh();
          
          toast({
            title: progress.status === 'completed' ? "Batch Completed" : "Batch Failed",
            description: `${progress.completed} completed, ${progress.failed} failed`,
            variant: progress.failed > 0 ? "destructive" : "default",
          });
        }
      } catch (error) {
        clearInterval(pollInterval);
        setIsProcessing(false);
      }
    }, 2000);

    // Cleanup after 10 minutes
    setTimeout(() => clearInterval(pollInterval), 10 * 60 * 1000);
  };

  const toggleBookingSelection = (bookingId: number) => {
    setSelectedBookings(prev => 
      prev.includes(bookingId) 
        ? prev.filter(id => id !== bookingId)
        : [...prev, bookingId]
    );
  };

  const selectAllVerified = () => {
    setSelectedBookings(verifiedBookingsNeedingTickets.map(b => b.id));
  };

  const clearSelection = () => {
    setSelectedBookings([]);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Smart Ticket Generation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="single" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="single">Single Booking</TabsTrigger>
              <TabsTrigger value="batch">Batch Processing</TabsTrigger>
              <TabsTrigger value="auto">Auto-Generate</TabsTrigger>
            </TabsList>

            {/* Single Booking Tab */}
            <TabsContent value="single" className="space-y-4">
              <div className="grid gap-4">
                <h3 className="text-lg font-semibold">Verified Bookings Needing Tickets</h3>
                {verifiedBookingsNeedingTickets.length === 0 ? (
                  <p className="text-muted-foreground">No bookings need ticket generation</p>
                ) : (
                  <div className="space-y-2">
                    {verifiedBookingsNeedingTickets.slice(0, 10).map(booking => (
                      <div key={booking.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">{booking.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {booking.ticketCount} tickets • ₹{booking.totalAmount}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => generateSingleTicket(booking.id)}
                          disabled={isProcessing}
                        >
                          <Ticket className="w-4 h-4 mr-1" />
                          Generate Tickets
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Batch Processing Tab */}
            <TabsContent value="batch" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Batch Ticket Generation</h3>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={selectAllVerified}>
                    Select All ({verifiedBookingsNeedingTickets.length})
                  </Button>
                  <Button variant="outline" size="sm" onClick={clearSelection}>
                    Clear Selection
                  </Button>
                </div>
              </div>
              
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {verifiedBookingsNeedingTickets.map(booking => (
                  <div key={booking.id} className="flex items-center space-x-3 p-2 border rounded">
                    <Checkbox
                      checked={selectedBookings.includes(booking.id)}
                      onCheckedChange={() => toggleBookingSelection(booking.id)}
                    />
                    <div className="flex-1">
                      <p className="font-medium">{booking.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {booking.ticketCount} tickets • ₹{booking.totalAmount}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <Button 
                onClick={generateBatchTickets}
                disabled={isProcessing || selectedBookings.length === 0}
                className="w-full"
              >
                <Users className="w-4 h-4 mr-2" />
                Generate {selectedBookings.length} Selected Tickets
              </Button>
            </TabsContent>

            {/* Auto-Generate Tab */}
            <TabsContent value="auto" className="space-y-4">
              <div className="text-center space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Automated Ticket Generation</h3>
                  <p className="text-muted-foreground">
                    Automatically generate tickets for all verified payments that don't have tickets yet.
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <p className="font-medium text-green-800 dark:text-green-200">
                      {verifiedBookingsNeedingTickets.length}
                    </p>
                    <p className="text-green-600 dark:text-green-300">Needing Tickets</p>
                  </div>
                  <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                    <p className="font-medium text-orange-800 dark:text-orange-200">
                      {pendingBookings.length}
                    </p>
                    <p className="text-orange-600 dark:text-orange-300">Pending Verification</p>
                  </div>
                </div>

                <Button 
                  onClick={autoGenerateAll}
                  disabled={isProcessing || verifiedBookingsNeedingTickets.length === 0}
                  size="lg"
                  className="w-full"
                >
                  <Zap className="w-4 h-4 mr-2" />
                  Auto-Generate All Tickets
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Active Batches */}
      {activeBatches.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Active Batch Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeBatches.map(batch => (
              <div key={batch.batchId} className="space-y-3 p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Batch {batch.batchId.split('_')[1]}</p>
                    <p className="text-sm text-muted-foreground">
                      {batch.completed + batch.failed} / {batch.totalBookings} processed
                    </p>
                  </div>
                  <Badge variant={batch.status === 'completed' ? 'default' : 'secondary'}>
                    {batch.status}
                  </Badge>
                </div>
                
                <Progress value={batch.progress} className="w-full" />
                
                <div className="flex justify-between text-sm">
                  <span className="text-green-600">✓ {batch.completed} completed</span>
                  <span className="text-red-600">✗ {batch.failed} failed</span>
                </div>

                {batch.status === 'processing' && (
                  <div className="space-y-2">
                    {batch.bookings
                      .filter(b => b.status === 'generating')
                      .slice(0, 3)
                      .map(booking => (
                        <div key={booking.bookingId} className="text-xs p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
                          <p>Booking #{booking.bookingId}: {booking.currentStep}</p>
                          <Progress value={booking.progress} className="h-1 mt-1" />
                        </div>
                      ))}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};