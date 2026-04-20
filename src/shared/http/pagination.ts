import { Request } from "express";
import { PaginationParams } from "../types";

export function getPagination(query: Request["query"]): PaginationParams {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 10, 1), 100);
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}
