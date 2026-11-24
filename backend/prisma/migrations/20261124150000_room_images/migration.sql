CREATE TABLE `RoomImage` (
    `id` CHAR(36) NOT NULL,
    `roomId` CHAR(36) NOT NULL,
    `storageKey` VARCHAR(80) NOT NULL,
    `mimeType` VARCHAR(40) NOT NULL DEFAULT 'image/webp',
    `sizeBytes` INTEGER NOT NULL,
    `width` INTEGER NOT NULL,
    `height` INTEGER NOT NULL,
    `alt` VARCHAR(160) NOT NULL,
    `isPrimary` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `RoomImage_storageKey_key` (`storageKey`),
    INDEX `RoomImage_roomId_isPrimary_createdAt_idx` (`roomId`, `isPrimary`, `createdAt`),
    PRIMARY KEY (`id`),
    CONSTRAINT `RoomImage_roomId_fkey` FOREIGN KEY (`roomId`) REFERENCES `Room`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
