import status from "http-status";
import { EventType, Prisma, Visibility } from "../../../generated/prisma/client";
import { deleteFileFromCloudinary, uploadFileToCloudinary } from "../../config/cloudinary.config";
import AppError from "../../errorHelpers/AppError";
import { prisma } from "../../lib/prisma";
import { generateSvgSlug } from "../../utils/generateSvgSlug";
import { buildMeta, buildQuery } from "../../utils/queryBuilder";
import { formatSvg, SvgFormatOptions } from "../../utils/svgFormatter";
import { sanitizeSvg } from "../../utils/svgSanitizer";
import { validateSvg } from "../../utils/svgValidator";

interface SvgInputPayload {
  svgContent: string;
  title?: string | undefined;
  visibility?: Visibility | undefined;
  sourceFileName?: string | undefined;
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

  // 5. Persist
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
  };

  return prisma.svgFile.create({
    data: createData,
  });
};

// ── Upload via multipart file ──────────────────────────────────
const uploadSvgFile = async (
  file: Express.Multer.File,
  body: { title?: string; visibility?: Visibility },
) => {
  if (!file) throw new AppError(status.BAD_REQUEST, "SVG file is required");

  if (file.mimetype !== "image/svg+xml" && !file.originalname.endsWith(".svg")) {
    throw new AppError(status.UNPROCESSABLE_ENTITY, "Only .svg files are allowed");
  }

  return processSvgContent({
    svgContent: file.buffer.toString("utf8"),
    ...body,
    sourceFileName: file.originalname,
  });
};

// ── Bulk upload via paste ────────────────────────────────────────
const bulkPasteSvg = async (
  items: Array<{
    svgContent: string;
    title?: string;
    visibility?: Visibility;
  }>,
) => {
  // Process in parallel for faster upload
  const uploadPromises = items.map(async (item, index) => {
    try {
      const result = await processSvgContent({
        svgContent: item.svgContent,
        title: item.title,
        visibility: item.visibility,
      });
      return { index, success: true as const, data: result };
    } catch (error) {
      return {
        index,
        success: false as const,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  });

  const settled = await Promise.all(uploadPromises);

  const results = settled.filter((r) => r.success);
  const errors = settled.filter((r) => !r.success);

  return {
    total: items.length,
    successful: results.length,
    failed: errors.length,
    results,
    errors,
  };
};

// ── List ───────────────────────────────────────────────────────
const listSvgFiles = async (query: Record<string, unknown>) => {
  const { where, orderBy, skip, take, page, limit } = buildQuery(query, {
    searchFields: ["title", "slug"],
    sortableFields: ["title", "createdAt", "viewCount", "copyCount"],
    filterableFields: ["visibility"],
    defaultSortBy: "createdAt",
    defaultSortOrder: "desc",
    maxLimit: 200,
  });

  // Optimize: Only fetch necessary fields
  const [data, total] = await Promise.all([
    prisma.svgFile.findMany({
      where,
      skip,
      take,
      orderBy,
      select: {
        id: true,
        title: true,
        slug: true,
        cdnUrl: true,
        fileSize: true,
        isValid: true,
        visibility: true,
        viewCount: true,
        copyCount: true,
        embedCount: true,
        createdAt: true,
        updatedAt: true,
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

const getSvgIconContentBySlug = async (slug: string, formatOptions?: SvgFormatOptions) => {
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

  return formatOptions ? formatSvg(svgContent, formatOptions) : svgContent;
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
  payload: { title?: string; visibility?: Visibility },
) => {
  const svgFile = await prisma.svgFile.findUnique({ where: { slug } });
  if (!svgFile) throw new AppError(status.NOT_FOUND, "SVG not found");

  return prisma.svgFile.update({
    where: { slug },
    data: {
      ...payload,
    },
  });
};

// ── Delete ─────────────────────────────────────────────────────
const deleteSvgFile = async (slug: string) => {
  const svgFile = await prisma.svgFile.findUnique({ where: { slug } });
  if (!svgFile) throw new AppError(status.NOT_FOUND, "SVG not found");

  // Delete DB record first; Cloudinary cleanup is best-effort
  await prisma.svgFile.delete({ where: { slug } });

  deleteFileFromCloudinary(svgFile.cdnUrl, "image").catch((err) => {
    console.error("Cloudinary delete failed for", svgFile.cdnUrl, err);
  });

  return { deleted: true };
};


// ── Serve multiple icons as SVG sprite ────────────────────────
// const getMultipleSvgIcons = async (slugs: string[], formatOptions?: SvgFormatOptions) => {
//   if (slugs.length > 20) {
//     throw new AppError(status.BAD_REQUEST, "Maximum 20 icons per request");
//   }

//   const svgFiles = await prisma.svgFile.findMany({
//     where: { slug: { in: slugs } },
//     select: { id: true, slug: true, cdnUrl: true, title: true },
//   });

//   if (svgFiles.length === 0) {
//     throw new AppError(status.NOT_FOUND, "No SVGs found");
//   }

//   // Fetch all SVG contents in parallel
//   const fetchResults = await Promise.all(
//     svgFiles.map(async (file) => {
//       const response = await fetch(file.cdnUrl);
//       if (!response.ok) return null;
//       const content = await response.text();
//       return { ...file, content };
//     }),
//   );

//   const validResults = fetchResults.filter(Boolean) as Array<{
//     id: string;
//     slug: string;
//     title: string | null;
//     content: string;
//   }>;

//   // Fire-and-forget view tracking for all
//   void Promise.all(
//     validResults.map((f) =>
//       Promise.all([
//         prisma.svgFile.update({ where: { slug: f.slug }, data: { viewCount: { increment: 1 } } }),
//         prisma.usageEvent.create({ data: { svgFileId: f.id, eventType: EventType.VIEW } }),
//       ]),
//     ),
//   );

//   const width = formatOptions?.width ?? 24;
//   const height = formatOptions?.height ?? 24;
//   const gap = 8;
//   const cols = validResults.length;
//   const totalWidth = cols * width + (cols - 1) * gap;

//   // Strip outer <svg> wrapper from each icon, wrap as <g> positioned inline
//   const symbols = validResults
//     .map((file, i) => {
//       // Extract inner content from <svg ...>...</svg>
//       const innerMatch = file.content.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
//       const inner = innerMatch?.[1] ?? file.content;

//       // Extract viewBox from the original so scaling works correctly
//       const viewBoxMatch = file.content.match(/viewBox=["']([^"']+)["']/i);
//       const viewBox = viewBoxMatch?.[1] ?? `0 0 ${width} ${height}`;

//       const x = i * (width + gap);

//       return `
//   <svg x="${x}" y="0" width="${width}" height="${height}" viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg">
//     ${inner}
//   </svg>`;
//     })
//     .join("\n");

//   const combinedSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${height}" viewBox="0 0 ${totalWidth} ${height}">
// ${symbols}
// </svg>`;

//   return combinedSvg;
// };

const getMultipleSvgIcons = async (slugs: string[], formatOptions?: SvgFormatOptions) => {
  if (slugs.length > 20) {
    throw new AppError(status.BAD_REQUEST, "Maximum 20 icons per request");
  }

  const svgFiles = await prisma.svgFile.findMany({
    where: { slug: { in: slugs } },
    select: { id: true, slug: true, cdnUrl: true, title: true },
  });

  if (svgFiles.length === 0) {
    throw new AppError(status.NOT_FOUND, "No SVGs found");
  }

  // ── Original slug order বজায় রাখো ────────────────────────────
  const slugIndexMap = new Map(slugs.map((slug, i) => [slug, i]));
  svgFiles.sort((a, b) => (slugIndexMap.get(a.slug) ?? 0) - (slugIndexMap.get(b.slug) ?? 0));

  // ── Parallel fetch ────────────────────────────────────────────
  const fetchResults = await Promise.all(
    svgFiles.map(async (file) => {
      const response = await fetch(file.cdnUrl);
      if (!response.ok) return null;
      const content = await response.text();
      return { ...file, content };
    }),
  );

  const validResults = fetchResults.filter(Boolean) as Array<{
    id: string;
    slug: string;
    title: string | null;
    content: string;
  }>;

  if (validResults.length === 0) {
    throw new AppError(status.BAD_GATEWAY, "Failed to fetch SVG contents");
  }

  // ── Fire-and-forget tracking ──────────────────────────────────
  void Promise.all(
    validResults.map((f) =>
      Promise.all([
        prisma.svgFile.update({ where: { slug: f.slug }, data: { viewCount: { increment: 1 } } }),
        prisma.usageEvent.create({ data: { svgFileId: f.id, eventType: EventType.VIEW } }),
      ]),
    ),
  );

  const width = formatOptions?.width ?? 24;
  const height = formatOptions?.height ?? 24;
  const gap = 8;
  const totalWidth = validResults.length * width + (validResults.length - 1) * gap;

  const symbols = validResults
    .map((file, i) => {
      const innerMatch = file.content.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
      const inner = innerMatch?.[1] ?? file.content;

      const viewBoxMatch = file.content.match(/viewBox=["']([^"']+)["']/i);
      const viewBox = viewBoxMatch?.[1] ?? `0 0 ${width} ${height}`;

      const x = i * (width + gap);

      return `  <svg x="${x}" y="0" width="${width}" height="${height}" viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
    })
    .join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${height}" viewBox="0 0 ${totalWidth} ${height}">\n${symbols}\n</svg>`;
};

export const svgService = {
  uploadSvgFile,
  bulkPasteSvg,
  listSvgFiles,
  getSvgBySlug,
  getSvgIconContentBySlug,
  trackCopyEvent,
  updateSvgFile,
  deleteSvgFile,
  getMultipleSvgIcons
};