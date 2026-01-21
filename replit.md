# Replit.md

## Overview
This project is a comprehensive event management system for "Telugu Night 3.0," a Telugu DJ night event scheduled for **January 25, 2026 at 7:00 PM onwards** at **HI-point Lounge (SOHO)**. It automates QR ticket generation and delivery, provides a dynamic admin panel with role-based access control, manages bookings with Cashfree payment processing and automatic webhook verification, integrates with Google Sheets, and handles guest management with unique codes. The system includes a coupon system, multi-phase ticket pricing (Early Bird, Phase 1-4), all built within a monorepo structure separating client, server, and shared components.

## Current Event Details
- **Event**: Telugu Night 3.0
- **Date**: January 25, 2026
- **Time**: 7:00 PM onwards
- **Venue**: HI-point Lounge (SOHO)

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **UI Framework**: shadcn/ui (built on Radix UI)
- **Styling**: Tailwind CSS
- **Routing**: Wouter
- **State Management**: TanStack Query (React Query)
- **Forms**: React Hook Form with Zod validation

### Backend Architecture
- **Runtime**: Node.js with TypeScript (ESM modules)
- **Framework**: Express.js with custom middleware
- **Database**: PostgreSQL with Drizzle ORM
- **Session Management**: PostgreSQL-based sessions with `connect-pg-simple`

### Data Storage
- **Primary Database**: PostgreSQL (configured for Neon Database)
- **ORM**: Drizzle ORM with migrations support
- **Schema Location**: Shared between client and server in `/shared/schema.ts`

### Key Components
- **Client-Side**: Event landing page, multi-step ticket booking form with dynamic pricing and guest management, role-based admin panel, and reusable UI components.
- **Server-Side**: Email service (two-stage), UPI payment processing with QR generation, authentication service (5 permission levels), Google Sheets integration, and storage interface.
- **Shared**: Database schema and TypeScript types, including role-based permissions.

### Data Flow
Client requests (TanStack Query) are processed by Express.js, which interacts with the PostgreSQL database via Drizzle ORM, returning JSON responses to the client.

### Core Features
- Automated QR ticket generation and delivery.
- Dynamic admin panel with 5 role-based access levels.
- Multi-login system.
- Booking management with mandatory payment screenshot upload and verification.
- Two-stage email notifications (payment confirmation and QR ticket delivery).
- Guest management with unique 6-digit alphanumeric codes and individual scan tracking.
- Coupon system.
- UPI payment processing with app-specific links and manual entry options.
- Automated data synchronization with Google Sheets (including reset and fresh sync).
- Comprehensive scanner for event entry, supporting individual guest check-in and duplicate scan prevention.
- Dynamic ticket pricing based on phases (Early Bird, Phase 1, Phase 2, Phase 3, Phase 4) with mutual exclusivity and admin controls.
- Real-time attendance tracking and dashboard analytics.
- Persistent storage using PostgreSQL.
- Google Calendar integration for event attendees.
- Public storage for payment screenshots.

## External Dependencies

### Database
- **Neon Database**: PostgreSQL hosting service.
- **Connection**: `@neondatabase/serverless` driver.

### UI Libraries
- **Radix UI**: Accessible component primitives.
- **Lucide React**: Icon library.
- **Embla Carousel**: Carousel component.
- **Date-fns**: Date manipulation utilities.

### Payment
- **Cashfree**: Payment gateway with automatic webhook processing for instant ticket verification.
- **UPI**: UPI app integration (PhonePe, Paytm, Google Pay, BHIM).

### Email
- **SMTP**: External SMTP service for email delivery.

### Google Services
- **Google Sheets API**: For data synchronization.
- **Google Calendar API**: For event integration.

### Development Tools
- **Replit Integration**: Custom Vite plugins.
- **TypeScript**: For type safety.
- **ESBuild**: For production bundling.
- **Multer**: For handling multipart/form-data, primarily file uploads.
- **qr-scanner**: For QR code detection.