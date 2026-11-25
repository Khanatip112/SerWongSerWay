-- CreateEnum
CREATE TYPE "SectionNextAction" AS ENUM ('NEXT_SECTION', 'GO_TO_SECTION', 'SUBMIT_FORM');

-- CreateEnum
CREATE TYPE "ContentBlockType" AS ENUM ('TEXT_BLOCK', 'IMAGE_BLOCK');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "QuestionType" ADD VALUE 'SHORT_ANSWER';
ALTER TYPE "QuestionType" ADD VALUE 'PARAGRAPH';
ALTER TYPE "QuestionType" ADD VALUE 'MULTIPLE_CHOICE';
ALTER TYPE "QuestionType" ADD VALUE 'CHECKBOXES';
ALTER TYPE "QuestionType" ADD VALUE 'DROPDOWN';
ALTER TYPE "QuestionType" ADD VALUE 'FILE_UPLOAD';
ALTER TYPE "QuestionType" ADD VALUE 'LINEAR_SCALE';
ALTER TYPE "QuestionType" ADD VALUE 'RATING';
ALTER TYPE "QuestionType" ADD VALUE 'MULTIPLE_CHOICE_GRID';
ALTER TYPE "QuestionType" ADD VALUE 'CHECKBOX_GRID';
ALTER TYPE "QuestionType" ADD VALUE 'DATE';
ALTER TYPE "QuestionType" ADD VALUE 'TIME';

-- AlterTable
ALTER TABLE "answers" ADD COLUMN     "jsonValue" JSONB;

-- AlterTable
ALTER TABLE "questions" ADD COLUMN     "config" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "description" TEXT,
ADD COLUMN     "image" JSONB,
ADD COLUMN     "sectionId" TEXT;

-- CreateTable
CREATE TABLE "sections" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "orderIndex" INTEGER NOT NULL,
    "nextAction" "SectionNextAction" NOT NULL DEFAULT 'NEXT_SECTION',
    "targetSectionId" TEXT,

    CONSTRAINT "sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_blocks" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "sectionId" TEXT,
    "type" "ContentBlockType" NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "config" JSONB NOT NULL DEFAULT '{}',
    "orderIndex" INTEGER NOT NULL,

    CONSTRAINT "content_blocks_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "sections" ADD CONSTRAINT "sections_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_blocks" ADD CONSTRAINT "content_blocks_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
