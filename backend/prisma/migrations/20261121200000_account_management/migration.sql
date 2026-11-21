ALTER TABLE `User` ADD COLUMN `username` VARCHAR(32) NULL,
    ADD COLUMN `managedById` CHAR(36) NULL,
    ADD COLUMN `lockedAt` DATETIME(3) NULL,
    ADD COLUMN `emailVerifiedAt` DATETIME(3) NULL,
    ADD COLUMN `isDemo` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `recoveryRequestedAt` DATETIME(3) NULL,
    ADD UNIQUE INDEX `User_username_key` (`username`),
    ADD CONSTRAINT `User_managedById_fkey` FOREIGN KEY (`managedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE `AccountCode` (
    `hash` CHAR(64) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `kind` ENUM('INVITE','RESET') NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    PRIMARY KEY (`hash`),
    UNIQUE INDEX `AccountCode_userId_kind_key` (`userId`,`kind`),
    CONSTRAINT `AccountCode_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
