-- CreateTable
CREATE TABLE "route_service_times" (
    "id" SERIAL NOT NULL,
    "route_id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "route_service_times_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stop_sequences" (
    "id" SERIAL NOT NULL,
    "route_id" TEXT NOT NULL,
    "stop_id" TEXT NOT NULL,
    "direction_id" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "is_terminus" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stop_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "route_service_times_route_id_idx" ON "route_service_times"("route_id");

-- CreateIndex
CREATE UNIQUE INDEX "route_service_times_route_id_service_id_key" ON "route_service_times"("route_id", "service_id");

-- CreateIndex
CREATE INDEX "stop_sequences_route_id_direction_id_idx" ON "stop_sequences"("route_id", "direction_id");

-- CreateIndex
CREATE INDEX "stop_sequences_stop_id_idx" ON "stop_sequences"("stop_id");

-- CreateIndex
CREATE UNIQUE INDEX "stop_sequences_route_id_stop_id_direction_id_key" ON "stop_sequences"("route_id", "stop_id", "direction_id");

-- AddForeignKey
ALTER TABLE "route_service_times" ADD CONSTRAINT "route_service_times_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("route_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stop_sequences" ADD CONSTRAINT "stop_sequences_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("route_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stop_sequences" ADD CONSTRAINT "stop_sequences_stop_id_fkey" FOREIGN KEY ("stop_id") REFERENCES "stops"("stop_id") ON DELETE RESTRICT ON UPDATE CASCADE;
