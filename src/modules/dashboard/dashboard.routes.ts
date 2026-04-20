import express from "express";
import { RowDataPacket } from "mysql2";
import pool from "../../config/database";
import asyncHandler from "../../utils/asyncHandler";
import { requireAuth } from "../../shared/auth/authMiddleware";
import { success } from "../../shared/http/respond";
import { toIsoOrNull } from "../../shared/db/mysql";

const router = express.Router();

router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const [summaryRows] = await pool.query<RowDataPacket[]>(
      `
        SELECT
          COUNT(*) AS total_data,
          SUM(CASE WHEN interview_status = 'PROCESS' THEN 1 ELSE 0 END) AS on_process,
          SUM(CASE WHEN interview_status = 'FAILED' THEN 1 ELSE 0 END) AS failed,
          SUM(CASE WHEN candidate_status = 'RESCHEDULE' THEN 1 ELSE 0 END) AS reschedule
        FROM interviews
      `
    );

    const [interviewStatusRows] = await pool.query<RowDataPacket[]>(
      `
        SELECT interview_status AS \`key\`, COUNT(*) AS value
        FROM interviews
        GROUP BY interview_status
      `
    );

    const [candidateStatusRows] = await pool.query<RowDataPacket[]>(
      `
        SELECT candidate_status AS \`key\`, COUNT(*) AS value
        FROM interviews
        GROUP BY candidate_status
      `
    );

    const [recruiterRows] = await pool.query<RowDataPacket[]>(
      `
        SELECT stage_code AS \`key\`, COUNT(*) AS value
        FROM recruiter_pipeline
        GROUP BY stage_code
      `
    );

    const [salesRows] = await pool.query<RowDataPacket[]>(
      `
        SELECT stage_code AS \`key\`, COUNT(*) AS value
        FROM sales_pipeline
        GROUP BY stage_code
      `
    );

    const [priorityRows] = await pool.query<RowDataPacket[]>(
      `
        SELECT
          i.candidate_id,
          c.full_name AS candidate_name,
          c.applied_role,
          i.scheduled_at,
          i.meeting_link,
          COALESCE(u.full_name, i.owner_name_snapshot) AS owner_name
        FROM interviews i
        INNER JOIN candidates c ON c.id = i.candidate_id
        LEFT JOIN users u ON u.id = i.owner_user_id
        WHERE DATE(i.scheduled_at) = CURDATE()
        ORDER BY i.scheduled_at ASC
      `
    );

    return success(res, {
      summary: {
        totalData: Number(summaryRows[0]?.total_data || 0),
        onProcess: Number(summaryRows[0]?.on_process || 0),
        failed: Number(summaryRows[0]?.failed || 0),
        reschedule: Number(summaryRows[0]?.reschedule || 0),
      },
      interviewStatusStats: interviewStatusRows.map((row) => ({
        key: String(row.key),
        label: String(row.key),
        value: Number(row.value),
      })),
      candidateStatusStats: candidateStatusRows.map((row) => ({
        key: String(row.key),
        label: String(row.key),
        value: Number(row.value),
      })),
      recruiterStats: recruiterRows.map((row) => ({
        key: String(row.key),
        label: String(row.key),
        value: Number(row.value),
      })),
      salesStats: salesRows.map((row) => ({
        key: String(row.key),
        label: String(row.key),
        value: Number(row.value),
      })),
      priorityToday: priorityRows.map((row) => ({
        candidateId: Number(row.candidate_id),
        candidateName: String(row.candidate_name),
        role: String(row.applied_role),
        scheduledAt: toIsoOrNull(row.scheduled_at),
        meetingLink: String(row.meeting_link),
        ownerName: row.owner_name ? String(row.owner_name) : null,
      })),
    });
  })
);

export default router;
