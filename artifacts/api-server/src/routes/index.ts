import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import studentsRouter from "./students";
import jobsRouter from "./jobs";
import applicationsRouter from "./applications";
import adminRouter from "./admin";
import recruiterRouter from "./recruiter";
import interviewsRouter from "./interviews";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(studentsRouter);
router.use(jobsRouter);
router.use(applicationsRouter);
router.use(adminRouter);
router.use(recruiterRouter);
router.use(interviewsRouter);

export default router;
