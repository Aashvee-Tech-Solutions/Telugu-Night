import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Trash2, Tag, Users, AlertCircle, Calendar } from "lucide-react";
import { format } from 'date-fns';

interface Coupon {
  id: number;
  code: string;
  discount: number;
  isActive: boolean;
  usageLimit: number | null;
  usageCount: number;
  validFrom: string | null;
  validTo: string | null;
  createdAt: string;
}

export default function CouponManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [newCoupon, setNewCoupon] = useState({
    code: '',
    discount: 10,
    usageLimit: 50,
    validFrom: '',
    validTo: ''
  });

  // Fetch coupons
  const { data: coupons, isLoading } = useQuery({
    queryKey: ['/api/coupons'],
    retry: 1,
  });

  // Create coupon mutation
  const createCouponMutation = useMutation({
    mutationFn: async (couponData: any) => {
      return apiRequest('POST', '/api/coupons', couponData);
    },
    onSuccess: () => {
      toast({
        title: "Coupon created successfully",
        description: "New coupon is now available for use",
      });
      setNewCoupon({ code: '', discount: 10, usageLimit: 50, validFrom: '', validTo: '' });
      queryClient.invalidateQueries({ queryKey: ['/api/coupons'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create coupon",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Toggle coupon status mutation
  const toggleCouponMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      return apiRequest('PATCH', `/api/coupons/${id}`, { isActive });
    },
    onSuccess: () => {
      toast({
        title: "Coupon status updated",
        description: "Coupon status has been changed successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/coupons'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update coupon",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete coupon mutation
  const deleteCouponMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/coupons/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Coupon deleted",
        description: "Coupon has been removed successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/coupons'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete coupon",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreateCoupon = () => {
    if (!newCoupon.code || newCoupon.discount <= 0) {
      toast({
        title: "Invalid input",
        description: "Coupon code and discount are required",
        variant: "destructive",
      });
      return;
    }

    // Format the coupon data
    const couponData = {
      ...newCoupon,
      code: newCoupon.code.toUpperCase(),
      validFrom: newCoupon.validFrom ? new Date(newCoupon.validFrom).toISOString() : null,
      validTo: newCoupon.validTo ? new Date(newCoupon.validTo).toISOString() : null,
    };

    createCouponMutation.mutate(couponData);
  };

  const getCouponStatus = (coupon: Coupon) => {
    if (!coupon.isActive) return { text: "Inactive", variant: "secondary" as const, color: "text-gray-600" };
    
    const now = new Date();
    const validFrom = coupon.validFrom ? new Date(coupon.validFrom) : null;
    const validTo = coupon.validTo ? new Date(coupon.validTo) : null;
    
    if (validFrom && now < validFrom) {
      return { text: "Scheduled", variant: "outline" as const, color: "text-blue-600" };
    }
    
    if (validTo && now > validTo) {
      return { text: "Expired", variant: "destructive" as const, color: "text-red-600" };
    }
    
    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
      return { text: "Exhausted", variant: "destructive" as const, color: "text-red-600" };
    }
    
    return { text: "Active", variant: "default" as const, color: "text-green-600" };
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
      {/* Create New Coupon */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Create New Coupon
          </CardTitle>
          <CardDescription>
            Add promotional coupons with usage limits and validity periods
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label htmlFor="coupon-code">Coupon Code</Label>
              <Input
                id="coupon-code"
                placeholder="SAVE20"
                value={newCoupon.code}
                onChange={(e) => setNewCoupon({ ...newCoupon, code: e.target.value.toUpperCase() })}
                data-testid="input-coupon-code"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="discount">Discount (%)</Label>
              <Input
                id="discount"
                type="number"
                min="1"
                max="100"
                placeholder="10"
                value={newCoupon.discount}
                onChange={(e) => setNewCoupon({ ...newCoupon, discount: parseInt(e.target.value) || 0 })}
                data-testid="input-discount"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="usage-limit">Usage Limit</Label>
              <Input
                id="usage-limit"
                type="number"
                min="1"
                placeholder="50"
                value={newCoupon.usageLimit}
                onChange={(e) => setNewCoupon({ ...newCoupon, usageLimit: parseInt(e.target.value) || 0 })}
                data-testid="input-usage-limit"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="valid-from">Valid From</Label>
              <Input
                id="valid-from"
                type="datetime-local"
                value={newCoupon.validFrom}
                onChange={(e) => setNewCoupon({ ...newCoupon, validFrom: e.target.value })}
                data-testid="input-valid-from"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="valid-to">Valid To</Label>
              <Input
                id="valid-to"
                type="datetime-local"
                value={newCoupon.validTo}
                onChange={(e) => setNewCoupon({ ...newCoupon, validTo: e.target.value })}
                data-testid="input-valid-to"
              />
            </div>
          </div>
          
          <Button 
            onClick={handleCreateCoupon}
            disabled={createCouponMutation.isPending}
            className="w-full md:w-auto"
            data-testid="button-create-coupon"
          >
            {createCouponMutation.isPending ? (
              <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full mr-2" />
            ) : (
              <Tag className="w-4 h-4 mr-2" />
            )}
            {createCouponMutation.isPending ? "Creating..." : "Create Coupon"}
          </Button>
        </CardContent>
      </Card>

      {/* Coupons List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="w-5 h-5" />
            Coupon Management
          </CardTitle>
          <CardDescription>
            View and manage all promotional coupons
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(coupons as any)?.coupons?.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Coupon Details</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Validity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {((coupons as any)?.coupons || []).map((coupon: Coupon, index: number) => {
                  const status = getCouponStatus(coupon);
                  return (
                    <TableRow key={coupon.id} data-testid={`row-coupon-${index}`}>
                      <TableCell>
                        <div>
                          <p className="font-medium font-mono">{coupon.code}</p>
                          <p className="text-xs text-gray-400">
                            Created {format(new Date(coupon.createdAt), 'MMM dd, yyyy')}
                          </p>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <Badge variant="outline" className="font-semibold">
                          {coupon.discount}% OFF
                        </Badge>
                      </TableCell>
                      
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-blue-500" />
                          <span>{coupon.usageCount}</span>
                          {coupon.usageLimit && (
                            <span className="text-gray-500">/ {coupon.usageLimit}</span>
                          )}
                        </div>
                        {coupon.usageLimit && (
                          <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                            <div 
                              className="bg-blue-600 h-1.5 rounded-full" 
                              style={{ width: `${Math.min((coupon.usageCount / coupon.usageLimit) * 100, 100)}%` }}
                            />
                          </div>
                        )}
                      </TableCell>
                      
                      <TableCell>
                        <div className="text-sm">
                          {coupon.validFrom && (
                            <p className="text-gray-600">
                              From: {format(new Date(coupon.validFrom), 'MMM dd, yyyy')}
                            </p>
                          )}
                          {coupon.validTo && (
                            <p className="text-gray-600">
                              To: {format(new Date(coupon.validTo), 'MMM dd, yyyy')}
                            </p>
                          )}
                          {!coupon.validFrom && !coupon.validTo && (
                            <p className="text-gray-500">No expiry</p>
                          )}
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <Badge variant={status.variant} className={status.color}>
                          {status.text}
                        </Badge>
                      </TableCell>
                      
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant={coupon.isActive ? "outline" : "default"}
                            onClick={() => toggleCouponMutation.mutate({ 
                              id: coupon.id, 
                              isActive: !coupon.isActive 
                            })}
                            disabled={toggleCouponMutation.isPending}
                            data-testid={`button-toggle-coupon-${index}`}
                          >
                            {coupon.isActive ? "Deactivate" : "Activate"}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => deleteCouponMutation.mutate(coupon.id)}
                            disabled={deleteCouponMutation.isPending}
                            data-testid={`button-delete-coupon-${index}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No coupons found</p>
              <p className="text-sm text-gray-400">Create your first promotional coupon to get started</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}