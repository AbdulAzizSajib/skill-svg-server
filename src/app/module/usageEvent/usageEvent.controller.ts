import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { usageEventService } from "./usageEvent.service";

const listUsageEvents = catchAsync(async (req: Request, res: Response) => {
  const result = await usageEventService.listUsageEvents(req.query as Record<string, unknown>);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Usage events retrieved successfully",
    data: result.data,
    meta: result.meta,
  });
});

const getUsageSummary = catchAsync(async (req: Request, res: Response) => {
  const result = await usageEventService.getUsageSummary(req.query as Record<string, unknown>);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Usage summary retrieved successfully",
    data: result,
  });
});

export const usageEventController = {
  listUsageEvents,
  getUsageSummary,
};
