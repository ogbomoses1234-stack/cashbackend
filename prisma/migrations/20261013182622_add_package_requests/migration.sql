-- CreateEnum
CREATE TYPE "PackageStatus" AS ENUM ('draft', 'submitted', 'quoted', 'approved', 'in_progress', 'shipped', 'delivered', 'cancelled');

-- CreateEnum
CREATE TYPE "PackageEditStatus" AS ENUM ('pending', 'approved', 'denied');

-- CreateTable
CREATE TABLE "package_requests" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "PackageStatus" NOT NULL DEFAULT 'draft',
    "isEditable" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "country" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "deliveryAddress" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "quotedTotal" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "package_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "package_items" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "productId" TEXT,
    "name" TEXT NOT NULL,
    "details" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "estimatedPrice" DECIMAL(12,2),
    "imageObjectKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "package_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "package_messages" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "senderRole" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "attachmentObjectKey" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "package_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "package_edit_requests" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "PackageEditStatus" NOT NULL DEFAULT 'pending',
    "adminNote" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "package_edit_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "package_requests_reference_key" ON "package_requests"("reference");

-- CreateIndex
CREATE INDEX "package_requests_userId_createdAt_idx" ON "package_requests"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "package_requests_status_idx" ON "package_requests"("status");

-- CreateIndex
CREATE INDEX "package_items_requestId_idx" ON "package_items"("requestId");

-- CreateIndex
CREATE INDEX "package_messages_requestId_createdAt_idx" ON "package_messages"("requestId", "createdAt");

-- CreateIndex
CREATE INDEX "package_edit_requests_requestId_idx" ON "package_edit_requests"("requestId");

-- AddForeignKey
ALTER TABLE "package_requests" ADD CONSTRAINT "package_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_items" ADD CONSTRAINT "package_items_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "package_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_messages" ADD CONSTRAINT "package_messages_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "package_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_edit_requests" ADD CONSTRAINT "package_edit_requests_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "package_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
