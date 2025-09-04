import { google } from 'googleapis';
import type { Booking } from '@shared/schema';

export class GoogleSheetsService {
  private sheets: any;
  private spreadsheetId: string;

  constructor() {
    // Initialize Google Sheets API with credentials from environment
    const credentials = JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS || '{}');
    
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    this.sheets = google.sheets({ version: 'v4', auth });
    this.spreadsheetId = process.env.GOOGLE_SHEETS_ID || '';
  }

  async addBookingToSheet(booking: Booking) {
    try {
      // Check if Google Sheets API is available
      if (!this.spreadsheetId) {
        console.log('Google Sheets not configured, skipping...');
        return null;
      }

      // Create header row if sheet is empty
      await this.ensureHeaderRow();

      const values = [
        [
          new Date().toISOString(),
          booking.id,
          booking.name,
          booking.email,
          booking.phone,
          booking.gender || '',
          booking.ticketCount,
          booking.ticketType || 'early_bird',
          Array.isArray(booking.guests) ? booking.guests.join(', ') : booking.guests || '',
          Array.isArray(booking.guestGenders) ? booking.guestGenders.join(', ') : booking.guestGenders || '',
          booking.couponCode || '',
          booking.couponDiscount || 0,
          booking.totalAmount,
          booking.paymentStatus,
          Array.isArray(booking.guestCodes) ? booking.guestCodes.join(', ') : booking.guestCodes || '',
          Array.isArray(booking.scannedGuests) ? booking.scannedGuests.join(', ') : booking.scannedGuests || '',
          Array.isArray(booking.scannedGuests) ? booking.scannedGuests.length : 0,
          booking.paymentScreenshot ? 
            (booking.paymentScreenshot.startsWith('http') ? 
              booking.paymentScreenshot : 
              `https://events.qlora.in${booking.paymentScreenshot}`) : ''
        ]
      ];

      const request = {
        spreadsheetId: this.spreadsheetId,
        range: 'Sheet1!A:S',
        valueInputOption: 'USER_ENTERED',
        resource: {
          values,
        },
      };

      const response = await this.sheets.spreadsheets.values.append(request);
      console.log('Successfully added booking to Google Sheets');
      return response.data;
    } catch (error: any) {
      if (error.message && error.message.includes('Google Sheets API has not been used')) {
        console.log('⚠️  Google Sheets API is not enabled. Please enable it in Google Cloud Console at:');
        console.log('https://console.developers.google.com/apis/api/sheets.googleapis.com/overview');
        // Don't throw error, just log it so booking still works
        return null;
      }
      console.error('Error adding to Google Sheets:', error);
      // Don't throw error to prevent booking failure
      return null;
    }
  }

  // Method to sync existing bookings - updates or adds as needed
  async syncBookingToSheet(booking: Booking) {
    try {
      return await this.addBookingToSheet(booking);
    } catch (error: any) {
      console.error('Error syncing booking to Google Sheets:', error);
      throw error;
    }
  }

  async updateBookingStatus(bookingId: number, status: string) {
    try {
      if (!this.spreadsheetId) {
        console.log('Google Sheets not configured, skipping update...');
        return null;
      }

      // This would require finding the booking row and updating it
      // For now, just log the action
      console.log(`Would update booking ${bookingId} status to ${status} in Google Sheets`);
      return null;
    } catch (error) {
      console.error('Error updating booking status in Google Sheets:', error);
      return null;
    }
  }

  async ensureHeaderRow() {
    try {
      // Check if there are any values in the sheet
      const getResponse = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'Sheet1!A1:S1',
      });

      if (!getResponse.data.values || getResponse.data.values.length === 0) {
        // Add header row
        const headerValues = [
          [
            'Timestamp',
            'Booking ID',
            'Name',
            'Email',
            'Phone',
            'Gender',
            'Ticket Count',
            'Ticket Type',
            'Guests',
            'Guest Genders',
            'Coupon Code',
            'Coupon Discount',
            'Total Amount',
            'Payment Status',
            'Guest Codes',
            'Scanned Guests',
            'Entry Count',
            'Payment Screenshot'
          ]
        ];

        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: 'Sheet1!A1:S1',
          valueInputOption: 'USER_ENTERED',
          resource: {
            values: headerValues,
          },
        });
      }
    } catch (error) {
      console.error('Error creating header row:', error);
    }
  }



  async addPaymentScreenshotToSheet(bookingId: number, screenshotUrl: string) {
    try {
      if (!this.spreadsheetId) {
        console.log('Google Sheets not configured for screenshot upload');
        return null;
      }

      // Find the row with this booking ID
      const getResponse = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'Sheet1!A:S',
      });

      const rows = getResponse.data.values || [];
      const rowIndex = rows.findIndex((row: any) => row[1] === bookingId.toString());

      if (rowIndex !== -1) {
        const range = `Sheet1!S${rowIndex + 1}`;  // Column S for screenshot URL
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range,
          valueInputOption: 'USER_ENTERED',
          resource: {
            values: [[screenshotUrl]],
          },
        });
        console.log(`✅ Added payment screenshot URL to Google Sheets: ${screenshotUrl}`);
        return true;
      } else {
        console.log(`⚠️ Booking ${bookingId} not found in Google Sheets for screenshot update`);
        return false;
      }
    } catch (error: any) {
      console.error('Error adding screenshot to Google Sheets:', error);
      if (error.message?.includes('API has not been used')) {
        console.log('Please enable Google Sheets API at: https://console.developers.google.com/apis/api/sheets.googleapis.com/overview?project=640169928600');
      }
      return false;
    }
  }

  async testConnection() {
    try {
      if (!this.spreadsheetId) {
        return { success: false, message: 'No spreadsheet ID configured' };
      }

      const response = await this.sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
      });

      return { 
        success: true, 
        message: 'Google Sheets API is working',
        title: response.data.properties?.title 
      };
    } catch (error: any) {
      console.error('Google Sheets test failed:', error);
      if (error.message?.includes('API has not been used')) {
        return { 
          success: false, 
          message: 'Google Sheets API needs to be enabled. Visit: https://console.developers.google.com/apis/api/sheets.googleapis.com/overview?project=640169928600'
        };
      }
      return { success: false, message: error?.message || 'Unknown error' };
    }
  }

  async resetSheet() {
    try {
      if (!this.spreadsheetId) {
        console.log('Google Sheets not configured, cannot reset');
        return { success: false, message: 'No spreadsheet ID configured' };
      }

      console.log('🔄 Resetting Google Sheet and starting fresh...');

      // Clear all existing data in the sheet
      await this.sheets.spreadsheets.values.clear({
        spreadsheetId: this.spreadsheetId,
        range: 'Sheet1!A:Z', // Clear all columns
      });

      // Add fresh header row
      const headerValues = [
        [
          'Timestamp',
          'Booking ID',
          'Name',
          'Email',
          'Phone',
          'Gender',
          'Ticket Count',
          'Ticket Type',
          'Guests',
          'Guest Genders',
          'Coupon Code',
          'Coupon Discount',
          'Total Amount',
          'Payment Status',
          'Guest Codes',
          'Scanned Guests',
          'Entry Count',
          'Payment Screenshot'
        ]
      ];

      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: 'Sheet1!A1:R1',
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: headerValues,
        },
      });

      console.log('✅ Google Sheet reset successfully with fresh headers');
      return { success: true, message: 'Google Sheet reset successfully' };

    } catch (error: any) {
      console.error('❌ Error resetting Google Sheet:', error);
      if (error.message?.includes('API has not been used')) {
        return { 
          success: false, 
          message: 'Google Sheets API needs to be enabled. Visit: https://console.developers.google.com/apis/api/sheets.googleapis.com/overview'
        };
      }
      return { success: false, message: error?.message || 'Unknown error' };
    }
  }

  async syncAllBookingsToFreshSheet(bookings: any[]) {
    try {
      if (!this.spreadsheetId) {
        console.log('Google Sheets not configured, cannot sync');
        return { success: false, message: 'No spreadsheet ID configured' };
      }

      console.log(`🔄 Syncing ${bookings.length} bookings to fresh Google Sheet...`);
      
      let successCount = 0;
      let errorCount = 0;

      for (const booking of bookings) {
        try {
          await this.addBookingToSheet(booking);
          successCount++;
          console.log(`✅ Synced booking ${booking.id}: ${booking.name}`);
        } catch (error) {
          errorCount++;
          console.error(`❌ Failed to sync booking ${booking.id}:`, error);
        }
      }

      console.log(`🎉 Sync completed: ${successCount} success, ${errorCount} errors`);
      return { 
        success: true, 
        message: `Synced ${successCount} bookings successfully`, 
        successCount, 
        errorCount 
      };

    } catch (error: any) {
      console.error('❌ Error during bulk sync:', error);
      return { success: false, message: error?.message || 'Bulk sync failed' };
    }
  }

  async updateBookingPaymentStatus(bookingId: number, status: string) {
    try {
      if (!this.spreadsheetId) {
        console.log('Google Sheets not configured for status update');
        return null;
      }

      // Find the row with this booking ID
      const getResponse = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'Sheet1!A:M',
      });

      const rows = getResponse.data.values || [];
      const rowIndex = rows.findIndex((row: any) => row[1] === bookingId.toString());

      if (rowIndex !== -1) {
        const range = `Sheet1!K${rowIndex + 1}`;  // Column K for payment status
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range,
          valueInputOption: 'USER_ENTERED',
          resource: {
            values: [[status]],
          },
        });
        console.log(`✅ Updated booking ${bookingId} status to ${status} in Google Sheets`);
        return true;
      } else {
        console.log(`⚠️ Booking ${bookingId} not found in Google Sheets for status update`);
        return false;
      }
    } catch (error) {
      console.error('Error updating booking status in Google Sheets:', error);
      return null;
    }
  }

  async deleteBookingFromSheet(bookingId: number) {
    try {
      if (!this.spreadsheetId) {
        console.log('Google Sheets not configured for booking deletion');
        return null;
      }

      // Find the row with this booking ID
      const getResponse = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'Sheet1!A:M',
      });

      const rows = getResponse.data.values || [];
      const rowIndex = rows.findIndex((row: any) => row[1] === bookingId.toString());

      if (rowIndex !== -1) {
        // Delete the row by clearing its contents and shifting rows up
        await this.sheets.spreadsheets.batchUpdate({
          spreadsheetId: this.spreadsheetId,
          resource: {
            requests: [{
              deleteDimension: {
                range: {
                  sheetId: 0, // First sheet
                  dimension: 'ROWS',
                  startIndex: rowIndex,
                  endIndex: rowIndex + 1
                }
              }
            }]
          }
        });
        console.log(`✅ Deleted booking ${bookingId} from Google Sheets (row ${rowIndex + 1})`);
        return true;
      } else {
        console.log(`⚠️ Booking ${bookingId} not found in Google Sheets for deletion`);
        return false;
      }
    } catch (error) {
      console.error('Error deleting booking from Google Sheets:', error);
      return false;
    }
  } 
}