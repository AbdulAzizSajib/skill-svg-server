import { EventType } from "../../../generated/prisma/client";
import { z } from "zod";

const listUsageEventQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  sortBy: z.enum(["createdAt"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
  eventType: z.nativeEnum(EventType).optional(),
  country: z.string().optional(),
  svgFileId: z.string().cuid().optional(),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
});

const usageSummaryQuerySchema = z.object({
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
});

export const UsageEventValidation = {
  listUsageEventQuerySchema,
  usageSummaryQuerySchema,
};
