-- CreateTable
CREATE TABLE "hourly_stop_metrics" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "hour" INTEGER NOT NULL,
    "stop_id" TEXT NOT NULL,
    "avg_delay" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "max_delay" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "min_delay" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "observations" INTEGER NOT NULL DEFAULT 0,
    "delay_under_30s" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "delay_30_to_60s" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "delay_60_to_120s" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "delay_120_to_300s" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "delay_over_300s" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "early_rate_30" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "early_rate_60" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "early_rate_120" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "on_time_rate_30" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "on_time_rate_60" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "on_time_rate_120" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "late_rate_30" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "late_rate_60" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "late_rate_120" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "hourly_stop_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hourly_stop_metrics_date_hour_idx" ON "hourly_stop_metrics"("date", "hour");

-- CreateIndex
CREATE INDEX "hourly_stop_metrics_stop_id_idx" ON "hourly_stop_metrics"("stop_id");

-- CreateIndex
CREATE UNIQUE INDEX "hourly_stop_metrics_date_hour_stop_id_key" ON "hourly_stop_metrics"("date", "hour", "stop_id");

-- AddForeignKey
ALTER TABLE "hourly_stop_metrics" ADD CONSTRAINT "hourly_stop_metrics_stop_id_fkey" FOREIGN KEY ("stop_id") REFERENCES "stops"("stop_id") ON DELETE RESTRICT ON UPDATE CASCADE;
