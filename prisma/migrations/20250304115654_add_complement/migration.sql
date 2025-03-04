-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "timeStart" TIMESTAMP(3) NOT NULL,
    "timeEnd" TIMESTAMP(3),
    "cause" TEXT NOT NULL DEFAULT 'UNKNOWN_CAUSE',
    "effect" TEXT NOT NULL DEFAULT 'UNKNOWN_EFFECT',
    "headerText" TEXT NOT NULL,
    "descriptionText" TEXT NOT NULL,
    "url" TEXT,
    "routeIds" TEXT,
    "stopIds" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isComplement" BOOLEAN NOT NULL DEFAULT false,
    "parentAlertId" TEXT,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_parentAlertId_fkey" FOREIGN KEY ("parentAlertId") REFERENCES "Alert"("id") ON DELETE SET NULL ON UPDATE CASCADE;
