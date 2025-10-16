import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const { JWT_SECRET = '' } = process.env;

if (!JWT_SECRET) {
  console.warn('Warning: JWT_SECRET is not set. Authentication will fail until it is provided.');
}

export interface TokenPayload {
  userId: string;
  email: string;
}

export function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

export function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(payload: TokenPayload): string {
  if (!JWT_SECRET) {
    throw new Error('JWT secret is not configured.');
  }

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '7d'
  });
}

export async function getUserFromToken(authHeader?: string | null): Promise<TokenPayload | null> {
  if (!authHeader || !JWT_SECRET) {
    return null;
  }

  const [, token] = authHeader.split(' ');
  if (!token) {
    return null;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    return decoded;
  } catch (error) {
    console.error('Failed to verify token', error);
    return null;
  }
}
