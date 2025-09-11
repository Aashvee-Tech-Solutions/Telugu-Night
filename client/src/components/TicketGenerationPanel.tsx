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
            <CheckCircle className="h-5 w-5 text-green-600" />
            Automated Ticket Processing Status
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            All tickets are automatically generated and sent via Cashfree webhook - no manual action required
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Automated Processing Status */}
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <CheckCircle className="h-8 w-8 text-green-600" />
                <div>
                  <h3 className="text-lg font-semibold text-green-800 dark:text-green-200">Automated Processing Active</h3>
                  <p className="text-green-600 dark:text-green-300 text-sm">Payment verification and ticket generation handled automatically</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-700 dark:text-green-200">
                    {bookings.filter(b => b.paymentStatus === 'verified').length}
                  </div>
                  <div className="text-sm text-green-600 dark:text-green-300">Verified Payments</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-700 dark:text-blue-200">
                    {bookings.filter(b => b.paymentStatus === 'pending').length}
                  </div>
                  <div className="text-sm text-blue-600 dark:text-blue-300">Processing</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-700 dark:text-green-200">
                    {bookings.filter(b => b.qrCodes && b.qrCodes.length > 0).length}
                  </div>
                  <div className="text-sm text-green-600 dark:text-green-300">Tickets Generated</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-700 dark:text-orange-200">
                    {bookings.filter(b => b.paymentStatus === 'verified' && (!b.qrCodes || b.qrCodes.length === 0)).length}
                  </div>
                  <div className="text-sm text-orange-600 dark:text-orange-300">Awaiting Generation</div>
                </div>
              </div>
            </div>

            {/* Recent Booking Activity */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Recent Booking Activity</h3>
              {bookings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Ticket className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No recent bookings to display</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {bookings.slice(0, 10).map(booking => (
                    <div key={booking.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{booking.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {booking.ticketCount} tickets • ₹{booking.totalAmount}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {booking.paymentStatus === 'verified' ? (
                          <Badge variant="default" className="bg-green-500">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Auto-Processed
                          </Badge>
                        ) : booking.paymentStatus === 'pending' ? (
                          <Badge variant="secondary">
                            <Clock className="w-3 h-3 mr-1" />
                            Processing
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            <XCircle className="w-3 h-3 mr-1" />
                            {booking.paymentStatus}
                          </Badge>
                        )}
                        {booking.qrCodes && booking.qrCodes.length > 0 && (
                          <Badge variant="outline">
                            <Ticket className="w-3 h-3 mr-1" />
                            Tickets Sent
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Webhook Status Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-blue-600" />
            Cashfree Webhook Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <p className="font-medium text-blue-800 dark:text-blue-200">Webhook Active & Monitoring</p>
            </div>
            <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
              <p>• Payments are automatically verified upon completion</p>
              <p>• Tickets are generated and emailed immediately after verification</p>
              <p>• No manual intervention required for payment processing</p>
              <p>• All booking statuses update in real-time</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};