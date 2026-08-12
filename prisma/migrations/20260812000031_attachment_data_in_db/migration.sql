-- AlterTable
ALTER TABLE "Attachment" ADD COLUMN     "data" BYTEA,
ALTER COLUMN "storageKey" DROP NOT NULL;
