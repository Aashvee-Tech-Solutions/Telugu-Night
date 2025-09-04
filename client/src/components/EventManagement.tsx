import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Calendar, MapPin, Users, Trash2, Settings } from "lucide-react";

interface Event {
  id: number;
  title: string;
  description: string;
  venue: string;
  eventDate: string;
  vendorId: number;
  isActive: boolean;
  maxCapacity: number;
  createdAt: string;
}

interface EventPhase {
  id: number;
  eventId: number;
  phaseName: string;
  phaseOrder: number;
  isActive: boolean;
  maxTickets: number;
  soldTickets: number;
  startDate: string;
  endDate: string;
}

interface TicketType {
  id: number;
  eventId: number;
  phaseId: number;
  typeName: string;
  price: number;
  isActive: boolean;
  maxQuantity: number;
  soldQuantity: number;
  description: string;
}

export default function EventManagement() {
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    venue: '',
    eventDate: '',
    maxCapacity: 500
  });
  
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [newPhase, setNewPhase] = useState({
    phaseName: '',
    phaseOrder: 1,
    maxTickets: 100,
    startDate: '',
    endDate: ''
  });
  
  const [newTicketType, setNewTicketType] = useState({
    phaseId: 0,
    typeName: '',
    price: 0,
    maxQuantity: 100,
    description: ''
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch events
  const { data: events, isLoading: eventsLoading } = useQuery({
    queryKey: ['/api/events'],
    queryFn: async () => {
      const token = localStorage.getItem('adminToken');
      const response = await fetch('/api/events', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch events');
      return response.json();
    },
  });

  // Fetch phases for selected event
  const { data: phases } = useQuery({
    queryKey: ['/api/events', selectedEvent?.id, 'phases'],
    queryFn: async () => {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`/api/events/${selectedEvent?.id}/phases`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch phases');
      return response.json();
    },
    enabled: !!selectedEvent,
  });

  // Fetch ticket types for selected event
  const { data: ticketTypes } = useQuery({
    queryKey: ['/api/events', selectedEvent?.id, 'ticket-types'],
    queryFn: async () => {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`/api/events/${selectedEvent?.id}/ticket-types`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch ticket types');
      return response.json();
    },
    enabled: !!selectedEvent,
  });

  // Create event mutation
  const createEventMutation = useMutation({
    mutationFn: async (eventData: any) => {
      const token = localStorage.getItem('adminToken');
      const response = await fetch('/api/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(eventData)
      });
      if (!response.ok) throw new Error('Failed to create event');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      setNewEvent({ title: '', description: '', venue: '', eventDate: '', maxCapacity: 500 });
      toast({ title: 'Success', description: 'Event created successfully' });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to create event',
        variant: 'destructive' 
      });
    },
  });

  // Create phase mutation
  const createPhaseMutation = useMutation({
    mutationFn: async (phaseData: any) => {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`/api/events/${selectedEvent?.id}/phases`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(phaseData)
      });
      if (!response.ok) throw new Error('Failed to create phase');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/events', selectedEvent?.id, 'phases'] });
      setNewPhase({ phaseName: '', phaseOrder: 1, maxTickets: 100, startDate: '', endDate: '' });
      toast({ title: 'Success', description: 'Phase created successfully' });
    },
  });

  // Create ticket type mutation
  const createTicketTypeMutation = useMutation({
    mutationFn: async (ticketData: any) => {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`/api/events/${selectedEvent?.id}/ticket-types`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(ticketData)
      });
      if (!response.ok) throw new Error('Failed to create ticket type');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/events', selectedEvent?.id, 'ticket-types'] });
      setNewTicketType({ phaseId: 0, typeName: '', price: 0, maxQuantity: 100, description: '' });
      toast({ title: 'Success', description: 'Ticket type created successfully' });
    },
  });

  return (
    <div className="space-y-6">
      {/* Events List */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Events Management</CardTitle>
              <CardDescription>Manage events, phases, and ticket types</CardDescription>
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <Button data-testid="button-create-event">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Event
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Event</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Event Title</Label>
                    <Input
                      value={newEvent.title}
                      onChange={(e) => setNewEvent(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Enter event title"
                      data-testid="input-event-title"
                    />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Textarea
                      value={newEvent.description}
                      onChange={(e) => setNewEvent(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Event description"
                    />
                  </div>
                  <div>
                    <Label>Venue</Label>
                    <Input
                      value={newEvent.venue}
                      onChange={(e) => setNewEvent(prev => ({ ...prev, venue: e.target.value }))}
                      placeholder="Event venue"
                    />
                  </div>
                  <div>
                    <Label>Event Date</Label>
                    <Input
                      type="datetime-local"
                      value={newEvent.eventDate}
                      onChange={(e) => setNewEvent(prev => ({ ...prev, eventDate: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Max Capacity</Label>
                    <Input
                      type="number"
                      value={newEvent.maxCapacity}
                      onChange={(e) => setNewEvent(prev => ({ ...prev, maxCapacity: parseInt(e.target.value) }))}
                    />
                  </div>
                  <Button 
                    onClick={() => createEventMutation.mutate(newEvent)}
                    disabled={createEventMutation.isPending}
                    className="w-full"
                  >
                    {createEventMutation.isPending ? 'Creating...' : 'Create Event'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {eventsLoading ? (
            <div className="flex justify-center p-8">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {events?.map((event: Event) => (
                <Card key={event.id} className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setSelectedEvent(event)}>
                  <CardHeader>
                    <CardTitle className="text-lg">{event.title}</CardTitle>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      {new Date(event.eventDate).toLocaleDateString()}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="w-4 h-4" />
                      {event.venue}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between items-center">
                      <Badge variant={event.isActive ? "default" : "secondary"}>
                        {event.isActive ? "Active" : "Inactive"}
                      </Badge>
                      <div className="flex items-center gap-1 text-sm">
                        <Users className="w-4 h-4" />
                        {event.maxCapacity}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selected Event Management */}
      {selectedEvent && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Managing: {selectedEvent.title}</CardTitle>
                <CardDescription>Configure phases and ticket types</CardDescription>
              </div>
              <Button variant="outline" onClick={() => setSelectedEvent(null)}>
                Close
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Phases Section */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Event Phases</h3>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Phase
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Event Phase</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Phase Name</Label>
                        <Input
                          value={newPhase.phaseName}
                          onChange={(e) => setNewPhase(prev => ({ ...prev, phaseName: e.target.value }))}
                          placeholder="e.g., Early Bird, Phase 1, VIP"
                        />
                      </div>
                      <div>
                        <Label>Phase Order</Label>
                        <Input
                          type="number"
                          value={newPhase.phaseOrder}
                          onChange={(e) => setNewPhase(prev => ({ ...prev, phaseOrder: parseInt(e.target.value) }))}
                        />
                      </div>
                      <div>
                        <Label>Max Tickets</Label>
                        <Input
                          type="number"
                          value={newPhase.maxTickets}
                          onChange={(e) => setNewPhase(prev => ({ ...prev, maxTickets: parseInt(e.target.value) }))}
                        />
                      </div>
                      <div>
                        <Label>Start Date</Label>
                        <Input
                          type="datetime-local"
                          value={newPhase.startDate}
                          onChange={(e) => setNewPhase(prev => ({ ...prev, startDate: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label>End Date</Label>
                        <Input
                          type="datetime-local"
                          value={newPhase.endDate}
                          onChange={(e) => setNewPhase(prev => ({ ...prev, endDate: e.target.value }))}
                        />
                      </div>
                      <Button 
                        onClick={() => createPhaseMutation.mutate(newPhase)}
                        disabled={createPhaseMutation.isPending}
                        className="w-full"
                      >
                        {createPhaseMutation.isPending ? 'Creating...' : 'Create Phase'}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {phases?.map((phase: EventPhase) => (
                  <Card key={phase.id}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-semibold">{phase.phaseName}</h4>
                          <p className="text-sm text-muted-foreground">Order: {phase.phaseOrder}</p>
                          <p className="text-sm text-muted-foreground">
                            {phase.soldTickets}/{phase.maxTickets} tickets sold
                          </p>
                        </div>
                        <Badge variant={phase.isActive ? "default" : "secondary"}>
                          {phase.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Ticket Types Section */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Ticket Types</h3>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Ticket Type
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Ticket Type</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Ticket Name</Label>
                        <Input
                          value={newTicketType.typeName}
                          onChange={(e) => setNewTicketType(prev => ({ ...prev, typeName: e.target.value }))}
                          placeholder="e.g., General, VIP, Student"
                        />
                      </div>
                      <div>
                        <Label>Price (₹)</Label>
                        <Input
                          type="number"
                          value={newTicketType.price}
                          onChange={(e) => setNewTicketType(prev => ({ ...prev, price: parseFloat(e.target.value) }))}
                        />
                      </div>
                      <div>
                        <Label>Max Quantity</Label>
                        <Input
                          type="number"
                          value={newTicketType.maxQuantity}
                          onChange={(e) => setNewTicketType(prev => ({ ...prev, maxQuantity: parseInt(e.target.value) }))}
                        />
                      </div>
                      <div>
                        <Label>Description</Label>
                        <Textarea
                          value={newTicketType.description}
                          onChange={(e) => setNewTicketType(prev => ({ ...prev, description: e.target.value }))}
                          placeholder="Ticket type description"
                        />
                      </div>
                      <Button 
                        onClick={() => createTicketTypeMutation.mutate(newTicketType)}
                        disabled={createTicketTypeMutation.isPending}
                        className="w-full"
                      >
                        {createTicketTypeMutation.isPending ? 'Creating...' : 'Create Ticket Type'}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {ticketTypes?.map((ticket: TicketType) => (
                  <Card key={ticket.id}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-semibold">{ticket.typeName}</h4>
                          <p className="text-lg font-bold text-green-600">₹{ticket.price}</p>
                          <p className="text-sm text-muted-foreground">
                            {ticket.soldQuantity}/{ticket.maxQuantity} sold
                          </p>
                          {ticket.description && (
                            <p className="text-xs text-muted-foreground mt-2">{ticket.description}</p>
                          )}
                        </div>
                        <Badge variant={ticket.isActive ? "default" : "secondary"}>
                          {ticket.isActive ? "Available" : "Disabled"}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}