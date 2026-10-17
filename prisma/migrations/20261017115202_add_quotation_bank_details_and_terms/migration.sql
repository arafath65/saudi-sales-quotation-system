-- AlterTable
ALTER TABLE `quotation` ADD COLUMN `bankDetailsSnapshot` JSON NULL,
    ADD COLUMN `termsConditionsSnapshot` JSON NULL;

-- CreateTable
CREATE TABLE `QuotationBankDetail` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `slot` INTEGER NOT NULL,
    `bankName` VARCHAR(150) NOT NULL DEFAULT '',
    `accountName` VARCHAR(150) NOT NULL DEFAULT '',
    `accountNumber` VARCHAR(100) NOT NULL DEFAULT '',
    `iban` VARCHAR(100) NULL,
    `swiftCode` VARCHAR(50) NULL,
    `branchName` VARCHAR(150) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `QuotationBankDetail_slot_key`(`slot`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `QuotationServiceTermsCondition` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `serviceType` VARCHAR(50) NOT NULL,
    `title` VARCHAR(150) NOT NULL,
    `content` TEXT NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `QuotationServiceTermsCondition_serviceType_isActive_idx`(`serviceType`, `isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
