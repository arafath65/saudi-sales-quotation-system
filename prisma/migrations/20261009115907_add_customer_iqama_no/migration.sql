-- AlterTable
ALTER TABLE `customer` ADD COLUMN `iqamaNo` VARCHAR(100) NULL;

-- CreateIndex
CREATE INDEX `Customer_iqamaNo_idx` ON `Customer`(`iqamaNo`);
