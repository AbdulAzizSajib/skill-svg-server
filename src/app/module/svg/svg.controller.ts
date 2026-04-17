import { Request, Response } from "express";
import status from "http-status";
import { EventType } from "../../../generated/prisma/client";
import AppError from "../../errorHelpers/AppError";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { svgService } from "./svg.service";

const getSlugParam = (req: Request): string => {
  const { slug } = req.params;

  if (typeof slug !== "string" || !slug.trim()) {
    throw new AppError(status.BAD_REQUEST, "Valid slug param is required");
  }

  return slug;
};

const uploadSvgFile = catchAsync(async (req: Request, res: Response) => {
  const result = await svgService.uploadSvgFile(req.file!, req.body);

  sendResponse(res, {
    httpStatusCode: status.CREATED,
    success: true,
    message: "SVG uploaded successfully",
    data: result,
  });
});

const bulkPasteSvg = catchAsync(async (req: Request, res: Response) => {
  const { items } = req.body;
  const result = await svgService.bulkPasteSvg(items);

  sendResponse(res, {
    httpStatusCode: status.CREATED,
    success: true,
    message: `Bulk upload completed: ${result.successful} successful, ${result.failed} failed`,
    data: result,
  });
});

const listSvgFiles = catchAsync(async (req: Request, res: Response) => {
  const result = await svgService.listSvgFiles(req.query as Record<string, unknown>);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "SVG files retrieved successfully",
    data: result.data,
    meta: result.meta,
  });
});

const getSvgBySlug = catchAsync(async (req: Request, res: Response) => {
  const slug = getSlugParam(req);
  const result = await svgService.getSvgBySlug(slug);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "SVG retrieved successfully",
    data: result,
  });
});

const serveSvgIcon = catchAsync(async (req: Request, res: Response) => {
  const slug = getSlugParam(req);
  const { w, h } = req.query as { w?: number; h?: number };

  const formatOptions: { width?: number; height?: number } = {};
  if (w !== undefined) formatOptions.width = w;
  if (h !== undefined) formatOptions.height = h;


const options = Object.keys(formatOptions).length > 0 ? formatOptions : undefined;

  // ── Comma detected → multi-icon ──────────────────────────────
  if (slug.includes(",")) {
    const slugList = slug.split(",").map((s) => s.trim()).filter(Boolean);
    const svgContent = await svgService.getMultipleSvgIcons(slugList, options);

    res.setHeader("Content-Type", "image/svg+xml");
    res.setHeader("Cache-Control", "public, max-age=31536000");
    return res.send(svgContent);
  }



  const svgContent = await svgService.getSvgIconContentBySlug(
    slug,
    options,
  );

  res.setHeader("Content-Type", "image/svg+xml");
  res.setHeader("Cache-Control", "public, max-age=31536000");
  res.send(svgContent);
});

const trackCopy = catchAsync(async (req: Request, res: Response) => {
  const slug = getSlugParam(req);
  const { type } = req.body as { type: "link" | "embed" | "external_embed" };

  const eventType =
    type === "link"
      ? EventType.COPY_LINK
      : type === "embed"
        ? EventType.COPY_EMBED
        : EventType.EXTERNAL_EMBED;
  const result = await svgService.trackCopyEvent(slug, eventType);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Event tracked",
    data: result,
  });
});

const updateSvgFile = catchAsync(async (req: Request, res: Response) => {
  const slug = getSlugParam(req);
  const result = await svgService.updateSvgFile(slug, req.body);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "SVG updated successfully",
    data: result,
  });
});

const deleteSvgFile = catchAsync(async (req: Request, res: Response) => {
  const slug = getSlugParam(req);
  const result = await svgService.deleteSvgFile(slug);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "SVG deleted successfully",
    data: result,
  });
});

export const svgController = {
  uploadSvgFile,
  bulkPasteSvg,
  listSvgFiles,
  serveSvgIcon,
  getSvgBySlug,
  trackCopy,
  updateSvgFile,
  deleteSvgFile,
  // getMultipleSvgIcons
  
};