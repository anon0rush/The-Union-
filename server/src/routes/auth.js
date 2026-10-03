import crypto from 'node:crypto';
import express from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { requireAuth, signSessionToken } from '../auth.js';
import { HttpError, asyncHandler, validate } from '../http.js';

const CURSOR_COLORS = ['#e11d48', '#db2777', '#9333ea', '#4f46e5', '#2563eb', '#0891b2', '#059669', '#65a30d', '#ca8a04', '#ea580c'];

const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  name: z.string().trim().min(1).max(60),
  password: z.string().min(8, 'must be at least 8 characters').max(128),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(128),
});

export const publicUser = (u) => ({ id: u.id, email: u.email, name: u.name, color: u.color });

export function authRouter({ repo, limit = true }) {
  const router = express.Router();
  // Used to make "unknown email" take as long as "wrong password" (no account enumeration via timing).
  const dummyHash = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), 10);

  const authLimiter = limit
    ? rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Too many attempts, try again later' } })
    : (_req, _res, next) => next();

  router.post('/register', authLimiter, asyncHandler(async (req, res) => {
    const body = validate(registerSchema, req.body);
    if (repo.getUserByEmail(body.email)) throw new HttpError(409, 'An account with this email already exists');

    const user = {
      id: crypto.randomUUID(),
      email: body.email,
      name: body.name,
      passwordHash: await bcrypt.hash(body.password, 12),
      color: CURSOR_COLORS[crypto.randomInt(CURSOR_COLORS.length)],
      createdAt: Date.now(),
    };
    repo.createUser(user);
    res.status(201).json({ token: signSessionToken(user.id), user: publicUser(user) });
  }));

  router.post('/login', authLimiter, asyncHandler(async (req, res) => {
    const body = validate(loginSchema, req.body);
    const user = repo.getUserByEmail(body.email);
    const ok = await bcrypt.compare(body.password, user?.password_hash ?? dummyHash);
    if (!user || !ok) throw new HttpError(401, 'Invalid email or password');
    res.json({ token: signSessionToken(user.id), user: publicUser(user) });
  }));

  router.get('/me', requireAuth(repo), (req, res) => {
    res.json({ user: publicUser(req.user) });
  });

  return router;
}
