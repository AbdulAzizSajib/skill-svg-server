import { z } from "zod";

const listTagQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  search: z.string().optional(),
  sortBy: z.enum(["name", "slug"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

const tagSlugParamSchema = z.object({
  slug: z.string().min(1, "Tag slug is required"),
});

export const TagValidation = {
  listTagQuerySchema,
  tagSlugParamSchema,
};
