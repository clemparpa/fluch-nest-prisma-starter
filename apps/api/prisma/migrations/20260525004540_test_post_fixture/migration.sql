-- CreateTable
CREATE TABLE "_test_post" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "_test_post_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "_test_post_organizationId_idx" ON "_test_post"("organizationId");
