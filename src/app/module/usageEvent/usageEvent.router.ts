import { Router } from "express";
import { Role } from "../../../generated/prisma/client";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { usageEventController } from "./usageEvent.controller";
import { UsageEventValidation } from "./usageEvent.validation";

const usageEventRouter: Router = Router();

usageEventRouter.get(
  "/",
  checkAuth(Role.ADMIN),
  validateRequest(UsageEventValidation.listUsageEventQuerySchema, "query"),
  usageEventController.listUsageEvents,
);

usageEventRouter.get(
  "/summary",
  checkAuth(Role.ADMIN),
  validateRequest(UsageEventValidation.usageSummaryQuerySchema, "query"),
  usageEventController.getUsageSummary,
);

export default usageEventRouter;
