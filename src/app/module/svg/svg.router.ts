import { Router } from "express";
import { Role } from "../../../generated/prisma/client";
import { multerUpload } from "../../config/multer.config";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { svgController } from "./svg.controller";
import { SvgValidation } from "./svg.validation";

const svgRouter: Router = Router();

// Public
svgRouter.get("/", validateRequest(SvgValidation.listSvgQuerySchema, "query"), svgController.listSvgFiles);
svgRouter.get("/icons/:slug", svgController.serveSvgIcon);
svgRouter.get("/:slug", svgController.getSvgBySlug);

// Semi-public (guest allowed, ownerId optional)
svgRouter.post(
  "/upload",
  multerUpload.single("svg"),
  validateRequest(SvgValidation.uploadSvgBodySchema),
  svgController.uploadSvgFile,
);

svgRouter.post(
  "/paste",
  validateRequest(SvgValidation.pasteSvgSchema),
  svgController.pasteSvg,
);

// Track copy events (no auth needed)
svgRouter.post(
  "/:slug/track",
  validateRequest(SvgValidation.trackEventSchema),
  svgController.trackCopy,
);

// Protected
svgRouter.patch(
  "/:slug",
  checkAuth(Role.USER, Role.ADMIN),
  validateRequest(SvgValidation.updateSvgSchema),
  svgController.updateSvgFile,
);

svgRouter.delete(
  "/:slug",
  checkAuth(Role.USER, Role.ADMIN),
  svgController.deleteSvgFile,
);

export default svgRouter;