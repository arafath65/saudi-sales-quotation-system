-- AlterTable
ALTER TABLE `invoiceitem` ADD COLUMN `adultPrice` DECIMAL(12, 2) NULL,
    ADD COLUMN `adultQuantity` INTEGER NULL,
    ADD COLUMN `childPrice` DECIMAL(12, 2) NULL,
    ADD COLUMN `childQuantity` INTEGER NULL,
    ADD COLUMN `infantPrice` DECIMAL(12, 2) NULL,
    ADD COLUMN `infantQuantity` INTEGER NULL;

-- AlterTable
ALTER TABLE `quotationitem` ADD COLUMN `adultPrice` DECIMAL(12, 2) NULL,
    ADD COLUMN `adultQuantity` INTEGER NULL,
    ADD COLUMN `childPrice` DECIMAL(12, 2) NULL,
    ADD COLUMN `childQuantity` INTEGER NULL,
    ADD COLUMN `infantPrice` DECIMAL(12, 2) NULL,
    ADD COLUMN `infantQuantity` INTEGER NULL;
