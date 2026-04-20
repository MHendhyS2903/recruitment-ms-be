import express from "express";
import multer from "multer";
import path from "path";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import pool from "../../config/database";
import asyncHandler from "../../utils/asyncHandler";
import createHttpError from "../../utils/httpError";
import { requireAuth } from "../../shared/auth/authMiddleware";
import {
  createTimestampedFileName,
  deleteUploadedFile,
  saveBufferToUpload,
} from "../../shared/files/storage";
import { withTransaction } from "../../shared/db/transaction";
import { getPagination } from "../../shared/http/pagination";
import { paginated, success } from "../../shared/http/respond";
import { AuthenticatedRequest, DbConnection } from "../../shared/types";
import { toIsoOrNull } from "../../shared/db/mysql";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

function getUploadedFile(req: AuthenticatedRequest): Express.Multer.File | null {
  if (req.file) {
    return req.file;
  }

  if (Array.isArray(req.files) && req.files.length > 0) {
    return req.files[0];
  }

  return null;
}

function buildCandidateCode(): string {
  const now = new Date();
  const year = now.getFullYear();
  const uniquePart = String(Date.now()).slice(-8);
  return `CND-${year}-${uniquePart}`;
}

function mapCandidateRow(row: RowDataPacket) {
  return {
    id: Number(row.id),
    candidateCode: String(row.candidate_code),
    fullName: String(row.full_name),
    appliedRole: String(row.applied_role),
    email: row.email ? String(row.email) : null,
    phone: row.phone ? String(row.phone) : null,
    source: row.source_channel ? String(row.source_channel) : null,
    location: row.current_location ? String(row.current_location) : null,
    expectedSalary: row.expected_salary_amount ? Number(row.expected_salary_amount) : null,
    expectedSalaryCurrency: String(row.expected_salary_currency),
    dateOfJoin: row.date_of_join ? String(row.date_of_join) : null,
    summary: row.profile_summary ? String(row.profile_summary) : null,
    photoUrl: row.photo_storage_path ? String(row.photo_storage_path) : null,
    currentStage: row.current_stage ? String(row.current_stage) : null,
    recruiterStage: row.recruiter_stage ? String(row.recruiter_stage) : null,
    salesStage: row.sales_stage ? String(row.sales_stage) : null,
    createdAt: toIsoOrNull(row.created_at),
    updatedAt: toIsoOrNull(row.updated_at),
  };
}

async function getCandidateDetail(candidateId: string | number) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `
      SELECT
        c.*,
        rp.id AS recruiter_pipeline_id,
        rp.stage_code AS recruiter_stage,
        rp.assigned_user_id AS recruiter_assigned_user_id,
        rp.handoff_to_sales_at,
        rp.locked_after_handoff,
        rp.notes AS recruiter_notes,
        sp.id AS sales_pipeline_id,
        sp.stage_code AS sales_stage,
        sp.assigned_user_id AS sales_assigned_user_id,
        sp.interview_schedule_at,
        sp.interview_link,
        sp.notes AS sales_notes,
        COALESCE(sp.stage_code, rp.stage_code) AS current_stage
      FROM candidates c
      LEFT JOIN recruiter_pipeline rp ON rp.candidate_id = c.id
      LEFT JOIN sales_pipeline sp ON sp.candidate_id = c.id
      WHERE c.id = ?
      LIMIT 1
    `,
    [candidateId]
  );

  if (rows.length === 0) {
    throw createHttpError(404, "Candidate not found", undefined, "NOT_FOUND");
  }

  const row = rows[0];
  const [documents] = await pool.query<RowDataPacket[]>(
    `
      SELECT id, category_code, original_name, storage_path, mime_type, size_bytes, created_at
      FROM candidate_documents
      WHERE candidate_id = ?
      ORDER BY created_at DESC
    `,
    [candidateId]
  );

  return {
    ...mapCandidateRow(row),
    recruiterPipeline: row.recruiter_pipeline_id
      ? {
          id: Number(row.recruiter_pipeline_id),
          stage: String(row.recruiter_stage),
          assignedUserId: row.recruiter_assigned_user_id
            ? Number(row.recruiter_assigned_user_id)
            : null,
          handoffToSalesAt: toIsoOrNull(row.handoff_to_sales_at),
          lockedAfterHandoff: Boolean(row.locked_after_handoff),
          notes: row.recruiter_notes ? String(row.recruiter_notes) : null,
        }
      : null,
    salesPipeline: row.sales_pipeline_id
      ? {
          id: Number(row.sales_pipeline_id),
          stage: String(row.sales_stage),
          assignedUserId: row.sales_assigned_user_id ? Number(row.sales_assigned_user_id) : null,
          scheduledAt: toIsoOrNull(row.interview_schedule_at),
          meetingLink: row.interview_link ? String(row.interview_link) : null,
          notes: row.sales_notes ? String(row.sales_notes) : null,
        }
      : null,
    documents: documents.map((document) => ({
      id: Number(document.id),
      category: String(document.category_code),
      originalName: String(document.original_name),
      mimeType: document.mime_type ? String(document.mime_type) : null,
      sizeBytes: document.size_bytes ? Number(document.size_bytes) : null,
      url: String(document.storage_path),
      createdAt: toIsoOrNull(document.created_at),
    })),
  };
}

async function assertCandidateEditable(candidateId: number | string): Promise<void> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `
      SELECT locked_after_handoff
      FROM recruiter_pipeline
      WHERE candidate_id = ?
      LIMIT 1
    `,
    [candidateId]
  );

  if (rows.length > 0 && Number(rows[0].locked_after_handoff) === 1) {
    throw createHttpError(
      409,
      "Candidate cannot be edited after recruiter handoff",
      undefined,
      "BUSINESS_RULE_ERROR"
    );
  }
}

async function assertCandidateExists(candidateId: number | string): Promise<void> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id FROM candidates WHERE id = ? LIMIT 1",
    [candidateId]
  );

  if (rows.length === 0) {
    throw createHttpError(404, "Candidate not found", undefined, "NOT_FOUND");
  }
}

async function assertDocumentCategoryExists(categoryCode: string): Promise<void> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT code FROM document_category_ref WHERE code = ? LIMIT 1",
    [categoryCode]
  );

  if (rows.length === 0) {
    throw createHttpError(
      400,
      "Invalid document category",
      {
        category: ["category must be one of CV, PORTOFOLIO, SURAT_LAMARAN, LAMPIRAN"],
      },
      "VALIDATION_ERROR"
    );
  }
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
        "(c.full_name LIKE ? OR c.applied_role LIKE ? OR c.email LIKE ? OR c.phone LIKE ?)"
      );
      const keyword = `%${String(req.query.search)}%`;
      params.push(keyword, keyword, keyword, keyword);
    }

    if (req.query.source) {
      clauses.push("c.source_channel = ?");
      params.push(req.query.source);
    }

    if (req.query.dateOfJoinFrom) {
      clauses.push("c.date_of_join >= ?");
      params.push(req.query.dateOfJoinFrom);
    }

    if (req.query.dateOfJoinTo) {
      clauses.push("c.date_of_join <= ?");
      params.push(req.query.dateOfJoinTo);
    }

    if (req.query.stage) {
      clauses.push("COALESCE(sp.stage_code, rp.stage_code) = ?");
      params.push(req.query.stage);
    }

    const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";

    const [rows] = await pool.query<RowDataPacket[]>(
      `
        SELECT
          c.*,
          rp.stage_code AS recruiter_stage,
          sp.stage_code AS sales_stage,
          COALESCE(sp.stage_code, rp.stage_code) AS current_stage
        FROM candidates c
        LEFT JOIN recruiter_pipeline rp ON rp.candidate_id = c.id
        LEFT JOIN sales_pipeline sp ON sp.candidate_id = c.id
        ${whereSql}
        ORDER BY c.created_at DESC
        LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    );

    const [countRows] = await pool.query<RowDataPacket[]>(
      `
        SELECT COUNT(*) AS total
        FROM candidates c
        LEFT JOIN recruiter_pipeline rp ON rp.candidate_id = c.id
        LEFT JOIN sales_pipeline sp ON sp.candidate_id = c.id
        ${whereSql}
      `,
      params
    );

    return paginated(
      res,
      rows.map(mapCandidateRow),
      page,
      limit,
      Number(countRows[0].total)
    );
  })
);

router.post(
  "/",
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const {
      fullName,
      appliedRole,
      email,
      phone,
      source,
      location,
      expectedSalary,
      expectedSalaryCurrency,
      dateOfJoin,
      summary,
    } = req.body as Record<string, unknown>;

    if (!fullName || !appliedRole) {
      throw createHttpError(
        400,
        "fullName and appliedRole are required",
        {
          ...(fullName ? {} : { fullName: ["fullName is required"] }),
          ...(appliedRole ? {} : { appliedRole: ["appliedRole is required"] }),
        },
        "VALIDATION_ERROR"
      );
    }

    const candidateId = await withTransaction(async (connection) => {
      const candidateCode = buildCandidateCode();
      const [candidateResult] = await connection.query<ResultSetHeader>(
        `
          INSERT INTO candidates (
            candidate_code,
            full_name,
            applied_role,
            email,
            phone,
            source_channel,
            current_location,
            expected_salary_amount,
            expected_salary_currency,
            date_of_join,
            profile_summary,
            created_by_user_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          candidateCode,
          fullName,
          appliedRole,
          email || null,
          phone || null,
          source || null,
          location || null,
          expectedSalary || null,
          expectedSalaryCurrency || "IDR",
          dateOfJoin || null,
          summary || null,
          req.user?.id || null,
        ]
      );

      const newCandidateId = candidateResult.insertId;

      await connection.query(
        `
          INSERT INTO recruiter_pipeline (
            candidate_id,
            stage_code,
            assigned_user_id,
            notes
          ) VALUES (?, 'TO_DO', ?, NULL)
        `,
        [newCandidateId, req.user?.id || null]
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
          ) VALUES (?, 'RECRUITER', NULL, 'TO_DO', ?, 'Candidate created')
        `,
        [newCandidateId, req.user?.id || null]
      );

      return newCandidateId;
    });

    return success(res, await getCandidateDetail(candidateId));
  })
);

router.get(
  "/:candidateId",
  asyncHandler(async (req, res) => {
    return success(res, await getCandidateDetail(String(req.params.candidateId)));
  })
);

router.patch(
  "/:candidateId",
  asyncHandler(async (req, res) => {
    const candidateId = Number(req.params.candidateId);
    await assertCandidateEditable(candidateId);

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

    if (updates.length === 0) {
      throw createHttpError(400, "No valid fields provided", undefined, "VALIDATION_ERROR");
    }

    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE candidates SET ${updates.join(", ")} WHERE id = ?`,
      [...values, candidateId]
    );

    if (result.affectedRows === 0) {
      throw createHttpError(404, "Candidate not found", undefined, "NOT_FOUND");
    }

    return success(res, await getCandidateDetail(candidateId));
  })
);

router.delete(
  "/:candidateId",
  asyncHandler(async (req, res) => {
    const [result] = await pool.query<ResultSetHeader>("DELETE FROM candidates WHERE id = ?", [
      req.params.candidateId,
    ]);

    if (result.affectedRows === 0) {
      throw createHttpError(404, "Candidate not found", undefined, "NOT_FOUND");
    }

    return res.status(204).send();
  })
);

router.get(
  "/:candidateId/history",
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query<RowDataPacket[]>(
      `
        SELECT
          h.id,
          h.module_code,
          h.from_stage_code,
          h.to_stage_code,
          h.changed_at,
          h.remarks,
          u.id AS changed_by_id,
          u.full_name AS changed_by_name
        FROM candidate_stage_history h
        LEFT JOIN users u ON u.id = h.changed_by_user_id
        WHERE h.candidate_id = ?
        ORDER BY h.changed_at DESC, h.id DESC
      `,
      [req.params.candidateId]
    );

    return success(
      res,
      rows.map((row) => ({
        id: Number(row.id),
        module: String(row.module_code),
        fromStage: row.from_stage_code ? String(row.from_stage_code) : null,
        toStage: String(row.to_stage_code),
        changedBy: row.changed_by_id
          ? {
              id: Number(row.changed_by_id),
              fullName: String(row.changed_by_name),
            }
          : null,
        changedAt: toIsoOrNull(row.changed_at),
        remarks: row.remarks ? String(row.remarks) : null,
      }))
    );
  })
);

router.get(
  "/:candidateId/documents",
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query<RowDataPacket[]>(
      `
        SELECT id, candidate_id, category_code, original_name, storage_path, mime_type, size_bytes, created_at
        FROM candidate_documents
        WHERE candidate_id = ?
        ORDER BY created_at DESC
      `,
      [req.params.candidateId]
    );

    return success(
      res,
      rows.map((row) => ({
        id: Number(row.id),
        candidateId: Number(row.candidate_id),
        category: String(row.category_code),
        originalName: String(row.original_name),
        mimeType: row.mime_type ? String(row.mime_type) : null,
        sizeBytes: row.size_bytes ? Number(row.size_bytes) : null,
        url: String(row.storage_path),
        createdAt: toIsoOrNull(row.created_at),
      }))
    );
  })
);

router.post(
  "/:candidateId/documents",
  upload.any(),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const candidateId = Number(req.params.candidateId);
    const category = String((req.body as Record<string, unknown>).category || "").trim();
    const file = getUploadedFile(req);

    await assertCandidateExists(candidateId);

    if (!category) {
      throw createHttpError(
        400,
        "category is required",
        { category: ["category is required"] },
        "VALIDATION_ERROR"
      );
    }

    if (!file) {
      throw createHttpError(
        400,
        "file is required",
        { file: ["file is required"] },
        "VALIDATION_ERROR"
      );
    }

    await assertDocumentCategoryExists(category);

    const relativeDirectory = path.join("candidates", String(candidateId), "documents");
    const storedFile = await saveBufferToUpload(
      relativeDirectory,
      createTimestampedFileName(file.originalname),
      file.buffer
    );

    const [result] = await pool.query<ResultSetHeader>(
      `
        INSERT INTO candidate_documents (
          candidate_id,
          category_code,
          original_name,
          storage_path,
          mime_type,
          size_bytes,
          uploaded_by_user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        candidateId,
        category,
        file.originalname,
        storedFile.publicUrl,
        file.mimetype || null,
        file.size || null,
        req.user?.id || null,
      ]
    );

    return success(res, {
      id: result.insertId,
      candidateId,
      category,
      originalName: file.originalname,
      mimeType: file.mimetype || null,
      sizeBytes: file.size || null,
      url: storedFile.publicUrl,
      createdAt: new Date().toISOString(),
    });
  })
);

router.post(
  "/:candidateId/photo",
  upload.any(),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const candidateId = Number(req.params.candidateId);
    const file = getUploadedFile(req);

    await assertCandidateExists(candidateId);

    if (!file) {
      throw createHttpError(
        400,
        "file is required",
        { file: ["file is required"] },
        "VALIDATION_ERROR"
      );
    }

    if (!file.mimetype.startsWith("image/")) {
      throw createHttpError(
        400,
        "photo must be an image",
        { file: ["photo must be an image"] },
        "VALIDATION_ERROR"
      );
    }

    const [currentRows] = await pool.query<RowDataPacket[]>(
      "SELECT photo_storage_path FROM candidates WHERE id = ? LIMIT 1",
      [candidateId]
    );

    const relativeDirectory = path.join("candidates", String(candidateId), "photo");
    const storedFile = await saveBufferToUpload(
      relativeDirectory,
      createTimestampedFileName(file.originalname),
      file.buffer
    );

    await pool.query(
      `
        UPDATE candidates
        SET photo_original_name = ?, photo_storage_path = ?
        WHERE id = ?
      `,
      [file.originalname, storedFile.publicUrl, candidateId]
    );

    await deleteUploadedFile(
      currentRows.length > 0 && currentRows[0].photo_storage_path
        ? String(currentRows[0].photo_storage_path)
        : null
    );

    return success(res, {
      candidateId,
      originalName: file.originalname,
      mimeType: file.mimetype || null,
      sizeBytes: file.size || null,
      url: storedFile.publicUrl,
    });
  })
);

router.delete(
  "/:candidateId/documents/:documentId",
  asyncHandler(async (req, res) => {
    const [documentRows] = await pool.query<RowDataPacket[]>(
      `
        SELECT storage_path
        FROM candidate_documents
        WHERE id = ? AND candidate_id = ?
        LIMIT 1
      `,
      [req.params.documentId, req.params.candidateId]
    );

    const [result] = await pool.query<ResultSetHeader>(
      "DELETE FROM candidate_documents WHERE id = ? AND candidate_id = ?",
      [req.params.documentId, req.params.candidateId]
    );

    if (result.affectedRows === 0) {
      throw createHttpError(404, "Candidate document not found", undefined, "NOT_FOUND");
    }

    if (documentRows.length > 0) {
      await deleteUploadedFile(String(documentRows[0].storage_path));
    }

    return res.status(204).send();
  })
);

export default router;
