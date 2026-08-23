-- CreateTable
CREATE TABLE "ContentIdeaImage" (
    "id" TEXT NOT NULL,
    "ideaId" TEXT NOT NULL,
    "dataUrl" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentIdeaImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContentIdeaImage_ideaId_idx" ON "ContentIdeaImage"("ideaId");

-- AddForeignKey
ALTER TABLE "ContentIdeaImage" ADD CONSTRAINT "ContentIdeaImage_ideaId_fkey" FOREIGN KEY ("ideaId") REFERENCES "ContentIdea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

