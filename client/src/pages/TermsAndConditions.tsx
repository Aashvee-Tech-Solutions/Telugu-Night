import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

const TermsAndConditions = () => {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-900 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <Card className="bg-white/90 dark:bg-slate-800/90 border-blue-200 dark:border-blue-700 shadow-xl backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center justify-between mb-4">
              <Button
                variant="outline"
                onClick={() => setLocation("/")}
                data-testid="button-back-home"
              >
                ← Back to Home
              </Button>
            </div>
            <CardTitle className="text-3xl text-center text-blue-700 dark:text-blue-300 font-bold">
              Terms & Conditions
            </CardTitle>
            <p className="text-center text-slate-600 dark:text-slate-300 font-medium">
              Last updated: December 2024
            </p>
          </CardHeader>
          <CardContent className="prose prose-slate dark:prose-invert max-w-none text-slate-700 dark:text-slate-200">
            <div className="space-y-8">
              
              <section>
                <h2 className="text-xl font-bold text-blue-700 dark:text-blue-300 mb-4">1. Introduction</h2>
                <p className="mb-4">
                  1.1 Welcome to events.qlora.in ("Website", "Service", "Platform"), an event booking and management system designed and developed by <strong>Aashvee Tech Solutions Pvt Ltd</strong>, a company registered in India.
                </p>
                <p className="mb-4">
                  1.2 By using our Service to book tickets for Telugu Night or any other events, you agree to be bound by these Terms & Conditions. Please read them carefully before using the Service.
                </p>
                <div className="mb-4 p-4 bg-red-100 dark:bg-red-900/50 border-2 border-red-400 dark:border-red-500 rounded-lg shadow-lg">
                  <p className="text-red-800 dark:text-red-200 font-semibold">
                    <strong>⚠️ IMPORTANT:</strong> <span className="text-red-700 dark:text-red-300">This document includes important exclusions of warranties and limitations of liability in Section 8.</span>
                  </p>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-bold text-blue-700 dark:text-blue-300 mb-4">2. Definitions</h2>
                <div className="space-y-4">
                  <div>
                    <p><strong>"Aashvee Tech Solutions"</strong> means Aashvee Tech Solutions Pvt Ltd, the company that owns and operates events.qlora.in</p>
                  </div>
                  <div>
                    <p><strong>"User" or "Customer"</strong> means any individual who uses the Website to book tickets or access our services</p>
                  </div>
                  <div>
                    <p><strong>"Event"</strong> means any event listed on our platform, including but not limited to Telugu Night</p>
                  </div>
                  <div>
                    <p><strong>"Ticket"</strong> means a digital pass that provides entry to a specified Event</p>
                  </div>
                  <div>
                    <p><strong>"QR Code"</strong> means the digital code generated for entry verification at events</p>
                  </div>
                  <div>
                    <p><strong>"Service"</strong> means the event booking and management platform provided through events.qlora.in</p>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-bold text-blue-700 dark:text-blue-300 mb-4">3. Use of Service</h2>
                <p className="mb-4">
                  3.1 <strong>Permitted Use:</strong> You may use our Service solely for booking tickets to events listed on our platform for personal, non-commercial purposes.
                </p>
                <p className="mb-4">
                  3.2 <strong>Account Security:</strong> You are responsible for maintaining the confidentiality of your booking information and contact details.
                </p>
                <p className="mb-4">
                  3.3 <strong>Prohibited Activities:</strong> You may not:
                </p>
                <ul className="list-disc list-inside ml-4 space-y-2">
                  <li>Resell tickets without authorization</li>
                  <li>Share or duplicate QR codes</li>
                  <li>Use the Service for any illegal or unauthorized purpose</li>
                  <li>Attempt to interfere with the proper functioning of the Service</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-bold text-blue-700 dark:text-blue-300 mb-4">4. Booking and Payment</h2>
                <p className="mb-4">
                  4.1 <strong>Booking Process:</strong> All bookings must be completed through our official payment gateways. Payment confirmation is required before ticket generation.
                </p>
                <p className="mb-4">
                  4.2 <strong>Payment Verification:</strong> After payment, you may be required to upload payment screenshots for verification purposes.
                </p>
                <p className="mb-4">
                  4.3 <strong>Ticket Delivery:</strong> Digital tickets with QR codes will be sent to your registered email address after payment verification.
                </p>
                <div className="mb-4 p-4 bg-amber-100 dark:bg-amber-900/50 border-2 border-amber-400 dark:border-amber-500 rounded-lg shadow-md">
                  <p className="text-amber-800 dark:text-amber-200 font-semibold">
                    <strong>📧 No Shipping Required:</strong> <span className="text-amber-700 dark:text-amber-300">All tickets are delivered digitally via email. No physical shipping is involved.</span>
                  </p>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-bold text-blue-700 dark:text-blue-300 mb-4">5. Refunds and Cancellations</h2>
                <div className="p-6 bg-red-100 dark:bg-red-900/50 border-2 border-red-400 dark:border-red-500 rounded-lg mb-4 shadow-xl">
                  <h3 className="text-lg font-bold text-red-900 dark:text-red-100 mb-4 text-center uppercase tracking-wide bg-red-200 dark:bg-red-800 py-2 px-4 rounded">🚫 NO REFUND POLICY</h3>
                  <p className="text-red-800 dark:text-red-200 mb-3 font-semibold">
                    <strong>5.1 No Refunds:</strong> <span className="text-red-700 dark:text-red-300">All ticket purchases are final. We do not offer refunds under any circumstances, including but not limited to:</span>
                  </p>
                  <ul className="list-disc list-inside ml-4 space-y-2 text-red-800 dark:text-red-200 font-medium">
                    <li>Change of mind</li>
                    <li>Personal scheduling conflicts</li>
                    <li>Inability to attend the event</li>
                    <li>Technical issues with payment processing (after successful transaction)</li>
                  </ul>
                  <p className="text-red-800 dark:text-red-200 mt-4 font-semibold">
                    <strong>5.2 No Returns:</strong> <span className="text-red-700 dark:text-red-300">As tickets are digital products delivered via email, returns are not applicable.</span>
                  </p>
                </div>
                <p className="mb-4">
                  5.3 <strong>Event Cancellation:</strong> In the unlikely event that an event is cancelled by the organizers, we will provide information about rescheduling or alternative arrangements.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-bold text-blue-700 dark:text-blue-300 mb-4">6. Event Entry and QR Codes</h2>
                <p className="mb-4">
                  6.1 <strong>Entry Requirements:</strong> A valid QR code is required for event entry. You must present your QR code at the venue for scanning.
                </p>
                <p className="mb-4">
                  6.2 <strong>One-Time Use:</strong> Each QR code can only be used once. Duplicate scans will be rejected.
                </p>
                <p className="mb-4">
                  6.3 <strong>Lost or Damaged Tickets:</strong> If you lose access to your QR code, contact us immediately. We may be able to assist but cannot guarantee replacement.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-bold text-blue-700 dark:text-blue-300 mb-4">7. Intellectual Property</h2>
                <p className="mb-4">
                  7.1 All content on events.qlora.in, including design, code, and functionality, is the intellectual property of Aashvee Tech Solutions Pvt Ltd.
                </p>
                <p className="mb-4">
                  7.2 You may not reproduce, distribute, or create derivative works from our platform without express written permission.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-bold text-blue-700 dark:text-blue-300 mb-4">8. Limitation of Liability</h2>
                <p className="mb-4">
                  8.1 <strong>Service Availability:</strong> While we strive to maintain uninterrupted service, we cannot guarantee 100% uptime.
                </p>
                <p className="mb-4">
                  8.2 <strong>Event Responsibility:</strong> We act as a booking platform only. Event organization, venue management, and event-day operations are the responsibility of event organizers.
                </p>
                <p className="mb-4">
                  8.3 <strong>Maximum Liability:</strong> Our liability is limited to the amount paid for your ticket(s).
                </p>
              </section>

              <section>
                <h2 className="text-xl font-bold text-blue-700 dark:text-blue-300 mb-4">9. Privacy and Data Protection</h2>
                <p className="mb-4">
                  9.1 Your use of our Service is also governed by our Privacy Policy, which can be found at <a href="/privacy-policy" className="text-primary underline">events.qlora.in/privacy-policy</a>
                </p>
                <p className="mb-4">
                  9.2 By using our Service, you consent to the collection and use of information in accordance with our Privacy Policy.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-bold text-blue-700 dark:text-blue-300 mb-4">10. Contact Information</h2>
                <p className="mb-4">
                  10.1 For any questions regarding these Terms & Conditions, please contact us at:
                </p>
                <div className="p-4 bg-blue-100 dark:bg-blue-900/50 border-2 border-blue-300 dark:border-blue-600 rounded-lg shadow-md">
                  <p><strong>Aashvee Tech Solutions Pvt Ltd</strong></p>
                  <p>Platform: events.qlora.in</p>
                  <p>Email: mis@aashveetech.com</p>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-bold text-blue-700 dark:text-blue-300 mb-4">11. Changes to Terms</h2>
                <p className="mb-4">
                  11.1 We reserve the right to update these Terms & Conditions at any time. Changes will be effective immediately upon posting on our website.
                </p>
                <p className="mb-4">
                  11.2 Continued use of the Service after changes constitutes acceptance of the updated terms.
                </p>
              </section>

              <div className="mt-8 pt-6 border-t border-border">
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-4">
                  <a 
                    href="/terms-and-conditions" 
                    className="text-xs text-muted-foreground hover:text-primary transition-colors underline"
                    data-testid="link-terms-conditions"
                  >
                    Terms & Conditions
                  </a>
                  <span className="hidden sm:inline text-muted-foreground">|</span>
                  <a 
                    href="/privacy-policy" 
                    className="text-xs text-muted-foreground hover:text-primary transition-colors underline"
                    data-testid="link-privacy-policy"
                  >
                    Privacy Policy
                  </a>
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  © 2024 telugunight.manipal.app - Designed and Developed by <strong>Aashvee Tech Solutions Pvt Ltd</strong>
                </p>
              </div>

            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TermsAndConditions;