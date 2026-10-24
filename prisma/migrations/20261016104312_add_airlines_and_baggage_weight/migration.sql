-- AlterTable
ALTER TABLE `invoiceitem` ADD COLUMN `airlineName` VARCHAR(100) NULL,
    ADD COLUMN `baggageWeightKg` DECIMAL(6, 2) NULL;

-- AlterTable
ALTER TABLE `quotationitem` ADD COLUMN `airlineName` VARCHAR(100) NULL,
    ADD COLUMN `baggageWeightKg` DECIMAL(6, 2) NULL;

-- CreateTable
CREATE TABLE `Airline` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Airline_name_key`(`name`),
    INDEX `Airline_isActive_name_idx`(`isActive`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
