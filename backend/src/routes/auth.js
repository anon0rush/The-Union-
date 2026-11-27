import crypto from 'node:crypto';
import express from 'express';
import bcrypt from 'bcryptjs';
import { requireAuth } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/HttpError.js';
import { signSessionToken } from '../utils/tokens.js';
import { loginSchema, registerSchema } from '../validation/schemas.js';

const BCRYPT_ROUNDS = 12;
const CURSOR_COLORS = ['#e11d48', '#db2777', '#9333ea', '#4f46e5', '#2563eb', '#0891b2', '#059669', '#65a30d', '#ca8a04', '#ea580c'];

const toPublicUser = (u) => ({ id: u.id, email: u.email, name: u.name, color: u.color });

export function authRouter({ repo, rateLimits = true }) {
  const router = express.Router();
  const limiter = authLimiter(rateLimits);
  const timingSafeHash = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), 10);

  router.post('/register', limiter, asyncHandler(async (req, res) => {
    const body = validate(registerSchema, req.body);
    if (repo.getUserByEmail(body.email)) throw new HttpError(409, 'An account with this email already exists');

    const user = {
      id: crypto.randomUUID(),
      email: body.email,
      name: body.name,
      passwordHash: await bcrypt.hash(body.password, BCRYPT_ROUNDS),
      color: CURSOR_COLORS[crypto.randomInt(CURSOR_COLORS.length)],
      createdAt: Date.now(),
    };
    repo.createUser(user);
    res.status(201).json({ token: signSessionToken(user.id), user: toPublicUser(user) });
  }));

  router.post('/login', limiter, asyncHandler(async (req, res) => {
    const body = validate(loginSchema, req.body);
    const user = repo.getUserByEmail(body.email);
    const valid = await bcrypt.compare(body.password, user?.password_hash ?? timingSafeHash);
    if (!user || !valid) throw new HttpError(401, 'Invalid email or password');
    res.json({ token: signSessionToken(user.id), user: toPublicUser(user) });
  }));

  router.get('/me', requireAuth(repo), (req, res) => {
    res.json({ user: toPublicUser(req.user) });
  });

  return router;
}
