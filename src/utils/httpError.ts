import { AppError } from "../shared/types";

function createHttpError(
  status: number,
  message: string,
  details?: unknown,
  code = "INTERNAL_ERROR"
): AppError {
  const error = new Error(message) as AppError;
  error.status = status;
  error.details = details;
  error.code = code;
  return error;
}

export default createHttpError;
