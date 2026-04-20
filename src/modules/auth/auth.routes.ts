import express from "express";
import bcrypt from "bcryptjs";
import { RowDataPacket } from "mysql2";
import pool from "../../config/database";
import asyncHandler from "../../utils/asyncHandler";
import createHttpError from "../../utils/httpError";
import { requireAuth } from "../../shared/auth/authMiddleware";
import { signAccessToken } from "../../shared/auth/jwt";
import { success } from "../../shared/http/respond";
import { AuthenticatedRequest, AuthUser, UserRole } from "../../shared/types";

const router = express.Router();

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      throw createHttpError(
        400,
        "email and password are required",
        {
          ...(email ? {} : { email: ["email is required"] }),
          ...(password ? {} : { password: ["password is required"] }),
        },
        "VALIDATION_ERROR"
      );
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `
        SELECT id, email, password_hash, full_name, role, is_active
        FROM users
        WHERE email = ?
        LIMIT 1
      `,
      [email]
    );

    if (rows.length === 0) {
      throw createHttpError(401, "Invalid credentials", undefined, "UNAUTHORIZED");
    }

    const userRow = rows[0];
    if (!userRow.is_active) {
      throw createHttpError(403, "User is inactive", undefined, "FORBIDDEN");
    }

    const passwordHash = String(userRow.password_hash);
    const isValidPassword = await bcrypt.compare(password, passwordHash);

    if (!isValidPassword) {
      throw createHttpError(401, "Invalid credentials", undefined, "UNAUTHORIZED");
    }

    await pool.query("UPDATE users SET last_login_at = NOW() WHERE id = ?", [userRow.id]);

    const user: AuthUser = {
      id: Number(userRow.id),
      fullName: String(userRow.full_name),
      email: String(userRow.email),
      role: String(userRow.role) as UserRole,
    };

    return success(res, {
      user,
      token: signAccessToken(user),
    });
  })
);

router.post(
  "/logout",
  requireAuth,
  asyncHandler(async (req, res) => {
    return success(res, { success: true });
  })
);

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.user) {
      throw createHttpError(401, "Authentication required", undefined, "UNAUTHORIZED");
    }

    return success(res, req.user);
  })
);

export default router;
