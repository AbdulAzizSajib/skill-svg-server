import { z } from "zod";
import { Visibility } from "../../../generated/prisma/client";

const tagsField = z
  .union([
    z.array(z.string().max(40)),
    z.string().transform((val) =>
      val.split(",").map((t) => t.trim()).filter(Boolean),
    ),
  ])
  .optional();

const uploadSvgBodySchema = z.object({
  title: z.string().max(120).optional(),
  visibility: z.nativeEnum(Visibility).optional().default(Visibility.PUBLIC),
  categoryId: z.string().cuid().optional(),
  tags: tagsField,
});

const pasteSvgSchema = z.object({
  svgContent: z
    .string({ error: "SVG content is required" })
    .min(10, "SVG content too short")
    .max(2_097_152, "SVG content exceeds 2MB"),
  title: z.string().max(120).optional(),
  visibility: z.nativeEnum(Visibility).optional().default(Visibility.PUBLIC),
  categoryId: z.string().cuid().optional(),
  tags: tagsField,
});

const updateSvgSchema = z.object({
  title: z.string().max(120).optional(),
  visibility: z.nativeEnum(Visibility).optional(),
  categoryId: z.string().cuid().nullable().optional(),
  tags: z.array(z.string().max(40)).optional(),
});

const trackEventSchema = z.object({
  type: z.enum(["link", "embed", "external_embed"]),
});

const listSvgQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  search: z.string().optional(),
  sortBy: z.enum(["title", "createdAt", "viewCount", "copyCount"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
  categoryId: z.string().cuid().optional(),
  tag: z.string().optional(),
  visibility: z.nativeEnum(Visibility).optional(),
  ownerId: z.string().optional(),
});

export const SvgValidation = {
  uploadSvgBodySchema,
  pasteSvgSchema,
  updateSvgSchema,
  trackEventSchema,
  listSvgQuerySchema,
};