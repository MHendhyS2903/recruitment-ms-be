import { NextFunction, Request, Response } from "express";
import { AppError } from "../shared/types";

function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
): Response | void {
  if (res.headersSent) {
    return next(err);
  }

  const status = err.status || 500;
  return res.status(status).json({
    error: {
      code: err.code || "INTERNAL_ERROR",
      message: err.message || "Internal server error",
      ...(err.details ? { details: err.details } : {}),
    },
  });
}

export default errorHandler;
