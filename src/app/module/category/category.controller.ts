import { Request, Response } from "express";
import status from "http-status";
import AppError from "../../errorHelpers/AppError";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { categoryService } from "./category.service";

const getParam = (value: string | string[] | undefined, fieldName: string) => {
  if (typeof value !== "string" || !value.trim()) {
    throw new AppError(status.BAD_REQUEST, `${fieldName} param is required`);
  }

  return value;
};

const createCategory = catchAsync(async (req: Request, res: Response) => {
  const result = await categoryService.createCategory(req.body);

  sendResponse(res, {
    httpStatusCode: status.CREATED,
    success: true,
    message: "Category created successfully",
    data: result,
  });
});

const listCategories = catchAsync(async (req: Request, res: Response) => {
  const result = await categoryService.listCategories(req.query as Record<string, unknown>);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Categories retrieved successfully",
    data: result.data,
    meta: result.meta,
  });
});

const getCategoryBySlug = catchAsync(async (req: Request, res: Response) => {
  const slug = getParam(req.params.slug, "slug");
  const result = await categoryService.getCategoryBySlug(slug);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Category retrieved successfully",
    data: result,
  });
});

const updateCategory = catchAsync(async (req: Request, res: Response) => {
  const id = getParam(req.params.id, "id");
  const result = await categoryService.updateCategory(id, req.body);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Category updated successfully",
    data: result,
  });
});

const deleteCategory = catchAsync(async (req: Request, res: Response) => {
  const id = getParam(req.params.id, "id");
  const result = await categoryService.deleteCategory(id);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Category deleted successfully",
    data: result,
  });
});

export const categoryController = {
  createCategory,
  listCategories,
  getCategoryBySlug,
  updateCategory,
  deleteCategory,
};
