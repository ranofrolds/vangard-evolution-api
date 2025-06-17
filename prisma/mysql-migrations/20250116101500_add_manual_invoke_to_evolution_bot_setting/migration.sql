-- AlterTable
ALTER TABLE `EvolutionBotSetting` ADD COLUMN `manualInvoke` BOOLEAN DEFAULT false;
ALTER TABLE `EvolutionBotSetting` ADD COLUMN `manualInvokeBotId` VARCHAR(100); 