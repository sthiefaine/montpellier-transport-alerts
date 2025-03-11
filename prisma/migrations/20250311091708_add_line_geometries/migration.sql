/*
  Warnings:

  - You are about to drop the column `created_at` on the `daily_metrics` table. All the data in the column will be lost.
  - You are about to drop the column `early_rate` on the `daily_metrics` table. All the data in the column will be lost.
  - You are about to drop the column `late_rate` on the `daily_metrics` table. All the data in the column will be lost.
  - You are about to drop the column `on_time_rate` on the `daily_metrics` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `hourly_metrics` table. All the data in the column will be lost.
  - You are about to drop the column `early_rate` on the `hourly_metrics` table. All the data in the column will be lost.
  - You are about to drop the column `late_rate` on the `hourly_metrics` table. All the data in the column will be lost.
  - You are about to drop the column `on_time_rate` on the `hourly_metrics` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `route_service_times` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `stop_metrics` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `stop_sequences` table. All the data in the column will be lost.
  - The primary key for the `stop_times` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the `Alert` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `daily_weather_impacts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `hourly_weather_impacts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `weather_data` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `early_rate_60` to the `daily_metrics` table without a default value. This is not possible if the table is not empty.
  - Added the required column `late_rate_60` to the `daily_metrics` table without a default value. This is not possible if the table is not empty.
  - Added the required column `on_time_rate_60` to the `daily_metrics` table without a default value. This is not possible if the table is not empty.
  - Made the column `delay` on table `realtime_delays` required. This step will fail if there are existing NULL values in that column.
  - Made the column `status` on table `realtime_delays` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Alert" DROP CONSTRAINT "Alert_parentAlertId_fkey";

-- DropForeignKey
ALTER TABLE "daily_metrics" DROP CONSTRAINT "daily_metrics_route_id_fkey";

-- DropForeignKey
ALTER TABLE "daily_weather_impacts" DROP CONSTRAINT "daily_weather_impacts_daily_metric_id_fkey";

-- DropForeignKey
ALTER TABLE "daily_weather_impacts" DROP CONSTRAINT "daily_weather_impacts_weather_id_fkey";

-- DropForeignKey
ALTER TABLE "hourly_metrics" DROP CONSTRAINT "hourly_metrics_route_id_fkey";

-- DropForeignKey
ALTER TABLE "hourly_weather_impacts" DROP CONSTRAINT "hourly_weather_impacts_hourly_metric_id_fkey";

-- DropForeignKey
ALTER TABLE "hourly_weather_impacts" DROP CONSTRAINT "hourly_weather_impacts_weather_id_fkey";

-- DropForeignKey
ALTER TABLE "realtime_delays" DROP CONSTRAINT "realtime_delays_route_id_fkey";

-- DropForeignKey
ALTER TABLE "realtime_delays" DROP CONSTRAINT "realtime_delays_stop_id_fkey";

-- DropForeignKey
ALTER TABLE "realtime_delays" DROP CONSTRAINT "realtime_delays_trip_id_fkey";

-- DropForeignKey
ALTER TABLE "route_service_times" DROP CONSTRAINT "route_service_times_route_id_fkey";

-- DropForeignKey
ALTER TABLE "stop_metrics" DROP CONSTRAINT "stop_metrics_route_id_fkey";

-- DropForeignKey
ALTER TABLE "stop_metrics" DROP CONSTRAINT "stop_metrics_stop_id_fkey";

-- DropForeignKey
ALTER TABLE "stop_sequences" DROP CONSTRAINT "stop_sequences_route_id_fkey";

-- DropForeignKey
ALTER TABLE "stop_sequences" DROP CONSTRAINT "stop_sequences_stop_id_fkey";

-- DropForeignKey
ALTER TABLE "stop_times" DROP CONSTRAINT "stop_times_stop_id_fkey";

-- DropForeignKey
ALTER TABLE "stop_times" DROP CONSTRAINT "stop_times_trip_id_fkey";

-- DropForeignKey
ALTER TABLE "trips" DROP CONSTRAINT "trips_route_id_fkey";

-- DropIndex
DROP INDEX "route_service_times_route_id_idx";

-- DropIndex
DROP INDEX "stop_sequences_route_id_direction_id_idx";

-- DropIndex
DROP INDEX "stop_sequences_stop_id_idx";

-- AlterTable
ALTER TABLE "daily_metrics" DROP COLUMN "created_at",
DROP COLUMN "early_rate",
DROP COLUMN "late_rate",
DROP COLUMN "on_time_rate",
ADD COLUMN     "early_rate_60" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "late_rate_60" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "on_time_rate_60" DOUBLE PRECISION NOT NULL,
ALTER COLUMN "date" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "max_delay" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "min_delay" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "delay_120_to_300s" DROP DEFAULT,
ALTER COLUMN "delay_30_to_60s" DROP DEFAULT,
ALTER COLUMN "delay_60_to_120s" DROP DEFAULT,
ALTER COLUMN "delay_over_300s" DROP DEFAULT,
ALTER COLUMN "delay_under_30s" DROP DEFAULT,
ALTER COLUMN "early_rate_120" DROP DEFAULT,
ALTER COLUMN "early_rate_30" DROP DEFAULT,
ALTER COLUMN "late_rate_120" DROP DEFAULT,
ALTER COLUMN "late_rate_30" DROP DEFAULT,
ALTER COLUMN "on_time_rate_120" DROP DEFAULT,
ALTER COLUMN "on_time_rate_30" DROP DEFAULT;

-- AlterTable
ALTER TABLE "hourly_metrics" DROP COLUMN "created_at",
DROP COLUMN "early_rate",
DROP COLUMN "late_rate",
DROP COLUMN "on_time_rate",
ADD COLUMN     "early_rate_60" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "late_rate_60" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "on_time_rate_60" DOUBLE PRECISION NOT NULL DEFAULT 0,
ALTER COLUMN "date" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "max_delay" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "min_delay" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "realtime_delays" ALTER COLUMN "delay" SET NOT NULL,
ALTER COLUMN "delay" SET DEFAULT 0,
ALTER COLUMN "status" SET NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'SCHEDULED';

-- AlterTable
ALTER TABLE "route_service_times" DROP COLUMN "created_at";

-- AlterTable
ALTER TABLE "routes" ALTER COLUMN "route_short_name" DROP NOT NULL,
ALTER COLUMN "route_long_name" DROP NOT NULL,
ALTER COLUMN "route_type" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "stop_metrics" DROP COLUMN "created_at",
ALTER COLUMN "date" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "max_delay" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "min_delay" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "stop_sequences" DROP COLUMN "created_at",
ALTER COLUMN "direction_id" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "stop_times" DROP CONSTRAINT "stop_times_pkey",
ADD CONSTRAINT "stop_times_pkey" PRIMARY KEY ("trip_id", "stop_id", "stop_sequence");

-- DropTable
DROP TABLE "Alert";

-- DropTable
DROP TABLE "daily_weather_impacts";

-- DropTable
DROP TABLE "hourly_weather_impacts";

-- DropTable
DROP TABLE "weather_data";

-- CreateTable
CREATE TABLE "line_geometries" (
    "id" SERIAL NOT NULL,
    "route_id" TEXT NOT NULL,
    "line_type" TEXT NOT NULL,
    "geometry" JSONB NOT NULL,
    "properties" JSONB NOT NULL,
    "last_updated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "line_geometries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "line_geometries_route_id_idx" ON "line_geometries"("route_id");

-- CreateIndex
CREATE INDEX "line_geometries_line_type_idx" ON "line_geometries"("line_type");

-- AddForeignKey
ALTER TABLE "line_geometries" ADD CONSTRAINT "line_geometries_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("route_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("route_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stop_times" ADD CONSTRAINT "stop_times_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("trip_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stop_times" ADD CONSTRAINT "stop_times_stop_id_fkey" FOREIGN KEY ("stop_id") REFERENCES "stops"("stop_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stop_sequences" ADD CONSTRAINT "stop_sequences_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("route_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stop_sequences" ADD CONSTRAINT "stop_sequences_stop_id_fkey" FOREIGN KEY ("stop_id") REFERENCES "stops"("stop_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_service_times" ADD CONSTRAINT "route_service_times_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("route_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "realtime_delays" ADD CONSTRAINT "realtime_delays_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("trip_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "realtime_delays" ADD CONSTRAINT "realtime_delays_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("route_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "realtime_delays" ADD CONSTRAINT "realtime_delays_stop_id_fkey" FOREIGN KEY ("stop_id") REFERENCES "stops"("stop_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_metrics" ADD CONSTRAINT "daily_metrics_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("route_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hourly_metrics" ADD CONSTRAINT "hourly_metrics_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("route_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stop_metrics" ADD CONSTRAINT "stop_metrics_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("route_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stop_metrics" ADD CONSTRAINT "stop_metrics_stop_id_fkey" FOREIGN KEY ("stop_id") REFERENCES "stops"("stop_id") ON DELETE RESTRICT ON UPDATE CASCADE;
