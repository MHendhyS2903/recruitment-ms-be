import express from "express";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import pool from "../../config/database";
import asyncHandler from "../../utils/asyncHandler";
import createHttpError from "../../utils/httpError";
import { requireAuth, requireRoles } from "../../shared/auth/authMiddleware";
import { withTransaction } from "../../shared/db/transaction";
import { getPagination } from "../../shared/http/pagination";
import { paginated, success } from "../../shared/http/respond";
import { AuthenticatedRequest, DbConnection } from "../../shared/types";
import { toIsoOrNull } from "../../shared/db/mysql";

const router = express.Router();

async function getSalesCandidateDetail(candidateId: string | number) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `
      SELECT
        c.*,
        rp.id AS recruiter_pipeline_id,
        rp.stage_code AS recruiter_stage,
        sp.id AS sales_pipeline_id,
        sp.stage_code AS sales_stage,
        sp.assigned_user_id,
        sp.interview_schedule_at,
        sp.interview_link,
        sp.notes AS sales_notes
      FROM sales_pipeline sp
      INNER JOIN candidates c ON c.id = sp.candidate_id
      INNER JOIN recruiter_pipeline rp ON rp.candidate_id = c.id
      WHERE c.id = ?
      LIMIT 1
    `,
    [candidateId]
  );

  if (rows.length === 0) {
    throw createHttpError(404, "Sales candidate not found", undefined, "NOT_FOUND");
  }

  const row = rows[0];

  return {
    candidateId: Number(row.id),
    salesPipelineId: Number(row.sales_pipeline_id),
    recruiterPipelineId: Number(row.recruiter_pipeline_id),
    stage: String(row.sales_stage),
    createdAt: toIsoOrNull(row.created_at),
    candidate: {
      id: Number(row.id),
      fullName: String(row.full_name),
      appliedRole: String(row.applied_role),
      email: row.email ? String(row.email) : null,
      phone: row.phone ? String(row.phone) : null,
      source: row.source_channel ? String(row.source_channel) : null,
      location: row.current_location ? String(row.current_location) : null,
      expectedSalary: row.expected_salary_amount ? Number(row.expected_salary_amount) : null,
      dateOfJoin: row.date_of_join ? String(row.date_of_join) : null,
      summary: row.profile_summary ? String(row.profile_summary) : null,
      photoUrl: row.photo_storage_path ? String(row.photo_storage_path) : null,
    },
    salesPipeline: {
      id: Number(row.sales_pipeline_id),
      stage: String(row.sales_stage),
      assignedUserId: row.assigned_user_id ? Number(row.assigned_user_id) : null,
      scheduledAt: toIsoOrNull(row.interview_schedule_at),
      meetingLink: row.interview_link ? String(row.interview_link) : null,
      notes: row.sales_notes ? String(row.sales_notes) : null,
    },
    recruiterPipeline: {
      id: Number(row.recruiter_pipeline_id),
      stage: String(row.recruiter_stage),
    },
  };
}

router.use(requireAuth, requireRoles(["SALES"]));

router.get(
  "/candidates",
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = getPagination(req.query);
    const clauses: string[] = [];
    const params: unknown[] = [];

    if (req.query.view === "todo") {
      clauses.push("sp.stage_code = 'TO_DO'");
    }

    if (req.query.stage) {
      clauses.push("sp.stage_code = ?");
      params.push(req.query.stage);
    }

    if (req.query.search) {
      clauses.push(
        "(c.full_name LIKE ? OR c.applied_role LIKE ? OR c.email LIKE ? OR c.phone LIKE ?)"
      );
      const keyword = `%${String(req.query.search)}%`;
      params.push(keyword, keyword, keyword, keyword);
    }

    const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";

    const [rows] = await pool.query<RowDataPacket[]>(
      `
        SELECT
          c.*,
          rp.id AS recruiter_pipeline_id,
          rp.stage_code AS recruiter_stage,
          sp.id AS sales_pipeline_id,
          sp.stage_code AS sales_stage,
          sp.interview_schedule_at,
          sp.interview_link
        FROM sales_pipeline sp
        INNER JOIN candidates c ON c.id = sp.candidate_id
        INNER JOIN recruiter_pipeline rp ON rp.candidate_id = c.id
        ${whereSql}
        ORDER BY c.created_at DESC
        LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    );

    const [countRows] = await pool.query<RowDataPacket[]>(
      `
        SELECT COUNT(*) AS total
        FROM sales_pipeline sp
        INNER JOIN candidates c ON c.id = sp.candidate_id
        INNER JOIN recruiter_pipeline rp ON rp.candidate_id = c.id
        ${whereSql}
      `,
      params
    );

    return paginated(
      res,
      rows.map((row) => ({
        candidateId: Number(row.id),
        salesPipelineId: Number(row.sales_pipeline_id),
        recruiterPipelineId: Number(row.recruiter_pipeline_id),
        stage: String(row.sales_stage),
        candidate: {
          id: Number(row.id),
          fullName: String(row.full_name),
          appliedRole: String(row.applied_role),
          email: row.email ? String(row.email) : null,
          phone: row.phone ? String(row.phone) : null,
          source: row.source_channel ? String(row.source_channel) : null,
          location: row.current_location ? String(row.current_location) : null,
          expectedSalary: row.expected_salary_amount ? Number(row.expected_salary_amount) : null,
          dateOfJoin: row.date_of_join ? String(row.date_of_join) : null,
          summary: row.profile_summary ? String(row.profile_summary) : null,
          photoUrl: row.photo_storage_path ? String(row.photo_storage_path) : null,
        },
        salesPipeline: {
          id: Number(row.sales_pipeline_id),
          stage: String(row.sales_stage),
          scheduledAt: toIsoOrNull(row.interview_schedule_at),
          meetingLink: row.interview_link ? String(row.interview_link) : null,
        },
      })),
      page,
      limit,
      Number(countRows[0].total)
    );
  })
);

router.get(
  "/candidates/:candidateId",
  asyncHandler(async (req, res) => {
    return success(res, await getSalesCandidateDetail(String(req.params.candidateId)));
  })
);

router.patch(
  "/candidates/:candidateId",
  asyncHandler(async (req, res) => {
    const candidateId = Number(req.params.candidateId);

    const fieldMap: Record<string, string> = {
      fullName: "full_name",
      appliedRole: "applied_role",
      email: "email",
      phone: "phone",
      source: "source_channel",
      location: "current_location",
      expectedSalary: "expected_salary_amount",
      expectedSalaryCurrency: "expected_salary_currency",
      dateOfJoin: "date_of_join",
      summary: "profile_summary",
    };

    const updates: string[] = [];
    const values: unknown[] = [];

    for (const [key, column] of Object.entries(fieldMap)) {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) {
        updates.push(`${column} = ?`);
        values.push((req.body as Record<string, unknown>)[key] || null);
      }
    }

    if (updates.length > 0) {
      await pool.query(`UPDATE candidates SET ${updates.join(", ")} WHERE id = ?`, [
        ...values,
        candidateId,
      ]);
    }

    const salesUpdates: string[] = [];
    const salesValues: unknown[] = [];

    if (Object.prototype.hasOwnProperty.call(req.body, "notes")) {
      salesUpdates.push("notes = ?");
      salesValues.push((req.body as Record<string, unknown>).notes || null);
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "assignedUserId")) {
      salesUpdates.push("assigned_user_id = ?");
      salesValues.push((req.body as Record<string, unknown>).assignedUserId || null);
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "scheduledAt")) {
      salesUpdates.push("interview_schedule_at = ?");
      salesValues.push((req.body as Record<string, unknown>).scheduledAt || null);
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "meetingLink")) {
      salesUpdates.push("interview_link = ?");
      salesValues.push((req.body as Record<string, unknown>).meetingLink || null);
    }

    if (salesUpdates.length > 0) {
      await pool.query(
        `UPDATE sales_pipeline SET ${salesUpdates.join(", ")} WHERE candidate_id = ?`,
        [...salesValues, candidateId]
      );
    }

    return success(res, await getSalesCandidateDetail(candidateId));
  })
);

router.post(
  "/candidates/:candidateId/process",
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const candidateId = Number(req.params.candidateId);
    const { scheduledAt, meetingLink, ownerUserId, hostUserId, notes } = req.body as Record<
      string,
      unknown
    >;

    if (!scheduledAt || !meetingLink) {
      throw createHttpError(
        400,
        "scheduledAt and meetingLink are required",
        {
          ...(scheduledAt ? {} : { scheduledAt: ["scheduledAt is required"] }),
          ...(meetingLink ? {} : { meetingLink: ["meetingLink is required"] }),
        },
        "VALIDATION_ERROR"
      );
    }

    const data = await withTransaction(async (connection: DbConnection) => {
      const [rows] = await connection.query<RowDataPacket[]>(
        `
          SELECT
            c.full_name,
            sp.id AS sales_pipeline_id,
            sp.stage_code AS sales_stage,
            rp.id AS recruiter_pipeline_id,
            rp.stage_code AS recruiter_stage
          FROM sales_pipeline sp
          INNER JOIN candidates c ON c.id = sp.candidate_id
          INNER JOIN recruiter_pipeline rp ON rp.candidate_id = c.id
          WHERE c.id = ?
          LIMIT 1
        `,
        [candidateId]
      );

      if (rows.length === 0) {
        throw createHttpError(404, "Sales candidate not found", undefined, "NOT_FOUND");
      }

      const row = rows[0];
      if (String(row.sales_stage) !== "TO_DO") {
        throw createHttpError(
          409,
          "Sales candidate can only be processed from TO_DO stage",
          undefined,
          "BUSINESS_RULE_ERROR"
        );
      }

      let ownerNameSnapshot: string | null = null;
      let hostNameSnapshot: string | null = null;

      if (ownerUserId) {
        const [ownerRows] = await connection.query<RowDataPacket[]>(
          "SELECT full_name FROM users WHERE id = ? LIMIT 1",
          [ownerUserId]
        );
        ownerNameSnapshot = ownerRows.length ? String(ownerRows[0].full_name) : null;
      }

      if (hostUserId) {
        const [hostRows] = await connection.query<RowDataPacket[]>(
          "SELECT full_name FROM users WHERE id = ? LIMIT 1",
          [hostUserId]
        );
        hostNameSnapshot = hostRows.length ? String(hostRows[0].full_name) : null;
      }

      await connection.query(
        `
          UPDATE sales_pipeline
          SET
            stage_code = 'INTERVIEWING',
            assigned_user_id = ?,
            interview_schedule_at = ?,
            interview_link = ?,
            processed_at = NOW(),
            notes = ?,
            updated_at = NOW()
          WHERE candidate_id = ?
        `,
        [ownerUserId || null, scheduledAt, meetingLink, notes || null, candidateId]
      );

      await connection.query(
        `
          UPDATE recruiter_pipeline
          SET stage_code = 'INTERVIEWING', updated_at = NOW()
          WHERE candidate_id = ?
        `,
        [candidateId]
      );

      const [interviewResult] = await connection.query<ResultSetHeader>(
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
          ) VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, 'INTERVIEW', 'PROCESS', ?, ?)
        `,
        [
          candidateId,
          row.sales_pipeline_id,
          scheduledAt,
          meetingLink,
          ownerUserId || null,
          ownerNameSnapshot,
          hostUserId || null,
          hostNameSnapshot,
          notes || null,
          req.user?.id || null,
        ]
      );

      await connection.query(
        `
          INSERT INTO candidate_stage_history (
            candidate_id,
            module_code,
            from_stage_code,
            to_stage_code,
            changed_by_user_id,
            remarks
          ) VALUES (?, 'SALES', 'TO_DO', 'INTERVIEWING', ?, ?)
        `,
        [candidateId, req.user?.id || null, notes || "Processed by sales"]
      );

      return {
        candidateId,
        salesPipeline: {
          id: Number(row.sales_pipeline_id),
          stage: "INTERVIEWING",
          scheduledAt,
          meetingLink,
        },
        recruiterPipeline: {
          id: Number(row.recruiter_pipeline_id),
          stage: "INTERVIEWING",
        },
        interview: {
          id: interviewResult.insertId,
          candidateStatus: "INTERVIEW",
          interviewStatus: "PROCESS",
        },
      };
    });

    return success(res, data);
  })
);

router.delete(
  "/candidates/:candidateId",
  asyncHandler(async (req, res) => {
    const candidateId = Number(req.params.candidateId);
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT id, stage_code FROM sales_pipeline WHERE candidate_id = ? LIMIT 1",
      [candidateId]
    );

    if (rows.length === 0) {
      throw createHttpError(404, "Sales candidate not found", undefined, "NOT_FOUND");
    }

    await withTransaction(async (connection: DbConnection) => {
      await connection.query("DELETE FROM interviews WHERE candidate_id = ?", [candidateId]);
      await connection.query("DELETE FROM sales_pipeline WHERE candidate_id = ?", [candidateId]);
      await connection.query(
        `
          UPDATE recruiter_pipeline
          SET
            stage_code = 'READY_TO_INTERVIEW',
            updated_at = NOW()
          WHERE candidate_id = ?
        `,
        [candidateId]
      );
    });

    return res.status(204).send();
  })
);

export default router;
