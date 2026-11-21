-- AlterTable
ALTER TABLE `User` ADD COLUMN `passwordHash` VARCHAR(150) NULL;

-- AlterTable
ALTER TABLE `InvoiceItem` ADD COLUMN `meterEnd` DECIMAL(10, 2) NULL,
    ADD COLUMN `meterStart` DECIMAL(10, 2) NULL;

-- CreateTable
CREATE TABLE `Session` (
    `tokenHash` CHAR(64) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,

    INDEX `Session_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`tokenHash`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PropertyAccess` (
    `propertyId` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,

    PRIMARY KEY (`propertyId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Tenant` (
    `id` CHAR(36) NOT NULL,
    `propertyId` CHAR(36) NOT NULL,
    `userId` CHAR(36) NULL,
    `fullName` VARCHAR(120) NOT NULL,
    `contact` VARCHAR(120) NULL,

    UNIQUE INDEX `Tenant_propertyId_userId_key`(`propertyId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LeaseTenant` (
    `leaseId` CHAR(36) NOT NULL,
    `tenantId` CHAR(36) NOT NULL,
    `representative` BOOLEAN NOT NULL,

    PRIMARY KEY (`leaseId`, `tenantId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Handover` (
    `leaseId` CHAR(36) NOT NULL,
    `kind` ENUM('IN', 'OUT') NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `condition` VARCHAR(255) NOT NULL,
    `inventory` TEXT NOT NULL,
    `electric` DECIMAL(10, 2) NOT NULL,
    `water` DECIMAL(10, 2) NOT NULL,
    `notes` TEXT NULL,
    `confirmedAt` DATETIME(3) NULL,

    PRIMARY KEY (`leaseId`, `kind`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Payment` (
    `id` CHAR(36) NOT NULL,
    `invoiceId` CHAR(36) NOT NULL,
    `requestKey` CHAR(36) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `method` ENUM('CASH', 'TRANSFER', 'DEPOSIT') NOT NULL,
    `status` ENUM('PENDING', 'CONFIRMED', 'REVERSED') NOT NULL DEFAULT 'PENDING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `confirmedAt` DATETIME(3) NULL,

    UNIQUE INDEX `Payment_invoiceId_requestKey_key`(`invoiceId`, `requestKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Settlement` (
    `leaseId` CHAR(36) NOT NULL,
    `received` DECIMAL(12, 2) NOT NULL,
    `deduction` DECIMAL(12, 2) NOT NULL,
    `debtOffset` DECIMAL(12, 2) NOT NULL,
    `refund` DECIMAL(12, 2) NOT NULL,
    `reason` VARCHAR(255) NOT NULL,
    `invoiceId` CHAR(36) NULL,
    `confirmedBy` CHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`leaseId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Notification` (
    `id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `event` VARCHAR(100) NOT NULL,
    `message` VARCHAR(255) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Notification_userId_event_key`(`userId`, `event`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Audit` (
    `id` CHAR(36) NOT NULL,
    `actorId` CHAR(36) NOT NULL,
    `action` VARCHAR(50) NOT NULL,
    `entityId` CHAR(36) NOT NULL,
    `reason` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Audit_entityId_idx`(`entityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Session` ADD CONSTRAINT `Session_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PropertyAccess` ADD CONSTRAINT `PropertyAccess_propertyId_fkey` FOREIGN KEY (`propertyId`) REFERENCES `Property`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PropertyAccess` ADD CONSTRAINT `PropertyAccess_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Tenant` ADD CONSTRAINT `Tenant_propertyId_fkey` FOREIGN KEY (`propertyId`) REFERENCES `Property`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Tenant` ADD CONSTRAINT `Tenant_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeaseTenant` ADD CONSTRAINT `LeaseTenant_leaseId_fkey` FOREIGN KEY (`leaseId`) REFERENCES `Lease`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeaseTenant` ADD CONSTRAINT `LeaseTenant_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Handover` ADD CONSTRAINT `Handover_leaseId_fkey` FOREIGN KEY (`leaseId`) REFERENCES `Lease`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `Invoice`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Settlement` ADD CONSTRAINT `Settlement_leaseId_fkey` FOREIGN KEY (`leaseId`) REFERENCES `Lease`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

