/*
  Warnings:

  - You are about to drop the column `logoPath` on the `companysettings` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `companysettings` DROP COLUMN `logoPath`,
    ADD COLUMN `logo1Path` TEXT NULL,
    ADD COLUMN `logo2Path` TEXT NULL,
    ADD COLUMN `logo3Path` TEXT NULL;
