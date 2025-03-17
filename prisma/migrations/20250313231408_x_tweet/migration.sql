-- CreateTable
CREATE TABLE "x_sessions" (
    "id" SERIAL NOT NULL,
    "cookie" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "x_sessions_pkey" PRIMARY KEY ("id")
);
