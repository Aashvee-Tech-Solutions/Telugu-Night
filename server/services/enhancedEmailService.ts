import nodemailer from 'nodemailer';
import QRCode from 'qrcode';
import { google } from 'googleapis';

interface BookingData {
  id: number;
  name: string;
  email: string;
  phone: string;
  ticketCount: number;
  guests: string[];
  guestCodes: string[];
  totalAmount: string;
  paymentStatus: string;
  qrCodes?: string[];
  passIds?: string[];
}

export class EnhancedEmailService {
  private transporter!: nodemailer.Transporter;
  private calendar: any;

  constructor() {
    this.initializeTransporter();
    this.initializeGoogleCalendar();
  }

  private initializeTransporter() {
    // Use working Hostinger SMTP configuration
    const smtpConfig = {
      host: 'smtp.hostinger.com',
      port: 465,
      secure: true, // Use SSL
      auth: {
        user: process.env.SMTP_USER || 'mis@aashveetech.com',
        pass: process.env.SMTP_PASS || 'Mis@1234@1234'
      },
      connectionTimeout: 10000,
      greetingTimeout: 5000,
      socketTimeout: 10000,
      maxConnections: 1,
      maxMessages: 1,
      tls: {
        rejectUnauthorized: false,
        minVersion: 'TLSv1'
      },
      debug: false,
      logger: false
    };

    this.transporter = nodemailer.createTransport(smtpConfig as any);
  }

  private async initializeGoogleCalendar() {
    try {
      if (process.env.GOOGLE_SHEETS_CREDENTIALS) {
        const credentials = JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS);
        const auth = new google.auth.GoogleAuth({
          credentials,
          scopes: ['https://www.googleapis.com/auth/calendar']
        });
        this.calendar = google.calendar({ version: 'v3', auth });
        console.log('✅ Google Calendar initialized successfully');
      }
    } catch (error: any) {
      console.log('Google Calendar initialization skipped:', error.message);
    }
  }

  // Generate Google Calendar event link
  private generateCalendarEvent(booking: BookingData): string {
    const eventTitle = encodeURIComponent('Telugu Night - DTR Manipal');
    const eventDescription = encodeURIComponent(`🎊 Telugu Night Event

Booking Details:
- Booking ID: #${booking.id}
- Tickets: ${booking.ticketCount}
- Guest Codes: ${booking.guestCodes.join(', ')}

Important: Show your QR code at the venue for entry!

Contact: mis@aashveetech.com | +91 6281614117`);
    const eventLocation = encodeURIComponent('DTR, Manipal, Karnataka');
    
    // Event date: September 19, 2025, 6:30 PM - 11:00 PM IST (UTC+5:30)
    const startTime = '20250919T130000Z'; // 6:30 PM IST = 1:00 PM UTC
    const endTime = '20250919T173000Z';   // 11:00 PM IST = 5:30 PM UTC
    
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${eventTitle}&dates=${startTime}/${endTime}&details=${eventDescription}&location=${eventLocation}&sf=true&output=xml`;
  }

  // Send payment confirmation email after screenshot upload
  async sendPaymentConfirmationEmail(booking: BookingData): Promise<void> {
    console.log(`📧 Skipping payment confirmation email for booking ${booking.id} - no longer sending under review emails`);
    // This method is now disabled to remove the "under review" email notification
    // Payments are processed immediately via webhook, so tickets are sent directly after verification
  }

  async sendPaymentCompletionEmail(booking: BookingData): Promise<void> {
    try {
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background: linear-gradient(135deg, #059669 0%, #047857 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Payment Successful!</h1>
            <p style="color: #d1fae5; margin: 10px 0 0 0; font-size: 16px;">Telugu Night - DTR Manipal</p>
          </div>
          
          <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h2 style="color: #333; margin: 0 0 10px 0;">Congratulations ${booking.name}!</h2>
              <p style="color: #666; font-size: 16px; line-height: 1.6;">
                Your payment has been successfully processed and verified. Your tickets are ready!
              </p>
              <div style="background: #10b981; color: white; padding: 10px 20px; border-radius: 25px; display: inline-block; margin: 15px 0;">
                ✅ Payment Verified
              </div>
            </div>
            
            <div style="background: #ecfdf5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
              <h3 style="color: #065f46; margin: 0 0 15px 0; text-align: center;">Booking Confirmed</h3>
              <div style="display: grid; gap: 10px;">
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #d1fae5;">
                  <span style="font-weight: bold; color: #374151;">Booking ID:</span>
                  <span style="color: #059669; font-weight: bold;">#${booking.id}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #d1fae5;">
                  <span style="font-weight: bold; color: #374151;">Tickets:</span>
                  <span style="color: #6b7280;">${booking.ticketCount}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #d1fae5;">
                  <span style="font-weight: bold; color: #374151;">Total Paid:</span>
                  <span style="color: #059669; font-weight: bold;">₹${parseFloat(booking.totalAmount.toString()).toFixed(2)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 8px 0;">
                  <span style="font-weight: bold; color: #374151;">Status:</span>
                  <span style="color: #059669; font-weight: bold;">✅ CONFIRMED</span>
                </div>
              </div>
            </div>

            ${booking.guests && booking.guests.length > 0 ? `
              <div style="background: #f8f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #4f46e5; margin: 0 0 15px 0; text-align: center;">👥 Guest List</h3>
                <ul style="list-style: none; padding: 0; margin: 0;">
                  <li style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #374151;">
                    <strong>1. ${booking.name}</strong> (Primary)
                  </li>
                  ${booking.guests.map((guest, index) => `
                    <li style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #374151;">
                      <strong>${index + 2}. ${guest}</strong>
                    </li>
                  `).join('')}
                </ul>
              </div>
            ` : ''}
            
            <div style="text-align: center; margin: 30px 0;">
              <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <h3 style="color: #92400e; margin: 0 0 10px 0;">📧 Tickets Coming Soon!</h3>
                <p style="color: #92400e; margin: 0; font-size: 14px;">
                  Your QR code tickets will be sent to this email address shortly. Please keep them ready for entry.
                </p>
              </div>
            </div>
            
            <div style="text-align: center; color: #666; font-size: 14px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 5px 0;">📅 Event Date: Coming Soon</p>
              <p style="margin: 5px 0;">📍 Venue: DTR, Manipal</p>
              <p style="margin: 5px 0;">📞 Support: +91 6281614117</p>
              <p style="margin: 15px 0 0 0; font-style: italic;">
                Thank you for choosing Telugu Night! We can't wait to see you dance! 🕺💃
              </p>
            </div>
          </div>
        </div>
      `;

      await this.transporter.sendMail({
        from: 'mis@aashveetech.com',
        to: booking.email,
        subject: `🎉 Payment Successful - Telugu Night Tickets Confirmed #${booking.id}`,
        html: emailHtml
      });

      console.log(`✅ Payment completion email sent to ${booking.email}`);
    } catch (error) {
      console.error('Payment completion email failed:', error);
      throw error;
    }
  }

  // Send payment failure notification email
  async sendPaymentFailureEmail(booking: BookingData): Promise<void> {
    try {
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">❌ Payment Failed</h1>
            <p style="color: #fecaca; margin: 10px 0 0 0; font-size: 16px;">Telugu Night - DTR Manipal</p>
          </div>
          
          <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h2 style="color: #333; margin: 0 0 10px 0;">Sorry ${booking.name}!</h2>
              <p style="color: #666; font-size: 16px; line-height: 1.6;">
                Unfortunately, your payment could not be processed. Your booking has been cancelled.
              </p>
              <div style="background: #dc2626; color: white; padding: 10px 20px; border-radius: 25px; display: inline-block; margin: 15px 0;">
                ❌ Payment Rejected
              </div>
            </div>
            
            <div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
              <h3 style="color: #991b1b; margin: 0 0 15px 0; text-align: center;">Cancelled Booking Details</h3>
              <div style="display: grid; gap: 10px;">
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #fecaca;">
                  <span style="font-weight: bold; color: #374151;">Booking ID:</span>
                  <span style="color: #dc2626; font-weight: bold;">#${booking.id}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #fecaca;">
                  <span style="font-weight: bold; color: #374151;">Tickets:</span>
                  <span style="color: #6b7280;">${booking.ticketCount}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #fecaca;">
                  <span style="font-weight: bold; color: #374151;">Amount:</span>
                  <span style="color: #dc2626; font-weight: bold;">₹${parseFloat(booking.totalAmount.toString()).toFixed(2)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 8px 0;">
                  <span style="font-weight: bold; color: #374151;">Status:</span>
                  <span style="color: #dc2626; font-weight: bold;">❌ CANCELLED</span>
                </div>
              </div>
            </div>
            
            <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #374151; margin: 0 0 15px 0; text-align: center;">💡 What happened?</h3>
              <ul style="color: #6b7280; margin: 0; padding-left: 20px;">
                <li>Payment gateway declined the transaction</li>
                <li>Insufficient funds or bank restrictions</li>
                <li>Network connectivity issues</li>
                <li>Transaction timeout or cancellation</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <div style="background: #dbeafe; border: 1px solid #3b82f6; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <h3 style="color: #1e40af; margin: 0 0 10px 0;">🔄 Want to try again?</h3>
                <p style="color: #1e40af; margin: 0 0 15px 0; font-size: 14px;">
                  Visit our website to make a new booking with the same details.
                </p>
                <a href="https://v0-telugunightlanding3k.vercel.app" style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  Book Again
                </a>
              </div>
            </div>
            
            <div style="text-align: center; color: #666; font-size: 14px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 5px 0;">📧 Support: mis@aashveetech.com</p>
              <p style="margin: 5px 0;">📞 Phone: +91 6281614117</p>
              <p style="margin: 15px 0 0 0; font-style: italic;">
                We're here to help if you need assistance with your booking.
              </p>
            </div>
          </div>
        </div>
      `;

      await this.transporter.sendMail({
        from: 'mis@aashveetech.com',
        to: booking.email,
        subject: `❌ Payment Failed - Telugu Night Booking Cancelled #${booking.id}`,
        html: emailHtml
      });

      console.log(`✅ Payment failure email sent to ${booking.email}`);
    } catch (error) {
      console.error('Payment failure email failed:', error);
      throw error;
    }
  }

  // Test SMTP connection
  async testEmailConnection(testEmail: string = 'test@example.com'): Promise<void> {
    try {
      await this.transporter.verify();
      console.log('✅ SMTP connection verified successfully');
      
      // Send test email
      await this.transporter.sendMail({
        from: 'mis@aashveetech.com',
        to: testEmail,
        subject: 'SMTP Connection Test - Telugu Night System',
        html: `
          <h2>SMTP Test Successful</h2>
          <p>Your email system is working correctly!</p>
          <p>Time: ${new Date().toISOString()}</p>
        `
      });
      
      console.log(`✅ Test email sent successfully to ${testEmail}`);
    } catch (error) {
      console.error('❌ SMTP connection failed:', error);
      throw error;
    }
  }

  // Send tickets with QR codes and Google Calendar integration
  async sendTicketEmails(booking: BookingData): Promise<void> {
    try {
      // Generate QR codes for each guest code (only guest code, no complex pass ID)
      const generatedQRCodes = [];
      for (let i = 0; i < booking.ticketCount; i++) {
        const guestCode = booking.guestCodes[i] || `GUEST${booking.id}${i + 1}`;
        // QR code contains only the guest code for direct scanning
        console.log(`📱 Generating QR code for guest code: ${guestCode}`);
        const qrCodeData = guestCode;
        const qrCodeImage = await QRCode.toDataURL(qrCodeData, {
          width: 300,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });
        generatedQRCodes.push(qrCodeImage);
      }

      const ticketAttachments = generatedQRCodes.map((qrCode, index) => ({
        filename: `telugu-night-ticket-${index + 1}.png`,
        content: qrCode.split(';base64,').pop(),
        encoding: 'base64',
        cid: `ticket${index + 1}`
      }));

      const calendarLink = this.generateCalendarEvent(booking);

      const mailOptions = {
        from: 'mis@aashveetech.com',
        to: booking.email,
        subject: '🎫 Your Telugu Night Tickets - QR Codes & Calendar Event Ready!',
        html: this.generateEnhancedTicketEmailHTML(booking, generatedQRCodes, calendarLink),
        attachments: ticketAttachments
      };

      await this.transporter.sendMail(mailOptions);
      console.log(`✅ Enhanced ticket email sent successfully to ${booking.email} with ${generatedQRCodes.length} QR codes and calendar event`);
    } catch (error) {
      console.error('Error sending enhanced ticket email:', error);
      throw error;
    }
  }

  // Generate enhanced ticket email HTML with QR codes and calendar integration
  private generateEnhancedTicketEmailHTML(booking: BookingData, qrCodes: string[], calendarLink: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; }
          .content { padding: 30px; background: #f9f9f9; }
          .card { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .ticket { border: 2px dashed #667eea; padding: 20px; margin: 15px 0; background: #f8f9ff; border-radius: 10px; text-align: center; }
          .qr-code { margin: 15px 0; }
          .guest-code { background: #667eea; color: white; padding: 8px 16px; border-radius: 20px; font-weight: bold; font-size: 18px; }
          .pass-id { color: #666; font-size: 12px; margin-top: 5px; }
          .highlight { color: #667eea; font-weight: bold; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
          .success { background: #e8f5e8; border-left: 4px solid #4CAF50; padding: 15px; margin: 15px 0; }
          .calendar-button { background: #4285f4; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 10px 5px; font-weight: bold; }
          .calendar-section { background: #e3f2fd; border: 1px solid #2196F3; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🎊 Telugu Night - DTR, Manipal</h1>
          <p>Your Digital Tickets with QR Codes</p>
        </div>
        
        <div class="content">
          <div class="success">
            <h2>✅ Payment Verified! Welcome to Telugu Night!</h2>
            <p>Hi <strong>${booking.name}</strong>, your payment has been successfully verified. Here are your digital tickets with QR codes!</p>
          </div>

          <div class="calendar-section">
            <h3>📅 Add to Your Calendar</h3>
            <p><strong>Telugu Night - September 19, 2025, 6:30 PM</strong></p>
            <p>DTR, Manipal, Karnataka</p>
            <a href="${calendarLink}" class="calendar-button" target="_blank">
              📅 Add to Google Calendar
            </a>
            <p style="font-size: 12px; color: #666; margin-top: 10px;">
              Click the button above to automatically add the event to your Google Calendar with all your booking details!
            </p>
          </div>

          <div class="card">
            <h3>📋 Booking Summary:</h3>
            <ul>
              <li><strong>Booking ID:</strong> <span class="highlight">#${booking.id}</span></li>
              <li><strong>Total Tickets:</strong> ${booking.ticketCount}</li>
              <li><strong>Total Amount:</strong> ₹${booking.totalAmount}</li>
              <li><strong>Contact:</strong> ${booking.phone}</li>
            </ul>
          </div>

          <h2 style="text-align: center; color: #667eea;">🎫 Your Digital Tickets</h2>
          
          ${booking.guestCodes.map((guestCode, index) => {
            // Get guest name - if it's the first ticket, use booking name, otherwise use guest names
            let guestName;
            if (index === 0) {
              guestName = booking.name; // Primary ticket holder
            } else {
              guestName = booking.guests[index - 1] || `Guest ${index + 1}`;
            }
            
            return `
            <div class="ticket">
              <h3>🎫 Ticket ${index + 1}</h3>
              <p><strong>Guest:</strong> ${guestName}</p>
              <div class="guest-code">${guestCode}</div>
              <div class="qr-code">
                <img src="cid:ticket${index + 1}" alt="QR Code" style="max-width: 250px;">
              </div>
              <p><em>Show this QR code at the venue entrance</em></p>
            </div>
          `;
          }).join('')}

          <div class="card">
            <h3>🎯 Event Information:</h3>
            <ul>
              <li><strong>Event:</strong> Telugu Night - DJ Experience</li>
              <li><strong>Venue:</strong> DTR, Manipal</li>
              <li><strong>Date:</strong> September 19, 2025</li>
              <li><strong>Time:</strong> 6:30 PM - 11:00 PM</li>
              <li><strong>Entry:</strong> Show QR code or guest code</li>
            </ul>
          </div>

          <div class="card" style="background: #fff3cd; border-left: 4px solid #ffc107;">
            <h3>⚠️ Important Instructions:</h3>
            <ul>
              <li>📱 <strong>Save these QR codes</strong> - required for venue entry</li>
              <li>🎫 <strong>Each person needs their own ticket</strong> - don't share QR codes</li>
              <li>📧 <strong>Print or screenshot</strong> - ensure QR codes are clearly visible</li>
              <li>🆔 <strong>Bring valid ID</strong> - may be required at the venue</li>
              <li>📅 <strong>Add to calendar</strong> - don't miss the event!</li>
            </ul>
          </div>
        </div>

        <div class="footer">
          <p>Questions? Contact us at: mis@aashveetech.com | 📞 +91 6281614117</p>
          <p><em>Telugu Night - The Ultimate DJ Experience in DTR, Manipal</em></p>
          <p style="margin-top: 15px;">
            <a href="${calendarLink}" style="color: #4285f4;">📅 Add Event to Google Calendar</a>
          </p>
        </div>
      </body>
      </html>
    `;
  }
}

export const enhancedEmailService = new EnhancedEmailService();