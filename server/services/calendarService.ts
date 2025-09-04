import { google } from 'googleapis';

export class CalendarService {
  private calendar: any;

  constructor() {
    const credentials = JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS || '{}');
    
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });

    this.calendar = google.calendar({ version: 'v3', auth });
  }

  async createEvent(eventDetails: {
    summary: string;
    description: string;
    startDateTime: string;
    endDateTime: string;
    location: string;
  }) {
    try {
      const event = {
        summary: eventDetails.summary,
        location: eventDetails.location,
        description: eventDetails.description,
        start: {
          dateTime: eventDetails.startDateTime,
          timeZone: 'Asia/Kolkata',
        },
        end: {
          dateTime: eventDetails.endDateTime,
          timeZone: 'Asia/Kolkata',
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 },
            { method: 'popup', minutes: 10 },
          ],
        },
      };

      const response = await this.calendar.events.insert({
        calendarId: 'primary',
        resource: event,
      });

      return response.data;
    } catch (error: any) {
      console.error('Error creating calendar event:', error);
      throw error;
    }
  }

  async getEvents() {
    try {
      const response = await this.calendar.events.list({
        calendarId: 'primary',
        timeMin: new Date().toISOString(),
        maxResults: 10,
        singleEvents: true,
        orderBy: 'startTime',
      });

      return response.data.items || [];
    } catch (error: any) {
      console.error('Error fetching calendar events:', error);
      return [];
    }
  }
}

export const calendarService = new CalendarService();