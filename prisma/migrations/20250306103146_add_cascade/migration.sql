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

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("route_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stop_times" ADD CONSTRAINT "stop_times_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("trip_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stop_times" ADD CONSTRAINT "stop_times_stop_id_fkey" FOREIGN KEY ("stop_id") REFERENCES "stops"("stop_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "realtime_delays" ADD CONSTRAINT "realtime_delays_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("trip_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "realtime_delays" ADD CONSTRAINT "realtime_delays_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("route_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "realtime_delays" ADD CONSTRAINT "realtime_delays_stop_id_fkey" FOREIGN KEY ("stop_id") REFERENCES "stops"("stop_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_metrics" ADD CONSTRAINT "daily_metrics_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("route_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hourly_metrics" ADD CONSTRAINT "hourly_metrics_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("route_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stop_metrics" ADD CONSTRAINT "stop_metrics_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("route_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stop_metrics" ADD CONSTRAINT "stop_metrics_stop_id_fkey" FOREIGN KEY ("stop_id") REFERENCES "stops"("stop_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_service_times" ADD CONSTRAINT "route_service_times_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("route_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stop_sequences" ADD CONSTRAINT "stop_sequences_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("route_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stop_sequences" ADD CONSTRAINT "stop_sequences_stop_id_fkey" FOREIGN KEY ("stop_id") REFERENCES "stops"("stop_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_weather_impacts" ADD CONSTRAINT "daily_weather_impacts_daily_metric_id_fkey" FOREIGN KEY ("daily_metric_id") REFERENCES "daily_metrics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_weather_impacts" ADD CONSTRAINT "daily_weather_impacts_weather_id_fkey" FOREIGN KEY ("weather_id") REFERENCES "weather_data"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hourly_weather_impacts" ADD CONSTRAINT "hourly_weather_impacts_hourly_metric_id_fkey" FOREIGN KEY ("hourly_metric_id") REFERENCES "hourly_metrics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hourly_weather_impacts" ADD CONSTRAINT "hourly_weather_impacts_weather_id_fkey" FOREIGN KEY ("weather_id") REFERENCES "weather_data"("id") ON DELETE CASCADE ON UPDATE CASCADE;
