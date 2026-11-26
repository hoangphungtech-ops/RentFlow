ALTER TABLE `Room` ADD COLUMN `listingTitle` VARCHAR(150) NULL;

CREATE TABLE `BookingMessage` (
  `id` CHAR(36) NOT NULL,
  `bookingId` CHAR(36) NOT NULL,
  `authorId` CHAR(36) NOT NULL,
  `body` VARCHAR(1000) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `BookingMessage_bookingId_createdAt_idx` (`bookingId`, `createdAt`),
  INDEX `BookingMessage_authorId_idx` (`authorId`),
  CONSTRAINT `BookingMessage_bookingId_fkey` FOREIGN KEY (`bookingId`) REFERENCES `BookingRequest` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `BookingMessage_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
