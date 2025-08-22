-- CreateTable
CREATE TABLE "Newsletter" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "fromEmail" TEXT,
    "previewText" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL,
    "html" TEXT NOT NULL,
    "text" TEXT,
    "thumbnailUrl" TEXT,
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Newsletter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportLog" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "note" TEXT,

    CONSTRAINT "ImportLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Newsletter_campaignId_key" ON "Newsletter"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "Newsletter_messageId_key" ON "Newsletter"("messageId");
