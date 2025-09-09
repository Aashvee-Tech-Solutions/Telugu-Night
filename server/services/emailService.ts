import nodemailer from 'nodemailer';
import QRCode from 'qrcode';
import { google } from 'googleapis';

interface BookingData {
  id: number;
  name: string;
  email: string;
  phone: string;
  ticketCount: number;
  guests: string[] | null;
  guestCodes: string[] | null;
  totalAmount: string;
  paymentStatus: string;
  qrCodes?: string[] | null;
  passIds?: string[] | null;
  paymentScreenshot?: string | null;
}

// Generate unique 6-digit alphanumeric code
function generateUniqueGuestCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Generate multiple unique codes for guests
export function generateGuestCodes(count: number): string[] {
  const codes = new Set<string>();
  while (codes.size < count) {
    codes.add(generateUniqueGuestCode());
  }
  return Array.from(codes);
}

// Generate pass IDs for dashboard viewing
export function generatePassIds(bookingId: number, count: number): string[] {
  const passIds = [];
  for (let i = 0; i < count; i++) {
    passIds.push(`TELUGU-${bookingId}-${i + 1}-${Date.now()}`);
  }
  return passIds;
}

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: 'smtp.hostinger.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER || 'mis@aashveetech.com',
        pass: process.env.SMTP_PASSWORD || 'Mis@1234@1234'
      }
    });
  }

  // Stage 1: Payment confirmation email
  async sendPaymentConfirmationEmail(booking: BookingData): Promise<void> {
    const mailOptions = {
      from: 'mis@aashveetech.com',
      to: booking.email,
      subject: '🎊 Telugu Night - Payment Received! Verification in Progress',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; }
            .content { padding: 30px; background: #f9f9f9; }
            .card { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .highlight { color: #667eea; font-weight: bold; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
            .button { background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 10px 0; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🎊 Telugu Night - DTR, Manipal</h1>
            <p>Payment Confirmation</p>
          </div>
          
          <div class="content">
            <div class="card">
              <h2>Hi ${booking.name}! 👋</h2>
              <p>Thank you for your payment! We've received your booking details and payment screenshot.</p>
              
              <h3>📋 Booking Details:</h3>
              <ul>
                <li><strong>Booking ID:</strong> <span class="highlight">#${booking.id}</span></li>
                <li><strong>Tickets:</strong> ${booking.ticketCount} × ₹300 = ₹${booking.totalAmount}</li>
                <li><strong>Contact:</strong> ${booking.phone}</li>
              </ul>

              ${booking.guests && booking.guests.length > 0 ? `
                <h3>👥 Guest Names:</h3>
                <ul>
                  ${booking.guests.map(guest => `<li>${guest}</li>`).join('')}
                </ul>
              ` : ''}
            </div>

            <div class="card" style="background: #e8f4f8; border-left: 4px solid #2196F3;">
              <h3>⏳ What happens next?</h3>
              <p><strong>1. Payment Verification:</strong> Our team will verify your payment within 2-4 hours</p>
              <p><strong>2. Ticket Delivery:</strong> Once verified, you'll receive your digital tickets with QR codes</p>
              <p><strong>3. Event Entry:</strong> Show your QR codes at the venue for instant entry</p>
            </div>

            <div class="card">
              <h3>📱 Important Information:</h3>
              <ul>
                <li>📧 <strong>Check your email regularly</strong> - tickets will be delivered digitally</li>
                <li>📱 <strong>Save the QR codes</strong> - needed for venue entry</li>
                <li>🎫 <strong>Each guest gets a unique code</strong> - don't share with others</li>
              </ul>
            </div>
          </div>

          <div class="footer">
            <p>Questions? Contact us at: mis@aashveetech.com | 📞 +91 6281614117</p>
            <p><em>Telugu Night - The Ultimate DJ Experience in DTR, Manipal</em></p>
          </div>
        </body>
        </html>
      `
    };

    await this.transporter.sendMail(mailOptions);
  }

  // Stage 2: Send tickets with QR codes
  async sendTicketEmails(booking: BookingData, qrCodes: string[], passIds: string[]): Promise<void> {
    try {
      // Generate QR codes for each guest code if not provided
      const generatedQRCodes = [];
      for (let i = 0; i < booking.ticketCount; i++) {
        const guestCode = booking.guestCodes?.[i] || `GUEST${booking.id}${i + 1}`;
        const qrCodeData = `TELUGU-NIGHT-${booking.id}-${guestCode}`;
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

      const mailOptions = {
        from: 'mis@aashveetech.com',
        to: booking.email,
        subject: '🎫 Your Telugu Night Tickets - Entry Passes Ready!',
        html: this.generateTicketEmailHTML(booking, generatedQRCodes),
        attachments: ticketAttachments
      };

      await this.transporter.sendMail(mailOptions);
      console.log(`Ticket email sent successfully to ${booking.email} with ${generatedQRCodes.length} QR codes`);
    } catch (error) {
      console.error('Error sending ticket email:', error);
      throw error;
    }
  }

  // Generate ticket email HTML with QR codes
  private generateTicketEmailHTML(booking: BookingData, qrCodes: string[]): string {
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
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🎊 Telugu Night - DTR, Manipal</h1>
          <p>Your Digital Tickets</p>
        </div>
        
        <div class="content">
          <div class="success">
            <h2>✅ Payment Verified! Welcome to Telugu Night!</h2>
            <p>Hi <strong>${booking.name}</strong>, your payment has been successfully verified. Here are your digital tickets with QR codes!</p>
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
          
          ${booking.guestCodes?.map((guestCode, index) => `
            <div class="ticket">
              <h3>🎫 Ticket ${index + 1}</h3>
              <p><strong>Guest:</strong> ${booking.guests?.[index] || `Guest ${index + 1}`}</p>
              <div class="guest-code">${guestCode}</div>
              <div class="pass-id">Pass ID: ${booking.passIds ? booking.passIds[index] : 'N/A'}</div>
              <div class="qr-code">
                <img src="cid:ticket${index + 1}" alt="QR Code" style="max-width: 250px;">
              </div>
              <p><em>Show this QR code at the venue entrance</em></p>
            </div>
          `).join('')}

          <div class="card">
            <h3>🎯 Event Information:</h3>
            <ul>
              <li><strong>Event:</strong> Telugu Night - DJ Experience</li>
              <li><strong>Venue:</strong> DTR, Manipal</li>
              <li><strong>Entry:</strong> Show your QR codes at the entrance</li>
              <li><strong>Guest Codes:</strong> Each ticket has a unique 6-digit code</li>
            </ul>
          </div>

          <div class="card" style="background: #fff3cd; border-left: 4px solid #ffc107;">
            <h3>⚠️ Important Instructions:</h3>
            <ul>
              <li>💾 <strong>Save this email</strong> - you'll need it for entry</li>
              <li>📱 <strong>Screenshot the QR codes</strong> - in case of network issues</li>
              <li>🎫 <strong>Each guest needs their own QR code</strong> - don't share</li>
              <li>⏰ <strong>Arrive early</strong> - for smooth entry process</li>
            </ul>
          </div>
        </div>

        <div class="footer">
          <p>Questions? Contact us at: mis@aashveetech.com | 📞 +91 6281614117</p>
          <p><em>Telugu Night - The Ultimate DJ Experience in DTR, Manipal</em></p>
        </div>
      </body>
      </html>
    `;
  }

  // Generate QR codes for tickets
  async generateQRCodes(booking: BookingData): Promise<{ qrCodes: string[], passIds: string[] }> {
    const passIds = generatePassIds(booking.id, booking.ticketCount);
    const qrCodes = [];

    for (let i = 0; i < booking.ticketCount; i++) {
      const guestCode = booking.guestCodes?.[i];
      const passId = passIds[i];
      const qrData = `TELUGU-NIGHT-${booking.id}-${guestCode}`;
      
      try {
        const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
          width: 300,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });
        qrCodes.push(qrCodeDataUrl);
      } catch (error) {
        console.error('QR code generation failed:', error);
        throw error;
      }
    }

    return { qrCodes, passIds };
  }

  // Send QR tickets method for backward compatibility
  async sendQRTickets(booking: BookingData): Promise<void> {
    // Generate QR codes and pass IDs
    const { qrCodes, passIds } = await this.generateQRCodes(booking);
    // Send ticket emails with generated QR codes
    await this.sendTicketEmails(booking, qrCodes, passIds);
  }

  // Send promoter credentials via email
  async sendPromoterCredentials(email: string, password: string, promoCode: string, referralUrl: string): Promise<void> {
    const mailOptions = {
      from: 'mis@aashveetech.com',
      to: email,
      subject: '🎯 Telugu Night - Promoter Access Credentials & Referral Link',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; max-width: 600px; margin: 0 auto; }
            .credentials { background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0; }
            .referral-box { background: #e8f5e8; border: 2px solid #28a745; padding: 15px; border-radius: 8px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
            .login-btn { background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 10px; }
            .copy-btn { background: #28a745; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px; display: inline-block; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>🎯 Telugu Night Promoter Access</h2>
            <p>Your promoter account has been created!</p>
          </div>
          <div class="content">
            <h3>Welcome to the Telugu Night Promoter Program!</h3>
            <p>You've been added as a promoter for Telugu Night events. Here are your login credentials:</p>
            
            <div class="credentials">
              <h4>🔐 Login Credentials:</h4>
              <p><strong>Email:</strong> ${email}</p>
              <p><strong>Password:</strong> ${password}</p>
              <p><strong>Promo Code:</strong> ${promoCode}</p>
              <p><strong>Login URL:</strong> <a href="https://telugunight.manipal.app/promoter/login">Promoter Dashboard</a></p>
            </div>

            <div class="referral-box">
              <h4>🔗 Your Referral Link:</h4>
              <p style="font-size: 14px; margin-bottom: 10px;">Share this link with customers to track your referrals:</p>
              <div style="background: white; padding: 10px; border-radius: 4px; word-break: break-all; font-family: monospace; font-size: 12px;">
                ${referralUrl}
              </div>
              <p style="font-size: 12px; margin-top: 10px; color: #555;">
                💡 <strong>Tip:</strong> When customers book using this link, they'll be automatically tracked as your referrals!
              </p>
            </div>

            <p><strong>As a promoter, you can:</strong></p>
            <ul>
              <li>📊 View your referral statistics</li>
              <li>👥 Track all bookings made through your referral code</li>
              <li>📈 Access real-time booking analytics</li>
              <li>🔗 Share your personalized referral link</li>
            </ul>

            <div style="text-align: center; margin: 20px 0;">
              <a href="https://telugunight.manipal.app/promoter/login" class="login-btn">
                🚀 Access Your Dashboard
              </a>
            </div>

            <p><strong>⚠️ Important:</strong></p>
            <ul>
              <li>Keep your credentials secure and don't share them</li>
              <li>Change your password after first login for security</li>
              <li>Share your unique referral link with potential attendees</li>
              <li>Contact admin support if you face any issues</li>
            </ul>

            <p>Thank you for being part of Telugu Night!</p>
            <p><strong>Team Telugu Night</strong></p>
          </div>
          <div class="footer">
            <p>This is an automated email. Please don't reply to this address.</p>
            <p>For support, contact: mis@aashveetech.com</p>
          </div>
        </body>
        </html>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log('✅ Promoter credentials email sent to:', email);
    } catch (error) {
      console.error('❌ Failed to send promoter credentials email:', error);
      throw error;
    }
  }
}