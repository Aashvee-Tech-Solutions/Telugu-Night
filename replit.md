# Event Ticket Booking App

## Overview

A modern event ticket booking application built with React and TypeScript. The app provides a sophisticated landing page for events with an integrated ticket booking system. Currently showcases a "Telugu Night" event with features for ticket purchasing, guest management, coupon application, and payment processing. The application uses a component-based architecture with shadcn/ui components for a polished user interface.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React 18 with TypeScript for type safety and modern development practices.

**Build Tool**: Vite for fast development and optimized production builds.

**Routing**: React Router DOM for client-side navigation with a simple two-page structure (Index and NotFound).

**State Management**: React Query (TanStack Query) for server state management and caching, with React's built-in useState for local component state.

### UI/UX Design System

**Component Library**: shadcn/ui components built on top of Radix UI primitives for accessibility and customization.

**Styling**: Tailwind CSS with a comprehensive design system defined in CSS custom properties using HSL color values.

**Theme**: Dark theme with purple/blue gradient accent colors, custom shadows, and smooth transitions.

**Responsive Design**: Mobile-first approach with responsive breakpoints and mobile-specific hooks.

### Component Structure

**Main Components**:
- `EventLanding`: Primary event showcase component with hero section, features, and booking integration
- `TicketBookingForm`: Multi-step ticket purchasing flow with guest management and payment

**UI Components**: Extensive collection of reusable components including forms, dialogs, cards, buttons, and navigation elements.

### Data Management

**Form Handling**: Controlled components with React Hook Form integration for complex form validation and state management.

**Toast Notifications**: Dual toast system using both shadcn/ui toast and Sonner for user feedback.

**Local Storage**: Browser storage for form persistence and user preferences.

### Development Tools

**Type Safety**: Full TypeScript implementation with strict type checking and custom type definitions.

**Code Organization**: Clean separation of concerns with dedicated directories for components, hooks, pages, and utilities.

**Utility Functions**: Custom utility functions for className merging and common operations.

## External Dependencies

### Core Libraries
- **React Router DOM**: Client-side routing and navigation
- **TanStack React Query**: Server state management and data fetching
- **React Hook Form**: Form state management and validation

### UI Framework
- **Radix UI**: Unstyled, accessible UI primitives for complex components
- **Tailwind CSS**: Utility-first CSS framework for styling
- **Lucide React**: Icon library for consistent iconography
- **class-variance-authority**: Utility for creating variant-based component APIs
- **clsx & tailwind-merge**: Conditional className utilities

### Development Tools
- **Vite**: Build tool and development server
- **TypeScript**: Static type checking
- **ESLint & Prettier**: Code linting and formatting (implied by structure)

### Enhanced UX Libraries
- **Sonner**: Toast notification system
- **Vaul**: Drawer component for mobile interactions
- **Embla Carousel**: Touch-friendly carousel component
- **input-otp**: OTP/PIN input component

### Potential Integrations
The architecture supports easy integration of:
- Payment processing systems (Stripe, PayPal, etc.)
- Email services for ticket confirmation
- Database systems for ticket storage and management
- Authentication providers for user accounts
- Analytics tracking for event insights