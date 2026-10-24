-- AlterTable
ALTER TABLE `invoiceitem` ADD COLUMN `numberOfDays` INTEGER NULL,
    ADD COLUMN `roomType` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `quotationitem` ADD COLUMN `numberOfDays` INTEGER NULL,
    ADD COLUMN `roomType` VARCHAR(191) NULL;
