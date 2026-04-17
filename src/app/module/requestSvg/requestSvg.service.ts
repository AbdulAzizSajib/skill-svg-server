import { prisma } from "../../lib/prisma";
import { ICreateRequestSvg } from "./requestSvg.interface";

const createRequest = async (
  payload: ICreateRequestSvg,
  meta: { ip?: string; country?: string }
) => {
  const { name } = payload;

  // optional: prevent duplicate spam (same name recent)
  const existing = await prisma.requestSvg.findFirst({
    where: {
      name: {
        equals: name,
        mode: "insensitive",
      },
    },
  });

  if (existing) {
    return existing; // already requested
  }

  const createData: { name: string; ip?: string | null; country?: string | null } = {
    name,
  };

  if (meta.ip !== undefined) createData.ip = meta.ip;
  if (meta.country !== undefined) createData.country = meta.country;

  const result = await prisma.requestSvg.create({
    data: createData,
  });

  return result;
};

// admin: get all requests
const getAllRequests = async () => {
  return prisma.requestSvg.findMany({
    orderBy: {
      createdAt: "desc",
    },
  });
};

// admin: mark as added
const markAsAdded = async (id: string) => {
  return prisma.requestSvg.update({
    where: { id },
    data: {
      status: "ADDED",
    },
  });
};

export const requestSvgService = {
  createRequest,
  getAllRequests,
  markAsAdded,
};