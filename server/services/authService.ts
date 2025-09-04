import { storage } from '../databaseStorage';
import { PERMISSIONS, ROLE_PERMISSIONS, type User } from '@shared/schema';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export class AuthService {
  // Create session token
  createToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  // Verify user credentials
  async verifyCredentials(username: string, password: string): Promise<User | null> {
    const user = await storage.getUserByUsername(username);
    if (!user || !user.isActive) return null;
    
    const isValid = bcrypt.compareSync(password, user.password);
    if (!isValid) return null;

    // Update last login
    await storage.updateUserLastLogin(user.id);
    return user;
  }

  // Create admin session
  async createSession(userId: number): Promise<string> {
    const token = this.createToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    await storage.createAdminSession({
      userId,
      token,
      expiresAt,
    });
    
    return token;
  }

  // Verify session token
  async verifySession(token: string): Promise<User | null> {
    const session = await storage.getAdminSessionByToken(token);
    if (!session || session.expiresAt < new Date()) {
      return null;
    }

    const user = await storage.getUser(session.userId);
    if (!user || !user.isActive) {
      return null;
    }

    return user;
  }

  // Check if user has specific permission
  hasPermission(user: User, permission: string): boolean {
    if (!user.isActive) return false;

    // Super admin has all permissions
    if (user.role === 'super_admin') return true;

    // Check role-based permissions
    const rolePermissions = ROLE_PERMISSIONS[user.role as keyof typeof ROLE_PERMISSIONS] || [];
    if (rolePermissions.includes(permission)) return true;

    // Check custom permissions
    if (user.permissions && user.permissions.includes(permission)) return true;

    return false;
  }

  // Check multiple permissions (user needs ALL of them)
  hasAllPermissions(user: User, permissions: string[]): boolean {
    return permissions.every(permission => this.hasPermission(user, permission));
  }

  // Check if user has any of the specified permissions
  hasAnyPermission(user: User, permissions: string[]): boolean {
    return permissions.some(permission => this.hasPermission(user, permission));
  }

  // Get user's effective permissions (role + custom)
  getUserPermissions(user: User): string[] {
    if (!user.isActive) return [];
    
    const rolePermissions = ROLE_PERMISSIONS[user.role as keyof typeof ROLE_PERMISSIONS] || [];
    const customPermissions = user.permissions || [];
    
    // Combine and deduplicate
    return [...new Set([...rolePermissions, ...customPermissions])];
  }

  // Clean expired sessions
  async cleanExpiredSessions(): Promise<void> {
    await storage.deleteExpiredSessions();
  }

  // Logout user (delete session)
  async logout(token: string): Promise<void> {
    await storage.deleteAdminSessionByToken(token);
  }
}

export const authService = new AuthService();