import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { requestSvgService } from "./requestSvg.service";
import AppError from "../../errorHelpers/AppError";
import geoip from "geoip-lite";

const createRequest = catchAsync(async (req: Request, res: Response) => {
  const payload = req.body;

  const ip = req.ip;

  const geo = geoip.lookup(ip);
  const country = geo?.country || "Unknown";

  const result = await requestSvgService.createRequest(payload, {
    ip,
    country
  });

  sendResponse(res, {
    httpStatusCode: status.CREATED,
    success: true,
    message: "Request submitted successfully",
    data: result,
  });
});

const getAllRequests = catchAsync(async (_req: Request, res: Response) => {
  const result = await requestSvgService.getAllRequests();

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Requests retrieved successfully",
    data: result,
  });
});

const markAsAdded = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id || typeof id !== "string") {
    throw new AppError(status.BAD_REQUEST, "Request ID is required");
  }

  const result = await requestSvgService.markAsAdded(id);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Marked as added",
    data: result,
  });
});

export const requestSvgController = {
  createRequest,
  getAllRequests,
  markAsAdded,
};