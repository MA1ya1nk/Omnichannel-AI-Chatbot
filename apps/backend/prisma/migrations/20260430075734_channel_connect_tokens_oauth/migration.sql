-- CreateTable
CREATE TABLE "LinkToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "metadata" JSONB,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LinkToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LinkToken_token_key" ON "LinkToken"("token");

-- CreateIndex
CREATE INDEX "LinkToken_userId_channel_idx" ON "LinkToken"("userId", "channel");

-- AddForeignKey
ALTER TABLE "LinkToken" ADD CONSTRAINT "LinkToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AppUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
