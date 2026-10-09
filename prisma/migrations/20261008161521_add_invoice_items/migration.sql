-- CreateTable
CREATE TABLE `InvoiceItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `invoiceId` INTEGER NOT NULL,
    `serviceType` ENUM('UMRAH_VISA', 'HOTEL_ACCOMMODATION', 'AIR_TICKET', 'TRANSPORTATION') NOT NULL,
    `description` TEXT NOT NULL,
    `visaType` ENUM('GROUP', 'INDIVIDUAL_VISA', 'HOST_UMRAH_VISA') NULL,
    `hotelName` VARCHAR(200) NULL,
    `paxCount` INTEGER NULL,
    `acType` ENUM('AC', 'NON_AC') NULL,
    `boardType` ENUM('ROOM_ONLY', 'BED_BREAKFAST') NULL,
    `ticketType` ENUM('ONE_WAY', 'RETURN') NULL,
    `routeId` INTEGER NULL,
    `vehicleTypeId` INTEGER NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `quantity` DECIMAL(10, 2) NOT NULL DEFAULT 1,
    `discount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `totalAmount` DECIMAL(12, 2) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `InvoiceItem_invoiceId_idx`(`invoiceId`),
    INDEX `InvoiceItem_serviceType_idx`(`serviceType`),
    INDEX `InvoiceItem_routeId_idx`(`routeId`),
    INDEX `InvoiceItem_vehicleTypeId_idx`(`vehicleTypeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `InvoiceItem` ADD CONSTRAINT `InvoiceItem_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `Invoice`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InvoiceItem` ADD CONSTRAINT `InvoiceItem_routeId_fkey` FOREIGN KEY (`routeId`) REFERENCES `Route`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InvoiceItem` ADD CONSTRAINT `InvoiceItem_vehicleTypeId_fkey` FOREIGN KEY (`vehicleTypeId`) REFERENCES `VehicleType`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
