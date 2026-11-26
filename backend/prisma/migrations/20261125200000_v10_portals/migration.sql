-- AlterTable
ALTER TABLE `User` MODIFY `role` ENUM('OWNER', 'STAFF', 'ACCOUNTANT', 'RENTER', 'ADMIN') NOT NULL DEFAULT 'OWNER';

-- AlterTable
ALTER TABLE `Room` ADD COLUMN `amenities` VARCHAR(500) NULL,
    ADD COLUMN `floorArea` DECIMAL(7, 2) NULL,
    ADD COLUMN `listingStatus` ENUM('DRAFT', 'PENDING', 'PUBLISHED', 'REJECTED') NOT NULL DEFAULT 'DRAFT';

-- CreateTable
CREATE TABLE `BookingRequest` (
    `id` CHAR(36) NOT NULL,
    `roomId` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `kind` VARCHAR(12) NOT NULL,
    `note` VARCHAR(500) NOT NULL,
    `visitDate` DATETIME(3) NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'CONFIRMED') NOT NULL DEFAULT 'PENDING',
    `holdFlag` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `BookingRequest_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `BookingRequest_roomId_status_idx`(`roomId`, `status`),
    UNIQUE INDEX `BookingRequest_roomId_holdFlag_key`(`roomId`, `holdFlag`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MaintenanceRequest` (
    `id` CHAR(36) NOT NULL,
    `leaseId` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `title` VARCHAR(120) NOT NULL,
    `description` VARCHAR(1000) NOT NULL,
    `status` ENUM('OPEN', 'IN_PROGRESS', 'DONE') NOT NULL DEFAULT 'OPEN',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `MaintenanceRequest_leaseId_status_idx`(`leaseId`, `status`),
    INDEX `MaintenanceRequest_userId_createdAt_idx`(`userId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OwnerApplication` (
    `id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `reason` VARCHAR(500) NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'CONFIRMED') NOT NULL DEFAULT 'PENDING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `OwnerApplication_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MeterEvidence` (
    `id` CHAR(36) NOT NULL,
    `readingId` CHAR(36) NOT NULL,
    `kind` ENUM('ELECTRICITY', 'WATER', 'SERVICE', 'OTHER') NOT NULL,
    `data` MEDIUMBLOB NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `MeterEvidence_readingId_kind_key`(`readingId`, `kind`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `BookingRequest` ADD CONSTRAINT `BookingRequest_roomId_fkey` FOREIGN KEY (`roomId`) REFERENCES `Room`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BookingRequest` ADD CONSTRAINT `BookingRequest_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MaintenanceRequest` ADD CONSTRAINT `MaintenanceRequest_leaseId_fkey` FOREIGN KEY (`leaseId`) REFERENCES `Lease`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MaintenanceRequest` ADD CONSTRAINT `MaintenanceRequest_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OwnerApplication` ADD CONSTRAINT `OwnerApplication_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MeterEvidence` ADD CONSTRAINT `MeterEvidence_readingId_fkey` FOREIGN KEY (`readingId`) REFERENCES `MeterReading`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
