-- CreateTable
CREATE TABLE "daily_metrics" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "route_id" TEXT NOT NULL,
    "total_trips" INTEGER NOT NULL,
    "total_stops" INTEGER NOT NULL,
    "avg_delay" DOUBLE PRECISION NOT NULL,
    "max_delay" INTEGER NOT NULL,
    "min_delay" INTEGER NOT NULL,
    "on_time_rate" DOUBLE PRECISION NOT NULL,
    "late_rate" DOUBLE PRECISION NOT NULL,
    "early_rate" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "daily_metrics_date_idx" ON "daily_metrics"("date");

-- CreateIndex
CREATE INDEX "daily_metrics_route_id_idx" ON "daily_metrics"("route_id");

-- CreateIndex
CREATE UNIQUE INDEX "daily_metrics_date_route_id_key" ON "daily_metrics"("date", "route_id");

-- AddForeignKey
ALTER TABLE "daily_metrics" ADD CONSTRAINT "daily_metrics_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("route_id") ON DELETE RESTRICT ON UPDATE CASCADE;
