-- CreateTable
CREATE TABLE "hourly_metrics" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "hour" INTEGER NOT NULL,
    "route_id" TEXT NOT NULL,
    "avg_delay" DOUBLE PRECISION NOT NULL,
    "max_delay" INTEGER NOT NULL,
    "min_delay" INTEGER NOT NULL,
    "observations" INTEGER NOT NULL,
    "on_time_rate" DOUBLE PRECISION NOT NULL,
    "late_rate" DOUBLE PRECISION NOT NULL,
    "early_rate" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hourly_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stop_metrics" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "route_id" TEXT NOT NULL,
    "stop_id" TEXT NOT NULL,
    "avg_delay" DOUBLE PRECISION NOT NULL,
    "max_delay" INTEGER NOT NULL,
    "min_delay" INTEGER NOT NULL,
    "observations" INTEGER NOT NULL,
    "on_time_rate" DOUBLE PRECISION NOT NULL,
    "late_rate" DOUBLE PRECISION NOT NULL,
    "early_rate" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stop_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hourly_metrics_date_hour_idx" ON "hourly_metrics"("date", "hour");

-- CreateIndex
CREATE INDEX "hourly_metrics_route_id_idx" ON "hourly_metrics"("route_id");

-- CreateIndex
CREATE UNIQUE INDEX "hourly_metrics_date_hour_route_id_key" ON "hourly_metrics"("date", "hour", "route_id");

-- CreateIndex
CREATE INDEX "stop_metrics_date_idx" ON "stop_metrics"("date");

-- CreateIndex
CREATE INDEX "stop_metrics_route_id_idx" ON "stop_metrics"("route_id");

-- CreateIndex
CREATE INDEX "stop_metrics_stop_id_idx" ON "stop_metrics"("stop_id");

-- CreateIndex
CREATE UNIQUE INDEX "stop_metrics_date_route_id_stop_id_key" ON "stop_metrics"("date", "route_id", "stop_id");

-- AddForeignKey
ALTER TABLE "hourly_metrics" ADD CONSTRAINT "hourly_metrics_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("route_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stop_metrics" ADD CONSTRAINT "stop_metrics_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("route_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stop_metrics" ADD CONSTRAINT "stop_metrics_stop_id_fkey" FOREIGN KEY ("stop_id") REFERENCES "stops"("stop_id") ON DELETE RESTRICT ON UPDATE CASCADE;
