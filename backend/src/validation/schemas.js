import { z } from 'zod';
import { ROLES } from '../utils/permissions.js';

const email = z.string().trim().toLowerCase().email().max(254);
const role = z.enum(ROLES);
const title = z.string().trim().min(1).max(200);

export const registerSchema = z.object({
  email,
  name: z.string().trim().min(1).max(60),
  password: z.string().min(8, 'must be at least 8 characters').max(128),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(128),
});

export const createDocumentSchema = z.object({
  title: title.optional(),
  importedFrom: z.string().trim().min(1).max(255).optional(),
});

export const renameDocumentSchema = z.object({ title });

export const addMemberSchema = z.object({ email, role });

export const updateMemberSchema = z.object({ role });

export const createLinkSchema = z.object({
  role,
  expiresInHours: z.number().int().min(1).max(24 * 90).nullable().optional(),
});

export const createVersionSchema = z.object({ label: z.string().trim().min(1).max(120) });
