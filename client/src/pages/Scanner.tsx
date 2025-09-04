import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Scan, Camera, User, Calendar, Ticket, CheckCircle, XCircle } from "lucide-react";

interface ScannedBooking {
  id: number;
  name: string;
  email: string;
  phone: string;
  ticketCount: number;
  guests: string[];
  guestCodes: string[];
  totalAmount: string;
  paymentStatus: string;
  isScanned: boolean;
  scannedAt: string | null;
  createdAt: string;
}

export default function Scanner() {
  const [scanInput, setScanInput] = useState("");
  const [scannedBooking, setScannedBooking] = useState<ScannedBooking | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleScan = async () => {
    if (!scanInput.trim()) {
      toast({
        title: "Invalid Input",
        description: "Please enter a booking ID or guest code",
        variant: "destructive",
      });
      return;
    }

    setIsScanning(true);

    try {
      const response = await fetch(`/api/scanner/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scanData: scanInput.trim()
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setScannedBooking(data.booking);
        
        // Check payment status
        if (data.booking.paymentStatus === 'pending') {
          toast({
            title: "Payment Pending",
            description: "Payment verification in progress. Entry not authorized yet.",
            variant: "destructive",
          });
        } else if (data.booking.isScanned) {
          toast({
            title: "Already Scanned",
            description: "This ticket was already used for entry.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Entry Authorized",
            description: `Welcome ${data.booking.name}! Entry approved.`,
          });
        }
        setScanInput("");
      } else {
        toast({
          title: "Scan Failed",
          description: data.message || "Invalid booking ID or guest code",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Connection Error",
        description: "Unable to connect to server",
        variant: "destructive",
      });
    }

    setIsScanning(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleScan();
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-800 p-4">
      <div className="max-w-4xl mx-auto">
        <Card className="mb-6">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center">
              <Scan className="w-8 h-8 text-purple-600 dark:text-purple-300" />
            </div>
            <CardTitle className="text-3xl">Telugu Night Scanner</CardTitle>
            <CardDescription>
              Scan QR codes or enter booking ID / guest codes to verify entry
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 mb-6">
              <div className="flex-1">
                <Input
                  ref={inputRef}
                  type="text"
                  placeholder="Enter booking ID or guest code (e.g., X8C2AO)"
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value.toUpperCase())}
                  onKeyPress={handleKeyPress}
                  className="text-lg py-3"
                />
              </div>
              <Button 
                onClick={handleScan}
                disabled={isScanning}
                size="lg"
                className="px-8"
              >
                {isScanning ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                    Scanning...
                  </>
                ) : (
                  <>
                    <Camera className="w-5 h-5 mr-2" />
                    Scan
                  </>
                )}
              </Button>
            </div>

            <div className="text-center text-sm text-gray-600 dark:text-gray-300">
              <p>💡 <strong>Tip:</strong> Focus on the camera to scan QR codes or type guest codes manually</p>
            </div>
          </CardContent>
        </Card>

        {scannedBooking && (
          <Card className={`border-2 ${scannedBooking.isScanned ? 'border-red-500' : 'border-green-500'}`}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <User className="w-6 h-6" />
                  {scannedBooking.name}
                </CardTitle>
                <Badge variant={scannedBooking.isScanned ? "destructive" : "default"}>
                  {scannedBooking.isScanned ? (
                    <>
                      <XCircle className="w-4 h-4 mr-1" />
                      Already Scanned
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Valid Entry
                    </>
                  )}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-sm text-gray-600 dark:text-gray-300">Contact Information</h4>
                    <p className="text-lg">{scannedBooking.email}</p>
                    <p className="text-lg">{scannedBooking.phone}</p>
                  </div>

                  <div>
                    <h4 className="font-semibold text-sm text-gray-600 dark:text-gray-300">Booking Details</h4>
                    <div className="flex items-center gap-2 mb-2">
                      <Ticket className="w-4 h-4" />
                      <span>{scannedBooking.ticketCount} Tickets</span>
                      <span className="text-gray-500">• ₹{scannedBooking.totalAmount}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      <span className="text-sm">Booked: {formatDate(scannedBooking.createdAt)}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-sm text-gray-600 dark:text-gray-300">Guests & Codes</h4>
                    <div className="space-y-2">
                      {scannedBooking.guests.map((guest, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded">
                          <span>{guest}</span>
                          <Badge variant="outline" className="font-mono">
                            {scannedBooking.guestCodes[index]}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>

                  {scannedBooking.isScanned && scannedBooking.scannedAt && (
                    <div>
                      <h4 className="font-semibold text-sm text-gray-600 dark:text-gray-300">Scan History</h4>
                      <p className="text-sm text-red-600 dark:text-red-400">
                        Previously scanned: {formatDate(scannedBooking.scannedAt)}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <Separator className="my-4" />

              <div className="text-center">
                <Badge 
                  variant={scannedBooking.paymentStatus === 'verified' ? "default" : "secondary"}
                  className="text-lg px-4 py-2"
                >
                  Payment Status: {scannedBooking.paymentStatus.toUpperCase()}
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="mt-6 text-center">
          <p className="text-white/80 text-sm">
            🎊 Telugu Night Event Scanner • Scan responsibly
          </p>
        </div>
      </div>
    </div>
  );
}