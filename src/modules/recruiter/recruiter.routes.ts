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

async function getDocumentsMap(candidateIds: number[]) {
  if (candidateIds.length === 0) {
    return new Map<number, Array<{ id: number; category: string; originalName: string }>>();
  }

  const placeholders = candidateIds.map(() => "?").join(", ");
  const [rows] = await pool.query<RowDataPacket[]>(
    `
      SELECT id, candidate_id, category_code, original_name
      FROM candidate_documents
      WHERE candidate_id IN (${placeholders})
      ORDER BY created_at DESC
    `,
    candidateIds
  );

  const map = new Map<number, Array<{ id: number; category: string; originalName: string }>>();
  for (const row of rows) {
    const candidateId = Number(row.candidate_id);
    const current = map.get(candidateId) || [];
    current.push({
      id: Number(row.id),
      category: String(row.category_code),
      originalName: String(row.original_name),
    });
    map.set(candidateId, current);
  }

  return map;
}

async function getRecruiterCandidateDetail(candidateId: string | number) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `
      SELECT
        c.*,
        rp.id AS recruiter_pipeline_id,
        rp.stage_code AS recruiter_stage,
        rp.assigned_user_id,
        rp.handoff_to_sales_at,
        rp.locked_after_handoff,
        rp.notes AS recruiter_notes
      FROM candidates c
      INNER JOIN recruiter_pipeline rp ON rp.candidate_id = c.id
      WHERE c.id = ?
      LIMIT 1
    `,
    [candidateId]
  );

  if (rows.length === 0) {
    throw createHttpError(404, "Recruiter candidate not found", undefined, "NOT_FOUND");
  }

  const row = rows[0];
  const [documents] = await pool.query<RowDataPacket[]>(
    `
      SELECT id, category_code, original_name
      FROM candidate_documents
      WHERE candidate_id = ?
      ORDER BY created_at DESC
    `,
    [candidateId]
  );

  return {
    candidateId: Number(row.id),
    recruiterPipelineId: Number(row.recruiter_pipeline_id),
    stage: String(row.recruiter_stage),
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
    documents: documents.map((document) => ({
      id: Number(document.id),
      category: String(document.category_code),
      originalName: String(document.original_name),
    })),
    recruiterPipeline: {
      id: Number(row.recruiter_pipeline_id),
      stage: String(row.recruiter_stage),
      assignedUserId: row.assigned_user_id ? Number(row.assigned_user_id) : null,
      handoffToSalesAt: toIsoOrNull(row.handoff_to_sales_at),
      lockedAfterHandoff: Boolean(row.locked_after_handoff),
      notes: row.recruiter_notes ? String(row.recruiter_notes) : null,
    },
  };
}

router.use(requireAuth, requireRoles(["RECRUITER"]));

router.get(
  "/candidates",
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = getPagination(req.query);
    const clauses: string[] = [];
    const params: unknown[] = [];

    if (req.query.view === "todo") {
      clauses.push("rp.stage_code = 'TO_DO'");
    }

    if (req.query.stage) {
      clauses.push("rp.stage_code = ?");
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
          rp.stage_code,
          rp.notes AS recruiter_notes
        FROM recruiter_pipeline rp
        INNER JOIN candidates c ON c.id = rp.candidate_id
        ${whereSql}
        ORDER BY c.created_at DESC
        LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    );

    const [countRows] = await pool.query<RowDataPacket[]>(
      `
        SELECT COUNT(*) AS total
        FROM recruiter_pipeline rp
        INNER JOIN candidates c ON c.id = rp.candidate_id
        ${whereSql}
      `,
      params
    );

    const candidateIds = rows.map((row) => Number(row.id));
    const documentMap = await getDocumentsMap(candidateIds);

    return paginated(
      res,
      rows.map((row) => ({
        candidateId: Number(row.id),
        recruiterPipelineId: Number(row.recruiter_pipeline_id),
        stage: String(row.stage_code),
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
        documents: documentMap.get(Number(row.id)) || [],
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
    return success(res, await getRecruiterCandidateDetail(String(req.params.candidateId)));
  })
);

router.patch(
  "/candidates/:candidateId",
  asyncHandler(async (req, res) => {
    const candidateId = Number(req.params.candidateId);
    const [pipelineRows] = await pool.query<RowDataPacket[]>(
      `
        SELECT locked_after_handoff
        FROM recruiter_pipeline
        WHERE candidate_id = ?
        LIMIT 1
      `,
      [candidateId]
    );

    if (pipelineRows.length === 0) {
      throw createHttpError(404, "Recruiter candidate not found", undefined, "NOT_FOUND");
    }

    if (Number(pipelineRows[0].locked_after_handoff) === 1) {
      throw createHttpError(409, "Candidate is locked after handoff", undefined, "BUSINESS_RULE_ERROR");
    }

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

    if (Object.prototype.hasOwnProperty.call(req.body, "notes")) {
      await pool.query("UPDATE recruiter_pipeline SET notes = ? WHERE candidate_id = ?", [
        (req.body as Record<string, unknown>).notes || null,
        candidateId,
      ]);
    }

    return success(res, await getRecruiterCandidateDetail(candidateId));
  })
);

router.post(
  "/candidates/:candidateId/process",
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const candidateId = Number(req.params.candidateId);
    const remarks = (req.body as Record<string, unknown>).remarks || "Ready to handoff to sales";

    const data = await withTransaction(async (connection: DbConnection) => {
      const [pipelineRows] = await connection.query<RowDataPacket[]>(
        `
          SELECT id, stage_code
          FROM recruiter_pipeline
          WHERE candidate_id = ?
          LIMIT 1
        `,
        [candidateId]
      );

      if (pipelineRows.length === 0) {
        throw createHttpError(404, "Recruiter candidate not found", undefined, "NOT_FOUND");
      }

      const recruiterPipeline = pipelineRows[0];
      if (String(recruiterPipeline.stage_code) !== "TO_DO") {
        throw createHttpError(
          409,
          "Recruiter candidate can only be processed from TO_DO stage",
          undefined,
          "BUSINESS_RULE_ERROR"
        );
      }

      await connection.query(
        `
          UPDATE recruiter_pipeline
          SET
            stage_code = 'READY_TO_INTERVIEW',
            handoff_to_sales_at = NOW(),
            locked_after_handoff = 1,
            updated_at = NOW()
          WHERE candidate_id = ?
        `,
        [candidateId]
      );

      const [salesRows] = await connection.query<RowDataPacket[]>(
        "SELECT id, stage_code FROM sales_pipeline WHERE candidate_id = ? LIMIT 1",
        [candidateId]
      );

      let salesPipelineId: number;
      if (salesRows.length === 0) {
        const [salesResult] = await connection.query<ResultSetHeader>(
          `
            INSERT INTO sales_pipeline (
              candidate_id,
              recruiter_pipeline_id,
              stage_code,
              assigned_user_id
            ) VALUES (?, ?, 'TO_DO', NULL)
          `,
          [candidateId, recruiterPipeline.id]
        );
        salesPipelineId = salesResult.insertId;
      } else {
        salesPipelineId = Number(salesRows[0].id);
      }

      await connection.query(
        `
          INSERT INTO candidate_stage_history (
            candidate_id,
            module_code,
            from_stage_code,
            to_stage_code,
            changed_by_user_id,
            remarks
          ) VALUES (?, 'RECRUITER', 'TO_DO', 'READY_TO_INTERVIEW', ?, ?)
        `,
        [candidateId, req.user?.id || null, remarks]
      );

      return {
        candidateId,
        recruiterPipeline: {
          id: Number(recruiterPipeline.id),
          stage: "READY_TO_INTERVIEW",
          lockedAfterHandoff: true,
          handoffToSalesAt: new Date().toISOString(),
        },
        salesPipeline: {
          id: salesPipelineId,
          stage: "TO_DO",
        },
      };
    });

    return success(res, data);
  })
);

router.delete(
  "/candidates/:candidateId",
  asyncHandler(async (req, res) => {
    const [pipelineRows] = await pool.query<RowDataPacket[]>(
      `
        SELECT stage_code
        FROM recruiter_pipeline
        WHERE candidate_id = ?
        LIMIT 1
      `,
      [req.params.candidateId]
    );

    if (pipelineRows.length === 0) {
      throw createHttpError(404, "Recruiter candidate not found", undefined, "NOT_FOUND");
    }

    if (String(pipelineRows[0].stage_code) !== "TO_DO") {
      throw createHttpError(
        409,
        "Recruiter candidate can only be deleted before processing",
        undefined,
        "BUSINESS_RULE_ERROR"
      );
    }

    await pool.query("DELETE FROM candidates WHERE id = ?", [req.params.candidateId]);
    return res.status(204).send();
  })
);

export default router;
