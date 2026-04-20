import express, { Request, Response } from "express";
import authRoutes from "../modules/auth/auth.routes";
import candidateRoutes from "../modules/candidates/candidate.routes";
import recruiterRoutes from "../modules/recruiter/recruiter.routes";
import salesRoutes from "../modules/sales/sales.routes";
import interviewRoutes from "../modules/interviews/interview.routes";
import dashboardRoutes from "../modules/dashboard/dashboard.routes";

const router = express.Router();

router.get("/health", (req: Request, res: Response) => {
  res.json({ data: { message: "Recruitment API is running" } });
});

router.use("/auth", authRoutes);
router.use("/candidates", candidateRoutes);
router.use("/recruiter", recruiterRoutes);
router.use("/sales", salesRoutes);
router.use("/interviews", interviewRoutes);
router.use("/dashboard", dashboardRoutes);

export default router;
