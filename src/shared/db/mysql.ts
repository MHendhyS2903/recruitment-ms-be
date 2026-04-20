import { RowDataPacket } from "mysql2";

export type DbRow = RowDataPacket & Record<string, unknown>;

export function toIsoOrNull(value: unknown): string | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return new Date(String(value)).toISOString();
}
