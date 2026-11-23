/*
  Warnings:

  - You are about to alter the column `name` on the `Role` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(50)`.
  - You are about to alter the column `fullName` on the `User` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(100)`.
  - You are about to alter the column `phone` on the `User` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(20)`.

*/
-- DropIndex
DROP INDEX `AuditLog_createdAt_idx` ON `AuditLog`;

-- DropIndex
DROP INDEX `UserPropertyAccess_propertyId_idx` ON `UserPropertyAccess`;

-- AlterTable
ALTER TABLE `Role` MODIFY `name` VARCHAR(50) NOT NULL;

-- AlterTable
ALTER TABLE `User` ADD COLUMN `tokenVersion` INTEGER NOT NULL DEFAULT 0,
    MODIFY `email` VARCHAR(255) NOT NULL,
    MODIFY `passwordHash` VARCHAR(255) NOT NULL,
    MODIFY `fullName` VARCHAR(100) NOT NULL,
    MODIFY `phone` VARCHAR(20) NULL;

-- CreateTable
CREATE TABLE `Payment` (
    `id` CHAR(36) NOT NULL,
    `leaseId` CHAR(36) NOT NULL,
    `transactionType` ENUM('INVOICE_PAYMENT', 'DEPOSIT_OFFSET', 'DEPOSIT_REFUND') NOT NULL DEFAULT 'INVOICE_PAYMENT',
    `amount` DECIMAL(12, 2) NOT NULL,
    `paymentMethod` VARCHAR(20) NOT NULL,
    `payerName` VARCHAR(100) NOT NULL,
    `paidAt` DATETIME(3) NOT NULL,
    `referenceCode` VARCHAR(100) NULL,
    `idempotencyKey` VARCHAR(100) NULL,
    `status` ENUM('PENDING', 'CONFIRMED', 'REVERSED') NOT NULL DEFAULT 'PENDING',
    `recordedById` CHAR(36) NOT NULL,
    `reversedAt` DATETIME(3) NULL,
    `reversedById` CHAR(36) NULL,
    `reversalReason` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Payment_referenceCode_key`(`referenceCode`),
    INDEX `Payment_leaseId_status_idx`(`leaseId`, `status`),
    UNIQUE INDEX `Payment_recordedById_idempotencyKey_key`(`recordedById`, `idempotencyKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PaymentAllocation` (
    `id` CHAR(36) NOT NULL,
    `paymentId` CHAR(36) NOT NULL,
    `invoiceId` CHAR(36) NOT NULL,
    `allocatedAmount` DECIMAL(12, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PaymentAllocation_invoiceId_idx`(`invoiceId`),
    UNIQUE INDEX `PaymentAllocation_paymentId_invoiceId_key`(`paymentId`, `invoiceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Invitation` (
    `id` CHAR(36) NOT NULL,
    `tokenHash` VARCHAR(64) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `leaseId` CHAR(36) NOT NULL,
    `createdById` CHAR(36) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Invitation_tokenHash_key`(`tokenHash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FileAsset` (
    `id` CHAR(36) NOT NULL,
    `entityType` VARCHAR(50) NOT NULL,
    `entityId` VARCHAR(64) NOT NULL,
    `uploadedById` CHAR(36) NOT NULL,
    `storageKey` VARCHAR(255) NOT NULL,
    `mimeType` VARCHAR(50) NOT NULL,
    `sizeBytes` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `FileAsset_entityType_entityId_idx`(`entityType`, `entityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `AuditLog_actorId_createdAt_idx` ON `AuditLog`(`actorId`, `createdAt`);

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_recordedById_fkey` FOREIGN KEY (`recordedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaymentAllocation` ADD CONSTRAINT `PaymentAllocation_paymentId_fkey` FOREIGN KEY (`paymentId`) REFERENCES `Payment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
