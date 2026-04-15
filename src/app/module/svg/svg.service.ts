import status from "http-status";
import { EventType, Prisma, Visibility } from "../../../generated/prisma/client";
import { deleteFileFromCloudinary, uploadFileToCloudinary } from "../../config/cloudinary.config";
import AppError from "../../errorHelpers/AppError";
import { prisma } from "../../lib/prisma";
import { generateSvgSlug } from "../../utils/generateSvgSlug";
import { buildMeta, buildQuery } from "../../utils/queryBuilder";
import { sanitizeSvg } from "../../utils/svgSanitizer";
import { validateSvg } from "../../utils/svgValidator";

interface SvgInputPayload {
  svgContent: string;
  title?: string;
  visibility?: Visibility;
  categoryId?: string;
  tags?: string[];
  ownerId?: string;
  sourceFileName?: string;
}

const generateUniqueSvgSlug = async (slugInput?: string) => {
  const baseSlug = generateSvgSlug(slugInput);
  let nextSlug = baseSlug;
  let suffix = 2;

  while (true) {
    const existing = await prisma.svgFile.findUnique({
      where: { slug: nextSlug },
      select: { id: true },
    });

    if (!existing) {
      return nextSlug;
    }

    nextSlug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
};

// ── Core: validate → sanitize → upload → store ────────────────
const processSvgContent = async (payload: SvgInputPayload) => {
  const {
    svgContent,
    title,
    visibility = Visibility.PUBLIC,
    categoryId,
    tags,
    ownerId,
    sourceFileName,
  } = payload;

  // 1. Validate
  const validation = validateSvg(svgContent);
  if (!validation.isValid) {
    throw new AppError(status.UNPROCESSABLE_ENTITY, validation.errors.join("; "));
  }

  // 2. Sanitize
  const { sanitizedSvg, removedCount, removedItems } = sanitizeSvg(svgContent);

  const slug = await generateUniqueSvgSlug(sourceFileName ?? title);

  // 3. Upload sanitized SVG to Cloudinary
  const svgBuffer = Buffer.from(sanitizedSvg, "utf8");
  const fileName = `${slug}.svg`;

  const uploaded = await uploadFileToCloudinary(svgBuffer, fileName, {
    resource_type: "image",
    folder: "skillsvg",
    format: "svg",
  });
  const svgPublicUrl = uploaded.secure_url.replace(
    "/image/upload/",
    "/image/upload/fl_sanitize/",
  );

  // 4. Validation log
  const validationLog = JSON.stringify({
    warnings: validation.warnings,
    detectedThreats: validation.detectedThreats,
    sanitizedItems: removedItems,
    sanitizedCount: removedCount,
  });

  // 5. Resolve tags
  const tagCreatePayload = tags?.map((name) => ({
    tag: {
      connectOrCreate: {
        where: { slug: name.toLowerCase().replace(/\s+/g, "-") },
        create: {
          name,
          slug: name.toLowerCase().replace(/\s+/g, "-"),
        },
      },
    },
  }));

  if (categoryId) {
    const categoryExists = await prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true },
    });

    if (!categoryExists) {
      throw new AppError(status.NOT_FOUND, "Category not found");
    }
  }

  // 6. Persist
  const createData: Prisma.SvgFileCreateInput = {
    title: title ?? null,
    slug,
    originalSvg: svgContent,
    sanitizedSvg,
    cdnUrl: svgPublicUrl,
    fileSize: validation.fileSizeBytes,
    isValid: validation.isValid,
    hasMalicious: validation.hasMalicious,
    validationLog,
    visibility,
    ...(ownerId ? { owner: { connect: { id: ownerId } } } : {}),
    ...(categoryId ? { category: { connect: { id: categoryId } } } : {}),
    ...(tagCreatePayload ? { tags: { create: tagCreatePayload } } : {}),
  };

  return prisma.svgFile.create({
    data: createData,
    include: {
      tags: { include: { tag: true } },
      category: true,
    },
  });
};

// ── Upload via multipart file ──────────────────────────────────
const uploadSvgFile = async (
  file: Express.Multer.File,
  body: { title?: string; visibility?: Visibility; categoryId?: string; tags?: string[] },
  ownerId?: string,
) => {
  if (!file) throw new AppError(status.BAD_REQUEST, "SVG file is required");

  if (file.mimetype !== "image/svg+xml" && !file.originalname.endsWith(".svg")) {
    throw new AppError(status.UNPROCESSABLE_ENTITY, "Only .svg files are allowed");
  }

  return processSvgContent({
    svgContent: file.buffer.toString("utf8"),
    ...body,
    sourceFileName: file.originalname,
    ...(ownerId !== undefined ? { ownerId } : {}),
  });
};

// ── Upload via paste ───────────────────────────────────────────
const pasteSvg = async (
  body: {
    svgContent: string;
    title?: string;
    visibility?: Visibility;
    categoryId?: string;
    tags?: string[];
  },
  ownerId?: string,
) => {
  return processSvgContent({
    ...body,
    ...(ownerId !== undefined ? { ownerId } : {}),
  });
};

// ── List ───────────────────────────────────────────────────────
const listSvgFiles = async (query: Record<string, unknown>) => {
  const { where, orderBy, skip, take, page, limit } = buildQuery(query, {
    searchFields: ["title", "slug"],
    sortableFields: ["title", "createdAt", "viewCount", "copyCount"],
    filterableFields: ["categoryId", "visibility", "ownerId"],
    defaultSortBy: "createdAt",
    defaultSortOrder: "desc",
  });

  // tag filter uses a nested relation — add it manually
  const tag = typeof query.tag === "string" ? query.tag.trim() : "";
  if (tag) {
    const and = (where.AND as Record<string, unknown>[]) ?? [];
    and.push({ tags: { some: { tag: { slug: tag } } } });
    where.AND = and;
  }

  const [data, total] = await Promise.all([
    prisma.svgFile.findMany({
      where,
      skip,
      take,
      orderBy,
      include: {
        tags: { include: { tag: true } },
        category: true,
        owner: { select: { id: true, name: true, image: true } },
      },
    }),
    prisma.svgFile.count({ where }),
  ]);

  return { data, meta: buildMeta(total, page, limit) };
};

// ── Get single by slug ─────────────────────────────────────────
const getSvgBySlug = async (slug: string, trackView = true) => {
  const svgFile = await prisma.svgFile.findUnique({
    where: { slug },
    include: {
      tags: { include: { tag: true } },
      category: true,
      owner: { select: { id: true, name: true, image: true } },
    },
  });

  if (!svgFile) throw new AppError(status.NOT_FOUND, "SVG not found");

  if (trackView) {
    void Promise.all([
      prisma.svgFile.update({ where: { slug }, data: { viewCount: { increment: 1 } } }),
      prisma.usageEvent.create({ data: { svgFileId: svgFile.id, eventType: EventType.VIEW } }),
    ]);
  }

  return {
    ...svgFile,
    embedCode: `<img src="${svgFile.cdnUrl}" alt="${svgFile.title ?? "SVG"}" />`,
    inlineEmbed: svgFile.sanitizedSvg,
  };
};

const getSvgIconContentBySlug = async (slug: string) => {
  const svgFile = await prisma.svgFile.findUnique({
    where: { slug },
    select: { id: true, cdnUrl: true },
  });

  if (!svgFile) throw new AppError(status.NOT_FOUND, "SVG not found");

  const response = await fetch(svgFile.cdnUrl);

  if (!response.ok) {
    throw new AppError(status.BAD_GATEWAY, "Failed to fetch SVG content");
  }

  const svgContent = await response.text();

  void Promise.all([
    prisma.svgFile.update({ where: { slug }, data: { viewCount: { increment: 1 } } }),
    prisma.usageEvent.create({ data: { svgFileId: svgFile.id, eventType: EventType.VIEW } }),
  ]);

  return svgContent;
};

// ── Track copy events ──────────────────────────────────────────
const trackCopyEvent = async (slug: string, eventType: EventType) => {
  const svgFile = await prisma.svgFile.findUnique({ where: { slug } });
  if (!svgFile) throw new AppError(status.NOT_FOUND, "SVG not found");

  const countField =
    eventType === EventType.COPY_LINK
      ? "copyCount"
      : eventType === EventType.COPY_EMBED || eventType === EventType.EXTERNAL_EMBED
        ? "embedCount"
        : null;

  await Promise.all([
    countField &&
      prisma.svgFile.update({ where: { slug }, data: { [countField]: { increment: 1 } } }),
    prisma.usageEvent.create({ data: { svgFileId: svgFile.id, eventType } }),
  ]);

  return { tracked: true };
};

// ── Update metadata ────────────────────────────────────────────
const updateSvgFile = async (
  slug: string,
  payload: { title?: string; visibility?: Visibility; categoryId?: string | null; tags?: string[] },
  requesterId: string,
) => {
  const svgFile = await prisma.svgFile.findUnique({ where: { slug } });
  if (!svgFile) throw new AppError(status.NOT_FOUND, "SVG not found");

  if (svgFile.ownerId && svgFile.ownerId !== requesterId) {
    throw new AppError(status.FORBIDDEN, "You do not own this SVG");
  }

  const { tags, ...rest } = payload;

  // Rebuild tags if provided
  if (tags) {
    await prisma.svgTag.deleteMany({ where: { svgFileId: svgFile.id } });
  }

  return prisma.svgFile.update({
    where: { slug },
    data: {
      ...rest,
      ...(tags && {
        tags: {
          create: tags.map((name) => ({
            tag: {
              connectOrCreate: {
                where: { slug: name.toLowerCase().replace(/\s+/g, "-") },
                create: { name, slug: name.toLowerCase().replace(/\s+/g, "-") },
              },
            },
          })),
        },
      }),
    },
    include: {
      tags: { include: { tag: true } },
      category: true,
    },
  });
};

// ── Delete ─────────────────────────────────────────────────────
const deleteSvgFile = async (slug: string, requesterId: string, requesterRole: string) => {
  const svgFile = await prisma.svgFile.findUnique({ where: { slug } });
  if (!svgFile) throw new AppError(status.NOT_FOUND, "SVG not found");

  if (requesterRole !== "ADMIN" && svgFile.ownerId !== requesterId) {
    throw new AppError(status.FORBIDDEN, "You do not own this SVG");
  }

  // Delete from Cloudinary
 await deleteFileFromCloudinary(svgFile.cdnUrl, "image");

  await prisma.svgFile.delete({ where: { slug } });

  return { deleted: true };
};

export const svgService = {
  uploadSvgFile,
  pasteSvg,
  listSvgFiles,
  getSvgBySlug,
  getSvgIconContentBySlug,
  trackCopyEvent,
  updateSvgFile,
  deleteSvgFile,
};