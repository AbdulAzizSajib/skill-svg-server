import { Router } from "express";
import { requestSvgController } from "./requestSvg.controller";
import { validateRequest } from "../../middleware/validateRequest";
import { RequestSvgValidation } from "./requestSvg.validation";
import { checkAuth } from "../../middleware/checkAuth";
import { Role } from "../../../generated/prisma/enums";

const router : Router = Router();


// public route (anyone can request)
router.post(
  "/",
  validateRequest(RequestSvgValidation.createRequestSvgZodSchema),
  requestSvgController.createRequest
);

// admin routes
router.get(
  "/",
  checkAuth(Role.ADMIN),
  requestSvgController.getAllRequests
);

router.patch(
  "/:id/mark-added",
  checkAuth(Role.ADMIN),
  requestSvgController.markAsAdded
);

export const requestSvgRouter = router;

