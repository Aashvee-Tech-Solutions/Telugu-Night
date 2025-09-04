import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/authService';
import { PERMISSIONS } from '@shared/schema';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

// Authentication middleware - verify session token
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '') || 
                  req.cookies?.admin_token;

    if (!token) {
      return res.status(401).json({ 
        message: 'Access denied. No authentication token provided.',
        code: 'NO_TOKEN' 
      });
    }

    const user = await authService.verifySession(token);
    if (!user) {
      return res.status(401).json({ 
        message: 'Access denied. Invalid or expired token.',
        code: 'INVALID_TOKEN' 
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ message: 'Authentication failed' });
  }
};

// Permission-based authorization middleware
export const requirePermission = (permission: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ 
        message: 'Authentication required',
        code: 'NOT_AUTHENTICATED' 
      });
    }

    if (!authService.hasPermission(req.user, permission)) {
      return res.status(403).json({ 
        message: `Access denied. Required permission: ${permission}`,
        code: 'INSUFFICIENT_PERMISSIONS',
        required: permission,
        userRole: req.user.role
      });
    }

    next();
  };
};

// Role-based authorization middleware
export const requireRole = (roles: string | string[]) => {
  const roleArray = Array.isArray(roles) ? roles : [roles];
  
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ 
        message: 'Authentication required',
        code: 'NOT_AUTHENTICATED' 
      });
    }

    if (!roleArray.includes(req.user.role)) {
      return res.status(403).json({ 
        message: `Access denied. Required role: ${roleArray.join(' or ')}`,
        code: 'INSUFFICIENT_ROLE',
        required: roleArray,
        userRole: req.user.role
      });
    }

    next();
  };
};

// Multiple permissions (user needs ALL of them)
export const requireAllPermissions = (permissions: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ 
        message: 'Authentication required',
        code: 'NOT_AUTHENTICATED' 
      });
    }

    if (!authService.hasAllPermissions(req.user, permissions)) {
      return res.status(403).json({ 
        message: `Access denied. Required permissions: ${permissions.join(', ')}`,
        code: 'INSUFFICIENT_PERMISSIONS',
        required: permissions,
        userRole: req.user.role
      });
    }

    next();
  };
};

// Any permission (user needs at least ONE of them)
export const requireAnyPermission = (permissions: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ 
        message: 'Authentication required',
        code: 'NOT_AUTHENTICATED' 
      });
    }

    if (!authService.hasAnyPermission(req.user, permissions)) {
      return res.status(403).json({ 
        message: `Access denied. Required at least one of: ${permissions.join(', ')}`,
        code: 'INSUFFICIENT_PERMISSIONS',
        required: permissions,
        userRole: req.user.role
      });
    }

    next();
  };
};