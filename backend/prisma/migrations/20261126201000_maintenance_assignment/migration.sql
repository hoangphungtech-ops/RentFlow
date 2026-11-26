ALTER TABLE `MaintenanceRequest` ADD COLUMN `assigneeId` CHAR(36) NULL;
CREATE INDEX `MaintenanceRequest_assigneeId_idx` ON `MaintenanceRequest`(`assigneeId`);
ALTER TABLE `MaintenanceRequest` ADD CONSTRAINT `MaintenanceRequest_assigneeId_fkey` FOREIGN KEY (`assigneeId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
