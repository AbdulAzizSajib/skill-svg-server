import { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../lib/prisma";
import { buildMeta, buildQuery } from "../../utils/queryBuilder";

const listUsageEvents = async (query: Record<string, unknown>) => {
  const { where, orderBy, skip, take, page, limit } = buildQuery(query, {
    sortableFields: ["createdAt"],
    filterableFields: ["eventType", "country", "svgFileId"],
    defaultSortBy: "createdAt",
    defaultSortOrder: "desc",
  });

  const from = typeof query.from === "string" ? query.from : undefined;
  const to = typeof query.to === "string" ? query.to : undefined;

  if (from || to) {
    const and = (where.AND as Record<string, unknown>[]) ?? [];
    and.push({
      createdAt: {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to) } : {}),
      },
    });
    where.AND = and;
  }

  const [data, total] = await Promise.all([
    prisma.usageEvent.findMany({
      where,
      skip,
      take,
      orderBy,
      include: {
        svgFile: {
          select: {
            id: true,
            slug: true,
            title: true,
            cdnUrl: true,
          },
        },
      },
    }),
    prisma.usageEvent.count({ where }),
  ]);

  return { data, meta: buildMeta(total, page, limit) };
};

const getUsageSummary = async (query: Record<string, unknown>) => {
  const where: Prisma.UsageEventWhereInput = {};
  const from = typeof query.from === "string" ? query.from : undefined;
  const to = typeof query.to === "string" ? query.to : undefined;

  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }

  const [totalEvents, eventBreakdownRows, topSvgRows] = await Promise.all([
    prisma.usageEvent.count({ where }),
    prisma.usageEvent.groupBy({
      by: ["eventType"],
      where,
      _count: { _all: true },
      orderBy: { _count: { eventType: "desc" } },
    }),
    prisma.usageEvent.groupBy({
      by: ["svgFileId"],
      where,
      _count: { _all: true },
      orderBy: { _count: { svgFileId: "desc" } },
      take: 10,
    }),
  ]);

  const svgIds = topSvgRows.map((row) => row.svgFileId);
  const svgFiles = svgIds.length
    ? await prisma.svgFile.findMany({
        where: { id: { in: svgIds } },
        select: { id: true, slug: true, title: true, cdnUrl: true },
      })
    : [];

  const svgMap = new Map(svgFiles.map((item) => [item.id, item]));

  return {
    totalEvents,
    eventBreakdown: eventBreakdownRows.map((row) => ({
      eventType: row.eventType,
      count: row._count._all,
    })),
    topSvgFiles: topSvgRows.map((row) => ({
      count: row._count._all,
      svgFile: svgMap.get(row.svgFileId) ?? null,
    })),
    range: {
      from: from ?? null,
      to: to ?? null,
    },
  };
};

export const usageEventService = {
  listUsageEvents,
  getUsageSummary,
};
