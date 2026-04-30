-- CreateEnum
CREATE TYPE "ConversationMode" AS ENUM ('ai', 'human');

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "mode" "ConversationMode" NOT NULL DEFAULT 'ai';
