import { Response } from "express";

export function success<T>(res: Response, data: T, meta?: Record<string, unknown>): Response {
  return res.json(meta ? { data, meta } : { data });
}

export function paginated(
  res: Response,
  data: unknown[],
  page: number,
  limit: number,
  totalItems: number
): Response {
  const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / limit);

  return res.json({
    data,
    meta: {
      page,
      limit,
      totalItems,
      totalPages,
    },
  });
}
