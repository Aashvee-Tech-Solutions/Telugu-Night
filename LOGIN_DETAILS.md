# Telugu Night Admin Login Details

## Admin Dashboard Access

**URL:** `/farazkivumdha`
**Username:** `aashvee`
**Password:** `Rudra@78611`

## Admin Features Available:
- View all bookings and payment screenshots
- Manually verify payments 
- Generate and send QR tickets via "Verify & Send QR" button
- View guest codes and booking details
- Access scanner functionality at `/scanner`

## Scanner Access
**URL:** `/scanner`
- Camera-based QR code scanning
- Manual guest code entry fallback
- Real-time entry verification

## Production Domain
All screenshot URLs and links use: `events.qlora.in`

## Test Coupon Codes
- `SAVE10` - 10% discount
- `EARLY20` - 20% discount  
- `VIP25` - 25% discount
- `STUDENT15` - 15% discount

## Latest Updates:
- ✅ **LOGIN ISSUE RESOLVED**: Admin authentication now working perfectly!
- ✅ **Google Calendar Integration**: QR ticket emails now include "Add to Calendar" button
- ✅ **Enhanced QR Codes**: Each guest gets unique QR code embedded in email
- ✅ **Auto Calendar Event**: Clicking button adds Telugu Night event to Google Calendar
- ✅ **Database Persistence**: All data stored in PostgreSQL, survives redeployments

## Key Notes:
- QR tickets are only sent via manual "Generate Ticket" button in admin panel
- Minimum 1 ticket required for booking (frontend validation active)
- All booking data persists in PostgreSQL database
- Screenshot upload workflow: Upload → View → Verify → Generate QR → Email sent
- **New**: QR ticket emails include Google Calendar integration