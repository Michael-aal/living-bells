CREATE TABLE "ConfigOption" (
    "id" SERIAL NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfigOption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ConfigOption_kind_name_key" ON "ConfigOption"("kind", "name");
CREATE INDEX "ConfigOption_kind_idx" ON "ConfigOption"("kind");

ALTER TABLE "ConfigOption" ADD CONSTRAINT "ConfigOption_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
