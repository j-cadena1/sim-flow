import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import DOMPurify from 'isomorphic-dompurify';

// Sanitize input helper
export const sanitize = (input: string): string => {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  }).trim();
};

// Validation schemas
export const createRequestSchema = z.object({
  title: z.string().min(3).max(255).transform(sanitize),
  description: z.string().min(10).max(5000).transform(sanitize),
  vendor: z.string().min(1).max(100).transform(sanitize),
  priority: z.enum(['Low', 'Medium', 'High']),
});

export const updateStatusSchema = z.object({
  status: z.enum([
    'Submitted',
    'Feasibility Review',
    'Resource Allocation',
    'Engineering Review',
    'In Progress',
    'Completed',
    'Revision Requested',
    'Accepted',
    'Denied',
  ]),
});

export const assignEngineerSchema = z.object({
  engineerId: z.string().uuid(),
  estimatedHours: z.number().int().min(1).max(1000),
});

export const addCommentSchema = z.object({
  content: z.string().min(1).max(2000).transform(sanitize),
});

// Validation middleware factory
export const validate = (schema: z.ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors,
        });
      }
      next(error);
    }
  };
};
