import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu, X, Home, Users, Settings, BarChart3, Ticket, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobileNavigationProps {
  currentPage?: string;
  onNavigate?: (page: string) => void;
  userPermissions?: string[];
  className?: string;
}

export function MobileNavigation({ 
  currentPage, 
  onNavigate, 
  userPermissions = [], 
  className 
}: MobileNavigationProps) {
  const [isOpen, setIsOpen] = useState(false);

  const navigationItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: Home,
      href: '/admin',
      permission: 'READ_BOOKINGS'
    },
    {
      id: 'bookings',
      label: 'Bookings',
      icon: Ticket,
      href: '/admin/bookings',
      permission: 'READ_BOOKINGS'
    },
    {
      id: 'users',
      label: 'Users',
      icon: Users,
      href: '/admin/users',
      permission: 'MANAGE_USERS'
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: BarChart3,
      href: '/admin/analytics',
      permission: 'VIEW_ANALYTICS'
    },
    {
      id: 'promoters',
      label: 'Promoters',
      icon: Star,
      href: '/admin/promoters',
      permission: 'MANAGE_PROMOTERS'
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      href: '/admin/settings',
      permission: 'SYSTEM_SETTINGS'
    }
  ];

  const hasPermission = (permission: string) => {
    return userPermissions.includes(permission) || userPermissions.includes('ADMIN');
  };

  const handleNavigate = (page: string, href: string) => {
    setIsOpen(false);
    if (onNavigate) {
      onNavigate(page);
    } else {
      window.location.href = href;
    }
  };

  return (
    <div className={cn("mobile-only", className)}>
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-md"
            data-testid="mobile-menu-trigger"
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Open navigation menu</span>
          </Button>
        </SheetTrigger>
        
        <SheetContent side="left" className="w-64 p-0">
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Navigation</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Navigation Items */}
            <nav className="flex-1 p-4">
              <ul className="space-y-2">
                {navigationItems
                  .filter(item => hasPermission(item.permission))
                  .map((item) => {
                    const Icon = item.icon;
                    const isActive = currentPage === item.id;
                    
                    return (
                      <li key={item.id}>
                        <Button
                          variant={isActive ? "secondary" : "ghost"}
                          className={cn(
                            "w-full justify-start gap-3 h-11",
                            isActive && "bg-primary/10 text-primary font-medium"
                          )}
                          onClick={() => handleNavigate(item.id, item.href)}
                          data-testid={`nav-${item.id}`}
                        >
                          <Icon className="h-4 w-4" />
                          {item.label}
                        </Button>
                      </li>
                    );
                  })}
              </ul>
            </nav>
            
            {/* Footer */}
            <div className="p-4 border-t bg-muted/50">
              <p className="text-xs text-muted-foreground text-center">
                Telugu Night Admin
              </p>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// Desktop navigation for larger screens
export function DesktopNavigation({ 
  currentPage, 
  onNavigate, 
  userPermissions = [], 
  className 
}: MobileNavigationProps) {
  const navigationItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: Home,
      href: '/admin',
      permission: 'READ_BOOKINGS'
    },
    {
      id: 'bookings',
      label: 'Bookings',
      icon: Ticket,
      href: '/admin/bookings',
      permission: 'READ_BOOKINGS'
    },
    {
      id: 'users',
      label: 'Users',
      icon: Users,
      href: '/admin/users',
      permission: 'MANAGE_USERS'
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: BarChart3,
      href: '/admin/analytics',
      permission: 'VIEW_ANALYTICS'
    },
    {
      id: 'promoters',
      label: 'Promoters',
      icon: Star,
      href: '/admin/promoters',
      permission: 'MANAGE_PROMOTERS'
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      href: '/admin/settings',
      permission: 'SYSTEM_SETTINGS'
    }
  ];

  const hasPermission = (permission: string) => {
    return userPermissions.includes(permission) || userPermissions.includes('ADMIN');
  };

  const handleNavigate = (page: string, href: string) => {
    if (onNavigate) {
      onNavigate(page);
    } else {
      window.location.href = href;
    }
  };

  return (
    <nav className={cn("mobile-hidden", className)}>
      <ul className="flex space-x-1">
        {navigationItems
          .filter(item => hasPermission(item.permission))
          .map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            
            return (
              <li key={item.id}>
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  className={cn(
                    "gap-2 h-9",
                    isActive && "bg-primary/10 text-primary font-medium"
                  )}
                  onClick={() => handleNavigate(item.id, item.href)}
                  data-testid={`nav-${item.id}`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="mobile-hidden">{item.label}</span>
                </Button>
              </li>
            );
          })}
      </ul>
    </nav>
  );
}