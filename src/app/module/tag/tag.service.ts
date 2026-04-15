import status from "http-status";
import AppError from "../../errorHelpers/AppError";
import { prisma } from "../../lib/prisma";
import { buildMeta, buildQuery } from "../../utils/queryBuilder";

const listTags = async (query: Record<string, unknown>) => {
  const { where, orderBy, skip, take, page, limit } = buildQuery(query, {
    searchFields: ["name", "slug"],
    sortableFields: ["name", "slug"],
    defaultSortBy: "name",
    defaultSortOrder: "asc",
  });

  const [data, total] = await Promise.all([
    prisma.tag.findMany({
      where,
      skip,
      take,
      orderBy,
      include: {
        _count: { select: { svgFiles: true } },
      },
    }),
    prisma.tag.count({ where }),
  ]);

  return { data, meta: buildMeta(total, page, limit) };
};

const getTagBySlug = async (slug: string) => {
  const tag = await prisma.tag.findUnique({
    where: { slug },
    include: {
      _count: { select: { svgFiles: true } },
      svgFiles: {
        include: {
          svgFile: {
            select: {
              id: true,
              slug: true,
              title: true,
              cdnUrl: true,
              visibility: true,
              viewCount: true,
              copyCount: true,
              embedCount: true,
              createdAt: true,
            },
          },
        },
      },
    },
  });

  if (!tag) {
    throw new AppError(status.NOT_FOUND, "Tag not found");
  }

  return {
    ...tag,
    svgFiles: tag.svgFiles.map((item) => item.svgFile),
  };
};

export const tagService = {
  listTags,
  getTagBySlug,
};
