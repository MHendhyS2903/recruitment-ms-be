import { NextFunction, Response } from "express";
import createHttpError from "../../utils/httpError";
import { verifyAccessToken } from "./jwt";
import { AuthenticatedRequest, UserRole } from "../types";

export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return next(createHttpError(401, "Authentication required", undefined, "UNAUTHORIZED"));
  }

  const token = authorization.replace("Bearer ", "").trim();

  try {
    req.user = verifyAccessToken(token);
    return next();
  } catch (error) {
    return next(createHttpError(401, "Invalid or expired token", undefined, "UNAUTHORIZED"));
  }
}

export function requireRoles(allowedRoles: UserRole[]) {
  return function roleGuard(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void {
    if (!req.user) {
      return next(createHttpError(401, "Authentication required", undefined, "UNAUTHORIZED"));
    }

    if (req.user.role === "SUPER_ADMIN" || allowedRoles.includes(req.user.role)) {
      return next();
    }

    return next(createHttpError(403, "You are not allowed to access this resource", undefined, "FORBIDDEN"));
  };
}
