import jwt, { Secret, SignOptions } from "jsonwebtoken";
import { AuthUser } from "../types";

const JWT_SECRET: Secret = process.env.JWT_SECRET || "change-this-secret";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "12h";

export function signAccessToken(user: AuthUser): string {
  const options: SignOptions = {
    expiresIn: JWT_EXPIRES_IN as SignOptions["expiresIn"],
  };

  return jwt.sign(user, JWT_SECRET, options);
}

export function verifyAccessToken(token: string): AuthUser {
  return jwt.verify(token, JWT_SECRET) as AuthUser;
}
