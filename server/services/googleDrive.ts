import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

export class GoogleDriveService {
  private drive: any;
  private auth: any;

  constructor() {
    this.initializeAuth();
  }

  private async initializeAuth() {
    try {
      // Initialize Google Drive API with service account
      this.auth = new google.auth.GoogleAuth({
        keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY || './service-account-key.json',
        scopes: [
          'https://www.googleapis.com/auth/drive.file',
          'https://www.googleapis.com/auth/drive'
        ],
      });

      this.drive = google.drive({ version: 'v3', auth: this.auth });
      console.log('✅ Google Drive API initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Google Drive API:', error);
    }
  }

  async uploadScreenshot(file: Express.Multer.File, bookingId: number): Promise<string> {
    try {
      if (!this.drive) {
        await this.initializeAuth();
      }

      // Create unique filename with booking ID
      const timestamp = Date.now();
      const fileExtension = path.extname(file.originalname);
      const fileName = `payment-screenshot-booking-${bookingId}-${timestamp}${fileExtension}`;

      // Upload file to Google Drive
      const response = await this.drive.files.create({
        requestBody: {
          name: fileName,
          parents: [process.env.GOOGLE_DRIVE_FOLDER_ID || 'root'], // Upload to specific folder or root
        },
        media: {
          mimeType: file.mimetype,
          body: fs.createReadStream(file.path),
        },
      });

      const fileId = response.data.id;

      // Make file publicly accessible
      await this.drive.permissions.create({
        fileId: fileId,
        requestBody: {
          role: 'reader',
          type: 'anyone',
        },
      });

      // Generate shareable link
      const shareableLink = `https://drive.google.com/file/d/${fileId}/view`;
      
      console.log(`✅ Screenshot uploaded to Google Drive: ${fileName} -> ${shareableLink}`);
      
      // Clean up local file after upload
      try {
        fs.unlinkSync(file.path);
        console.log(`🗑️ Local file cleaned up: ${file.path}`);
      } catch (cleanupError) {
        console.warn('Warning: Failed to cleanup local file:', cleanupError);
      }

      return shareableLink;
    } catch (error) {
      console.error('❌ Failed to upload to Google Drive:', error);
      throw new Error('Failed to upload screenshot to secure storage');
    }
  }

  async getFileDirectLink(fileId: string): Promise<string> {
    try {
      // Generate direct download link for viewing
      return `https://drive.google.com/uc?id=${fileId}&export=view`;
    } catch (error) {
      console.error('❌ Failed to generate direct link:', error);
      throw new Error('Failed to generate file access link');
    }
  }

  async deleteFile(fileId: string): Promise<boolean> {
    try {
      if (!this.drive) {
        await this.initializeAuth();
      }

      await this.drive.files.delete({
        fileId: fileId,
      });

      console.log(`✅ File deleted from Google Drive: ${fileId}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to delete file from Google Drive:', error);
      return false;
    }
  }

  // Extract file ID from shareable link
  extractFileId(shareableLink: string): string | null {
    const match = shareableLink.match(/\/file\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
  }

  // Test connection to Google Drive
  async testConnection(): Promise<boolean> {
    try {
      if (!this.drive) {
        await this.initializeAuth();
      }

      // Test by listing files in the drive
      const response = await this.drive.files.list({
        pageSize: 1,
      });

      console.log('✅ Google Drive connection test successful');
      return true;
    } catch (error) {
      console.error('❌ Google Drive connection test failed:', error);
      return false;
    }
  }
}