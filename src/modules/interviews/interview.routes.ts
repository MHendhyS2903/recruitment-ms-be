import express from "express";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import pool from "../../config/database";
import asyncHandler from "../../utils/asyncHandler";
import createHttpError from "../../utils/httpError";
import { requireAuth } from "../../shared/auth/authMiddleware";
import { getPagination } from "../../shared/http/pagination";
import { paginated, success } from "../../shared/http/respond";
import { AuthenticatedRequest } from "../../shared/types";
import { toIsoOrNull } from "../../shared/db/mysql";

const router = express.Router();

function mapInterview(row: RowDataPacket) {
  return {
    id: Number(row.id),
    candidateId: Number(row.candidate_id),
    candidateName: String(row.candidate_name),
    role: String(row.applied_role),
    candidateStatus: String(row.candidate_status),
    scheduledAt: toIsoOrNull(row.scheduled_at),
    owner: row.owner_user_id
      ? {
          id: Number(row.owner_user_id),
          fullName: row.owner_full_name
            ? String(row.owner_full_name)
            : row.owner_name_snapshot
              ? String(row.owner_name_snapshot)
              : null,
        }
      : null,
    meetingLink: String(row.meeting_link),
    host: row.host_user_id
      ? {
          id: Number(row.host_user_id),
          fullName: row.host_full_name
            ? String(row.host_full_name)
            : row.host_name_snapshot
              ? String(row.host_name_snapshot)
              : null,
        }
      : null,
    interviewStatus: String(row.interview_status),
    notes: row.notes ? String(row.notes) : null,
  };
}

router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = getPagination(req.query);
    const clauses: string[] = [];
    const params: unknown[] = [];

    if (req.query.search) {
      clauses.push(
        "(c.full_name LIKE ? OR c.applied_role LIKE ? OR uo.full_name LIKE ? OR uh.full_name LIKE ?)"
      );
      const keyword = `%${String(req.query.search)}%`;
      params.push(keyword, keyword, keyword, keyword);
    }

    if (req.query.candidateStatus) {
      clauses.push("i.candidate_status = ?");
      params.push(req.query.candidateStatus);
    }

    if (req.query.interviewStatus) {
      clauses.push("i.interview_status = ?");
      params.push(req.query.interviewStatus);
    }

    if (req.query.ownerUserId) {
      clauses.push("i.owner_user_id = ?");
      params.push(req.query.ownerUserId);
    }

    if (req.query.scheduledDate) {
      clauses.push("DATE(i.scheduled_at) = ?");
      params.push(req.query.scheduledDate);
    }

    const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";

    const baseSql = `
      FROM interviews i
      INNER JOIN candidates c ON c.id = i.candidate_id
      LEFT JOIN users uo ON uo.id = i.owner_user_id
      LEFT JOIN users uh ON uh.id = i.host_user_id
      ${whereSql}
    `;

    const [rows] = await pool.query<RowDataPacket[]>(
      `
        SELECT
          i.id,
          i.candidate_id,
          c.full_name AS candidate_name,
          c.applied_role,
          i.candidate_status,
          i.scheduled_at,
          i.owner_user_id,
          i.owner_name_snapshot,
          uo.full_name AS owner_full_name,
          i.meeting_link,
          i.host_user_id,
          i.host_name_snapshot,
          uh.full_name AS host_full_name,
          i.interview_status,
          i.notes
        ${baseSql}
        ORDER BY i.scheduled_at DESC
        LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    );

    const [countRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total ${baseSql}`,
      params
    );

    return paginated(res, rows.map(mapInterview), page, limit, Number(countRows[0].total));
  })
);

router.get(
  "/:interviewId",
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query<RowDataPacket[]>(
      `
        SELECT
          i.*,
          c.full_name AS candidate_name,
          c.applied_role,
          uo.full_name AS owner_full_name,
          uh.full_name AS host_full_name
        FROM interviews i
        INNER JOIN candidates c ON c.id = i.candidate_id
        LEFT JOIN users uo ON uo.id = i.owner_user_id
        LEFT JOIN users uh ON uh.id = i.host_user_id
        WHERE i.id = ?
        LIMIT 1
      `,
      [req.params.interviewId]
    );

    if (rows.length === 0) {
      throw createHttpError(404, "Interview not found", undefined, "NOT_FOUND");
    }

    return success(res, mapInterview(rows[0]));
  })
);

router.post(
  "/",
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const {
      candidateId,
      salesPipelineId,
      scheduledAt,
      meetingLink,
      ownerUserId,
      hostUserId,
      candidateStatus,
      interviewStatus,
      notes,
      interviewRound,
    } = req.body as Record<string, unknown>;

    if (!candidateId || !scheduledAt || !meetingLink) {
      throw createHttpError(
        400,
        "candidateId, scheduledAt, and meetingLink are required",
        undefined,
        "VALIDATION_ERROR"
      );
    }

    const [candidateRows] = await pool.query<RowDataPacket[]>(
      "SELECT full_name, applied_role FROM candidates WHERE id = ? LIMIT 1",
      [candidateId]
    );

    if (candidateRows.length === 0) {
      throw createHttpError(404, "Candidate not found", undefined, "NOT_FOUND");
    }

    let ownerNameSnapshot: string | null = null;
    let hostNameSnapshot: string | null = null;

    if (ownerUserId) {
      const [ownerRows] = await pool.query<RowDataPacket[]>(
        "SELECT full_name FROM users WHERE id = ? LIMIT 1",
        [ownerUserId]
      );
      ownerNameSnapshot = ownerRows.length ? String(ownerRows[0].full_name) : null;
    }

    if (hostUserId) {
      const [hostRows] = await pool.query<RowDataPacket[]>(
        "SELECT full_name FROM users WHERE id = ? LIMIT 1",
        [hostUserId]
      );
      hostNameSnapshot = hostRows.length ? String(hostRows[0].full_name) : null;
    }

    const [result] = await pool.query<ResultSetHeader>(
      `
        INSERT INTO interviews (
          candidate_id,
          sales_pipeline_id,
          interview_round,
          scheduled_at,
          meeting_link,
          owner_user_id,
          owner_name_snapshot,
          host_user_id,
          host_name_snapshot,
          candidate_status,
          interview_status,
          notes,
          created_by_user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        candidateId,
        salesPipelineId || null,
        interviewRound || 1,
        scheduledAt,
        meetingLink,
        ownerUserId || null,
        ownerNameSnapshot,
        hostUserId || null,
        hostNameSnapshot,
        candidateStatus || "INTERVIEW",
        interviewStatus || "PROCESS",
        notes || null,
        req.user?.id || null,
      ]
    );

    req.params.interviewId = String(result.insertId);
    const [rows] = await pool.query<RowDataPacket[]>(
      `
        SELECT
          i.*,
          c.full_name AS candidate_name,
          c.applied_role,
          uo.full_name AS owner_full_name,
          uh.full_name AS host_full_name
        FROM interviews i
        INNER JOIN candidates c ON c.id = i.candidate_id
        LEFT JOIN users uo ON uo.id = i.owner_user_id
        LEFT JOIN users uh ON uh.id = i.host_user_id
        WHERE i.id = ?
        LIMIT 1
      `,
      [result.insertId]
    );

    return success(res, mapInterview(rows[0]));
  })
);

router.patch(
  "/:interviewId",
  asyncHandler(async (req, res) => {
    const fieldMap: Record<string, string> = {
      candidateStatus: "candidate_status",
      interviewStatus: "interview_status",
      scheduledAt: "scheduled_at",
      meetingLink: "meeting_link",
      notes: "notes",
      ownerUserId: "owner_user_id",
      hostUserId: "host_user_id",
    };

    const updates: string[] = [];
    const values: unknown[] = [];

    for (const [key, column] of Object.entries(fieldMap)) {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) {
        updates.push(`${column} = ?`);
        values.push((req.body as Record<string, unknown>)[key] || null);
      }
    }

    if (updates.length === 0) {
      throw createHttpError(400, "No valid fields provided", undefined, "VALIDATION_ERROR");
    }

    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE interviews SET ${updates.join(", ")} WHERE id = ?`,
      [...values, req.params.interviewId]
    );

    if (result.affectedRows === 0) {
      throw createHttpError(404, "Interview not found", undefined, "NOT_FOUND");
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `
        SELECT
          i.*,
          c.full_name AS candidate_name,
          c.applied_role,
          uo.full_name AS owner_full_name,
          uh.full_name AS host_full_name
        FROM interviews i
        INNER JOIN candidates c ON c.id = i.candidate_id
        LEFT JOIN users uo ON uo.id = i.owner_user_id
        LEFT JOIN users uh ON uh.id = i.host_user_id
        WHERE i.id = ?
        LIMIT 1
      `,
      [req.params.interviewId]
    );

    return success(res, mapInterview(rows[0]));
  })
);

router.delete(
  "/:interviewId",
  asyncHandler(async (req, res) => {
    const [result] = await pool.query<ResultSetHeader>("DELETE FROM interviews WHERE id = ?", [
      req.params.interviewId,
    ]);

    if (result.affectedRows === 0) {
      throw createHttpError(404, "Interview not found", undefined, "NOT_FOUND");
    }

    return res.status(204).send();
  })
);

export default router;
