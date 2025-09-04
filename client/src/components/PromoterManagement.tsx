import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Plus, Mail, Link2, DollarSign, Users } from 'lucide-react';
import { format } from 'date-fns';

interface Promoter {
  id: number;
  name: string;
  email: string;
  promoCode: string;
  commissionRate: number;
  isActive: boolean;
  createdAt: string;
  totalBookings: number;
  totalRevenue: number;
  commission: number;
}

export default function PromoterManagement() {
  const { toast } = useToast();
  const [newPromoter, setNewPromoter] = useState({
    name: '',
    email: '',
    commissionRate: 0
  });

  const { data: promoters, isLoading } = useQuery({
    queryKey: ['/api/admin/promoters'],
    retry: 1,
  });

  const createPromoterMutation = useMutation({
    mutationFn: async (promoterData: any) => {
      return apiRequest('POST', '/api/admin/promoters', promoterData);
    },
    onSuccess: () => {
      toast({
        title: "Promoter created successfully",
        description: "Credentials have been sent to their email",
      });
      setNewPromoter({ name: '', email: '', commissionRate: 0 });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/promoters'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create promoter",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const togglePromoterMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      return apiRequest('PATCH', `/api/admin/promoters/${id}/toggle`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/promoters'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update promoter",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreatePromoter = () => {
    if (!newPromoter.name || !newPromoter.email) {
      toast({
        title: "Invalid input",
        description: "Name and email are required",
        variant: "destructive",
      });
      return;
    }

    createPromoterMutation.mutate(newPromoter);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Create New Promoter */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Create New Promoter
          </CardTitle>
          <CardDescription>
            Add a new promoter to track referral bookings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="promoter-name">Full Name</Label>
              <Input
                id="promoter-name"
                placeholder="John Doe"
                value={newPromoter.name}
                onChange={(e) => setNewPromoter({ ...newPromoter, name: e.target.value })}
                data-testid="input-promoter-name"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="promoter-email">Email Address</Label>
              <Input
                id="promoter-email"
                type="email"
                placeholder="john@example.com"
                value={newPromoter.email}
                onChange={(e) => setNewPromoter({ ...newPromoter, email: e.target.value })}
                data-testid="input-promoter-email"
              />
            </div>
            
            <div className="space-y-2">
            </div>
          </div>
          
          <Button 
            onClick={handleCreatePromoter}
            disabled={createPromoterMutation.isPending}
            data-testid="button-create-promoter"
          >
            {createPromoterMutation.isPending ? (
              <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full mr-2" />
            ) : (
              <Mail className="w-4 h-4 mr-2" />
            )}
            {createPromoterMutation.isPending ? "Creating..." : "Create Promoter & Send Credentials"}
          </Button>
        </CardContent>
      </Card>

      {/* Promoters List */}
      <Card>
        <CardHeader>
          <CardTitle>Promoter Management</CardTitle>
          <CardDescription>
            View and manage all promoters and their performance
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(promoters as any)?.promoters?.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Promoter Details</TableHead>
                  <TableHead>Promo Code</TableHead>
                  <TableHead>Performance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {((promoters as any)?.promoters || []).map((promoter: Promoter, index: number) => (
                  <TableRow key={promoter.id} data-testid={`row-promoter-${index}`}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{promoter.name}</p>
                        <p className="text-sm text-gray-500">{promoter.email}</p>
                        <p className="text-xs text-gray-400">
                          Joined {format(new Date(promoter.createdAt), 'MMM dd, yyyy')}
                        </p>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono">
                          {promoter.promoCode}
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            const url = `https://events.qlora.in/book?ref=${promoter.promoCode}`;
                            navigator.clipboard.writeText(url);
                            toast({
                              title: "URL copied",
                              description: "Promoter URL copied to clipboard",
                            });
                          }}
                          data-testid={`button-copy-url-${index}`}
                        >
                          <Link2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-blue-500" />
                        <span>{promoter.totalBookings} bookings</span>
                      </div>
                      <p className="text-xs text-gray-500">
                        ₹{Number(promoter.totalRevenue || 0).toFixed(2)} total revenue
                      </p>
                    </TableCell>
                    
                    <TableCell>
                      <Badge variant={promoter.isActive ? "default" : "secondary"}>
                        {promoter.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    
                    <TableCell>
                      <Button
                        size="sm"
                        variant={promoter.isActive ? "destructive" : "default"}
                        onClick={() => togglePromoterMutation.mutate({ 
                          id: promoter.id, 
                          isActive: !promoter.isActive 
                        })}
                        disabled={togglePromoterMutation.isPending}
                        data-testid={`button-toggle-${index}`}
                      >
                        {promoter.isActive ? "Deactivate" : "Activate"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No promoters found</p>
              <p className="text-sm">Create your first promoter to start tracking referrals!</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}