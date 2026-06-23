-- AlterTable
ALTER TABLE "header_settings"
ADD COLUMN     "backgroundOpacity" INTEGER NOT NULL DEFAULT 92,
ADD COLUMN     "backdropBlur" INTEGER NOT NULL DEFAULT 12,
ADD COLUMN     "dropdownBackgroundOpacity" INTEGER NOT NULL DEFAULT 96,
ADD COLUMN     "dropdownBackdropBlur" INTEGER NOT NULL DEFAULT 16;
