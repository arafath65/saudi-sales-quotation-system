-- CreateTable
CREATE TABLE `HotelConfirmation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `receiptNo` VARCHAR(50) NOT NULL,
    `hotelConfirmationNumber` VARCHAR(100) NOT NULL,
    `status` ENUM('TENTATIVE', 'DEFINITE') NOT NULL DEFAULT 'TENTATIVE',
    `checkIn` DATE NOT NULL,
    `checkOut` DATE NOT NULL,
    `customerName` VARCHAR(150) NOT NULL,
    `customerMobile` VARCHAR(50) NOT NULL,
    `customerWhatsapp` VARCHAR(50) NULL,
    `customerEmail` VARCHAR(150) NULL,
    `customerAddress` TEXT NULL,
    `customerPassportNo` VARCHAR(100) NULL,
    `hotelName` VARCHAR(200) NOT NULL,
    `roomType` VARCHAR(150) NOT NULL,
    `numberOfDays` INTEGER NULL,
    `roomQuantity` DECIMAL(10, 2) NOT NULL,
    `paxCount` INTEGER NULL,
    `acType` ENUM('AC', 'NON_AC') NULL,
    `boardType` ENUM('ROOM_ONLY', 'BED_BREAKFAST') NULL,
    `currency` ENUM('SAR', 'LKR', 'USD') NOT NULL DEFAULT 'SAR',
    `amount` DECIMAL(12, 2) NOT NULL,
    `discount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `totalAmount` DECIMAL(12, 2) NOT NULL,
    `termsConditionsSnapshot` JSON NULL,
    `notes` TEXT NULL,
    `quotationId` INTEGER NOT NULL,
    `quotationItemId` INTEGER NOT NULL,
    `createdById` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `HotelConfirmation_receiptNo_key`(`receiptNo`),
    INDEX `HotelConfirmation_quotationId_idx`(`quotationId`),
    INDEX `HotelConfirmation_quotationItemId_idx`(`quotationItemId`),
    INDEX `HotelConfirmation_status_idx`(`status`),
    INDEX `HotelConfirmation_checkIn_checkOut_idx`(`checkIn`, `checkOut`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `HotelConfirmation` ADD CONSTRAINT `HotelConfirmation_quotationId_fkey` FOREIGN KEY (`quotationId`) REFERENCES `Quotation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HotelConfirmation` ADD CONSTRAINT `HotelConfirmation_quotationItemId_fkey` FOREIGN KEY (`quotationItemId`) REFERENCES `QuotationItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HotelConfirmation` ADD CONSTRAINT `HotelConfirmation_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
