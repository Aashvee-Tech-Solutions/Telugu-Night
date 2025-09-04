import express from 'express';
import path from 'path';

// Middleware to serve uploaded files with proper MIME types
export function serveUploads(app: express.Application) {
  // Serve uploaded files statically
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads'), {
    maxAge: '1d', // Cache for 1 day
    setHeaders: (res, filePath) => {
      // Set proper MIME types for images
      const ext = path.extname(filePath).toLowerCase();
      
      switch (ext) {
        case '.jpg':
        case '.jpeg':
          res.setHeader('Content-Type', 'image/jpeg');
          break;
        case '.png':
          res.setHeader('Content-Type', 'image/png');
          break;
        case '.gif':
          res.setHeader('Content-Type', 'image/gif');
          break;
        case '.webp':
          res.setHeader('Content-Type', 'image/webp');
          break;
        default:
          res.setHeader('Content-Type', 'application/octet-stream');
      }
      
      // Allow cross-origin requests for images
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET');
    }
  }));
  
  console.log('✅ Upload middleware configured - screenshots accessible at /uploads/*');
}