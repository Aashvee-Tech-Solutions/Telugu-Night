var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/services/googleSheets.ts
var googleSheets_exports = {};
__export(googleSheets_exports, {
  GoogleSheetsService: () => GoogleSheetsService
});
import { google } from "googleapis";
var GoogleSheetsService;
var init_googleSheets = __esm({
  "server/services/googleSheets.ts"() {
    "use strict";
    GoogleSheetsService = class {
      sheets;
      spreadsheetId;
      constructor() {
        const credentials = JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS || "{}");
        const auth = new google.auth.GoogleAuth({
          credentials,
          scopes: ["https://www.googleapis.com/auth/spreadsheets"]
        });
        this.sheets = google.sheets({ version: "v4", auth });
        this.spreadsheetId = process.env.GOOGLE_SHEETS_ID || "";
      }
      async addBookingToSheet(booking) {
        try {
          if (!this.spreadsheetId) {
            console.log("Google Sheets not configured, skipping...");
            return null;
          }
          await this.ensureHeaderRow();
          const values = [
            [
              (/* @__PURE__ */ new Date()).toISOString(),
              booking.id,
              booking.name,
              booking.email,
              booking.phone,
              booking.gender || "",
              booking.ticketCount,
              booking.ticketType || "early_bird",
              Array.isArray(booking.guests) ? booking.guests.join(", ") : booking.guests || "",
              Array.isArray(booking.guestGenders) ? booking.guestGenders.join(", ") : booking.guestGenders || "",
              booking.couponCode || "",
              booking.couponDiscount || 0,
              booking.totalAmount,
              booking.paymentStatus,
              Array.isArray(booking.guestCodes) ? booking.guestCodes.join(", ") : booking.guestCodes || "",
              Array.isArray(booking.scannedGuests) ? booking.scannedGuests.join(", ") : booking.scannedGuests || "",
              Array.isArray(booking.scannedGuests) ? booking.scannedGuests.length : 0,
              booking.paymentScreenshot ? booking.paymentScreenshot.startsWith("http") ? booking.paymentScreenshot : `https://events.qlora.in${booking.paymentScreenshot}` : ""
            ]
          ];
          const request = {
            spreadsheetId: this.spreadsheetId,
            range: "Sheet1!A:S",
            valueInputOption: "USER_ENTERED",
            resource: {
              values
            }
          };
          const response = await this.sheets.spreadsheets.values.append(request);
          console.log("Successfully added booking to Google Sheets");
          return response.data;
        } catch (error) {
          if (error.message && error.message.includes("Google Sheets API has not been used")) {
            console.log("\u26A0\uFE0F  Google Sheets API is not enabled. Please enable it in Google Cloud Console at:");
            console.log("https://console.developers.google.com/apis/api/sheets.googleapis.com/overview");
            return null;
          }
          console.error("Error adding to Google Sheets:", error);
          return null;
        }
      }
      // Method to sync existing bookings - updates or adds as needed
      async syncBookingToSheet(booking) {
        try {
          return await this.addBookingToSheet(booking);
        } catch (error) {
          console.error("Error syncing booking to Google Sheets:", error);
          throw error;
        }
      }
      async updateBookingStatus(bookingId, status) {
        try {
          if (!this.spreadsheetId) {
            console.log("Google Sheets not configured, skipping update...");
            return null;
          }
          console.log(`Would update booking ${bookingId} status to ${status} in Google Sheets`);
          return null;
        } catch (error) {
          console.error("Error updating booking status in Google Sheets:", error);
          return null;
        }
      }
      async ensureHeaderRow() {
        try {
          const getResponse = await this.sheets.spreadsheets.values.get({
            spreadsheetId: this.spreadsheetId,
            range: "Sheet1!A1:S1"
          });
          if (!getResponse.data.values || getResponse.data.values.length === 0) {
            const headerValues = [
              [
                "Timestamp",
                "Booking ID",
                "Name",
                "Email",
                "Phone",
                "Gender",
                "Ticket Count",
                "Ticket Type",
                "Guests",
                "Guest Genders",
                "Coupon Code",
                "Coupon Discount",
                "Total Amount",
                "Payment Status",
                "Guest Codes",
                "Scanned Guests",
                "Entry Count",
                "Payment Screenshot"
              ]
            ];
            await this.sheets.spreadsheets.values.update({
              spreadsheetId: this.spreadsheetId,
              range: "Sheet1!A1:S1",
              valueInputOption: "USER_ENTERED",
              resource: {
                values: headerValues
              }
            });
          }
        } catch (error) {
          console.error("Error creating header row:", error);
        }
      }
      async addPaymentScreenshotToSheet(bookingId, screenshotUrl) {
        try {
          if (!this.spreadsheetId) {
            console.log("Google Sheets not configured for screenshot upload");
            return null;
          }
          const getResponse = await this.sheets.spreadsheets.values.get({
            spreadsheetId: this.spreadsheetId,
            range: "Sheet1!A:S"
          });
          const rows = getResponse.data.values || [];
          const rowIndex = rows.findIndex((row) => row[1] === bookingId.toString());
          if (rowIndex !== -1) {
            const range = `Sheet1!S${rowIndex + 1}`;
            await this.sheets.spreadsheets.values.update({
              spreadsheetId: this.spreadsheetId,
              range,
              valueInputOption: "USER_ENTERED",
              resource: {
                values: [[screenshotUrl]]
              }
            });
            console.log(`\u2705 Added payment screenshot URL to Google Sheets: ${screenshotUrl}`);
            return true;
          } else {
            console.log(`\u26A0\uFE0F Booking ${bookingId} not found in Google Sheets for screenshot update`);
            return false;
          }
        } catch (error) {
          console.error("Error adding screenshot to Google Sheets:", error);
          if (error.message?.includes("API has not been used")) {
            console.log("Please enable Google Sheets API at: https://console.developers.google.com/apis/api/sheets.googleapis.com/overview?project=640169928600");
          }
          return false;
        }
      }
      async testConnection() {
        try {
          if (!this.spreadsheetId) {
            return { success: false, message: "No spreadsheet ID configured" };
          }
          const response = await this.sheets.spreadsheets.get({
            spreadsheetId: this.spreadsheetId
          });
          return {
            success: true,
            message: "Google Sheets API is working",
            title: response.data.properties?.title
          };
        } catch (error) {
          console.error("Google Sheets test failed:", error);
          if (error.message?.includes("API has not been used")) {
            return {
              success: false,
              message: "Google Sheets API needs to be enabled. Visit: https://console.developers.google.com/apis/api/sheets.googleapis.com/overview?project=640169928600"
            };
          }
          return { success: false, message: error?.message || "Unknown error" };
        }
      }
      async resetSheet() {
        try {
          if (!this.spreadsheetId) {
            console.log("Google Sheets not configured, cannot reset");
            return { success: false, message: "No spreadsheet ID configured" };
          }
          console.log("\u{1F504} Resetting Google Sheet and starting fresh...");
          await this.sheets.spreadsheets.values.clear({
            spreadsheetId: this.spreadsheetId,
            range: "Sheet1!A:Z"
            // Clear all columns
          });
          const headerValues = [
            [
              "Timestamp",
              "Booking ID",
              "Name",
              "Email",
              "Phone",
              "Gender",
              "Ticket Count",
              "Ticket Type",
              "Guests",
              "Guest Genders",
              "Coupon Code",
              "Coupon Discount",
              "Total Amount",
              "Payment Status",
              "Guest Codes",
              "Scanned Guests",
              "Entry Count",
              "Payment Screenshot"
            ]
          ];
          await this.sheets.spreadsheets.values.update({
            spreadsheetId: this.spreadsheetId,
            range: "Sheet1!A1:R1",
            valueInputOption: "USER_ENTERED",
            resource: {
              values: headerValues
            }
          });
          console.log("\u2705 Google Sheet reset successfully with fresh headers");
          return { success: true, message: "Google Sheet reset successfully" };
        } catch (error) {
          console.error("\u274C Error resetting Google Sheet:", error);
          if (error.message?.includes("API has not been used")) {
            return {
              success: false,
              message: "Google Sheets API needs to be enabled. Visit: https://console.developers.google.com/apis/api/sheets.googleapis.com/overview"
            };
          }
          return { success: false, message: error?.message || "Unknown error" };
        }
      }
      async syncAllBookingsToFreshSheet(bookings2) {
        try {
          if (!this.spreadsheetId) {
            console.log("Google Sheets not configured, cannot sync");
            return { success: false, message: "No spreadsheet ID configured" };
          }
          console.log(`\u{1F504} Syncing ${bookings2.length} bookings to fresh Google Sheet...`);
          let successCount = 0;
          let errorCount = 0;
          for (const booking of bookings2) {
            try {
              await this.addBookingToSheet(booking);
              successCount++;
              console.log(`\u2705 Synced booking ${booking.id}: ${booking.name}`);
            } catch (error) {
              errorCount++;
              console.error(`\u274C Failed to sync booking ${booking.id}:`, error);
            }
          }
          console.log(`\u{1F389} Sync completed: ${successCount} success, ${errorCount} errors`);
          return {
            success: true,
            message: `Synced ${successCount} bookings successfully`,
            successCount,
            errorCount
          };
        } catch (error) {
          console.error("\u274C Error during bulk sync:", error);
          return { success: false, message: error?.message || "Bulk sync failed" };
        }
      }
      async updateBookingPaymentStatus(bookingId, status) {
        try {
          if (!this.spreadsheetId) {
            console.log("Google Sheets not configured for status update");
            return null;
          }
          const getResponse = await this.sheets.spreadsheets.values.get({
            spreadsheetId: this.spreadsheetId,
            range: "Sheet1!A:M"
          });
          const rows = getResponse.data.values || [];
          const rowIndex = rows.findIndex((row) => row[1] === bookingId.toString());
          if (rowIndex !== -1) {
            const range = `Sheet1!K${rowIndex + 1}`;
            await this.sheets.spreadsheets.values.update({
              spreadsheetId: this.spreadsheetId,
              range,
              valueInputOption: "USER_ENTERED",
              resource: {
                values: [[status]]
              }
            });
            console.log(`\u2705 Updated booking ${bookingId} status to ${status} in Google Sheets`);
            return true;
          } else {
            console.log(`\u26A0\uFE0F Booking ${bookingId} not found in Google Sheets for status update`);
            return false;
          }
        } catch (error) {
          console.error("Error updating booking status in Google Sheets:", error);
          return null;
        }
      }
      async deleteBookingFromSheet(bookingId) {
        try {
          if (!this.spreadsheetId) {
            console.log("Google Sheets not configured for booking deletion");
            return null;
          }
          const getResponse = await this.sheets.spreadsheets.values.get({
            spreadsheetId: this.spreadsheetId,
            range: "Sheet1!A:M"
          });
          const rows = getResponse.data.values || [];
          const rowIndex = rows.findIndex((row) => row[1] === bookingId.toString());
          if (rowIndex !== -1) {
            await this.sheets.spreadsheets.batchUpdate({
              spreadsheetId: this.spreadsheetId,
              resource: {
                requests: [{
                  deleteDimension: {
                    range: {
                      sheetId: 0,
                      // First sheet
                      dimension: "ROWS",
                      startIndex: rowIndex,
                      endIndex: rowIndex + 1
                    }
                  }
                }]
              }
            });
            console.log(`\u2705 Deleted booking ${bookingId} from Google Sheets (row ${rowIndex + 1})`);
            return true;
          } else {
            console.log(`\u26A0\uFE0F Booking ${bookingId} not found in Google Sheets for deletion`);
            return false;
          }
        } catch (error) {
          console.error("Error deleting booking from Google Sheets:", error);
          return false;
        }
      }
    };
  }
});

// server/services/emailService.ts
var emailService_exports = {};
__export(emailService_exports, {
  EmailService: () => EmailService,
  generateGuestCodes: () => generateGuestCodes,
  generatePassIds: () => generatePassIds
});
import nodemailer from "nodemailer";
import QRCode from "qrcode";
function generateUniqueGuestCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
function generateGuestCodes(count) {
  const codes = /* @__PURE__ */ new Set();
  while (codes.size < count) {
    codes.add(generateUniqueGuestCode());
  }
  return Array.from(codes);
}
function generatePassIds(bookingId, count) {
  const passIds = [];
  for (let i = 0; i < count; i++) {
    passIds.push(`TELUGU-${bookingId}-${i + 1}-${Date.now()}`);
  }
  return passIds;
}
var EmailService;
var init_emailService = __esm({
  "server/services/emailService.ts"() {
    "use strict";
    EmailService = class {
      transporter;
      constructor() {
        this.transporter = nodemailer.createTransport({
          host: "smtp.hostinger.com",
          port: 587,
          secure: false,
          auth: {
            user: process.env.SMTP_USER || "mis@aashveetech.com",
            pass: process.env.SMTP_PASSWORD || "Mis@1234@1234"
          }
        });
      }
      // Stage 1: Payment confirmation email
      async sendPaymentConfirmationEmail(booking) {
        const mailOptions = {
          from: "mis@aashveetech.com",
          to: booking.email,
          subject: "\u{1F38A} Telugu Night - Payment Received! Verification in Progress",
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
            <h1>\u{1F38A} Telugu Night - DTR, Manipal</h1>
            <p>Payment Confirmation</p>
          </div>
          
          <div class="content">
            <div class="card">
              <h2>Hi ${booking.name}! \u{1F44B}</h2>
              <p>Thank you for your payment! We've received your booking details and payment screenshot.</p>
              
              <h3>\u{1F4CB} Booking Details:</h3>
              <ul>
                <li><strong>Booking ID:</strong> <span class="highlight">#${booking.id}</span></li>
                <li><strong>Tickets:</strong> ${booking.ticketCount} \xD7 \u20B9300 = \u20B9${booking.totalAmount}</li>
                <li><strong>Contact:</strong> ${booking.phone}</li>
              </ul>

              ${booking.guests && booking.guests.length > 0 ? `
                <h3>\u{1F465} Guest Names:</h3>
                <ul>
                  ${booking.guests.map((guest) => `<li>${guest}</li>`).join("")}
                </ul>
              ` : ""}
            </div>

            <div class="card" style="background: #e8f4f8; border-left: 4px solid #2196F3;">
              <h3>\u23F3 What happens next?</h3>
              <p><strong>1. Payment Verification:</strong> Our team will verify your payment within 2-4 hours</p>
              <p><strong>2. Ticket Delivery:</strong> Once verified, you'll receive your digital tickets with QR codes</p>
              <p><strong>3. Event Entry:</strong> Show your QR codes at the venue for instant entry</p>
            </div>

            <div class="card">
              <h3>\u{1F4F1} Important Information:</h3>
              <ul>
                <li>\u{1F4E7} <strong>Check your email regularly</strong> - tickets will be delivered digitally</li>
                <li>\u{1F4F1} <strong>Save the QR codes</strong> - needed for venue entry</li>
                <li>\u{1F3AB} <strong>Each guest gets a unique code</strong> - don't share with others</li>
              </ul>
            </div>
          </div>

          <div class="footer">
            <p>Questions? Contact us at: mis@aashveetech.com | \u{1F4DE} +91 6281614117</p>
            <p><em>Telugu Night - The Ultimate DJ Experience in DTR, Manipal</em></p>
          </div>
        </body>
        </html>
      `
        };
        await this.transporter.sendMail(mailOptions);
      }
      // Stage 2: Send tickets with QR codes
      async sendTicketEmails(booking, qrCodes, passIds) {
        try {
          const generatedQRCodes = [];
          for (let i = 0; i < booking.ticketCount; i++) {
            const guestCode = booking.guestCodes[i] || `GUEST${booking.id}${i + 1}`;
            const qrCodeData = `TELUGU-NIGHT-${booking.id}-${guestCode}`;
            const qrCodeImage = await QRCode.toDataURL(qrCodeData, {
              width: 300,
              margin: 2,
              color: {
                dark: "#000000",
                light: "#FFFFFF"
              }
            });
            generatedQRCodes.push(qrCodeImage);
          }
          const ticketAttachments = generatedQRCodes.map((qrCode, index) => ({
            filename: `telugu-night-ticket-${index + 1}.png`,
            content: qrCode.split(";base64,").pop(),
            encoding: "base64",
            cid: `ticket${index + 1}`
          }));
          const mailOptions = {
            from: "mis@aashveetech.com",
            to: booking.email,
            subject: "\u{1F3AB} Your Telugu Night Tickets - Entry Passes Ready!",
            html: this.generateTicketEmailHTML(booking, generatedQRCodes),
            attachments: ticketAttachments
          };
          await this.transporter.sendMail(mailOptions);
          console.log(`Ticket email sent successfully to ${booking.email} with ${generatedQRCodes.length} QR codes`);
        } catch (error) {
          console.error("Error sending ticket email:", error);
          throw error;
        }
      }
      // Generate ticket email HTML with QR codes
      generateTicketEmailHTML(booking, qrCodes) {
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
          <h1>\u{1F38A} Telugu Night - DTR, Manipal</h1>
          <p>Your Digital Tickets</p>
        </div>
        
        <div class="content">
          <div class="success">
            <h2>\u2705 Payment Verified! Welcome to Telugu Night!</h2>
            <p>Hi <strong>${booking.name}</strong>, your payment has been successfully verified. Here are your digital tickets with QR codes!</p>
          </div>

          <div class="card">
            <h3>\u{1F4CB} Booking Summary:</h3>
            <ul>
              <li><strong>Booking ID:</strong> <span class="highlight">#${booking.id}</span></li>
              <li><strong>Total Tickets:</strong> ${booking.ticketCount}</li>
              <li><strong>Total Amount:</strong> \u20B9${booking.totalAmount}</li>
              <li><strong>Contact:</strong> ${booking.phone}</li>
            </ul>
          </div>

          <h2 style="text-align: center; color: #667eea;">\u{1F3AB} Your Digital Tickets</h2>
          
          ${booking.guestCodes.map((guestCode, index) => `
            <div class="ticket">
              <h3>\u{1F3AB} Ticket ${index + 1}</h3>
              <p><strong>Guest:</strong> ${booking.guests[index] || `Guest ${index + 1}`}</p>
              <div class="guest-code">${guestCode}</div>
              <div class="pass-id">Pass ID: ${booking.passIds ? booking.passIds[index] : "N/A"}</div>
              <div class="qr-code">
                <img src="cid:ticket${index + 1}" alt="QR Code" style="max-width: 250px;">
              </div>
              <p><em>Show this QR code at the venue entrance</em></p>
            </div>
          `).join("")}

          <div class="card">
            <h3>\u{1F3AF} Event Information:</h3>
            <ul>
              <li><strong>Event:</strong> Telugu Night - DJ Experience</li>
              <li><strong>Venue:</strong> DTR, Manipal</li>
              <li><strong>Entry:</strong> Show your QR codes at the entrance</li>
              <li><strong>Guest Codes:</strong> Each ticket has a unique 6-digit code</li>
            </ul>
          </div>

          <div class="card" style="background: #fff3cd; border-left: 4px solid #ffc107;">
            <h3>\u26A0\uFE0F Important Instructions:</h3>
            <ul>
              <li>\u{1F4BE} <strong>Save this email</strong> - you'll need it for entry</li>
              <li>\u{1F4F1} <strong>Screenshot the QR codes</strong> - in case of network issues</li>
              <li>\u{1F3AB} <strong>Each guest needs their own QR code</strong> - don't share</li>
              <li>\u23F0 <strong>Arrive early</strong> - for smooth entry process</li>
            </ul>
          </div>
        </div>

        <div class="footer">
          <p>Questions? Contact us at: mis@aashveetech.com | \u{1F4DE} +91 6281614117</p>
          <p><em>Telugu Night - The Ultimate DJ Experience in DTR, Manipal</em></p>
        </div>
      </body>
      </html>
    `;
      }
      // Generate QR codes for tickets
      async generateQRCodes(booking) {
        const passIds = generatePassIds(booking.id, booking.ticketCount);
        const qrCodes = [];
        for (let i = 0; i < booking.ticketCount; i++) {
          const guestCode = booking.guestCodes[i];
          const passId = passIds[i];
          const qrData = `TELUGU-NIGHT-${booking.id}-${guestCode}`;
          try {
            const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
              width: 300,
              margin: 2,
              color: {
                dark: "#000000",
                light: "#FFFFFF"
              }
            });
            qrCodes.push(qrCodeDataUrl);
          } catch (error) {
            console.error("QR code generation failed:", error);
            throw error;
          }
        }
        return { qrCodes, passIds };
      }
    };
  }
});

// server/services/enhancedEmailService.ts
var enhancedEmailService_exports = {};
__export(enhancedEmailService_exports, {
  EnhancedEmailService: () => EnhancedEmailService,
  enhancedEmailService: () => enhancedEmailService
});
import nodemailer2 from "nodemailer";
import QRCode2 from "qrcode";
import { google as google2 } from "googleapis";
var EnhancedEmailService, enhancedEmailService;
var init_enhancedEmailService = __esm({
  "server/services/enhancedEmailService.ts"() {
    "use strict";
    EnhancedEmailService = class {
      transporter;
      calendar;
      constructor() {
        this.initializeTransporter();
        this.initializeGoogleCalendar();
      }
      initializeTransporter() {
        const smtpConfig = {
          host: "smtp.hostinger.com",
          port: 465,
          secure: true,
          // Use SSL
          auth: {
            user: process.env.SMTP_USER || "mis@aashveetech.com",
            pass: process.env.SMTP_PASS || "Mis@1234@1234"
          },
          connectionTimeout: 1e4,
          greetingTimeout: 5e3,
          socketTimeout: 1e4,
          maxConnections: 1,
          maxMessages: 1,
          tls: {
            rejectUnauthorized: false,
            minVersion: "TLSv1"
          },
          debug: false,
          logger: false
        };
        this.transporter = nodemailer2.createTransport(smtpConfig);
      }
      async initializeGoogleCalendar() {
        try {
          if (process.env.GOOGLE_SHEETS_CREDENTIALS) {
            const credentials = JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS);
            const auth = new google2.auth.GoogleAuth({
              credentials,
              scopes: ["https://www.googleapis.com/auth/calendar"]
            });
            this.calendar = google2.calendar({ version: "v3", auth });
            console.log("\u2705 Google Calendar initialized successfully");
          }
        } catch (error) {
          console.log("Google Calendar initialization skipped:", error.message);
        }
      }
      // Generate Google Calendar event link
      generateCalendarEvent(booking) {
        const eventTitle = encodeURIComponent("Telugu Night - DTR Manipal");
        const eventDescription = encodeURIComponent(`\u{1F38A} Telugu Night Event

Booking Details:
- Booking ID: #${booking.id}
- Tickets: ${booking.ticketCount}
- Guest Codes: ${booking.guestCodes.join(", ")}

Important: Show your QR code at the venue for entry!

Contact: mis@aashveetech.com | +91 6281614117`);
        const eventLocation = encodeURIComponent("DTR, Manipal, Karnataka");
        const startTime = "20250803T190000Z";
        const endTime = "20250803T230000Z";
        return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${eventTitle}&dates=${startTime}/${endTime}&details=${eventDescription}&location=${eventLocation}&sf=true&output=xml`;
      }
      // Send payment confirmation email after screenshot upload
      async sendPaymentConfirmationEmail(booking) {
        try {
          const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Payment Received!</h1>
            <p style="color: #e0e7ff; margin: 10px 0 0 0; font-size: 16px;">Telugu Night - DTR Manipal</p>
          </div>
          
          <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h2 style="color: #333; margin: 0 0 10px 0;">Hi ${booking.name}!</h2>
              <p style="color: #666; font-size: 16px; line-height: 1.6;">
                Thank you for uploading your payment screenshot. Your booking is now being reviewed by our admin team.
              </p>
            </div>
            
            <div style="background: #f8f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #4f46e5; margin: 0 0 15px 0; text-align: center;">Booking Details</h3>
              <div style="display: grid; gap: 10px;">
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                  <span style="font-weight: bold; color: #374151;">Booking ID:</span>
                  <span style="color: #6b7280;">#${booking.id}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                  <span style="font-weight: bold; color: #374151;">Tickets:</span>
                  <span style="color: #6b7280;">${booking.ticketCount}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                  <span style="font-weight: bold; color: #374151;">Total Amount:</span>
                  <span style="color: #059669; font-weight: bold;">\u20B9${parseFloat(booking.totalAmount.toString()).toFixed(2)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 8px 0;">
                  <span style="font-weight: bold; color: #374151;">Status:</span>
                  <span style="color: #d97706; font-weight: bold;">Under Review</span>
                </div>
              </div>
            </div>
            
            <div style="background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; color: #92400e; font-size: 14px; text-align: center;">
                <strong>Next Steps:</strong> Our admin team will verify your payment and send your QR tickets via email within 24 hours.
              </p>
            </div>
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 14px; margin: 0;">
                Questions? Contact us at <a href="mailto:mis@aashveetech.com" style="color: #4f46e5;">mis@aashveetech.com</a>
              </p>
            </div>
          </div>
        </div>
      `;
          await this.transporter.sendMail({
            from: "mis@aashveetech.com",
            to: booking.email,
            subject: `Payment Received - Telugu Night Booking #${booking.id}`,
            html: emailHtml
          });
          console.log(`\u2705 Payment confirmation email sent to ${booking.email}`);
        } catch (error) {
          console.error("Payment confirmation email failed:", error);
          throw error;
        }
      }
      // Test SMTP connection
      async testEmailConnection(testEmail = "test@example.com") {
        try {
          await this.transporter.verify();
          console.log("\u2705 SMTP connection verified successfully");
          await this.transporter.sendMail({
            from: "mis@aashveetech.com",
            to: testEmail,
            subject: "SMTP Connection Test - Telugu Night System",
            html: `
          <h2>SMTP Test Successful</h2>
          <p>Your email system is working correctly!</p>
          <p>Time: ${(/* @__PURE__ */ new Date()).toISOString()}</p>
        `
          });
          console.log(`\u2705 Test email sent successfully to ${testEmail}`);
        } catch (error) {
          console.error("\u274C SMTP connection failed:", error);
          throw error;
        }
      }
      // Send tickets with QR codes and Google Calendar integration
      async sendTicketEmails(booking) {
        try {
          const generatedQRCodes = [];
          for (let i = 0; i < booking.ticketCount; i++) {
            const guestCode = booking.guestCodes[i] || `GUEST${booking.id}${i + 1}`;
            console.log(`\u{1F4F1} Generating QR code for guest code: ${guestCode}`);
            const qrCodeData = guestCode;
            const qrCodeImage = await QRCode2.toDataURL(qrCodeData, {
              width: 300,
              margin: 2,
              color: {
                dark: "#000000",
                light: "#FFFFFF"
              }
            });
            generatedQRCodes.push(qrCodeImage);
          }
          const ticketAttachments = generatedQRCodes.map((qrCode, index) => ({
            filename: `telugu-night-ticket-${index + 1}.png`,
            content: qrCode.split(";base64,").pop(),
            encoding: "base64",
            cid: `ticket${index + 1}`
          }));
          const calendarLink = this.generateCalendarEvent(booking);
          const mailOptions = {
            from: "mis@aashveetech.com",
            to: booking.email,
            subject: "\u{1F3AB} Your Telugu Night Tickets - QR Codes & Calendar Event Ready!",
            html: this.generateEnhancedTicketEmailHTML(booking, generatedQRCodes, calendarLink),
            attachments: ticketAttachments
          };
          await this.transporter.sendMail(mailOptions);
          console.log(`\u2705 Enhanced ticket email sent successfully to ${booking.email} with ${generatedQRCodes.length} QR codes and calendar event`);
        } catch (error) {
          console.error("Error sending enhanced ticket email:", error);
          throw error;
        }
      }
      // Generate enhanced ticket email HTML with QR codes and calendar integration
      generateEnhancedTicketEmailHTML(booking, qrCodes, calendarLink) {
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
          <h1>\u{1F38A} Telugu Night - DTR, Manipal</h1>
          <p>Your Digital Tickets with QR Codes</p>
        </div>
        
        <div class="content">
          <div class="success">
            <h2>\u2705 Payment Verified! Welcome to Telugu Night!</h2>
            <p>Hi <strong>${booking.name}</strong>, your payment has been successfully verified. Here are your digital tickets with QR codes!</p>
          </div>

          <div class="calendar-section">
            <h3>\u{1F4C5} Add to Your Calendar</h3>
            <p><strong>Telugu Night - August 3, 2025, 7:00 PM</strong></p>
            <p>DTR, Manipal, Karnataka</p>
            <a href="${calendarLink}" class="calendar-button" target="_blank">
              \u{1F4C5} Add to Google Calendar
            </a>
            <p style="font-size: 12px; color: #666; margin-top: 10px;">
              Click the button above to automatically add the event to your Google Calendar with all your booking details!
            </p>
          </div>

          <div class="card">
            <h3>\u{1F4CB} Booking Summary:</h3>
            <ul>
              <li><strong>Booking ID:</strong> <span class="highlight">#${booking.id}</span></li>
              <li><strong>Total Tickets:</strong> ${booking.ticketCount}</li>
              <li><strong>Total Amount:</strong> \u20B9${booking.totalAmount}</li>
              <li><strong>Contact:</strong> ${booking.phone}</li>
            </ul>
          </div>

          <h2 style="text-align: center; color: #667eea;">\u{1F3AB} Your Digital Tickets</h2>
          
          ${booking.guestCodes.map((guestCode, index) => {
          let guestName;
          if (index === 0) {
            guestName = booking.name;
          } else {
            guestName = booking.guests[index - 1] || `Guest ${index + 1}`;
          }
          return `
            <div class="ticket">
              <h3>\u{1F3AB} Ticket ${index + 1}</h3>
              <p><strong>Guest:</strong> ${guestName}</p>
              <div class="guest-code">${guestCode}</div>
              <div class="qr-code">
                <img src="cid:ticket${index + 1}" alt="QR Code" style="max-width: 250px;">
              </div>
              <p><em>Show this QR code at the venue entrance</em></p>
            </div>
          `;
        }).join("")}

          <div class="card">
            <h3>\u{1F3AF} Event Information:</h3>
            <ul>
              <li><strong>Event:</strong> Telugu Night - DJ Experience</li>
              <li><strong>Venue:</strong> DTR, Manipal</li>
              <li><strong>Date:</strong> August 3, 2025</li>
              <li><strong>Time:</strong> 7:00 PM - 11:00 PM</li>
              <li><strong>Entry:</strong> Show QR code or guest code</li>
            </ul>
          </div>

          <div class="card" style="background: #fff3cd; border-left: 4px solid #ffc107;">
            <h3>\u26A0\uFE0F Important Instructions:</h3>
            <ul>
              <li>\u{1F4F1} <strong>Save these QR codes</strong> - required for venue entry</li>
              <li>\u{1F3AB} <strong>Each person needs their own ticket</strong> - don't share QR codes</li>
              <li>\u{1F4E7} <strong>Print or screenshot</strong> - ensure QR codes are clearly visible</li>
              <li>\u{1F194} <strong>Bring valid ID</strong> - may be required at the venue</li>
              <li>\u{1F4C5} <strong>Add to calendar</strong> - don't miss the event!</li>
            </ul>
          </div>
        </div>

        <div class="footer">
          <p>Questions? Contact us at: mis@aashveetech.com | \u{1F4DE} +91 6281614117</p>
          <p><em>Telugu Night - The Ultimate DJ Experience in DTR, Manipal</em></p>
          <p style="margin-top: 15px;">
            <a href="${calendarLink}" style="color: #4285f4;">\u{1F4C5} Add Event to Google Calendar</a>
          </p>
        </div>
      </body>
      </html>
    `;
      }
    };
    enhancedEmailService = new EnhancedEmailService();
  }
});

// server/index.ts
import express2 from "express";
import cookieParser from "cookie-parser";

// server/routes.ts
import { createServer } from "http";
import multer from "multer";
import path from "path";
import fs from "fs";
import bcrypt2 from "bcryptjs";
import compression from "compression";

// server/db.ts
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  PERMISSIONS: () => PERMISSIONS,
  ROLE_PERMISSIONS: () => ROLE_PERMISSIONS,
  adminSessions: () => adminSessions,
  bookings: () => bookings,
  coupons: () => coupons,
  insertAdminSessionSchema: () => insertAdminSessionSchema,
  insertBookingSchema: () => insertBookingSchema,
  insertCouponSchema: () => insertCouponSchema,
  insertTicketConfigSchema: () => insertTicketConfigSchema,
  insertUserSchema: () => insertUserSchema,
  ticketConfig: () => ticketConfig,
  ticketCounter: () => ticketCounter,
  users: () => users
});
import { pgTable, text, serial, integer, boolean, timestamp, numeric, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
var users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role", { enum: ["super_admin", "admin", "organizer", "scanner", "viewer"] }).notNull().default("scanner"),
  permissions: jsonb("permissions").$type().default([]),
  isActive: boolean("is_active").default(true),
  lastLogin: timestamp("last_login"),
  createdAt: timestamp("created_at").defaultNow()
});
var adminSessions = pgTable("admin_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  token: text("token").unique().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow()
});
var bookings = pgTable("bookings", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  gender: text("gender", { enum: ["male", "female", "other"] }),
  ticketCount: integer("ticket_count").notNull(),
  ticketType: text("ticket_type", { enum: ["early_bird", "phase_1"] }).default("early_bird"),
  guests: jsonb("guests").$type().default([]),
  guestGenders: jsonb("guest_genders").$type().default([]),
  guestCodes: jsonb("guest_codes").$type().default([]),
  // 6-digit alphanumeric codes
  couponCode: text("coupon_code"),
  couponDiscount: integer("coupon_discount").default(0),
  totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).notNull(),
  paymentStatus: text("payment_status", { enum: ["pending", "paid", "verified"] }).default("pending"),
  paymentScreenshot: text("payment_screenshot"),
  qrCodes: jsonb("qr_codes").$type().default([]),
  passIds: jsonb("pass_ids").$type().default([]),
  // Unique pass IDs for dashboard
  isScanned: boolean("is_scanned").default(false),
  scannedAt: timestamp("scanned_at"),
  scannedBy: integer("scanned_by").references(() => users.id),
  scannedGuests: jsonb("scanned_guests").$type().default([]),
  // Track which guests have been scanned
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
var coupons = pgTable("coupons", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  discount: integer("discount").notNull(),
  isActive: boolean("is_active").default(true),
  usageLimit: integer("usage_limit"),
  usageCount: integer("usage_count").default(0),
  createdAt: timestamp("created_at").defaultNow()
});
var insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  role: true,
  permissions: true
});
var insertAdminSessionSchema = createInsertSchema(adminSessions).pick({
  userId: true,
  token: true,
  expiresAt: true
});
var ticketConfig = pgTable("ticket_config", {
  id: serial("id").primaryKey(),
  earlyBirdPrice: numeric("early_bird_price", { precision: 10, scale: 2 }).default("300"),
  phase1Price: numeric("phase1_price", { precision: 10, scale: 2 }).default("350"),
  earlyBirdLimit: integer("early_bird_limit").default(90),
  phase1Limit: integer("phase1_limit").default(200),
  isEarlyBirdActive: boolean("is_early_bird_active").default(true),
  isPhase1Active: boolean("is_phase1_active").default(true),
  convenientFee: numeric("convenient_fee", { precision: 10, scale: 2 }).default("12.96"),
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedBy: integer("updated_by").references(() => users.id)
});
var ticketCounter = pgTable("ticket_counter", {
  id: serial("id").primaryKey(),
  earlyBirdCount: integer("early_bird_count").default(0),
  earlyBirdLimit: integer("early_bird_limit").default(90),
  phase1Count: integer("phase_1_count").default(0),
  lastUpdated: timestamp("last_updated").defaultNow()
});
var insertBookingSchema = createInsertSchema(bookings).pick({
  name: true,
  email: true,
  phone: true,
  gender: true,
  ticketCount: true,
  ticketType: true,
  guests: true,
  couponCode: true
}).extend({
  couponCode: z.string().optional(),
  guests: z.array(z.string()).optional()
});
var insertCouponSchema = createInsertSchema(coupons).pick({
  code: true,
  discount: true,
  usageLimit: true
});
var insertTicketConfigSchema = createInsertSchema(ticketConfig).pick({
  earlyBirdPrice: true,
  phase1Price: true,
  earlyBirdLimit: true,
  phase1Limit: true,
  isEarlyBirdActive: true,
  isPhase1Active: true,
  convenientFee: true
});
var PERMISSIONS = {
  // Booking management
  VIEW_BOOKINGS: "view_bookings",
  VERIFY_PAYMENTS: "verify_payments",
  SEND_TICKETS: "send_tickets",
  DELETE_BOOKINGS: "delete_bookings",
  MANAGE_BOOKINGS: "manage_bookings",
  // Scanner access
  SCANNER_ACCESS: "scanner_access",
  // User management
  MANAGE_USERS: "manage_users",
  VIEW_USERS: "view_users",
  // System settings
  MANAGE_COUPONS: "manage_coupons",
  VIEW_ANALYTICS: "view_analytics",
  SYSTEM_SETTINGS: "system_settings"
};
var ROLE_PERMISSIONS = {
  super_admin: Object.values(PERMISSIONS),
  admin: [
    PERMISSIONS.VIEW_BOOKINGS,
    PERMISSIONS.VERIFY_PAYMENTS,
    PERMISSIONS.SEND_TICKETS,
    PERMISSIONS.DELETE_BOOKINGS,
    PERMISSIONS.MANAGE_BOOKINGS,
    PERMISSIONS.SCANNER_ACCESS,
    PERMISSIONS.MANAGE_COUPONS,
    PERMISSIONS.VIEW_ANALYTICS,
    PERMISSIONS.VIEW_USERS
  ],
  organizer: [
    PERMISSIONS.VIEW_BOOKINGS,
    PERMISSIONS.VERIFY_PAYMENTS,
    PERMISSIONS.SEND_TICKETS,
    PERMISSIONS.VIEW_ANALYTICS
  ],
  scanner: [
    PERMISSIONS.SCANNER_ACCESS
  ],
  viewer: [
    PERMISSIONS.VIEW_BOOKINGS,
    PERMISSIONS.VIEW_ANALYTICS
  ]
};

// server/db.ts
neonConfig.webSocketConstructor = ws;
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?"
  );
}
var pool = new Pool({ connectionString: process.env.DATABASE_URL });
var db = drizzle({ client: pool, schema: schema_exports });

// server/databaseStorage.ts
import { eq } from "drizzle-orm";
var DatabaseStorage = class {
  adminSessions;
  temporaryCoupons;
  currentCouponId;
  ticketCountCache = null;
  bookingsCache = null;
  CACHE_TTL = 3e4;
  // 30 seconds cache
  constructor() {
    this.adminSessions = /* @__PURE__ */ new Map();
    this.temporaryCoupons = /* @__PURE__ */ new Map();
    this.currentCouponId = 1;
    this.initializeDefaultUser();
    this.initializeTicketCounter();
  }
  async initializeDefaultUser() {
    try {
      const adminUser = await this.getUserByUsername("aashvee");
      if (!adminUser) {
        const hashedPassword = await import("bcryptjs").then((bcrypt3) => bcrypt3.hashSync("Rudra@78611", 10));
        await this.createUser({
          username: "aashvee",
          password: hashedPassword,
          role: "super_admin",
          permissions: ["view_bookings", "verify_payments", "manage_coupons", "send_tickets", "scanner_access", "delete_bookings", "manage_bookings", "manage_users", "view_users", "view_analytics", "system_settings"]
        });
        console.log("\u2705 Default admin user created");
      }
    } catch (error) {
      console.log("Admin user initialization error:", error);
    }
  }
  async initializeTicketCounter() {
    try {
      const existingCounter = await db.select().from(ticketCounter).limit(1);
      if (existingCounter.length === 0) {
        await db.insert(ticketCounter).values({
          earlyBirdCount: 0,
          earlyBirdLimit: 90,
          phase1Count: 0
        });
        console.log("\u2705 Ticket counter initialized");
      }
    } catch (error) {
      console.log("Ticket counter initialization error:", error);
    }
  }
  // User operations
  async getUser(id) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || void 0;
  }
  async getUserByUsername(username) {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || void 0;
  }
  async createUser(insertUser) {
    const [user] = await db.insert(users).values([insertUser]).returning();
    return user;
  }
  // Booking operations - Now using database
  async createBooking(bookingData) {
    const [booking] = await db.insert(bookings).values({
      name: bookingData.name,
      email: bookingData.email,
      phone: bookingData.phone,
      ticketCount: bookingData.ticketCount,
      guests: bookingData.guests || [],
      guestCodes: bookingData.guestCodes || [],
      couponCode: bookingData.couponCode || null,
      totalAmount: bookingData.totalAmount || "0",
      paymentStatus: bookingData.paymentStatus || "pending",
      couponDiscount: bookingData.couponDiscount || 0
    }).returning();
    this.bookingsCache = null;
    return booking;
  }
  async getBooking(id) {
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, id));
    return booking || void 0;
  }
  async getAllBookings() {
    if (this.bookingsCache && Date.now() - this.bookingsCache.lastUpdated < this.CACHE_TTL) {
      return this.bookingsCache.data;
    }
    const result = await db.select().from(bookings);
    this.bookingsCache = {
      data: result,
      lastUpdated: Date.now()
    };
    return result;
  }
  async updateBookingPaymentStatus(id, status, screenshot) {
    const updateData = {
      paymentStatus: status,
      updatedAt: /* @__PURE__ */ new Date()
    };
    if (screenshot) updateData.paymentScreenshot = screenshot;
    await db.update(bookings).set(updateData).where(eq(bookings.id, id));
    this.bookingsCache = null;
  }
  // Delete booking
  async deleteBooking(id) {
    const bookingToDelete = await this.getBooking(id);
    if (!bookingToDelete) {
      throw new Error("Booking not found");
    }
    const [deletedBooking] = await db.delete(bookings).where(eq(bookings.id, id)).returning();
    if (!deletedBooking) {
      throw new Error("Booking not found");
    }
    try {
      await this.decreaseTicketCounts(bookingToDelete.ticketType, bookingToDelete.ticketCount);
      console.log(`\u2705 Booking ${id} deleted from database and ${bookingToDelete.ticketCount} ${bookingToDelete.ticketType} tickets returned to inventory`);
    } catch (error) {
      console.error("Failed to update ticket counts after deletion:", error);
    }
    this.bookingsCache = null;
  }
  async updateBookingQRCodes(id, qrCodes, passIds, guestCodes) {
    await db.update(bookings).set({
      qrCodes,
      passIds,
      guestCodes,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq(bookings.id, id));
  }
  async scanTicket(id, scannedBy) {
    await db.update(bookings).set({
      isScanned: true,
      scannedAt: /* @__PURE__ */ new Date(),
      scannedBy,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq(bookings.id, id));
  }
  async updateBookingVerification(id, status, guestCodes) {
    await db.update(bookings).set({
      paymentStatus: status,
      guestCodes,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq(bookings.id, id));
  }
  // Coupon operations
  async createCoupon(insertCoupon) {
    const id = this.currentCouponId++;
    const coupon = {
      ...insertCoupon,
      id,
      isActive: true,
      usageLimit: insertCoupon.usageLimit || null,
      usageCount: 0,
      createdAt: /* @__PURE__ */ new Date()
    };
    this.temporaryCoupons.set(id, coupon);
    return coupon;
  }
  async getCouponByCode(code) {
    const coupon = Array.from(this.temporaryCoupons.values()).find(
      (c) => c.code === code && c.isActive
    );
    if (coupon && coupon.usageLimit && (coupon.usageCount || 0) >= coupon.usageLimit) {
      return void 0;
    }
    return coupon;
  }
  async updateCouponUsage(code) {
    const coupon = Array.from(this.temporaryCoupons.values()).find((c) => c.code === code);
    if (coupon) {
      coupon.usageCount = (coupon.usageCount || 0) + 1;
      console.log(`Coupon ${code} usage updated: ${coupon.usageCount}/${coupon.usageLimit || "unlimited"}`);
    }
  }
  async validateCoupon(code) {
    const testCoupons = [
      { code: "SAVE10", discount: 10, message: "10% discount applied!" },
      { code: "EARLY20", discount: 20, message: "20% early bird discount!" },
      { code: "VIP25", discount: 25, message: "25% VIP discount!" },
      { code: "STUDENT15", discount: 15, message: "15% student discount!" }
    ];
    const testCoupon = testCoupons.find((c) => c.code === code.toUpperCase());
    if (testCoupon) {
      return { valid: true, discount: testCoupon.discount, message: testCoupon.message };
    }
    const coupon = Array.from(this.temporaryCoupons.values()).find((c) => c.code === code);
    if (!coupon) {
      return { valid: false, discount: 0, message: "Invalid coupon code" };
    }
    if (!coupon.isActive) {
      return { valid: false, discount: 0, message: "Coupon is inactive" };
    }
    if (coupon.usageLimit && (coupon.usageCount || 0) >= coupon.usageLimit) {
      return { valid: false, discount: 0, message: "Coupon usage limit reached" };
    }
    return {
      valid: true,
      discount: coupon.discount,
      message: `${coupon.discount}% discount applied`
    };
  }
  async getAllCoupons() {
    return Array.from(this.temporaryCoupons.values());
  }
  // User management methods
  async updateUserLastLogin(id) {
    await db.update(users).set({
      lastLogin: /* @__PURE__ */ new Date()
    }).where(eq(users.id, id));
  }
  async updateUserRole(id, role, permissions) {
    const updateData = { role };
    if (permissions) {
      updateData.permissions = permissions;
    }
    const [user] = await db.update(users).set(updateData).where(eq(users.id, id)).returning();
    return user;
  }
  async updateBookingScannedGuests(id, scannedGuests) {
    try {
      await db.update(bookings).set({
        scannedGuests,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq(bookings.id, id));
      this.bookingsCache = null;
      console.log(`\u2705 Updated scanned guests for booking ${id}: ${scannedGuests.join(", ")}`);
    } catch (error) {
      console.error(`\u274C Failed to update scanned guests for booking ${id}:`, error);
      throw new Error("Failed to update scanned guests");
    }
  }
  // Ticket counting operations
  async getTicketCounts() {
    if (this.ticketCountCache && Date.now() - this.ticketCountCache.lastUpdated < this.CACHE_TTL) {
      return {
        earlyBirdCount: this.ticketCountCache.earlyBirdCount,
        earlyBirdLimit: this.ticketCountCache.earlyBirdLimit,
        phase1Count: this.ticketCountCache.phase1Count
      };
    }
    try {
      const [counter] = await db.select().from(ticketCounter).limit(1);
      const result = counter ? {
        earlyBirdCount: counter.earlyBirdCount || 0,
        earlyBirdLimit: counter.earlyBirdLimit || 90,
        phase1Count: counter.phase1Count || 0
      } : { earlyBirdCount: 0, earlyBirdLimit: 90, phase1Count: 0 };
      this.ticketCountCache = {
        ...result,
        lastUpdated: Date.now()
      };
      return result;
    } catch (error) {
      console.error("Failed to get ticket counts:", error);
      return { earlyBirdCount: 0, earlyBirdLimit: 90, phase1Count: 0 };
    }
  }
  async updateEarlyBirdLimit(limit) {
    try {
      await db.update(ticketCounter).set({
        earlyBirdLimit: limit
      });
      console.log(`\u2705 Updated early bird limit to: ${limit}`);
    } catch (error) {
      console.error("Failed to update early bird limit:", error);
      throw new Error("Failed to update early bird limit");
    }
  }
  async updateTicketCounts(ticketType, ticketCount) {
    try {
      const updateField = ticketType === "early_bird" ? "earlyBirdCount" : "phase1Count";
      const currentCounts = await this.getTicketCounts();
      const newCount = currentCounts[updateField === "earlyBirdCount" ? "earlyBirdCount" : "phase1Count"] + ticketCount;
      const updateData = {};
      updateData[updateField] = newCount;
      await db.update(ticketCounter).set(updateData);
      this.ticketCountCache = null;
      console.log(`\u2705 Updated ${updateField}: ${newCount} (added ${ticketCount})`);
    } catch (error) {
      console.error("Failed to update ticket counts:", error);
      throw new Error("Failed to update ticket counts");
    }
  }
  async decreaseTicketCounts(ticketType, ticketCount) {
    try {
      const updateField = ticketType === "early_bird" ? "earlyBirdCount" : "phase1Count";
      const currentCounts = await this.getTicketCounts();
      const currentCount = currentCounts[updateField === "earlyBirdCount" ? "earlyBirdCount" : "phase1Count"];
      const newCount = Math.max(0, currentCount - ticketCount);
      const updateData = {};
      updateData[updateField] = newCount;
      await db.update(ticketCounter).set(updateData);
      this.ticketCountCache = null;
      console.log(`\u2705 Decreased ${updateField}: ${newCount} (removed ${ticketCount})`);
    } catch (error) {
      console.error("Failed to decrease ticket counts:", error);
      throw new Error("Failed to decrease ticket counts");
    }
  }
  // Ticket configuration methods
  async getTicketConfig() {
    try {
      const [config] = await db.select().from(ticketConfig).limit(1);
      return config || {
        earlyBirdPrice: "300",
        phase1Price: "350",
        earlyBirdLimit: 90,
        phase1Limit: 200,
        isEarlyBirdActive: true,
        isPhase1Active: true,
        convenientFee: "12.96"
      };
    } catch (error) {
      console.error("Failed to get ticket config:", error);
      return {
        earlyBirdPrice: "300",
        phase1Price: "350",
        earlyBirdLimit: 90,
        phase1Limit: 200,
        isEarlyBirdActive: true,
        isPhase1Active: true,
        convenientFee: "12.96"
      };
    }
  }
  async updateTicketConfig(config, updatedBy) {
    try {
      const [existingConfig] = await db.select().from(ticketConfig).limit(1);
      if (existingConfig) {
        await db.update(ticketConfig).set({
          ...config,
          updatedAt: /* @__PURE__ */ new Date(),
          updatedBy
        });
      } else {
        await db.insert(ticketConfig).values({
          ...config,
          updatedBy
        });
      }
      console.log("\u2705 Updated ticket configuration");
    } catch (error) {
      console.error("Failed to update ticket config:", error);
      throw new Error("Failed to update ticket configuration");
    }
  }
  async initializeTicketConfig() {
    try {
      const [existingConfig] = await db.select().from(ticketConfig).limit(1);
      if (!existingConfig) {
        await db.insert(ticketConfig).values({
          earlyBirdPrice: "300",
          phase1Price: "350",
          earlyBirdLimit: 90,
          phase1Limit: 200,
          isEarlyBirdActive: true,
          isPhase1Active: true,
          convenientFee: "12.96"
        });
        console.log("\u2705 Initialized default ticket configuration");
      }
    } catch (error) {
      console.error("Failed to initialize ticket config:", error);
    }
  }
  // Admin session management (in-memory for now)
  async createAdminSession(sessionData) {
    const session = {
      id: `${sessionData.userId}-${Date.now()}`,
      userId: sessionData.userId,
      token: sessionData.token,
      expiresAt: sessionData.expiresAt,
      createdAt: /* @__PURE__ */ new Date()
    };
    this.adminSessions.set(sessionData.token, session);
  }
  async getAdminSessionByToken(token) {
    return this.adminSessions.get(token);
  }
  async deleteAdminSessionByToken(token) {
    this.adminSessions.delete(token);
  }
  async deleteExpiredSessions() {
    const now = /* @__PURE__ */ new Date();
    for (const [token, session] of Array.from(this.adminSessions.entries())) {
      if (session.expiresAt < now) {
        this.adminSessions.delete(token);
      }
    }
  }
};
var storage = new DatabaseStorage();

// server/routes.ts
init_googleSheets();
init_emailService();
init_enhancedEmailService();

// server/services/paymentService.ts
import QRCode3 from "qrcode";
var PaymentService = class {
  upiId = "9014500513-2@ybl";
  merchantName = "Telugu Night Event";
  generatePaymentLink(amount, bookingId, customerName) {
    const params = new URLSearchParams({
      pa: this.upiId,
      pn: this.merchantName,
      am: amount.toString(),
      cu: "INR",
      tn: `Telugu Night Booking #${bookingId} - ${customerName}`
    });
    return `upi://pay?${params.toString()}`;
  }
  async generateQRCode(upiUrl) {
    try {
      const qrCodeDataURL = await QRCode3.toDataURL(upiUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#FFFFFF"
        }
      });
      return qrCodeDataURL;
    } catch (error) {
      console.error("Error generating QR code:", error);
      throw error;
    }
  }
  calculateAmount(ticketCount, couponDiscount = 0) {
    const ticketPrice = 300;
    const convenienceFeePerTicket = 12.96;
    let totalAmount = ticketCount * ticketPrice;
    if (couponDiscount > 0) {
      totalAmount = totalAmount * (1 - couponDiscount / 100);
    }
    totalAmount += ticketCount * convenienceFeePerTicket;
    return Math.round(totalAmount * 100) / 100;
  }
};

// server/services/authService.ts
import bcrypt from "bcryptjs";
import crypto from "crypto";
var AuthService = class {
  // Create session token
  createToken() {
    return crypto.randomBytes(32).toString("hex");
  }
  // Verify user credentials
  async verifyCredentials(username, password) {
    const user = await storage.getUserByUsername(username);
    if (!user || !user.isActive) return null;
    const isValid = bcrypt.compareSync(password, user.password);
    if (!isValid) return null;
    await storage.updateUserLastLogin(user.id);
    return user;
  }
  // Create admin session
  async createSession(userId) {
    const token = this.createToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1e3);
    await storage.createAdminSession({
      userId,
      token,
      expiresAt
    });
    return token;
  }
  // Verify session token
  async verifySession(token) {
    const session = await storage.getAdminSessionByToken(token);
    if (!session || session.expiresAt < /* @__PURE__ */ new Date()) {
      return null;
    }
    const user = await storage.getUser(session.userId);
    if (!user || !user.isActive) {
      return null;
    }
    return user;
  }
  // Check if user has specific permission
  hasPermission(user, permission) {
    if (!user.isActive) return false;
    if (user.role === "super_admin") return true;
    const rolePermissions = ROLE_PERMISSIONS[user.role] || [];
    if (rolePermissions.includes(permission)) return true;
    if (user.permissions && user.permissions.includes(permission)) return true;
    return false;
  }
  // Check multiple permissions (user needs ALL of them)
  hasAllPermissions(user, permissions) {
    return permissions.every((permission) => this.hasPermission(user, permission));
  }
  // Check if user has any of the specified permissions
  hasAnyPermission(user, permissions) {
    return permissions.some((permission) => this.hasPermission(user, permission));
  }
  // Get user's effective permissions (role + custom)
  getUserPermissions(user) {
    if (!user.isActive) return [];
    const rolePermissions = ROLE_PERMISSIONS[user.role] || [];
    const customPermissions = user.permissions || [];
    return [.../* @__PURE__ */ new Set([...rolePermissions, ...customPermissions])];
  }
  // Clean expired sessions
  async cleanExpiredSessions() {
    await storage.deleteExpiredSessions();
  }
  // Logout user (delete session)
  async logout(token) {
    await storage.deleteAdminSessionByToken(token);
  }
};
var authService = new AuthService();

// server/services/ticketGenerationService.ts
import { EventEmitter } from "events";
init_emailService();
var TicketGenerationService = class extends EventEmitter {
  paymentService;
  emailService;
  activeBatches = /* @__PURE__ */ new Map();
  processingQueue = [];
  isProcessing = false;
  constructor() {
    super();
    this.paymentService = new PaymentService();
    this.emailService = new EmailService();
  }
  // Generate tickets for a single booking with progress tracking
  async generateTicketsForBooking(bookingId) {
    const booking = await storage.getBooking(bookingId);
    if (!booking) {
      throw new Error("Booking not found");
    }
    const progress = {
      bookingId,
      status: "pending",
      progress: 0,
      currentStep: "Initializing ticket generation",
      qrCodes: [],
      passIds: [],
      guestCodes: [],
      errors: [],
      startTime: /* @__PURE__ */ new Date()
    };
    this.emit("progress", progress);
    try {
      const hasExistingQRCodes = booking.qrCodes && booking.qrCodes.length > 0;
      const hasExistingGuestCodes = booking.guestCodes && booking.guestCodes.length > 0;
      if (hasExistingQRCodes && hasExistingGuestCodes) {
        console.log(`\u267B\uFE0F Reusing existing QR codes for booking ${bookingId}`);
        progress.status = "completed";
        progress.progress = 100;
        progress.currentStep = "Reusing existing QR codes";
        progress.qrCodes = booking.qrCodes;
        progress.passIds = booking.passIds || [];
        progress.guestCodes = booking.guestCodes;
        progress.completedAt = /* @__PURE__ */ new Date();
        try {
          const { EnhancedEmailService: EnhancedEmailService2 } = await Promise.resolve().then(() => (init_enhancedEmailService(), enhancedEmailService_exports));
          const enhancedEmailService2 = new EnhancedEmailService2();
          await enhancedEmailService2.sendQRTickets(booking);
          console.log(`\u2705 Existing QR tickets resent successfully to ${booking.email}`);
        } catch (emailError) {
          console.error("Failed to resend existing tickets:", emailError);
          progress.errors.push("Failed to resend existing tickets");
        }
        this.emit("progress", progress);
        return progress;
      }
      progress.status = "generating";
      progress.currentStep = "Generating pass IDs";
      progress.progress = 10;
      this.emit("progress", progress);
      const { generatePassIds: generatePassIds2 } = await Promise.resolve().then(() => (init_emailService(), emailService_exports));
      const passIds = generatePassIds2(booking.id, booking.ticketCount);
      progress.passIds = passIds;
      progress.progress = 25;
      this.emit("progress", progress);
      progress.currentStep = "Generating QR codes";
      progress.progress = 40;
      this.emit("progress", progress);
      const qrCodes = [];
      for (let i = 0; i < booking.ticketCount; i++) {
        const guestCode = booking.guestCodes?.[i] || `GUEST${booking.id}_${i + 1}`;
        const qrData = guestCode;
        const qrCode = await this.paymentService.generateQRCode(qrData);
        qrCodes.push(qrCode);
        progress.progress = 40 + (i + 1) * (30 / booking.ticketCount);
        progress.currentStep = `Generated QR code ${i + 1} of ${booking.ticketCount}`;
        this.emit("progress", progress);
      }
      progress.qrCodes = qrCodes;
      progress.guestCodes = booking.guestCodes || [];
      progress.currentStep = "Updating booking records";
      progress.progress = 75;
      this.emit("progress", progress);
      await storage.updateBookingQRCodes(bookingId, qrCodes, passIds, booking.guestCodes || []);
      progress.currentStep = "Sending tickets via email";
      progress.progress = 85;
      this.emit("progress", progress);
      try {
        const { enhancedEmailService: enhancedEmailService2 } = await Promise.resolve().then(() => (init_enhancedEmailService(), enhancedEmailService_exports));
        await enhancedEmailService2.sendTicketEmails({
          ...booking,
          guests: booking.guests || [],
          guestCodes: progress.guestCodes,
          qrCodes: progress.qrCodes,
          passIds: progress.passIds,
          paymentStatus: booking.paymentStatus || "verified"
        });
      } catch (emailError) {
        progress.errors.push(`Email delivery failed: ${emailError.message}`);
        console.error("Email delivery failed:", emailError);
      }
      progress.status = "completed";
      progress.currentStep = "Ticket generation completed";
      progress.progress = 100;
      progress.completedAt = /* @__PURE__ */ new Date();
      this.emit("progress", progress);
      return progress;
    } catch (error) {
      progress.status = "failed";
      progress.errors.push(error.message);
      progress.completedAt = /* @__PURE__ */ new Date();
      this.emit("progress", progress);
      throw error;
    }
  }
  // Batch process multiple bookings with smart queuing
  async generateTicketsBatch(bookingIds) {
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const batchProgress = {
      batchId,
      totalBookings: bookingIds.length,
      completed: 0,
      failed: 0,
      progress: 0,
      status: "pending",
      bookings: [],
      startTime: /* @__PURE__ */ new Date()
    };
    for (const bookingId of bookingIds) {
      batchProgress.bookings.push({
        bookingId,
        status: "pending",
        progress: 0,
        currentStep: "Queued for processing",
        qrCodes: [],
        passIds: [],
        guestCodes: [],
        errors: [],
        startTime: /* @__PURE__ */ new Date()
      });
    }
    this.activeBatches.set(batchId, batchProgress);
    this.emit("batchProgress", batchProgress);
    this.processBatch(batchId, bookingIds);
    return batchId;
  }
  async processBatch(batchId, bookingIds) {
    const batch = this.activeBatches.get(batchId);
    if (!batch) return;
    batch.status = "processing";
    this.emit("batchProgress", batch);
    const concurrency = 3;
    const chunks = this.chunkArray(bookingIds, concurrency);
    for (const chunk of chunks) {
      const promises = chunk.map(async (bookingId) => {
        try {
          const bookingProgress = batch.bookings.find((b) => b.bookingId === bookingId);
          if (!bookingProgress) return;
          const progressHandler = (progress) => {
            Object.assign(bookingProgress, progress);
            this.updateBatchProgress(batchId);
          };
          this.on("progress", progressHandler);
          await this.generateTicketsForBooking(bookingId);
          batch.completed++;
          this.removeListener("progress", progressHandler);
        } catch (error) {
          batch.failed++;
          const bookingProgress = batch.bookings.find((b) => b.bookingId === bookingId);
          if (bookingProgress) {
            bookingProgress.status = "failed";
            bookingProgress.errors.push(error instanceof Error ? error.message : "Unknown error");
          }
        }
      });
      await Promise.all(promises);
    }
    batch.status = batch.failed > 0 ? "completed" : "completed";
    batch.progress = 100;
    batch.completedAt = /* @__PURE__ */ new Date();
    this.emit("batchProgress", batch);
  }
  updateBatchProgress(batchId) {
    const batch = this.activeBatches.get(batchId);
    if (!batch) return;
    const totalProgress = batch.bookings.reduce((sum, booking) => sum + booking.progress, 0);
    batch.progress = Math.round(totalProgress / batch.totalBookings);
    this.emit("batchProgress", batch);
  }
  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
  // Get progress for a specific batch
  getBatchProgress(batchId) {
    return this.activeBatches.get(batchId) || null;
  }
  // Get all active batches
  getActiveBatches() {
    return Array.from(this.activeBatches.values());
  }
  // Auto-generate tickets for verified payments
  async autoGenerateForVerifiedPayments() {
    const allBookings = await storage.getAllBookings();
    const verifiedBookings = allBookings.filter((booking) => booking.paymentStatus === "verified");
    const bookingsNeedingTickets = verifiedBookings.filter(
      (booking) => !booking.qrCodes || booking.qrCodes.length === 0
    );
    if (bookingsNeedingTickets.length === 0) {
      return [];
    }
    const batchIds = [];
    const batchSize = 10;
    for (let i = 0; i < bookingsNeedingTickets.length; i += batchSize) {
      const batchBookings = bookingsNeedingTickets.slice(i, i + batchSize);
      const batchId = await this.generateTicketsBatch(batchBookings.map((b) => b.id));
      batchIds.push(batchId);
    }
    return batchIds;
  }
  // Cleanup completed batches older than 1 hour
  cleanupOldBatches() {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1e3);
    for (const [batchId, batch] of Array.from(this.activeBatches.entries())) {
      if (batch.completedAt && batch.completedAt < oneHourAgo) {
        this.activeBatches.delete(batchId);
      }
    }
  }
};
var ticketGenerationService = new TicketGenerationService();
setInterval(() => {
  ticketGenerationService.cleanupOldBatches();
}, 30 * 60 * 1e3);

// server/middleware/authMiddleware.ts
var authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "") || req.cookies?.admin_token;
    if (!token) {
      return res.status(401).json({
        message: "Access denied. No authentication token provided.",
        code: "NO_TOKEN"
      });
    }
    const user = await authService.verifySession(token);
    if (!user) {
      return res.status(401).json({
        message: "Access denied. Invalid or expired token.",
        code: "INVALID_TOKEN"
      });
    }
    req.user = user;
    next();
  } catch (error) {
    console.error("Authentication error:", error);
    res.status(500).json({ message: "Authentication failed" });
  }
};
var requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required",
        code: "NOT_AUTHENTICATED"
      });
    }
    if (!authService.hasPermission(req.user, permission)) {
      return res.status(403).json({
        message: `Access denied. Required permission: ${permission}`,
        code: "INSUFFICIENT_PERMISSIONS",
        required: permission,
        userRole: req.user.role
      });
    }
    next();
  };
};

// server/routes.ts
import { eq as eq2 } from "drizzle-orm";
var storage_multer = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = "uploads/";
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + "-" + uniqueSuffix + ext);
  }
});
var upload = multer({
  storage: storage_multer,
  limits: {
    fileSize: 10 * 1024 * 1024,
    // 10MB limit
    files: 1
  },
  fileFilter: (req, file, cb) => {
    console.log(`\u{1F4E4} File upload attempt: ${file.originalname}, type: ${file.mimetype}`);
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Only images (JPG, PNG, GIF, WebP) are allowed. Got: ${file.mimetype}`));
    }
  }
});
async function registerRoutes(app2) {
  app2.use((req, res, next) => {
    if (req.path.includes("/payment-proof") || req.path.includes("/uploads/")) {
      return next();
    }
    compression({
      threshold: 1024,
      // Only compress if response is > 1KB
      level: 6,
      // Compression level (1-9, 6 is default)
      chunkSize: 16 * 1024
      // 16KB chunks
    })(req, res, next);
  });
  app2.post("/api/scanner/scan", async (req, res) => {
    try {
      const { scanData } = req.body;
      if (!scanData || typeof scanData !== "string") {
        return res.status(400).json({ message: "Valid scan data is required" });
      }
      const trimmedData = scanData.trim();
      console.log(`Scanner: Looking for "${trimmedData}"`);
      let booking = null;
      const bookingId = parseInt(trimmedData);
      if (!isNaN(bookingId) && bookingId > 0) {
        console.log(`Scanner: Searching by booking ID ${bookingId}`);
        booking = await storage.getBooking(bookingId);
      }
      if (!booking) {
        console.log(`Scanner: Searching by guest code "${trimmedData.toUpperCase()}"`);
        const allBookings = await storage.getAllBookings();
        booking = allBookings.find((b) => {
          if (!b.guestCodes || !Array.isArray(b.guestCodes)) return false;
          return b.guestCodes.includes(trimmedData.toUpperCase()) || b.guestCodes.some((code) => `TELUGU-NIGHT-${b.id}-${code}` === trimmedData.toUpperCase());
        });
      }
      if (!booking) {
        console.log(`Scanner: No booking found for "${trimmedData}"`);
        return res.status(404).json({
          message: `No booking found. Please check the booking ID or guest code.`
        });
      }
      console.log(`Scanner: Found booking ${booking.id} for ${booking.name}`);
      if (booking.paymentStatus === "pending") {
        return res.status(400).json({
          message: "Payment not verified yet. Please wait for admin verification.",
          booking: {
            ...booking,
            scannedAt: booking.scannedAt?.toISOString ? booking.scannedAt.toISOString() : booking.scannedAt
          }
        });
      }
      let scannedGuestCode = null;
      let guestIndex = -1;
      if (booking.guestCodes && booking.guestCodes.includes(trimmedData.toUpperCase())) {
        scannedGuestCode = trimmedData.toUpperCase();
        guestIndex = booking.guestCodes.indexOf(scannedGuestCode);
      } else if (booking.guestCodes) {
        const match = booking.guestCodes.find((code) => `TELUGU-NIGHT-${booking.id}-${code}` === trimmedData.toUpperCase());
        if (match) {
          scannedGuestCode = match;
          guestIndex = booking.guestCodes.indexOf(match);
        }
      }
      if (!booking.scannedGuests) {
        booking.scannedGuests = [];
      }
      if (scannedGuestCode && booking.scannedGuests.includes(scannedGuestCode)) {
        const guestName = guestIndex === 0 ? booking.name : booking.guests && booking.guests[guestIndex - 1] || `Guest ${guestIndex + 1}`;
        return res.json({
          success: true,
          message: `${guestName} has already entered Telugu Night. Entry was confirmed earlier.`,
          alreadyScanned: true,
          booking: {
            ...booking,
            scannedAt: booking.scannedAt?.toISOString ? booking.scannedAt.toISOString() : booking.scannedAt,
            scannedGuests: booking.scannedGuests
          },
          guestInfo: {
            guestName,
            guestCode: scannedGuestCode,
            guestIndex
          }
        });
      }
      if (booking.paymentStatus === "verified") {
        if (scannedGuestCode) {
          const guestName = guestIndex === 0 ? booking.name : booking.guests && booking.guests[guestIndex - 1] || `Guest ${guestIndex + 1}`;
          booking.scannedGuests.push(scannedGuestCode);
          await storage.updateBookingScannedGuests(booking.id, booking.scannedGuests);
          console.log(`Scanner: Guest ${guestName} (${scannedGuestCode}) entered successfully`);
          res.json({
            success: true,
            message: `Welcome ${guestName}! Entry approved.`,
            booking: {
              ...booking,
              scannedAt: (/* @__PURE__ */ new Date()).toISOString(),
              scannedGuests: booking.scannedGuests
            },
            guestInfo: {
              guestName,
              guestCode: scannedGuestCode,
              guestIndex
            }
          });
        } else {
          if (booking.isScanned) {
            return res.json({
              success: true,
              message: `${booking.name} has already entered. Entry confirmed.`,
              alreadyScanned: true,
              booking: {
                ...booking,
                scannedAt: booking.scannedAt?.toISOString ? booking.scannedAt.toISOString() : booking.scannedAt
              }
            });
          }
          await storage.scanTicket(booking.id, 1);
          booking.isScanned = true;
          booking.scannedAt = /* @__PURE__ */ new Date();
          console.log(`Scanner: Successfully scanned booking ${booking.id} for ${booking.name}`);
          res.json({
            success: true,
            message: `Welcome ${booking.name}! Entry approved.`,
            booking: {
              ...booking,
              scannedAt: booking.scannedAt.toISOString()
            }
          });
        }
      } else {
        res.status(400).json({
          success: false,
          message: "Payment not verified yet. Please wait for admin verification."
        });
      }
    } catch (error) {
      console.error("Scanner error:", error);
      res.status(500).json({
        message: "Scanner error occurred"
      });
    }
  });
  const emailService = new EmailService();
  const paymentService = new PaymentService();
  const googleSheetsService = new GoogleSheetsService();
  const ticketGenerationService2 = new TicketGenerationService();
  const { generateGuestCodes: generateGuestCodes2, generatePassIds: generatePassIds2 } = await Promise.resolve().then(() => (init_emailService(), emailService_exports));
  app2.get("/api/screenshots/:filename", authenticate, requirePermission(PERMISSIONS.VIEW_BOOKINGS), (req, res) => {
    try {
      const filename = req.params.filename;
      const filepath = path.join(process.cwd(), "uploads", filename);
      console.log(`\u{1F4F8} Screenshot request for: ${filename}`);
      console.log(`\u{1F4C2} Looking in path: ${filepath}`);
      if (!fs.existsSync(filepath)) {
        console.log(`\u274C Screenshot not found: ${filepath}`);
        return res.status(404).json({ message: "Screenshot not found" });
      }
      console.log(`\u2705 Screenshot found, serving: ${filename}`);
      res.sendFile(filepath);
    } catch (error) {
      console.error("Screenshot viewing error:", error);
      res.status(500).json({ message: "Failed to load screenshot" });
    }
  });
  app2.get("/uploads/:filename", (req, res) => {
    try {
      const filename = req.params.filename;
      const filepath = path.join(process.cwd(), "uploads", filename);
      if (!fs.existsSync(filepath)) {
        return res.status(404).json({ message: "File not found" });
      }
      res.sendFile(filepath);
    } catch (error) {
      console.error("File serving error:", error);
      res.status(500).json({ message: "Failed to serve file" });
    }
  });
  app2.post("/api/admin/init-user", async (req, res) => {
    try {
      const bcrypt3 = await import("bcryptjs");
      const hashedPassword = bcrypt3.hashSync("Rudra@78611", 10);
      try {
        await db.delete(users).where(eq2(users.username, "aashvee"));
      } catch (e) {
      }
      const [newUser] = await db.insert(users).values({
        username: "aashvee",
        password: hashedPassword,
        role: "admin",
        permissions: ["VIEW_BOOKINGS", "VERIFY_PAYMENTS", "MANAGE_COUPONS", "SEND_TICKETS", "SCANNER_ACCESS", "MANAGE_BOOKINGS"],
        isActive: true
      }).returning();
      console.log("\u2705 Admin user initialized successfully");
      res.json({ message: "Admin user initialized", user: { username: newUser.username, role: newUser.role } });
    } catch (error) {
      console.error("Admin initialization error:", error);
      res.status(500).json({ message: "Failed to initialize admin user" });
    }
  });
  app2.post("/api/auth/admin-login", async (req, res) => {
    try {
      const { username, password } = req.body;
      const user = await authService.verifyCredentials(username, password);
      if (!user) {
        return res.status(401).json({
          message: "Invalid username or password",
          code: "INVALID_CREDENTIALS"
        });
      }
      const token = await authService.createSession(user.id);
      const cookieOptions = {
        httpOnly: true,
        secure: false,
        // Allow http in development
        sameSite: "lax",
        // More permissive for development
        maxAge: 24 * 60 * 60 * 1e3
        // 24 hours
      };
      res.cookie("admin_token", token, cookieOptions);
      const userPermissions = authService.getUserPermissions(user);
      res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          permissions: userPermissions,
          isActive: user.isActive
        }
      });
    } catch (error) {
      console.error("Admin login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });
  app2.post("/api/admin/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      const user = await authService.verifyCredentials(username, password);
      if (!user) {
        return res.status(401).json({
          message: "Invalid username or password",
          code: "INVALID_CREDENTIALS"
        });
      }
      const token = await authService.createSession(user.id);
      const cookieOptions = {
        httpOnly: true,
        secure: false,
        // Allow http in development
        sameSite: "lax",
        // More permissive for development
        maxAge: 24 * 60 * 60 * 1e3
        // 24 hours
      };
      res.cookie("admin_token", token, cookieOptions);
      const userPermissions = authService.getUserPermissions(user);
      res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          permissions: userPermissions,
          isActive: user.isActive
        }
      });
    } catch (error) {
      console.error("Admin login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });
  app2.post("/api/auth/logout", authenticate, async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (token) {
        await authService.logout(token);
      }
      res.json({ message: "Logged out successfully" });
    } catch (error) {
      res.status(500).json({ message: "Logout failed" });
    }
  });
  app2.get("/api/auth/me", authenticate, async (req, res) => {
    try {
      const userPermissions = authService.getUserPermissions(req.user);
      res.json({
        user: {
          id: req.user.id,
          username: req.user.username,
          role: req.user.role,
          permissions: userPermissions,
          isActive: req.user.isActive,
          lastLogin: req.user.lastLogin
        }
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to get user info" });
    }
  });
  app2.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      const user = await storage.getUserByUsername(username);
      if (!user || !bcrypt2.compareSync(password, user.password)) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      const token = user.id.toString();
      res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
    } catch (error) {
      res.status(500).json({ message: "Login failed" });
    }
  });
  app2.post("/api/auth/register", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      userData.password = bcrypt2.hashSync(userData.password, 10);
      const user = await storage.createUser(userData);
      res.json({ user: { id: user.id, username: user.username, role: user.role } });
    } catch (error) {
      res.status(400).json({ message: "Registration failed" });
    }
  });
  app2.get("/api/ticket-counts", async (req, res) => {
    try {
      const counts = await storage.getTicketCounts();
      res.set({
        "Cache-Control": "public, max-age=30",
        // 30 seconds cache
        "ETag": `"${JSON.stringify(counts)}"`,
        "Vary": "Accept-Encoding"
      });
      res.json(counts);
    } catch (error) {
      console.error("Error fetching ticket counts:", error);
      res.status(500).json({ message: "Failed to fetch ticket counts" });
    }
  });
  app2.get("/api/ticket-config", async (req, res) => {
    try {
      const config = await storage.getTicketConfig();
      const counts = await storage.getTicketCounts();
      res.json({ config, counts });
    } catch (error) {
      console.error("Error fetching ticket config:", error);
      res.status(500).json({ message: "Failed to fetch ticket configuration" });
    }
  });
  app2.put("/api/admin/early-bird-limit", authenticate, requirePermission(PERMISSIONS.SYSTEM_SETTINGS), async (req, res) => {
    try {
      const { limit } = req.body;
      if (!limit || limit < 0) {
        return res.status(400).json({ message: "Invalid limit value" });
      }
      await storage.updateEarlyBirdLimit(limit);
      const counts = await storage.getTicketCounts();
      res.json({ message: "Early bird limit updated", counts });
    } catch (error) {
      console.error("Error updating early bird limit:", error);
      res.status(500).json({ message: "Failed to update early bird limit" });
    }
  });
  app2.get("/api/admin/ticket-config", authenticate, requirePermission(PERMISSIONS.SYSTEM_SETTINGS), async (req, res) => {
    try {
      const config = await storage.getTicketConfig();
      const counts = await storage.getTicketCounts();
      res.json({ config, counts });
    } catch (error) {
      console.error("Error getting ticket config:", error);
      res.status(500).json({ message: "Failed to get ticket configuration" });
    }
  });
  app2.put("/api/admin/ticket-config", authenticate, requirePermission(PERMISSIONS.SYSTEM_SETTINGS), async (req, res) => {
    try {
      const config = req.body.config || req.body;
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      let finalConfig = { ...config };
      if ("isEarlyBirdActive" in config || "isPhase1Active" in config) {
        if (config.isEarlyBirdActive && !config.isPhase1Active) {
          finalConfig.isPhase1Active = false;
          console.log("\u{1F3AB} Early Bird started - Phase 1 automatically stopped");
        }
        if (config.isPhase1Active && !config.isEarlyBirdActive) {
          finalConfig.isEarlyBirdActive = false;
          console.log("\u{1F3AB} Phase 1 started - Early Bird automatically stopped");
        }
        if (config.isEarlyBirdActive && config.isPhase1Active) {
          finalConfig.isEarlyBirdActive = false;
          finalConfig.isPhase1Active = true;
          console.log("\u{1F3AB} Both phases requested - Phase 1 takes priority, Early Bird stopped");
        }
      }
      await storage.updateTicketConfig(finalConfig, userId);
      const updatedConfig = await storage.getTicketConfig();
      const counts = await storage.getTicketCounts();
      let message = "Ticket configuration updated successfully";
      if (finalConfig.isEarlyBirdActive !== config.isEarlyBirdActive || finalConfig.isPhase1Active !== config.isPhase1Active) {
        message += " (phases adjusted for mutual exclusivity)";
      }
      res.json({
        message,
        config: updatedConfig,
        counts
      });
    } catch (error) {
      console.error("Error updating ticket config:", error);
      res.status(500).json({ message: "Failed to update ticket configuration" });
    }
  });
  app2.get("/api/admin/analytics", authenticate, requirePermission(PERMISSIONS.VIEW_ANALYTICS), async (req, res) => {
    try {
      const bookings2 = await storage.getAllBookings();
      const counts = await storage.getTicketCounts();
      const analytics = {
        totalBookings: bookings2.length,
        totalTicketsSold: bookings2.reduce((sum, booking) => sum + booking.ticketCount, 0),
        totalRevenue: bookings2.reduce((sum, booking) => sum + parseFloat(booking.totalAmount), 0),
        verifiedBookings: bookings2.filter((b) => b.paymentStatus === "verified").length,
        pendingBookings: bookings2.filter((b) => b.paymentStatus === "pending").length,
        scannedTickets: bookings2.reduce((sum, booking) => sum + (booking.scannedGuests?.length || 0), 0),
        genderBreakdown: bookings2.reduce((acc, booking) => {
          if (booking.gender) {
            const gender = booking.gender.toLowerCase();
            if (gender === "male") acc.male++;
            else if (gender === "female") acc.female++;
            else acc.other++;
          }
          if (booking.guestGenders && Array.isArray(booking.guestGenders)) {
            booking.guestGenders.forEach((guestGender) => {
              if (guestGender) {
                const gender = guestGender.toLowerCase();
                if (gender === "male") acc.male++;
                else if (gender === "female") acc.female++;
                else acc.other++;
              }
            });
          }
          return acc;
        }, { male: 0, female: 0, other: 0 }),
        ticketTypes: {
          earlyBird: counts.earlyBirdCount,
          phase1: counts.phase1Count
        },
        earlyBirdLimit: counts.earlyBirdLimit,
        recentBookings: bookings2.slice(-5).reverse()
      };
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching analytics:", error);
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });
  app2.post("/api/bookings", async (req, res) => {
    try {
      const bookingData = req.body;
      const counts = await storage.getTicketCounts();
      const config = await storage.getTicketConfig();
      let ticketPrice = 300;
      let ticketType = bookingData.ticketType || "early_bird";
      const isEarlyBirdAvailable = config.isEarlyBirdActive && counts.earlyBirdCount < counts.earlyBirdLimit;
      const isPhase1Available = config.isPhase1Active;
      if (!isEarlyBirdAvailable || ticketType === "phase_1") {
        if (isPhase1Available) {
          ticketPrice = parseInt(config.phase1Price) || 350;
          ticketType = "phase_1";
        } else {
          return res.status(400).json({ message: "No tickets are currently available for sale" });
        }
      } else {
        ticketPrice = parseInt(config.earlyBirdPrice) || 300;
        ticketType = "early_bird";
      }
      let couponDiscount = 0;
      if (bookingData.couponCode) {
        const coupon = await storage.getCouponByCode(bookingData.couponCode);
        if (coupon && coupon.isActive) {
          if (!coupon.usageLimit || (coupon.usageCount || 0) < coupon.usageLimit) {
            couponDiscount = coupon.discount;
            await storage.updateCouponUsage(bookingData.couponCode);
          }
        }
      }
      const subtotal = bookingData.ticketCount * ticketPrice;
      const discountAmount = Math.round(subtotal * couponDiscount / 100);
      const totalAmount = subtotal - discountAmount;
      const guestCodes = generateGuestCodes2(bookingData.ticketCount);
      const booking = await storage.createBooking({
        ...bookingData,
        ticketType,
        guestCodes,
        couponCode: bookingData.couponCode || null,
        totalAmount: totalAmount.toString(),
        couponDiscount,
        paymentStatus: "pending"
      });
      await storage.updateTicketCounts(ticketType, bookingData.ticketCount);
      await storage.updateBookingPaymentStatus(booking.id, "pending");
      booking.totalAmount = totalAmount.toString();
      booking.couponDiscount = couponDiscount;
      booking.guestCodes = guestCodes;
      try {
        const { GoogleSheetsService: GoogleSheetsService2 } = await Promise.resolve().then(() => (init_googleSheets(), googleSheets_exports));
        const googleSheetsService2 = new GoogleSheetsService2();
        await googleSheetsService2.addBookingToSheet(booking);
        console.log(`\u2705 Booking ${booking.id} synced to Google Sheets`);
      } catch (sheetsError) {
        console.error("Google Sheets sync failed:", sheetsError);
      }
      const totalWithFee = totalAmount + bookingData.ticketCount * 12.96;
      const upiLink = paymentService.generatePaymentLink(totalWithFee, booking.id, booking.name);
      const qrCodeDataURL = await paymentService.generateQRCode(upiLink);
      res.json({
        booking: {
          ...booking,
          totalAmount: totalAmount.toString(),
          ticketType
        },
        paymentLink: qrCodeDataURL,
        upiLink,
        ticketCounts: await storage.getTicketCounts()
      });
    } catch (error) {
      console.error("Booking creation error:", error);
      res.status(400).json({ message: "Booking creation failed", error: error.message });
    }
  });
  app2.get("/api/bookings", authenticate, requirePermission(PERMISSIONS.VIEW_BOOKINGS), async (req, res) => {
    try {
      const bookings2 = await storage.getAllBookings();
      res.json(bookings2);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch bookings" });
    }
  });
  app2.get("/api/bookings/:id", async (req, res) => {
    try {
      const booking = await storage.getBooking(parseInt(req.params.id));
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }
      res.json(booking);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch booking" });
    }
  });
  app2.get("/api/payment/redirect", (req, res) => {
    const { pa, pn, am, cu, tn, upi } = req.query;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Payment - Telugu Night</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; min-height: 100vh; margin: 0; }
          .container { max-width: 400px; margin: 0 auto; background: rgba(255,255,255,0.1); padding: 30px; border-radius: 15px; backdrop-filter: blur(10px); }
          .amount { font-size: 2em; font-weight: bold; margin: 20px 0; }
          .btn { background: #4CAF50; color: white; padding: 15px 30px; border: none; border-radius: 25px; font-size: 1.1em; cursor: pointer; margin: 10px; text-decoration: none; display: inline-block; }
          .btn:hover { background: #45a049; }
          .qr-code { background: white; padding: 20px; border-radius: 10px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Telugu Night Payment</h1>
          <div class="amount">\u20B9${am}</div>
          <p>Pay to: ${pn}</p>
          <p>UPI ID: ${pa}</p>
          <p>Description: ${tn}</p>
          
          <div id="qrcode" class="qr-code"></div>
          
          <a href="${upi}" class="btn" onclick="startTimer()">Pay with UPI Apps</a>
          <br>
          <small>After payment, take a screenshot and upload it for verification</small>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
        <script>
          QRCode.toCanvas(document.getElementById('qrcode'), '${upi}', {width: 250}, function(error) {
            if (error) console.error(error);
          });

          function startTimer() {
            setTimeout(() => {
              alert('After completing payment, please take a screenshot and upload it for verification.');
            }, 3000);
          }
        </script>
      </body>
      </html>
    `;
    res.send(html);
  });
  app2.post("/api/bookings/:id/payment-proof", (req, res) => {
    upload.single("screenshot")(req, res, async (err) => {
      try {
        if (err) {
          console.error("Multer upload error:", err);
          if (err instanceof multer.MulterError) {
            if (err.code === "LIMIT_FILE_SIZE") {
              return res.status(400).json({ message: "File too large. Maximum size is 10MB." });
            }
            return res.status(400).json({ message: `Upload error: ${err.message}` });
          }
          return res.status(400).json({ message: err.message || "File upload failed" });
        }
        const bookingId = parseInt(req.params.id);
        const booking = await storage.getBooking(bookingId);
        if (!booking) {
          return res.status(404).json({ message: "Booking not found" });
        }
        if (!req.file) {
          return res.status(400).json({
            message: "Screenshot is required. Please select an image file and try again."
          });
        }
        console.log(`\u{1F4F8} Screenshot uploaded: ${req.file.filename}, size: ${req.file.size} bytes`);
        const screenshotUrl = `/uploads/${req.file.filename}`;
        await storage.updateBookingPaymentStatus(bookingId, "pending", screenshotUrl);
        console.log(`\u2705 Booking ${bookingId} updated with screenshot: ${screenshotUrl}`);
        try {
          const { GoogleSheetsService: GoogleSheetsService2 } = await Promise.resolve().then(() => (init_googleSheets(), googleSheets_exports));
          const googleSheetsService2 = new GoogleSheetsService2();
          await googleSheetsService2.addPaymentScreenshotToSheet(bookingId, `https://events.qlora.in${screenshotUrl}`);
          console.log(`\u2705 Screenshot added to Google Sheets for booking ${bookingId}`);
        } catch (sheetsError) {
          console.error("Google Sheets update failed:", sheetsError);
        }
        try {
          const { EnhancedEmailService: EnhancedEmailService2 } = await Promise.resolve().then(() => (init_enhancedEmailService(), enhancedEmailService_exports));
          const emailService2 = new EnhancedEmailService2();
          const updatedBooking = await storage.getBooking(bookingId);
          if (updatedBooking) {
            await emailService2.sendPaymentConfirmationEmail({
              ...updatedBooking,
              guests: updatedBooking.guests || [],
              guestCodes: updatedBooking.guestCodes || [],
              paymentStatus: updatedBooking.paymentStatus || "pending"
            });
            console.log("\u2705 Booking confirmation email sent after screenshot upload");
          }
        } catch (emailError) {
          console.error("Booking confirmation email failed:", emailError);
        }
        res.json({
          message: "Payment screenshot uploaded successfully! Booking confirmation sent. Awaiting admin verification.",
          screenshotUrl,
          ticketsSent: false,
          filename: req.file.filename
        });
      } catch (error) {
        console.error("Screenshot upload error:", error);
        res.status(500).json({
          message: "Failed to process screenshot upload. Please try again.",
          error: error.message
        });
      }
    });
  });
  app2.post("/api/bookings/:id/verify-payment", authenticate, requirePermission(PERMISSIONS.VERIFY_PAYMENTS), async (req, res) => {
    try {
      const bookingId = parseInt(req.params.id);
      const booking = await storage.getBooking(bookingId);
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }
      const guestCodes = generateGuestCodes2(booking.ticketCount);
      const passIds = generatePassIds2(bookingId, booking.ticketCount);
      await storage.updateBookingVerification(bookingId, "verified", guestCodes);
      await storage.updateBookingQRCodes(bookingId, [], passIds, guestCodes);
      const updatedBooking = await storage.getBooking(bookingId);
      if (updatedBooking) {
        await enhancedEmailService.sendTicketEmails({
          ...updatedBooking,
          guests: updatedBooking.guests || [],
          guestCodes: updatedBooking.guestCodes || [],
          paymentStatus: updatedBooking.paymentStatus || "verified"
        });
      }
      try {
        await googleSheetsService.updateBookingPaymentStatus(bookingId, "verified");
      } catch (error) {
        console.log("Google Sheets update failed (non-critical):", error.message);
      }
      res.json({
        message: "Payment verified successfully! QR tickets sent to customer email.",
        guestCodes,
        passIds,
        ticketsSent: true
      });
    } catch (error) {
      res.status(500).json({ message: "Verification failed" });
    }
  });
  app2.post("/api/coupons", authenticate, requirePermission(PERMISSIONS.MANAGE_COUPONS), async (req, res) => {
    try {
      const couponData = insertCouponSchema.parse(req.body);
      const coupon = await storage.createCoupon(couponData);
      res.json(coupon);
    } catch (error) {
      res.status(400).json({ message: "Coupon creation failed" });
    }
  });
  app2.get("/api/coupons", authenticate, requirePermission(PERMISSIONS.MANAGE_COUPONS), async (req, res) => {
    try {
      const coupons3 = await storage.getAllCoupons();
      res.json(coupons3);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch coupons" });
    }
  });
  app2.post("/api/coupons/validate", async (req, res) => {
    try {
      const { code } = req.body;
      if (!code || typeof code !== "string") {
        return res.status(400).json({
          valid: false,
          discount: 0,
          message: "Coupon code is required"
        });
      }
      const validation = await storage.validateCoupon(code.trim().toUpperCase());
      res.json(validation);
    } catch (error) {
      console.error("Coupon validation error:", error);
      res.status(500).json({
        valid: false,
        discount: 0,
        message: "Validation failed"
      });
    }
  });
  app2.get("/api/admin/bookings", authenticate, requirePermission(PERMISSIONS.VIEW_BOOKINGS), async (req, res) => {
    try {
      const bookings2 = await storage.getAllBookings();
      res.set({
        "Cache-Control": "private, max-age=10",
        // 10 seconds cache for admin data
        "ETag": `"bookings-${bookings2.length}-${Date.now()}"`,
        "Vary": "Accept-Encoding"
      });
      res.json(bookings2);
    } catch (error) {
      console.error("Failed to fetch bookings:", error);
      res.status(500).json({ message: "Failed to fetch bookings" });
    }
  });
  app2.post("/api/admin/bookings/:id/verify", authenticate, requirePermission(PERMISSIONS.VERIFY_PAYMENTS), async (req, res) => {
    try {
      const bookingId = parseInt(req.params.id);
      const action = req.body?.action || "verify";
      const booking = await storage.getBooking(bookingId);
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }
      if (action === "verify") {
        await storage.updateBookingPaymentStatus(bookingId, "verified");
        const guestCodes = generateGuestCodes2(booking.ticketCount);
        const passIds = generatePassIds2(bookingId, booking.ticketCount);
        await storage.updateBookingQRCodes(bookingId, [], passIds, guestCodes);
        const updatedBooking = await storage.getBooking(bookingId);
        if (updatedBooking) {
          try {
            await enhancedEmailService.sendTicketEmails({
              ...updatedBooking,
              guests: updatedBooking.guests || [],
              guestCodes: updatedBooking.guestCodes || [],
              qrCodes: updatedBooking.qrCodes || [],
              paymentStatus: updatedBooking.paymentStatus || "verified"
            });
            console.log(`\u2705 QR tickets sent successfully to ${updatedBooking.email}`);
          } catch (emailError) {
            console.error("Email sending failed (non-critical):", emailError);
          }
        }
      } else if (action === "reject") {
        await storage.updateBookingPaymentStatus(bookingId, "pending");
      }
      res.json({ message: `Payment ${action === "verify" ? "verified" : "rejected"} successfully` });
    } catch (error) {
      console.error("Verification error:", error);
      res.status(500).json({ message: "Failed to update payment status" });
    }
  });
  app2.post("/api/admin/bookings/:id/send-ticket", authenticate, requirePermission(PERMISSIONS.SEND_TICKETS), async (req, res) => {
    try {
      const bookingId = parseInt(req.params.id);
      const booking = await storage.getBooking(bookingId);
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }
      if (booking.paymentStatus !== "verified") {
        return res.status(400).json({ message: "Payment not verified yet" });
      }
      const hasExistingQRCodes = booking.qrCodes && booking.qrCodes.length > 0;
      const hasExistingGuestCodes = booking.guestCodes && booking.guestCodes.length > 0;
      if (hasExistingQRCodes && hasExistingGuestCodes) {
        console.log(`\u267B\uFE0F Reusing existing QR codes for booking ${bookingId}`);
        try {
          const { EnhancedEmailService: EnhancedEmailService2 } = await Promise.resolve().then(() => (init_enhancedEmailService(), enhancedEmailService_exports));
          const enhancedEmailService2 = new EnhancedEmailService2();
          await enhancedEmailService2.sendQRTickets(booking);
          return res.json({
            message: "Existing tickets resent successfully!",
            guestCodes: booking.guestCodes,
            passIds: booking.passIds,
            note: "Used existing QR codes"
          });
        } catch (emailError) {
          console.error("Failed to resend existing tickets:", emailError);
          return res.status(500).json({ message: "Failed to resend existing tickets" });
        }
      }
      console.log(`\u{1F195} Generating new QR codes for booking ${bookingId}`);
      const guestCodes = hasExistingGuestCodes ? booking.guestCodes : generateGuestCodes2(booking.ticketCount);
      const passIds = generatePassIds2(bookingId, booking.ticketCount);
      if (!hasExistingGuestCodes) {
        await storage.updateBookingVerification(bookingId, "verified", guestCodes);
      }
      const result = await ticketGenerationService2.generateTicketsForBooking(bookingId);
      if (result.status === "completed") {
        res.json({
          message: "New tickets generated and sent successfully!",
          guestCodes: result.guestCodes,
          passIds: result.passIds,
          note: "Generated new QR codes"
        });
      } else {
        res.status(500).json({
          message: "Failed to generate tickets",
          errors: result.errors
        });
      }
    } catch (error) {
      console.error("Failed to send ticket:", error);
      res.status(500).json({ message: "Failed to send ticket" });
    }
  });
  app2.delete("/api/admin/bookings/:id", authenticate, requirePermission(PERMISSIONS.DELETE_BOOKINGS), async (req, res) => {
    try {
      const bookingId = parseInt(req.params.id);
      const booking = await storage.getBooking(bookingId);
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }
      await storage.deleteBooking(bookingId);
      try {
        const { GoogleSheetsService: GoogleSheetsService2 } = await Promise.resolve().then(() => (init_googleSheets(), googleSheets_exports));
        const googleSheetsService2 = new GoogleSheetsService2();
        await googleSheetsService2.deleteBookingFromSheet(bookingId);
        console.log(`\u2705 Booking ${bookingId} deleted from Google Sheets`);
      } catch (sheetsError) {
        console.error("Google Sheets delete failed:", sheetsError);
      }
      res.json({
        message: `Booking for ${booking.name} deleted successfully`
      });
    } catch (error) {
      console.error("Failed to delete booking:", error);
      res.status(500).json({ message: "Failed to delete booking" });
    }
  });
  app2.post("/api/scanner/check-in-guests", authenticate, requirePermission(PERMISSIONS.SCANNER_ACCESS), async (req, res) => {
    try {
      const { bookingId, guestCodes } = req.body;
      if (!bookingId || !guestCodes || !Array.isArray(guestCodes) || guestCodes.length === 0) {
        return res.status(400).json({ message: "Invalid booking ID or guest codes" });
      }
      const booking = await storage.getBooking(bookingId);
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }
      if (booking.paymentStatus !== "verified") {
        return res.status(400).json({ message: "Payment not verified for this booking" });
      }
      const validGuestCodes = guestCodes.filter(
        (code) => booking.guestCodes && booking.guestCodes.includes(code)
      );
      if (validGuestCodes.length !== guestCodes.length) {
        return res.status(400).json({ message: "Some guest codes do not belong to this booking" });
      }
      const alreadyScanned = validGuestCodes.filter(
        (code) => booking.scannedGuests && booking.scannedGuests.includes(code)
      );
      if (alreadyScanned.length > 0) {
        return res.status(400).json({
          message: `Some guests have already been checked in: ${alreadyScanned.join(", ")}`
        });
      }
      const updatedScannedGuests = [...booking.scannedGuests || [], ...validGuestCodes];
      await storage.updateBookingScannedGuests(bookingId, updatedScannedGuests);
      const guestDetails = validGuestCodes.map((code) => {
        const index = booking.guestCodes?.indexOf(code) || 0;
        return {
          guestCode: code,
          guestName: booking.guests?.[index] || `Guest ${index + 1}`,
          guestIndex: index
        };
      });
      console.log(`\u2705 Bulk guest check-in: ${validGuestCodes.length} guests from booking ${bookingId}`);
      res.json({
        success: true,
        message: `${validGuestCodes.length} guest(s) successfully checked in`,
        checkedInGuests: guestDetails,
        booking: await storage.getBooking(bookingId)
      });
    } catch (error) {
      console.error("Bulk check-in error:", error);
      res.status(500).json({ message: "Check-in failed" });
    }
  });
  app2.post("/api/scanner/scan", authenticate, requirePermission(PERMISSIONS.SCANNER_ACCESS), async (req, res) => {
    try {
      const { scanData } = req.body;
      const code = scanData;
      if (!code) {
        return res.status(400).json({
          success: false,
          message: "Code is required"
        });
      }
      console.log(`\u{1F50D} Scanner attempting to verify code: ${code}`);
      let booking = null;
      const numericCode = parseInt(code);
      if (!isNaN(numericCode)) {
        booking = await storage.getBooking(numericCode);
        console.log(`\u{1F4CB} Searched by booking ID ${numericCode}:`, booking ? "Found" : "Not found");
      }
      if (!booking) {
        const allBookings = await storage.getAllBookings();
        booking = allBookings.find(
          (b) => b.guestCodes && Array.isArray(b.guestCodes) && b.guestCodes.includes(code.toUpperCase())
        );
        console.log(`\u{1F3AB} Searched by guest code ${code}:`, booking ? `Found booking ${booking.id}` : "Not found");
      }
      if (!booking) {
        return res.json({
          success: false,
          message: `Invalid code: ${code}. Check booking ID or guest code.`
        });
      }
      if (booking.paymentStatus !== "verified") {
        return res.json({
          success: false,
          message: `Entry denied: Payment not verified for ${booking.name}`
        });
      }
      const isGuestCode = booking.guestCodes && Array.isArray(booking.guestCodes) && booking.guestCodes.includes(code.toUpperCase());
      if (isGuestCode) {
        const guestCode = code.toUpperCase();
        const guestIndex = booking.guestCodes.indexOf(guestCode);
        const guestName = booking.guests?.[guestIndex] || `Guest ${guestIndex + 1}`;
        if (booking.scannedGuests && booking.scannedGuests.includes(guestCode)) {
          return res.json({
            success: false,
            message: `${guestName} (${guestCode}) has already entered. Duplicate entry not allowed.`
          });
        }
        const updatedScannedGuests = [...booking.scannedGuests || [], guestCode];
        await storage.updateBookingScannedGuests(booking.id, updatedScannedGuests);
        const updatedBooking2 = await storage.getBooking(booking.id);
        console.log(`\u2705 Individual guest entry approved: ${guestName} (${guestCode}) for booking ${booking.id}`);
        return res.json({
          success: true,
          message: `Welcome ${guestName}! Individual entry verified.`,
          booking: updatedBooking2,
          guestInfo: {
            guestName,
            guestCode,
            guestIndex
          }
        });
      }
      if (booking.isScanned) {
        return res.json({
          success: false,
          message: `Entry denied: Ticket already used for ${booking.name}`
        });
      }
      await storage.scanTicket(booking.id, 1);
      const updatedBooking = await storage.getBooking(booking.id);
      console.log(`\u2705 Entry approved for booking ${booking.id}: ${booking.name}`);
      res.json({
        success: true,
        message: `Welcome ${booking.name}! Entry approved.`,
        booking: updatedBooking
      });
    } catch (error) {
      console.error("Scanner error:", error);
      res.status(500).json({
        success: false,
        message: "Scanner system error"
      });
    }
  });
  app2.post("/api/test-email", async (req, res) => {
    try {
      const { email, subject, message } = req.body;
      await enhancedEmailService.testEmailConnection(email || "test@example.com");
      res.json({
        success: true,
        message: "SMTP connection test successful",
        config: {
          host: "smtp.hostinger.com",
          port: "465",
          user: "mis@aashveetech.com"
        }
      });
    } catch (error) {
      console.error("SMTP test failed:", error);
      res.status(500).json({
        success: false,
        message: error.message,
        error: error.code || error.errno
      });
    }
  });
  app2.get("/api/test-sheets", async (req, res) => {
    try {
      const result = await googleSheetsService.testConnection();
      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });
  app2.get("/api/admin/screenshot-diagnostic", authenticate, requirePermission(PERMISSIONS.VIEW_BOOKINGS), async (req, res) => {
    try {
      const bookings2 = await storage.getAllBookings();
      const bookingsWithScreenshots = bookings2.filter((b) => b.paymentScreenshot);
      const uploadsDir = path.join(process.cwd(), "uploads");
      const actualFiles = fs.readdirSync(uploadsDir).filter((f) => f.startsWith("screenshot-"));
      const fileDetails = actualFiles.map((filename) => {
        const filepath = path.join(uploadsDir, filename);
        const stats = fs.statSync(filepath);
        return {
          filename,
          size: stats.size,
          isLikelyValid: stats.size > 1e3,
          // Files over 1KB are likely real images
          modified: stats.mtime
        };
      });
      const mismatches = [];
      const working = [];
      const corrupted = [];
      for (const booking of bookingsWithScreenshots) {
        const filename = booking.paymentScreenshot.replace("/uploads/", "");
        const fileDetail = fileDetails.find((f) => f.filename === filename);
        if (fileDetail) {
          if (fileDetail.isLikelyValid) {
            working.push({
              bookingId: booking.id,
              name: booking.name,
              email: booking.email,
              phone: booking.phone,
              filename,
              size: fileDetail.size,
              status: "VALID",
              paymentStatus: booking.paymentStatus
            });
          } else {
            corrupted.push({
              bookingId: booking.id,
              name: booking.name,
              email: booking.email,
              phone: booking.phone,
              filename,
              size: fileDetail.size,
              status: "CORRUPTED",
              paymentStatus: booking.paymentStatus,
              reuploadUrl: `${process.env.REPLIT_DEV_DOMAIN || "http://localhost:5000"}/api/bookings/${booking.id}/reupload`
            });
          }
        } else {
          mismatches.push({
            bookingId: booking.id,
            name: booking.name,
            email: booking.email,
            phone: booking.phone,
            expectedFile: filename,
            status: "MISSING",
            paymentStatus: booking.paymentStatus
          });
        }
      }
      res.json({
        totalBookingsWithScreenshots: bookingsWithScreenshots.length,
        actualFilesCount: actualFiles.length,
        validScreenshots: working.length,
        corruptedScreenshots: corrupted.length,
        missingScreenshots: mismatches.length,
        mismatches,
        working,
        corrupted,
        summary: {
          message: corrupted.length > 0 ? `\u26A0\uFE0F ${corrupted.length} customers need to re-upload payment screenshots` : "\u2705 All screenshots are valid",
          corruptedCustomers: corrupted.map((c) => `${c.name} (${c.phone}) - Booking #${c.bookingId}`)
        }
      });
    } catch (error) {
      res.status(500).json({ message: "Diagnostic failed", error: error.message });
    }
  });
  app2.get("/api/bookings/:id/reupload", async (req, res) => {
    try {
      const bookingId = parseInt(req.params.id);
      const booking = await storage.getBooking(bookingId);
      if (!booking) {
        return res.status(404).send(`
          <html>
            <head><title>Booking Not Found</title></head>
            <body style="font-family: Arial; text-align: center; padding: 50px;">
              <h1>Booking Not Found</h1>
              <p>The booking ID ${bookingId} could not be found.</p>
            </body>
          </html>
        `);
      }
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Re-upload Payment Screenshot - Telugu Night</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body { font-family: Arial; max-width: 600px; margin: 0 auto; padding: 20px; }
              .container { background: #f9f9f9; padding: 30px; border-radius: 10px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px; margin-bottom: 20px; }
              .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
              .upload-area { border: 2px dashed #ccc; padding: 40px; text-align: center; border-radius: 10px; margin: 20px 0; }
              .upload-area.dragover { border-color: #007bff; background: #f0f8ff; }
              .btn { background: #007bff; color: white; padding: 12px 30px; border: none; border-radius: 5px; cursor: pointer; font-size: 16px; }
              .btn:hover { background: #0056b3; }
              .success { background: #d4edda; border: 1px solid #c3e6cb; color: #155724; padding: 15px; border-radius: 5px; margin: 20px 0; }
              .error { background: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; padding: 15px; border-radius: 5px; margin: 20px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>\u{1F3AD} Telugu Night - Re-upload Payment Screenshot</h1>
                <p>Booking ID: #${booking.id} | ${booking.name}</p>
              </div>
              
              <div class="warning">
                <strong>\u26A0\uFE0F Screenshot Re-upload Required</strong><br>
                Your previous payment screenshot appears to be corrupted and needs to be uploaded again.
                This is due to a technical issue that has now been resolved.
              </div>

              <form id="reuploadForm" enctype="multipart/form-data">
                <div class="upload-area" id="uploadArea">
                  <input type="file" id="screenshot" name="screenshot" accept="image/*" style="display: none;" required>
                  <p><strong>\u{1F4F8} Click to Select Payment Screenshot</strong></p>
                  <p>JPG, PNG, GIF, WebP files up to 10MB</p>
                  <button type="button" class="btn" onclick="document.getElementById('screenshot').click()">Choose File</button>
                  <div id="fileName" style="margin-top: 15px; font-weight: bold;"></div>
                </div>
                
                <button type="submit" class="btn" id="submitBtn" disabled>Re-upload Screenshot</button>
              </form>

              <div id="message"></div>
            </div>

            <script>
              const form = document.getElementById('reuploadForm');
              const fileInput = document.getElementById('screenshot');
              const fileName = document.getElementById('fileName');
              const submitBtn = document.getElementById('submitBtn');
              const message = document.getElementById('message');

              fileInput.addEventListener('change', function() {
                if (this.files[0]) {
                  fileName.textContent = '\u2705 ' + this.files[0].name + ' (' + (this.files[0].size / 1024 / 1024).toFixed(2) + ' MB)';
                  fileName.style.color = 'green';
                  submitBtn.disabled = false;
                  submitBtn.style.background = '#28a745';
                }
              });

              form.addEventListener('submit', async function(e) {
                e.preventDefault();
                
                const formData = new FormData();
                formData.append('screenshot', fileInput.files[0]);
                
                submitBtn.disabled = true;
                submitBtn.textContent = 'Uploading...';
                
                try {
                  const response = await fetch('/api/bookings/${booking.id}/payment-proof', {
                    method: 'POST',
                    body: formData
                  });
                  
                  const result = await response.json();
                  
                  if (response.ok) {
                    message.innerHTML = '<div class="success">\u2705 Screenshot uploaded successfully! Your payment is now pending admin verification. You will receive QR tickets via email once verified.</div>';
                    form.style.display = 'none';
                  } else {
                    message.innerHTML = '<div class="error">\u274C ' + result.message + '</div>';
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Re-upload Screenshot';
                  }
                } catch (error) {
                  message.innerHTML = '<div class="error">\u274C Upload failed. Please try again.</div>';
                  submitBtn.disabled = false;
                  submitBtn.textContent = 'Re-upload Screenshot';
                }
              });
            </script>
          </body>
        </html>
      `;
      res.send(html);
    } catch (error) {
      console.error("Re-upload page error:", error);
      res.status(500).send("Internal server error");
    }
  });
  app2.post("/api/admin/sync-sheets", authenticate, requirePermission(PERMISSIONS.VIEW_BOOKINGS), async (req, res) => {
    try {
      const bookings2 = await storage.getAllBookings();
      console.log(`\u{1F504} Starting Google Sheets sync for ${bookings2.length} bookings...`);
      let syncedCount = 0;
      let errors = 0;
      const errorDetails = [];
      const { GoogleSheetsService: GoogleSheetsService2 } = await Promise.resolve().then(() => (init_googleSheets(), googleSheets_exports));
      const googleSheetsService2 = new GoogleSheetsService2();
      for (const booking of bookings2) {
        try {
          if (typeof googleSheetsService2.syncBookingToSheet === "function") {
            await googleSheetsService2.syncBookingToSheet(booking);
          } else {
            await googleSheetsService2.addBookingToSheet(booking);
          }
          syncedCount++;
          console.log(`\u2705 Synced booking ${booking.id}: ${booking.name}`);
        } catch (error) {
          console.error(`\u274C Failed to sync booking ${booking.id}:`, error.message);
          errors++;
          errorDetails.push(`Booking ${booking.id}: ${error.message}`);
        }
      }
      const message = `Synced ${syncedCount} bookings to Google Sheets (${errors} errors)`;
      console.log(`\u{1F3AF} ${message}`);
      res.json({
        success: true,
        message,
        syncedCount,
        errors,
        totalBookings: bookings2.length,
        errorDetails: errorDetails.slice(0, 3)
        // Show first 3 errors
      });
    } catch (error) {
      console.error("Bulk sync failed:", error);
      res.status(500).json({
        success: false,
        message: "Failed to sync bookings to Google Sheets",
        error: error.message
      });
    }
  });
  app2.post("/api/admin/reset-sheets", authenticate, requirePermission(PERMISSIONS.VIEW_BOOKINGS), async (req, res) => {
    try {
      console.log("\u{1F504} Starting Google Sheets reset and fresh sync...");
      const { GoogleSheetsService: GoogleSheetsService2 } = await Promise.resolve().then(() => (init_googleSheets(), googleSheets_exports));
      const googleSheetsService2 = new GoogleSheetsService2();
      const resetResult = await googleSheetsService2.resetSheet();
      if (!resetResult.success) {
        return res.status(500).json({
          success: false,
          message: `Failed to reset sheet: ${resetResult.message}`
        });
      }
      console.log("\u2705 Google Sheet reset completed, now syncing all bookings...");
      const bookings2 = await storage.getAllBookings();
      const syncResult = await googleSheetsService2.syncAllBookingsToFreshSheet(bookings2);
      if (!syncResult.success) {
        return res.status(500).json({
          success: false,
          message: `Failed to sync bookings: ${syncResult.message}`
        });
      }
      const message = `Google Sheet reset and ${syncResult.successCount} bookings synced successfully`;
      console.log(`\u{1F389} ${message}`);
      res.json({
        success: true,
        message,
        resetSuccess: true,
        totalBookings: bookings2.length,
        syncedCount: syncResult.successCount,
        errors: syncResult.errorCount
      });
    } catch (error) {
      console.error("\u274C Reset and sync failed:", error);
      res.status(500).json({
        success: false,
        message: "Failed to reset and sync Google Sheets"
      });
    }
  });
  app2.get("/api/test-email", async (req, res) => {
    try {
      const testBooking = {
        id: 999,
        name: "Test User",
        email: "systemtest@example.com",
        phone: "1234567890",
        ticketCount: 2,
        guests: ["Guest 1"],
        guestCodes: ["TEST01", "TEST02"],
        totalAmount: "600",
        paymentStatus: "verified",
        qrCodes: [],
        passIds: []
      };
      const result = await emailService.sendPaymentConfirmationEmail(testBooking);
      res.json({ message: "Test email sent successfully", result });
    } catch (error) {
      console.error("Test email failed:", error);
      res.status(500).json({ message: "Test email failed", error: error.message });
    }
  });
  app2.post("/api/bookings/:id/payment-proof", upload.single("screenshot"), async (req, res) => {
    try {
      const bookingId = parseInt(req.params.id);
      const booking = await storage.getBooking(bookingId);
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }
      if (!req.file) {
        return res.status(400).json({
          message: "Screenshot upload is mandatory to complete your booking. Please upload payment proof."
        });
      }
      console.log(`\u{1F4F8} Uploading screenshot to public uploads folder for booking ${bookingId}...`);
      const timestamp2 = Date.now();
      const fileExtension = path.extname(req.file.originalname);
      const uniqueFilename = `payment-${bookingId}-${timestamp2}${fileExtension}`;
      const publicPath = `/uploads/${uniqueFilename}`;
      const oldPath = req.file.path;
      const newPath = path.join(process.cwd(), "uploads", uniqueFilename);
      fs.renameSync(oldPath, newPath);
      console.log(`\u2705 Screenshot uploaded to public folder: ${publicPath}`);
      await storage.updateBookingPaymentStatus(bookingId, "pending", publicPath);
      try {
        const { GoogleSheetsService: GoogleSheetsService2 } = await Promise.resolve().then(() => (init_googleSheets(), googleSheets_exports));
        const googleSheetsService2 = new GoogleSheetsService2();
        await googleSheetsService2.addPaymentScreenshotToSheet(bookingId, `https://events.qlora.in${publicPath}`);
        console.log(`\u2705 Public screenshot URL synced to Google Sheets for booking ${bookingId}`);
      } catch (sheetsError) {
        console.error("Google Sheets screenshot sync failed:", sheetsError);
      }
      try {
        await enhancedEmailService.sendPaymentConfirmationEmail(booking);
        console.log(`\u2705 Payment confirmation email sent to ${booking.email}`);
      } catch (emailError) {
        console.error("Payment confirmation email failed:", emailError);
      }
      res.json({
        message: "Screenshot uploaded successfully! Confirmation email sent. Your booking is now pending admin verification.",
        screenshot: publicPath,
        booking: {
          id: booking.id,
          name: booking.name,
          paymentStatus: "pending"
        }
      });
    } catch (error) {
      console.error("Screenshot upload error:", error);
      res.status(500).json({ message: "Failed to upload screenshot" });
    }
  });
  app2.get("/api/bookings/:id/reupload", async (req, res) => {
    try {
      const bookingId = parseInt(req.params.id);
      const booking = await storage.getBooking(bookingId);
      if (!booking) {
        return res.status(404).send(`
          <html><body style="font-family: Arial; text-align: center; margin-top: 50px;">
            <h2>\u274C Booking Not Found</h2>
            <p>The booking ID ${bookingId} was not found in our system.</p>
          </body></html>
        `);
      }
      const totalWithFee = parseFloat(booking.totalAmount) + booking.ticketCount * 12.96;
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Re-upload Payment Screenshot - Telugu Night</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 20px; padding: 30px; box-shadow: 0 20px 40px rgba(0,0,0,0.1); }
            .header { text-align: center; margin-bottom: 30px; }
            .header h1 { color: #333; margin: 0; font-size: 24px; }
            .booking-info { background: #f8f9fa; padding: 20px; border-radius: 10px; margin-bottom: 20px; }
            .upload-area { border: 3px dashed #007bff; border-radius: 10px; padding: 40px; text-align: center; margin: 20px 0; transition: all 0.3s ease; cursor: pointer; }
            .upload-area:hover { border-color: #0056b3; background: #f8f9ff; }
            .upload-area.dragover { border-color: #28a745; background: #f0fff4; }
            .btn { background: linear-gradient(45deg, #007bff, #0056b3); color: white; padding: 12px 30px; border: none; border-radius: 25px; cursor: pointer; font-size: 16px; margin: 10px; transition: all 0.3s ease; }
            .btn:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(0,123,255,0.3); }
            .btn:disabled { background: #ccc; cursor: not-allowed; transform: none; }
            .success { background: #d4edda; color: #155724; padding: 15px; border-radius: 5px; margin: 10px 0; border: 1px solid #c3e6cb; }
            .error { background: #f8d7da; color: #721c24; padding: 15px; border-radius: 5px; margin: 10px 0; border: 1px solid #f5c6cb; }
            .file-info { margin: 15px 0; padding: 10px; background: #e9ecef; border-radius: 5px; display: none; }
            .progress { background: #e9ecef; border-radius: 10px; height: 20px; margin: 10px 0; overflow: hidden; display: none; }
            .progress-bar { background: linear-gradient(45deg, #28a745, #20c997); height: 100%; width: 0%; transition: width 0.3s ease; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>\u{1F3AB} Re-upload Payment Screenshot</h1>
              <p>Telugu Night Event - DTR, Manipal</p>
            </div>
            
            <div class="booking-info">
              <h3>Booking Details</h3>
              <p><strong>Booking ID:</strong> #${booking.id}</p>
              <p><strong>Name:</strong> ${booking.name}</p>
              <p><strong>Email:</strong> ${booking.email}</p>
              <p><strong>Tickets:</strong> ${booking.ticketCount}</p>
              <p><strong>Amount Paid:</strong> \u20B9${totalWithFee.toFixed(2)}</p>
            </div>

            <div style="background: #fff3cd; padding: 15px; border-radius: 10px; margin-bottom: 20px; border: 1px solid #ffeaa7;">
              <h4 style="margin: 0; color: #856404;">\u{1F4F8} Screenshot Upload Required</h4>
              <p style="margin: 10px 0 0 0; color: #856404;">Your previous screenshot was corrupted or missing. Please upload a clear image of your payment confirmation.</p>
            </div>

            <form id="uploadForm" enctype="multipart/form-data">
              <div class="upload-area" id="uploadArea" onclick="document.getElementById('fileInput').click()">
                <p><strong>\u{1F4F1} Drag & drop your screenshot here</strong></p>
                <p>or click to select file</p>
                <p style="font-size: 14px; color: #666; margin-top: 15px;">Supported: JPG, PNG, GIF, WebP (Max 10MB)</p>
              </div>
              
              <input type="file" id="fileInput" name="screenshot" accept="image/*" style="display: none;" required>
              
              <div class="file-info" id="fileInfo"></div>
              <div class="progress" id="progress">
                <div class="progress-bar" id="progressBar"></div>
              </div>
              
              <div style="text-align: center; margin-top: 20px;">
                <button type="submit" class="btn" id="submitBtn" disabled>
                  \u{1F4E4} Upload Screenshot
                </button>
              </div>
            </form>

            <div id="message"></div>

            <div class="footer">
              <p>Need help? Contact us at support@telugunight.com</p>
              <p>Event Date: August 3, 2025 | Venue: DTR, Manipal</p>
            </div>
          </div>

          <script>
            const fileInput = document.getElementById('fileInput');
            const uploadArea = document.getElementById('uploadArea');
            const fileInfo = document.getElementById('fileInfo');
            const submitBtn = document.getElementById('submitBtn');
            const progress = document.getElementById('progress');
            const progressBar = document.getElementById('progressBar');
            const message = document.getElementById('message');
            const form = document.getElementById('uploadForm');

            // Drag and drop functionality
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
              uploadArea.addEventListener(eventName, preventDefaults, false);
            });

            function preventDefaults(e) {
              e.preventDefault();
              e.stopPropagation();
            }

            ['dragenter', 'dragover'].forEach(eventName => {
              uploadArea.addEventListener(eventName, () => uploadArea.classList.add('dragover'), false);
            });

            ['dragleave', 'drop'].forEach(eventName => {
              uploadArea.addEventListener(eventName, () => uploadArea.classList.remove('dragover'), false);
            });

            uploadArea.addEventListener('drop', (e) => {
              const dt = e.dataTransfer;
              const files = dt.files;
              fileInput.files = files;
              handleFiles(files);
            });

            fileInput.addEventListener('change', (e) => {
              handleFiles(e.target.files);
            });

            function handleFiles(files) {
              if (files.length > 0) {
                const file = files[0];
                const fileSize = (file.size / (1024 * 1024)).toFixed(2);
                
                fileInfo.innerHTML = \`
                  <strong>Selected File:</strong> \${file.name}<br>
                  <strong>Size:</strong> \${fileSize} MB<br>
                  <strong>Type:</strong> \${file.type}
                \`;
                fileInfo.style.display = 'block';
                submitBtn.disabled = false;
              }
            }

            form.addEventListener('submit', async (e) => {
              e.preventDefault();
              
              if (!fileInput.files[0]) {
                message.innerHTML = '<div class="error">Please select a screenshot to upload.</div>';
                return;
              }

              const formData = new FormData();
              formData.append('screenshot', fileInput.files[0]);

              submitBtn.disabled = true;
              submitBtn.textContent = '\u{1F4E4} Uploading...';
              progress.style.display = 'block';
              
              // Simulate progress
              let progressValue = 0;
              const progressInterval = setInterval(() => {
                progressValue += Math.random() * 30;
                if (progressValue > 90) progressValue = 90;
                progressBar.style.width = progressValue + '%';
              }, 200);

              try {
                const response = await fetch('/api/bookings/${booking.id}/payment-proof', {
                  method: 'POST',
                  body: formData
                });
                
                clearInterval(progressInterval);
                progressBar.style.width = '100%';
                
                const result = await response.json();
                
                if (response.ok) {
                  message.innerHTML = '<div class="success">\u2705 Screenshot uploaded successfully! Your payment is now pending admin verification. You will receive QR tickets via email once verified.</div>';
                  form.style.display = 'none';
                } else {
                  throw new Error(result.message || 'Upload failed');
                }
              } catch (error) {
                clearInterval(progressInterval);
                message.innerHTML = \`<div class="error">\u274C Upload failed: \${error.message}</div>\`;
                submitBtn.disabled = false;
                submitBtn.textContent = '\u{1F4E4} Upload Screenshot';
                progress.style.display = 'none';
              }
            });
          </script>
        </body>
        </html>
      `;
      res.send(html);
    } catch (error) {
      console.error("Re-upload page error:", error);
      res.status(500).send(`
        <html><body style="font-family: Arial; text-align: center; margin-top: 50px;">
          <h2>\u274C Error</h2>
          <p>Unable to load re-upload page. Please try again later.</p>
        </body></html>
      `);
    }
  });
  app2.post("/api/admin/verify-payment/:id", authenticate, requirePermission(PERMISSIONS.VERIFY_PAYMENTS), async (req, res) => {
    try {
      const bookingId = parseInt(req.params.id);
      const booking = await storage.getBooking(bookingId);
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }
      if (booking.paymentStatus !== "pending") {
        return res.status(400).json({ message: "Booking is not in pending status" });
      }
      await storage.updateBookingPaymentStatus(bookingId, "verified");
      try {
        const { GoogleSheetsService: GoogleSheetsService2 } = await Promise.resolve().then(() => (init_googleSheets(), googleSheets_exports));
        const googleSheetsService2 = new GoogleSheetsService2();
        await googleSheetsService2.updateBookingPaymentStatus(bookingId, "verified");
      } catch (sheetsError) {
        console.error("Google Sheets update failed:", sheetsError);
      }
      res.json({
        message: "Payment verified successfully. Booking is now ready for ticket generation.",
        booking: { ...booking, paymentStatus: "verified" }
      });
    } catch (error) {
      console.error("Payment verification error:", error);
      res.status(500).json({ message: error.message || "Failed to verify payment" });
    }
  });
  app2.post("/api/admin/generate-tickets/:id", authenticate, requirePermission(PERMISSIONS.VERIFY_PAYMENTS), async (req, res) => {
    try {
      const bookingId = parseInt(req.params.id);
      const booking = await storage.getBooking(bookingId);
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }
      if (booking.paymentStatus !== "verified") {
        return res.status(400).json({ message: "Payment must be verified before generating tickets" });
      }
      const progress = await ticketGenerationService2.generateTicketsForBooking(bookingId);
      res.json({
        message: "Tickets generated and sent successfully!",
        progress,
        qrCodes: progress.qrCodes.length,
        passIds: progress.passIds
      });
    } catch (error) {
      console.error("Ticket generation error:", error);
      res.status(500).json({ message: error.message || "Failed to generate tickets" });
    }
  });
  app2.delete("/api/admin/bookings/:id", authenticate, requirePermission(PERMISSIONS.MANAGE_BOOKINGS), async (req, res) => {
    try {
      const bookingId = parseInt(req.params.id);
      const booking = await storage.getBooking(bookingId);
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }
      await storage.deleteBooking(bookingId);
      console.log(`\u{1F4CB} Skipping Google Sheets deletion for booking ${bookingId} as per admin settings`);
      res.json({
        message: `Booking #${bookingId} for ${booking.name} has been deleted successfully.`,
        deletedBooking: booking
      });
    } catch (error) {
      console.error("Booking deletion error:", error);
      res.status(500).json({ message: error.message || "Failed to delete booking" });
    }
  });
  app2.post("/api/admin/generate-tickets-batch", authenticate, requirePermission(PERMISSIONS.VERIFY_PAYMENTS), async (req, res) => {
    try {
      const { bookingIds } = req.body;
      if (!Array.isArray(bookingIds) || bookingIds.length === 0) {
        return res.status(400).json({ message: "Invalid booking IDs provided" });
      }
      const batchId = await ticketGenerationService2.generateTicketsBatch(bookingIds);
      res.json({
        message: "Batch ticket generation started",
        batchId,
        totalBookings: bookingIds.length
      });
    } catch (error) {
      console.error("Batch ticket generation error:", error);
      res.status(500).json({ message: error.message || "Failed to start batch generation" });
    }
  });
  app2.get("/api/admin/batch-progress/:batchId", authenticate, requirePermission(PERMISSIONS.VIEW_BOOKINGS), async (req, res) => {
    try {
      const { batchId } = req.params;
      const progress = ticketGenerationService2.getBatchProgress(batchId);
      if (!progress) {
        return res.status(404).json({ message: "Batch not found" });
      }
      res.json(progress);
    } catch (error) {
      console.error("Batch progress error:", error);
      res.status(500).json({ message: "Failed to get batch progress" });
    }
  });
  app2.post("/api/admin/auto-generate-tickets", authenticate, requirePermission(PERMISSIONS.VERIFY_PAYMENTS), async (req, res) => {
    try {
      const batchIds = await ticketGenerationService2.autoGenerateForVerifiedPayments();
      res.json({
        message: batchIds.length > 0 ? "Auto-generation started" : "No bookings need ticket generation",
        batchIds,
        totalBatches: batchIds.length
      });
    } catch (error) {
      console.error("Auto-generation error:", error);
      res.status(500).json({ message: error.message || "Failed to start auto-generation" });
    }
  });
  app2.post("/api/admin/verify-payment", authenticate, requirePermission(PERMISSIONS.VERIFY_PAYMENTS), async (req, res) => {
    try {
      const { bookingId, action } = req.body;
      if (!bookingId || !action) {
        return res.status(400).json({ message: "Missing bookingId or action" });
      }
      const booking = await storage.getBooking(bookingId);
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }
      if (action === "verify") {
        console.log(`\u{1F50D} Manual verification for booking ${bookingId}: ${booking.name}`);
        console.log(`\u{1F4F8} Screenshot: ${booking.paymentScreenshot || "No screenshot"}`);
        const progress = await ticketGenerationService2.generateTicketsForBooking(bookingId);
        console.log(`\u2705 Verification complete for booking ${bookingId}:`, {
          qrCodes: progress.qrCodes.length,
          passIds: progress.passIds.length,
          guestCodes: progress.guestCodes
        });
        res.json({
          message: `Payment verified and ${progress.qrCodes.length} QR tickets sent to ${booking.email}`,
          qrCodes: progress.qrCodes.length,
          passIds: progress.passIds,
          guestCodes: progress.guestCodes,
          booking: {
            id: booking.id,
            name: booking.name,
            email: booking.email,
            paymentStatus: "verified"
          }
        });
      } else if (action === "reject") {
        await storage.updateBookingVerification(bookingId, "rejected", []);
        console.log(`\u274C Payment rejected for booking ${bookingId}: ${booking.name}`);
        res.json({
          message: `Payment rejected for ${booking.name}`,
          booking: {
            id: booking.id,
            name: booking.name,
            paymentStatus: "rejected"
          }
        });
      } else {
        res.status(400).json({ message: 'Invalid action. Use "verify" or "reject"' });
      }
    } catch (error) {
      console.error("Payment verification error:", error);
      res.status(500).json({ message: error.message || "Failed to verify payment" });
    }
  });
  app2.post("/api/admin/verify-payment/:id", authenticate, requirePermission(PERMISSIONS.VERIFY_PAYMENTS), async (req, res) => {
    try {
      const bookingId = parseInt(req.params.id);
      const progress = await ticketGenerationService2.generateTicketsForBooking(bookingId);
      res.json({
        message: "Payment verified and tickets sent",
        qrCodes: progress.qrCodes.length,
        passIds: progress.passIds
      });
    } catch (error) {
      console.error("Payment verification error:", error);
      res.status(500).json({ message: error.message || "Failed to verify payment" });
    }
  });
  app2.get("/uploads/:filename", (req, res) => {
    const filename = req.params.filename;
    const filepath = path.join(process.cwd(), "uploads", filename);
    if (!fs.existsSync(filepath)) {
      console.error(`Screenshot not found: ${filepath}`);
      return res.status(404).json({ message: "Screenshot not found" });
    }
    const ext = path.extname(filename).toLowerCase();
    if (ext === ".jpg" || ext === ".jpeg") {
      res.setHeader("Content-Type", "image/jpeg");
    } else if (ext === ".png") {
      res.setHeader("Content-Type", "image/png");
    } else if (ext === ".gif") {
      res.setHeader("Content-Type", "image/gif");
    } else if (ext === ".webp") {
      res.setHeader("Content-Type", "image/webp");
    }
    res.sendFile(filepath, (err) => {
      if (err) {
        console.error("Error serving file:", err);
        res.status(404).json({ message: "File not found" });
      }
    });
  });
  app2.get("/api/bookings/:id/download-ticket", authenticate, async (req, res) => {
    try {
      const bookingId = parseInt(req.params.id);
      const booking = await storage.getBooking(bookingId);
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }
      if (booking.paymentStatus !== "verified" || !booking.qrCodes || booking.qrCodes.length === 0) {
        return res.status(400).json({ message: "No tickets available for download" });
      }
      const QRCode4 = await import("qrcode");
      const Canvas = await import("canvas");
      const canvas = Canvas.default.createCanvas(800, 600);
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#1a1a2e";
      ctx.fillRect(0, 0, 800, 600);
      ctx.fillStyle = "#ffb347";
      ctx.font = "bold 32px Arial";
      ctx.textAlign = "center";
      ctx.fillText("Telugu Night - DTR, Manipal", 400, 80);
      ctx.fillStyle = "#ffffff";
      ctx.font = "18px Arial";
      ctx.fillText(`Name: ${booking.name}`, 400, 150);
      ctx.fillText(`Email: ${booking.email}`, 400, 180);
      ctx.fillText(`Tickets: ${booking.ticketCount}`, 400, 210);
      ctx.fillText(`Booking ID: ${booking.id}`, 400, 240);
      if (booking.guestCodes && booking.guestCodes.length > 0) {
        ctx.fillText(`Guest Codes: ${booking.guestCodes.join(", ")}`, 400, 270);
      }
      const primaryGuestCode = booking.guestCodes?.[0] || "ENTRY";
      const qrCodeDataUrl = await QRCode4.toDataURL(`TELUGU-NIGHT-${booking.id}-${primaryGuestCode}`, {
        width: 200,
        margin: 2
      });
      const qrImg = new Canvas.default.Image();
      qrImg.src = qrCodeDataUrl;
      ctx.drawImage(qrImg, 300, 320, 200, 200);
      ctx.font = "14px Arial";
      ctx.fillText("Show this QR code at the venue for entry", 400, 550);
      const buffer = canvas.toBuffer("image/jpeg");
      res.set({
        "Content-Type": "image/jpeg",
        "Content-Disposition": `attachment; filename="telugu-night-ticket-${booking.id}.jpg"`
      });
      res.send(buffer);
    } catch (error) {
      console.error("Ticket download error:", error);
      res.status(500).json({ message: "Failed to generate ticket" });
    }
  });
  app2.get("/health", (req, res) => {
    res.json({
      status: "healthy",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      uptime: process.uptime(),
      version: "1.0.0"
    });
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// server/vite.ts
import express from "express";
import fs2 from "fs";
import path3 from "path";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path2 from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...process.env.NODE_ENV !== "production" && process.env.REPL_ID !== void 0 ? [
      await import("@replit/vite-plugin-cartographer").then(
        (m) => m.cartographer()
      )
    ] : []
  ],
  resolve: {
    alias: {
      "@": path2.resolve(import.meta.dirname, "client", "src"),
      "@shared": path2.resolve(import.meta.dirname, "shared"),
      "@assets": path2.resolve(import.meta.dirname, "attached_assets")
    }
  },
  root: path2.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path2.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path3.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html"
      );
      let template = await fs2.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path3.resolve(import.meta.dirname, "public");
  if (!fs2.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path3.resolve(distPath, "index.html"));
  });
}

// server/index.ts
var app = express2();
app.use(express2.json());
app.use("/uploads", express2.static("uploads"));
app.use(cookieParser());
app.use(express2.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const start = Date.now();
  const path4 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path4.startsWith("/api")) {
      let logLine = `${req.method} ${path4} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
(async () => {
  const server = await registerRoutes(app);
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const port = 5e3;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true
  }, () => {
    log(`serving on port ${port}`);
  });
})();
