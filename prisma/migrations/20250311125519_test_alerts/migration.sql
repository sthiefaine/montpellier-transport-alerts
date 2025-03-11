/*
  Warnings:

  - You are about to drop the `Alert` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Alert" DROP CONSTRAINT "Alert_parentAlertId_fkey";

-- DropTable
DROP TABLE "Alert";

-- CreateTable
CREATE TABLE "alerts" (
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

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_parentAlertId_fkey" FOREIGN KEY ("parentAlertId") REFERENCES "alerts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
