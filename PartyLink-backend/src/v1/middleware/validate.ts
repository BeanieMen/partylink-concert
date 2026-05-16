import { type NextFunction, type Request, type Response } from 'express';
import { type AnyZodObject, ZodError } from 'zod';
import { HttpError } from '../types/http';

export function validate(schema: {
  body?: AnyZodObject;
  params?: AnyZodObject;
  query?: AnyZodObject;
}) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schema.body) schema.body.parse(req.body);
      if (schema.params) schema.params.parse(req.params);
      if (schema.query) schema.query.parse(req.query);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(new HttpError(400, 'VALIDATION_ERROR', 'Invalid request payload', error.issues));
        return;
      }

      next(error);
    }
  };
}
