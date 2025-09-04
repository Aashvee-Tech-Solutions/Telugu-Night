# Telugu Night Event Management System - Complete Overview

## 🎯 What This App Does

### Core Features

#### 1. **Event Ticket Booking System**
- **Multi-step booking form** with personal details, guest information, and coupon application
- **Dynamic pricing calculator** showing real-time totals with discounts
- **Number input for tickets** (1-10 tickets) with proper validation
- **Guest name collection** for events requiring attendee lists
- **Coupon system** with real-time validation and discount application

#### 2. **Payment Processing**
- **UPI payment integration** with QR code generation
- **Payment screenshot upload** for verification
- **Automatic payment link generation** to UPI apps
- **Payment status tracking** (pending → verified → rejected)

#### 3. **Two-Stage Email System**
- **Stage 1: Payment Confirmation** - Sent immediately after booking
- **Stage 2: Ticket Delivery** - Sent after payment verification with QR codes
- **Automated email delivery** using Hostinger SMTP (mis@aashveetech.com)

#### 4. **QR Code & Guest Management**
- **Unique 6-digit guest codes** (alphanumeric: a-z, 0-9) for each ticket
- **QR code generation** for each ticket with unique pass IDs
- **Scannable tickets** for event entry verification
- **Guest code tracking** in admin panel and Google Sheets

#### 5. **Google Sheets Integration**
- **Automatic data sync** to Google Sheets for backup and analysis
- **Guest codes included** in spreadsheet entries
- **Real-time booking updates** to shared spreadsheet

#### 6. **Role-Based Admin Panel**
- **5 Permission Levels:**
  - **Super Admin** - Full system access
  - **Admin** - Most features except user management
  - **Organizer** - Booking and coupon management
  - **Scanner** - QR scanning and verification only
  - **Viewer** - Read-only dashboard access

#### 7. **Security Features**
- **Session-based authentication** with JWT-like tokens
- **Permission-based access control** for different admin functions
- **Secure password hashing** with bcrypt
- **Database session storage** for reliability

---

## 🔐 Admin Access

### Login Credentials
- **URL**: `/farazkivumdha`
- **Username**: `aashvee`
- **Password**: `Rudra@78611`

### Admin Panel Features
- **Dashboard** with booking statistics and recent activity
- **Booking Management** with guest codes and pass IDs display
- **Payment Verification** tools
- **QR Scanner Interface** for event entry
- **Coupon Management** system
- **User Role Management** (Super Admin only)

---

## 💳 Payment Verification Process

### Current Method (Simplified)
1. **Customer books tickets** → Gets UPI payment QR code
2. **Customer pays** via UPI apps → Takes screenshot
3. **Customer uploads screenshot** → System receives proof
4. **Admin verifies payment** → Clicks "Verify" button in admin panel
5. **System automatically sends tickets** → QR codes emailed instantly

### Admin Verification Steps:
1. **Go to Admin Panel** → `/farazkivumdha`
2. **Login** with credentials above
3. **Click "Bookings" tab** → See all pending payments
4. **Review screenshot** → Check payment amount and details
5. **Click "Verify"** → Automatically triggers ticket delivery
6. **Done** → Customer receives QR codes via email

### Alternative: Auto-Verification (Future Enhancement)
- **UPI callback integration** for instant verification
- **Payment gateway APIs** for automated confirmation
- **Bank statement parsing** for bulk verification

---

## 📊 Data Flow

### Booking Process
```
Customer Form → Booking Created → Google Sheets Updated → Payment QR Generated → 
Screenshot Upload → Admin Verification → QR Tickets Emailed
```

### Email Workflow
```
Booking Created → Payment Confirmation Email →
Payment Verified → Ticket Delivery Email (with QR codes)
```

### Admin Workflow
```
Login → Dashboard View → Booking List → Payment Verification → 
QR Code Management → Guest Code Tracking
```

---

## 🛠 Technical Architecture

### Frontend (React + TypeScript)
- **Components**: Booking form, admin panel, QR scanner
- **State Management**: React Query for server state
- **UI Framework**: shadcn/ui with Tailwind CSS
- **Routing**: Wouter for client-side navigation

### Backend (Node.js + Express)
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Session-based with role permissions
- **Email Service**: Nodemailer with Hostinger SMTP
- **File Upload**: Multer for payment screenshots
- **QR Generation**: qrcode library for ticket QR codes

### External Integrations
- **Google Sheets API** for data backup and analysis
- **Hostinger SMTP** for reliable email delivery
- **UPI Payment System** for Indian payment processing

---

## 📈 Capacity & Performance

### Current Limits
- **300+ bookings supported** efficiently
- **10 tickets maximum** per booking
- **Real-time coupon validation**
- **Instant QR code generation**
- **Bulk email processing** capability

### Scalability
- **Database-backed** for reliability
- **Session-based auth** for multiple admin users
- **API-ready** for mobile app integration
- **Modular architecture** for easy feature additions

---

## 🎫 Event Details

### Telugu Night Specifics
- **Base Price**: ₹300 per ticket
- **Special Pricing**: Coupon discounts available
- **Location**: DTR, Manipal
- **Event Type**: Telugu DJ night
- **Capacity**: Unlimited (system supports 300+ efficiently)

This system provides a complete end-to-end solution for event management, from ticket booking to entry verification, with minimal manual intervention required.