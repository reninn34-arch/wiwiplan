-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "contentIdeaId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL DEFAULT 'Cliente',
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Comment_contentIdeaId_idx" ON "Comment"("contentIdeaId");

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_contentIdeaId_fkey" FOREIGN KEY ("contentIdeaId") REFERENCES "ContentIdea"("id") ON DELETE CASCADE ON UPDATE CASCADE;
