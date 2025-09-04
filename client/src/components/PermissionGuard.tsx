import { ReactNode } from "react";

interface PermissionGuardProps {
  permissions: string[];
  userPermissions: string[];
  children: ReactNode;
  fallback?: ReactNode;
  requireAll?: boolean; // If true, user needs ALL permissions. If false, needs ANY
}

export function PermissionGuard({ 
  permissions, 
  userPermissions, 
  children, 
  fallback = null,
  requireAll = false 
}: PermissionGuardProps) {
  const hasPermission = requireAll
    ? permissions.every(p => userPermissions.includes(p))
    : permissions.some(p => userPermissions.includes(p));

  if (!hasPermission) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

interface RoleGuardProps {
  roles: string[];
  userRole: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export function RoleGuard({ 
  roles, 
  userRole, 
  children, 
  fallback = null 
}: RoleGuardProps) {
  if (!roles.includes(userRole)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}