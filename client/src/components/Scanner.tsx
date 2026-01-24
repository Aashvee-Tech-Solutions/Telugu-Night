import { useState, useRef, useEffect } from 'react';
import { Camera, X, Zap, CheckCircle, AlertCircle, Keyboard, Users, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import QrScanner from 'qr-scanner';

interface ScanResult {
  success: boolean;
  message: string;
  alreadyScanned?: boolean;
  booking?: {
    id: number;
    name: string;
    email: string;
    ticketCount: number;
    guests: string[];
    guestCodes: string[];
    scannedGuests: string[];
    totalAmount: string;
    paymentStatus: string;
    gender?: string;
    guestGenders?: string[];
    couponCode?: string;
    couponDiscount?: number;
  };
  guestInfo?: {
    guestName: string;
    guestCode: string;
    guestIndex: number;
  };
}

interface ScannerProps {
  onClose?: () => void;
  onScanSuccess?: (result: ScanResult) => void;
  embedded?: boolean; // New prop to control if it's embedded in another component
}

export default function Scanner({ onClose, onScanSuccess, embedded = false }: ScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [manualEntry, setManualEntry] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [lastScanResult, setLastScanResult] = useState<ScanResult | null>(null);
  const [showGuestChecklist, setShowGuestChecklist] = useState(false);
  const [selectedGuests, setSelectedGuests] = useState<string[]>([]);
  const [isProcessingScan, setIsProcessingScan] = useState(false);
  const [lastScannedCode, setLastScannedCode] = useState<string>('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const qrScannerRef = useRef<QrScanner | null>(null);
  const { toast } = useToast();

  const checkInMutation = useMutation({
    mutationFn: async (data: { bookingId: number, guestCodes: string[] }) => {
      return await apiRequest('POST', '/api/scanner/check-in-guests', data);
    },
    onSuccess: (result: any) => {
      toast({
        title: "Guests Checked In",
        description: `${selectedGuests.length} guest(s) successfully entered Telugu Night!`,
      });
      setSelectedGuests([]);
      setShowGuestChecklist(false);
      setLastScanResult(null);
    },
    onError: (error) => {
      toast({
        title: "Check-in Failed",
        description: "Failed to process guest entries. Please try again.",
        variant: "destructive",
      });
    }
  });

  const scanMutation = useMutation({
    mutationFn: async (code: string) => {
      return await apiRequest('POST', '/api/scanner/scan', { scanData: code.trim() });
    },
    onSuccess: (result: ScanResult) => {
      console.log('✅ Scanner success:', result);
      setLastScanResult(result);
      setIsProcessingScan(false);
      onScanSuccess?.(result);
      
      if (result.success) {
        // Check if guest already scanned
        if (result.alreadyScanned) {
          toast({
            title: "⛔ Already Scanned",
            description: result.message,
            variant: "destructive",
          });
          return;
        }

        // Show guest checklist for group bookings, immediate entry for individual
        if (result.booking && result.booking.ticketCount > 1 && !result.guestInfo) {
          setShowGuestChecklist(true);
        }
        
        if (result.guestInfo) {
          toast({
            title: "Entry Approved",
            description: `${result.guestInfo.guestName} (${result.guestInfo.guestCode}) - Welcome to Telugu Night!`,
          });
        } else {
          toast({
            title: "Entry Verified",
            description: `Welcome ${result.booking?.name}! ${result.booking?.ticketCount === 1 ? 'Individual entry approved.' : 'Group booking verified - select guests to enter.'}`,
          });
        }
      } else {
        toast({
          title: "Entry Denied", 
          description: result.message,
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      console.error('❌ Scanner error:', error);
      setIsProcessingScan(false);
      toast({
        title: "Scanner Error",
        description: error.message || "Failed to verify entry",
        variant: "destructive",
      });
    },
  });

  const startCamera = async () => {
    try {
      setIsScanning(true);
      setIsProcessingScan(false);
      setLastScannedCode('');
      
      if (!videoRef.current) {
        throw new Error('Video element not found');
      }

      // Initialize QR scanner
      qrScannerRef.current = new QrScanner(
        videoRef.current,
        (result) => {
          const scannedData = result.data;
          console.log('QR Code detected:', scannedData);
          
          // Prevent duplicate scans of the same code
          if (isProcessingScan || lastScannedCode === scannedData) {
            console.log('⏭️ Skipping duplicate scan:', scannedData);
            return;
          }
          
          setIsProcessingScan(true);
          setLastScannedCode(scannedData);
          scanMutation.mutate(scannedData);
          stopCamera(); // Stop camera after successful scan
        },
        {
          onDecodeError: (error) => {
            // Silent error handling - QR scanner constantly tries to decode
            console.debug('QR decode attempt:', error instanceof Error ? error.message : String(error));
          },
          highlightScanRegion: true,
          highlightCodeOutline: true,
          preferredCamera: 'environment',
        }
      );

      await qrScannerRef.current.start();
      console.log('✅ QR Scanner camera started successfully');
    } catch (error: any) {
      console.error('❌ Failed to start camera:', error);
      setIsScanning(false);
      setIsProcessingScan(false);
      toast({
        title: "Camera Error",
        description: "Failed to access camera. Please check permissions or try manual entry.",
        variant: "destructive",
      });
    }
  };

  const stopCamera = () => {
    if (qrScannerRef.current) {
      qrScannerRef.current.stop();
      qrScannerRef.current.destroy();
      qrScannerRef.current = null;
    }
    setIsScanning(false);
    setIsProcessingScan(false);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) {
      toast({
        title: "Invalid Code",
        description: "Please enter a valid booking ID or guest code",
        variant: "destructive",
      });
      return;
    }
    
    console.log('🔍 Manual code entry:', manualCode.trim());
    scanMutation.mutate(manualCode.trim());
    setManualCode('');  // Clear after submission
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Conditional wrapper - modal or embedded
  const content = (
    <Card className={embedded ? "w-full" : "w-full max-w-md"}>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Entry Scanner
          </CardTitle>
          {onClose && !embedded && (
            <Button size="sm" variant="ghost" onClick={onClose} className="hover:bg-gray-100 dark:hover:bg-gray-800">
              <X className="w-4 h-4" />
            </Button>
          )}
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Camera/Manual Toggle */}
          <div className="flex gap-2">
            <Button
              variant={!manualEntry ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setManualEntry(false);
                if (!isScanning) startCamera();
              }}
              className="flex-1"
            >
              <Camera className="w-4 h-4 mr-2" />
              Camera Scan
            </Button>
            <Button
              variant={manualEntry ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setManualEntry(true);
                stopCamera();
              }}
              className="flex-1"
            >
              <Keyboard className="w-4 h-4 mr-2" />
              Manual Entry
            </Button>
          </div>

          {/* Camera View */}
          {!manualEntry && (
            <div className="relative">
              <video
                ref={videoRef}
                className="w-full h-64 bg-gray-900 rounded-lg object-cover"
                playsInline
                muted
              />
              
              {!isScanning && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-lg">
                  <Button onClick={startCamera} size="lg">
                    <Camera className="w-5 h-5 mr-2" />
                    Start Scanning
                  </Button>
                </div>
              )}
              
              {isScanning && (
                <div className="absolute inset-0 border-4 border-dashed border-primary/50 rounded-lg flex items-center justify-center">
                  <div className="w-48 h-48 border-4 border-primary rounded-lg"></div>
                </div>
              )}
            </div>
          )}

          {/* Manual Entry Form */}
          {manualEntry && (
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Enter Booking ID or Guest Code
                </label>
                <Input
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="e.g., 123 or ABC123"
                  className="text-center text-lg font-mono"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Enter the booking ID number or 6-digit guest code
                </p>
              </div>
              
              <Button 
                type="submit" 
                className="w-full" 
                size="lg"
                disabled={scanMutation.isPending}
              >
                {scanMutation.isPending ? (
                  <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                ) : (
                  <CheckCircle className="w-4 h-4 mr-2" />
                )}
                Verify Entry
              </Button>
            </form>
          )}

          {/* Scan Result Display */}
          {lastScanResult && (
            <div className={`p-6 rounded-xl border-2 shadow-lg ${
              lastScanResult.success && !lastScanResult.alreadyScanned
                ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-300 dark:from-green-900 dark:to-emerald-900 dark:border-green-600' 
                : lastScanResult.alreadyScanned
                ? 'bg-gradient-to-br from-red-50 to-red-100 border-red-500 dark:from-red-900 dark:to-red-800 dark:border-red-400 animate-pulse'
                : 'bg-gradient-to-br from-red-50 to-rose-50 border-red-300 dark:from-red-900 dark:to-rose-900 dark:border-red-600'
            }`}>
              <div className="flex items-center gap-3 mb-4">
                {lastScanResult.success && !lastScanResult.alreadyScanned ? (
                  <div className="p-2 rounded-full bg-green-100 dark:bg-green-800">
                    <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-300" />
                  </div>
                ) : (
                  <div className={`p-2 rounded-full ${
                    lastScanResult.alreadyScanned 
                      ? 'bg-red-200 dark:bg-red-700 animate-pulse' 
                      : 'bg-red-100 dark:bg-red-800'
                  }`}>
                    <AlertCircle className={`w-6 h-6 ${
                      lastScanResult.alreadyScanned 
                        ? 'text-red-700 dark:text-red-200' 
                        : 'text-red-600 dark:text-red-300'
                    }`} />
                  </div>
                )}
                <div>
                  <span className={`text-lg font-bold ${
                    lastScanResult.success && !lastScanResult.alreadyScanned
                      ? 'text-green-800 dark:text-green-200' 
                      : lastScanResult.alreadyScanned
                      ? 'text-red-900 dark:text-red-100 text-xl'
                      : 'text-red-800 dark:text-red-200'
                  }`}>
                    {lastScanResult.success && !lastScanResult.alreadyScanned 
                      ? '✅ Entry Approved' 
                      : lastScanResult.alreadyScanned 
                      ? '⛔ ALREADY SCANNED' 
                      : '❌ Entry Denied'}
                  </span>
                  <p className={`text-sm mt-1 ${
                    lastScanResult.success && !lastScanResult.alreadyScanned
                      ? 'text-green-700 dark:text-green-300' 
                      : lastScanResult.alreadyScanned
                      ? 'text-red-800 dark:text-red-200 font-semibold'
                      : 'text-red-700 dark:text-red-300'
                  }`}>
                    {lastScanResult.message}
                  </p>
                </div>
              </div>

              {lastScanResult.booking && (
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 space-y-3 border border-gray-200 dark:border-gray-600">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">Name:</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{lastScanResult.booking.name}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">Tickets:</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{lastScanResult.booking.ticketCount}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">Amount:</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">₹{lastScanResult.booking.totalAmount}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">Status:</span>
                    <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300 font-medium">
                      {lastScanResult.booking.paymentStatus}
                    </Badge>
                  </div>
                  {lastScanResult.booking.gender && (
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-gray-700 dark:text-gray-300">Gender:</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100 capitalize">{lastScanResult.booking.gender}</span>
                    </div>
                  )}
                  {lastScanResult.booking.couponCode && (
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-gray-700 dark:text-gray-300">Coupon Used:</span>
                      <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300 font-medium">
                        {lastScanResult.booking.couponCode} ({lastScanResult.booking.couponDiscount || 0}% off)
                      </Badge>
                    </div>
                  )}
                  {lastScanResult.booking.guestCodes?.length && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                          All Guest Codes & Status:
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {lastScanResult.booking.scannedGuests?.length || 0} / {lastScanResult.booking.ticketCount} Entered
                        </Badge>
                      </div>
                      
                      <div className="space-y-2">
                        {lastScanResult.booking.guestCodes.map((guestCode, index) => {
                          // Get guest name - if it's the first ticket, use booking name, otherwise use guest names
                          let guestName;
                          let guestGender;
                          if (index === 0) {
                            guestName = lastScanResult.booking?.name; // Primary ticket holder
                            guestGender = lastScanResult.booking?.gender;
                          } else {
                            guestName = lastScanResult.booking?.guests?.[index - 1] || `Guest ${index + 1}`;
                            guestGender = lastScanResult.booking?.guestGenders?.[index - 1];
                          }
                          
                          const isScanned = lastScanResult.booking?.scannedGuests?.includes(guestCode);
                          const isCurrentScan = lastScanResult.guestInfo?.guestCode === guestCode;
                          
                          return (
                            <div 
                              key={index} 
                              className={`flex items-center justify-between p-3 rounded-lg border-2 transition-all ${
                                isCurrentScan 
                                  ? 'bg-blue-50 dark:bg-blue-900 border-blue-500 shadow-md' 
                                  : isScanned 
                                  ? 'bg-green-50 dark:bg-green-900 border-green-400' 
                                  : 'bg-gray-50 dark:bg-gray-800 border-gray-300'
                              }`}
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-gray-900 dark:text-gray-100">
                                    {guestName}
                                  </span>
                                  {guestGender && (
                                    <Badge variant="outline" className="text-xs bg-purple-100 text-purple-800 border-purple-300 capitalize">
                                      {guestGender}
                                    </Badge>
                                  )}
                                  {isCurrentScan && (
                                    <Badge variant="outline" className="text-xs bg-blue-100 text-blue-800 border-blue-300">
                                      Just Scanned
                                    </Badge>
                                  )}
                                </div>
                                <span className="text-xs font-mono text-gray-600 dark:text-gray-400">
                                  Code: {guestCode}
                                </span>
                              </div>
                              
                              <Badge 
                                variant={isScanned ? "default" : "outline"} 
                                className={
                                  isScanned 
                                    ? "bg-green-600 text-white hover:bg-green-700" 
                                    : "bg-gray-200 text-gray-700 border-gray-400"
                                }
                              >
                                {isScanned ? "✓ Entered" : "⏳ Pending"}
                              </Badge>
                            </div>
                          );
                        })}
                      </div>
                      
                      <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <p className="text-xs text-blue-700 dark:text-blue-300 text-center">
                          <strong>How it works:</strong> Each person scans their individual QR code to enter.
                          {lastScanResult.booking.scannedGuests?.length !== lastScanResult.booking.ticketCount && (
                            <span className="block mt-1">
                              Remaining guests can still scan their codes to enter.
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Instructions */}
          <div className="text-center text-sm text-muted-foreground">
            {manualEntry 
              ? "Enter booking ID or guest code manually" 
              : "Position QR code or barcode in the camera view"
            }
          </div>

          {/* Guest Checklist Modal */}
          {showGuestChecklist && lastScanResult?.booking && (
            <Card className="mt-4 border-2 border-blue-500 bg-blue-50 dark:bg-blue-950">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-800 dark:text-blue-200">
                  <Users className="w-5 h-5" />
                  Select Guests to Check In
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900 p-3 rounded">
                  <strong>{lastScanResult.booking.name}</strong> - {lastScanResult.booking.ticketCount} tickets
                  <br />
                  Select which guests are entering now:
                </div>
                
                <div className="space-y-2">
                  {lastScanResult.booking.guests?.map((guest, index) => {
                    const guestCode = lastScanResult.booking?.guestCodes[index];
                    const isAlreadyScanned = lastScanResult.booking?.scannedGuests?.includes(guestCode || '');
                    const isSelected = selectedGuests.includes(guestCode || '');
                    
                    return (
                      <div 
                        key={index} 
                        className={`flex items-center space-x-3 p-3 rounded-lg border-2 transition-colors ${
                          isAlreadyScanned 
                            ? 'bg-gray-100 dark:bg-gray-800 border-gray-300 opacity-60' 
                            : isSelected
                            ? 'bg-green-100 dark:bg-green-900 border-green-500'
                            : 'bg-white dark:bg-gray-700 border-gray-200 hover:border-blue-300'
                        }`}
                      >
                        <Checkbox 
                          checked={isSelected}
                          disabled={isAlreadyScanned}
                          onCheckedChange={(checked) => {
                            if (guestCode) {
                              if (checked) {
                                setSelectedGuests(prev => [...prev, guestCode]);
                              } else {
                                setSelectedGuests(prev => prev.filter(code => code !== guestCode));
                              }
                            }
                          }}
                        />
                        <div className="flex-1">
                          <div className="font-medium text-gray-900 dark:text-gray-100">
                            {guest}
                          </div>
                          <div className="text-sm font-mono text-gray-600 dark:text-gray-400">
                            Code: {guestCode}
                          </div>
                        </div>
                        <Badge 
                          variant={isAlreadyScanned ? "default" : "outline"}
                          className={
                            isAlreadyScanned 
                              ? "bg-green-600 text-white" 
                              : isSelected
                              ? "bg-blue-600 text-white"
                              : "bg-gray-200 text-gray-700"
                          }
                        >
                          {isAlreadyScanned ? "✓ Already Entered" : isSelected ? "Selected" : "Pending"}
                        </Badge>
                      </div>
                    );
                  })}
                </div>

                <div className="flex gap-2 pt-4 border-t">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setShowGuestChecklist(false);
                      setSelectedGuests([]);
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={() => {
                      if (lastScanResult?.booking && selectedGuests.length > 0) {
                        checkInMutation.mutate({
                          bookingId: lastScanResult.booking.id,
                          guestCodes: selectedGuests
                        });
                      }
                    }}
                    disabled={selectedGuests.length === 0 || checkInMutation.isPending}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  >
                    {checkInMutation.isPending ? (
                      <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                    ) : (
                      <Check className="w-4 h-4 mr-2" />
                    )}
                    Check In {selectedGuests.length} Guest{selectedGuests.length !== 1 ? 's' : ''}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
  );

  // Return modal or embedded version
  if (embedded) {
    return content;
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
      {content}
    </div>
  );
}