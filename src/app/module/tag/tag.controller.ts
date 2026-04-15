import { Request, Response } from "express";
import status from "http-status";
import AppError from "../../errorHelpers/AppError";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { tagService } from "./tag.service";

const getSlugParam = (value: string | string[] | undefined) => {
  if (typeof value !== "string" || !value.trim()) {
    throw new AppError(status.BAD_REQUEST, "Tag slug is required");
  }

  return value;
};

const listTags = catchAsync(async (req: Request, res: Response) => {
  const result = await tagService.listTags(req.query as Record<string, unknown>);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Tags retrieved successfully",
    data: result.data,
    meta: result.meta,
  });
});

const getTagBySlug = catchAsync(async (req: Request, res: Response) => {
  const slug = getSlugParam(req.params.slug);
  const result = await tagService.getTagBySlug(slug);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Tag retrieved successfully",
    data: result,
  });
});

export const tagController = {
  listTags,
  getTagBySlug,
};
