import { Router } from "express";
import { userController } from "./user.controller";
import { validateRequest } from "../../middleware/validateRequest";
import { UserValidation } from "./user.validation";
import { checkAuth } from "../../middleware/checkAuth";
import { Role } from "../../../generated/prisma/enums";
import { multerUpload } from "../../config/multer.config";

const userRouter: Router = Router();




// Create admin (OWNER or ADMIN only)
userRouter.post(
  "/create-admin",
  checkAuth(Role.ADMIN),
  validateRequest(UserValidation.createAdminZodSchema),
  userController.createAdmin,
);

userRouter.patch(
  "/me",
  checkAuth(Role.USER, Role.ADMIN),
  multerUpload.single("profilePhoto"),
  validateRequest(UserValidation.updateProfileZodSchema),
  userController.updateProfile,
);

export default userRouter;
