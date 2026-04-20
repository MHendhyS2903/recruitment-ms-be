import { Request } from "express";
import { PoolConnection } from "mysql2/promise";

export type UserRole = "SUPER_ADMIN" | "RECRUITER" | "SALES" | "FINANCE";
export type RecruiterStage = "TO_DO" | "READY_TO_INTERVIEW" | "INTERVIEWING";
export type SalesStage = "TO_DO" | "INTERVIEWING";
export type CandidateStatus = "INTERVIEW" | "BACKOUT" | "RESCHEDULE";
export type InterviewStatus = "PROCESS" | "FAILED";

export interface AppError extends Error {
  status?: number;
  code?: string;
  details?: unknown;
}

export interface AuthUser {
  id: number;
  email: string;
  fullName: string;
  role: UserRole;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export type DbConnection = PoolConnection;
