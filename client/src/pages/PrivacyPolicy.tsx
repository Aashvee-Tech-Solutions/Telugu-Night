import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

const PrivacyPolicy = () => {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <Card className="bg-gradient-card border-border/50 shadow-card">
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
            <CardTitle className="text-3xl text-center text-primary">
              Privacy Policy
            </CardTitle>
            <p className="text-center text-muted-foreground">
              Last updated: December 2024
            </p>
          </CardHeader>
          <CardContent className="prose prose-slate dark:prose-invert max-w-none">
            <div className="space-y-8">
              
              <section>
                <h2 className="text-xl font-semibold text-primary mb-4">Introduction</h2>
                <p className="mb-4">
                  <strong>Aashvee Tech Solutions Pvt Ltd</strong> ("we", "our", "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard your information when you use events.qlora.in ("Website", "Service", "Platform").
                </p>
                <p className="mb-4">
                  This policy applies to all users of our event booking platform, including customers booking tickets for Telugu Night and other events listed on our platform.
                </p>
                <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-blue-800 dark:text-blue-200">
                    <strong>We do not sell or trade your personal data</strong> to third parties. Your privacy and data security are our top priorities.
                  </p>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-primary mb-4">1. Information We Collect</h2>
                
                <h3 className="text-lg font-semibold mb-3">1.1 Information You Provide</h3>
                <p className="mb-4">When you use our Service, we may collect the following information:</p>
                <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                  <li><strong>Personal Information:</strong> Name, email address, phone number</li>
                  <li><strong>Booking Information:</strong> Event preferences, number of tickets, guest names</li>
                  <li><strong>Payment Information:</strong> Payment screenshots, transaction references (we do not store credit card details)</li>
                  <li><strong>Communication Data:</strong> Messages sent through our platform</li>
                </ul>

                <h3 className="text-lg font-semibold mb-3">1.2 Information We Collect Automatically</h3>
                <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                  <li><strong>Technical Information:</strong> IP address, browser type, device information</li>
                  <li><strong>Usage Data:</strong> Pages visited, time spent on platform, booking patterns</li>
                  <li><strong>QR Code Usage:</strong> Entry scan data and timestamps for events</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-primary mb-4">2. How We Use Your Information</h2>
                <p className="mb-4">We use your personal information for the following purposes:</p>
                
                <h3 className="text-lg font-semibold mb-3">2.1 Service Provision</h3>
                <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                  <li>Processing ticket bookings and payments</li>
                  <li>Generating and delivering QR codes via email</li>
                  <li>Verifying payment screenshots</li>
                  <li>Managing event entry and attendance tracking</li>
                  <li>Providing customer support</li>
                </ul>

                <h3 className="text-lg font-semibold mb-3">2.2 Communication</h3>
                <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                  <li>Sending booking confirmations and QR tickets</li>
                  <li>Event updates and important notifications</li>
                  <li>Customer service communications</li>
                </ul>

                <h3 className="text-lg font-semibold mb-3">2.3 Business Operations</h3>
                <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                  <li>Analytics and service improvement</li>
                  <li>Fraud prevention and security</li>
                  <li>Compliance with legal obligations</li>
                  <li>Maintaining accurate business records</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-primary mb-4">3. Information Sharing</h2>
                <div className="p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg mb-4">
                  <p className="text-green-800 dark:text-green-200">
                    <strong>We do not sell, rent, or trade your personal information</strong> with third parties for marketing purposes.
                  </p>
                </div>
                
                <p className="mb-4">We may share your information only in the following circumstances:</p>
                <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                  <li><strong>Event Organizers:</strong> Basic booking information for event management purposes</li>
                  <li><strong>Payment Processors:</strong> Transaction data for payment verification</li>
                  <li><strong>Service Providers:</strong> Email delivery services for sending tickets</li>
                  <li><strong>Legal Requirements:</strong> When required by law or court order</li>
                  <li><strong>Business Protection:</strong> To protect our rights, property, or safety</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-primary mb-4">4. Google Sheets Integration</h2>
                <p className="mb-4">
                  We integrate with Google Sheets for administrative purposes to maintain booking records. This integration helps us:
                </p>
                <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                  <li>Maintain backup records of bookings</li>
                  <li>Generate reports for event management</li>
                  <li>Sync payment screenshot URLs for verification</li>
                </ul>
                <p className="mb-4">
                  This data is stored securely and accessed only by authorized personnel for legitimate business purposes.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-primary mb-4">5. Data Security</h2>
                <p className="mb-4">We implement appropriate security measures to protect your personal information:</p>
                <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                  <li><strong>Encryption:</strong> Data is encrypted during transmission</li>
                  <li><strong>Access Control:</strong> Limited access to authorized personnel only</li>
                  <li><strong>Secure Storage:</strong> Personal data stored in secure databases</li>
                  <li><strong>Regular Updates:</strong> Security systems regularly updated and monitored</li>
                </ul>
                <p className="mb-4 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <strong>Payment Security:</strong> We do not store complete credit card information. Payment processing is handled by secure third-party payment gateways.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-primary mb-4">6. Your Rights</h2>
                <p className="mb-4">You have the following rights regarding your personal data:</p>
                
                <h3 className="text-lg font-semibold mb-3">6.1 Access and Correction</h3>
                <p className="mb-4">You can request access to your personal data and ask us to correct any inaccuracies.</p>
                
                <h3 className="text-lg font-semibold mb-3">6.2 Data Portability</h3>
                <p className="mb-4">You can request a copy of your personal data in a structured format.</p>
                
                <h3 className="text-lg font-semibold mb-3">6.3 Deletion</h3>
                <p className="mb-4">You can request deletion of your personal data, subject to legal and business requirements.</p>
                
                <h3 className="text-lg font-semibold mb-3">6.4 Communication Preferences</h3>
                <p className="mb-4">You can opt out of marketing communications while still receiving essential service-related messages.</p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-primary mb-4">7. Data Retention</h2>
                <p className="mb-4">We retain your personal information for the following periods:</p>
                <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                  <li><strong>Booking Data:</strong> Retained for business records and potential future events</li>
                  <li><strong>Payment Information:</strong> Retained as required for financial compliance</li>
                  <li><strong>QR Code Data:</strong> Retained for event verification and analysis</li>
                  <li><strong>Communication Records:</strong> Retained for customer service purposes</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-primary mb-4">8. Cookies and Tracking</h2>
                <p className="mb-4">Our website uses cookies and similar technologies to:</p>
                <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                  <li>Maintain your session during booking</li>
                  <li>Remember your preferences</li>
                  <li>Analyze website usage for improvements</li>
                  <li>Ensure security and prevent fraud</li>
                </ul>
                <p className="mb-4">You can control cookies through your browser settings, but this may affect website functionality.</p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-primary mb-4">9. Third-Party Links</h2>
                <p className="mb-4">
                  Our platform may contain links to external websites or services. We are not responsible for the privacy practices of these third parties. We recommend reviewing their privacy policies before providing any personal information.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-primary mb-4">10. Children's Privacy</h2>
                <p className="mb-4">
                  Our Service is not intended for children under 18 years of age. We do not knowingly collect personal information from children under 18. If you become aware that a child has provided us with personal data, please contact us immediately.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-primary mb-4">11. Changes to This Policy</h2>
                <p className="mb-4">
                  We may update this Privacy Policy from time to time. We will notify users of significant changes by:
                </p>
                <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                  <li>Posting the updated policy on our website</li>
                  <li>Sending email notifications for material changes</li>
                  <li>Updating the "Last updated" date at the top of this policy</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-primary mb-4">12. Contact Us</h2>
                <p className="mb-4">If you have any questions about this Privacy Policy or our data practices, please contact us:</p>
                <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                  <p><strong>Aashvee Tech Solutions Pvt Ltd</strong></p>
                  <p>Platform: events.qlora.in</p>
                  <p>Email: mis@aashveetech.com</p>
                  <p>Subject: Privacy Policy Inquiry</p>
                </div>
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
                  © 2024 events.qlora.in - Designed and Developed by <strong>Aashvee Tech Solutions Pvt Ltd</strong>
                </p>
              </div>

            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PrivacyPolicy;