import { Router } from "express";
import { validateRequest } from "../../middleware/validateRequest";
import { tagController } from "./tag.controller";
import { TagValidation } from "./tag.validation";

const tagRouter: Router = Router();

tagRouter.get(
  "/",
  validateRequest(TagValidation.listTagQuerySchema, "query"),
  tagController.listTags,
);

tagRouter.get(
  "/:slug",
  validateRequest(TagValidation.tagSlugParamSchema, "params"),
  tagController.getTagBySlug,
);

export default tagRouter;
