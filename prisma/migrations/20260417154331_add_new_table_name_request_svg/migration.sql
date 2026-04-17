-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'ADDED');

-- CreateTable
CREATE TABLE "requested_svgs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ip" TEXT,
    "country" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "requested_svgs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "requested_svgs_name_idx" ON "requested_svgs"("name");

-- CreateIndex
CREATE INDEX "requested_svgs_status_idx" ON "requested_svgs"("status");
