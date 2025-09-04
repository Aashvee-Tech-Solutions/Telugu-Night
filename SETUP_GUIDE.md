# Telugu Night Event Management System - Complete Setup Guide

## 🎯 System Overview
Your complete Telugu Night event management system is now ready with:
- ✅ **Google Sheets Integration** - All bookings automatically saved 
- ✅ **Email Service** - Hostinger SMTP configured (mis@aashveetech.com)
- ✅ **QR Code Generation** - Automatic ticket generation
- ✅ **Admin Dashboard** - Full booking management
- ✅ **Scanner System** - QR code scanning for event entry
- ✅ **Payment Processing** - UPI integration with screenshot upload
- ✅ **Google Calendar** - Event management integration

## 📋 Quick Setup Steps

### Step 1: Google Sheets Setup
1. **Create a Google Sheet** for storing booking data
2. **Share the sheet** with: `telugunight@eng-skyline-326301.iam.gserviceaccount.com`
3. **Give Editor permissions** to the service account
4. **Copy the Sheet ID** from the URL: `https://docs.google.com/spreadsheets/d/[SHEET_ID]/edit`
5. **Update the environment variable**: Set `GOOGLE_SHEETS_ID` to your sheet ID

### Step 2: Admin Access
- **Admin Login URL**: `/admin`
- **Username**: `admin`
- **Password**: `TeluguNight2024`

### Step 3: Scanner Access
- **Scanner URL**: `/scanner`
- Available for manual ID entry or camera QR scanning

## 🔧 System Features

### Booking System
- **Main booking page**: `/` (root URL)
- **Special pricing**: 11 tickets for price of 10 (₹300 per ticket)
- **Coupon system**: Automatic discount application
- **UPI payment**: Direct to 6281614117@ptsbi
- **Screenshot upload**: Payment proof with Google Sheets storage

### Admin Dashboard (`/admin`)
- **View all bookings** with status tracking
- **Payment verification** - Approve/reject payments
- **Send tickets** - Email tickets with QR codes
- **Real-time statistics** - Pending, verified, scanned counts
- **Google Sheets integration** - All data automatically backed up

### Scanner System (`/scanner`)
- **QR code scanning** - Camera-based ticket verification
- **Manual entry** - Fallback booking ID verification
- **Guest check-in** - Complete booking details display
- **Real-time tracking** - Recent scans display

### Email System
- **Automatic confirmation** emails after booking
- **Ticket delivery** emails with QR codes after verification
- **Hostinger SMTP** - Professional email delivery

## 📧 Email Configuration (Already Setup)
- **SMTP Host**: smtp.hostinger.com
- **Port**: 587
- **Username**: mis@aashveetech.com
- **Password**: Mis@1234@1234

## 📊 Google Sheets Structure
The system automatically creates these columns:
1. Timestamp
2. Booking ID
3. Name
4. Email
5. Phone
6. Ticket Count
7. Guests
8. Coupon Code
9. Coupon Discount
10. Total Amount
11. Payment Status
12. Payment Screenshot URL

## 🗓️ Google Calendar Integration
- **Automatic event creation** in Google Calendar
- **Timezone**: Asia/Kolkata
- **Event reminders** - Email (24h) and Popup (10min)

## 🔒 Security Features
- **Admin authentication** - Simple login system
- **Payment verification** - Manual approval process
- **QR code validation** - Prevents duplicate scans
- **Secure file uploads** - Image-only uploads with size limits

## 🚀 Next Steps

1. **Test the booking system** by making a sample booking
2. **Access admin dashboard** at `/admin` to verify booking appears
3. **Test email delivery** by verifying a payment
4. **Test scanner** at `/scanner` with generated QR codes
5. **Set up your Google Sheet** with the provided service account

## 📱 Mobile-Friendly
- **Responsive design** - Works on all devices
- **Touch-friendly scanner** - Easy QR code scanning
- **Mobile admin panel** - Manage bookings on the go

## 🎫 Ticket Flow
1. **Customer books** tickets with payment screenshot
2. **Admin verifies** payment in dashboard
3. **System generates** QR code and sends email
4. **Scanner validates** QR code at event entrance
5. **Google Sheets** records all activity

Your Telugu Night event management system is ready to use! 🎉