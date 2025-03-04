-- CreateTable
CREATE TABLE "stops" (
    "stop_id" TEXT NOT NULL,
    "stop_code" TEXT,
    "stop_name" TEXT NOT NULL,
    "stop_lat" DOUBLE PRECISION NOT NULL,
    "stop_lon" DOUBLE PRECISION NOT NULL,
    "location_type" INTEGER,
    "parent_station" TEXT,
    "wheelchair_boarding" INTEGER,

    CONSTRAINT "stops_pkey" PRIMARY KEY ("stop_id")
);

-- CreateTable
CREATE TABLE "routes" (
    "route_id" TEXT NOT NULL,
    "route_short_name" TEXT NOT NULL,
    "route_long_name" TEXT NOT NULL,
    "route_type" INTEGER NOT NULL,
    "route_color" TEXT,
    "route_text_color" TEXT,

    CONSTRAINT "routes_pkey" PRIMARY KEY ("route_id")
);

-- CreateTable
CREATE TABLE "trips" (
    "trip_id" TEXT NOT NULL,
    "route_id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "trip_headsign" TEXT,
    "direction_id" INTEGER,
    "block_id" TEXT,
    "shape_id" TEXT,
    "wheelchair_accessible" INTEGER,
    "bikes_allowed" INTEGER,

    CONSTRAINT "trips_pkey" PRIMARY KEY ("trip_id")
);

-- CreateTable
CREATE TABLE "stop_times" (
    "trip_id" TEXT NOT NULL,
    "arrival_time" TEXT NOT NULL,
    "departure_time" TEXT NOT NULL,
    "stop_id" TEXT NOT NULL,
    "stop_sequence" INTEGER NOT NULL,
    "pickup_type" INTEGER,
    "drop_off_type" INTEGER,

    CONSTRAINT "stop_times_pkey" PRIMARY KEY ("trip_id","stop_sequence")
);

-- CreateTable
CREATE TABLE "realtime_delays" (
    "id" SERIAL NOT NULL,
    "collected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trip_id" TEXT NOT NULL,
    "route_id" TEXT NOT NULL,
    "stop_id" TEXT NOT NULL,
    "scheduled_time" BIGINT,
    "actual_time" BIGINT,
    "delay" INTEGER,
    "status" TEXT,

    CONSTRAINT "realtime_delays_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "realtime_delays_trip_id_idx" ON "realtime_delays"("trip_id");

-- CreateIndex
CREATE INDEX "realtime_delays_route_id_idx" ON "realtime_delays"("route_id");

-- CreateIndex
CREATE INDEX "realtime_delays_stop_id_idx" ON "realtime_delays"("stop_id");

-- CreateIndex
CREATE INDEX "realtime_delays_collected_at_idx" ON "realtime_delays"("collected_at");

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("route_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stop_times" ADD CONSTRAINT "stop_times_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("trip_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stop_times" ADD CONSTRAINT "stop_times_stop_id_fkey" FOREIGN KEY ("stop_id") REFERENCES "stops"("stop_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "realtime_delays" ADD CONSTRAINT "realtime_delays_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("trip_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "realtime_delays" ADD CONSTRAINT "realtime_delays_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("route_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "realtime_delays" ADD CONSTRAINT "realtime_delays_stop_id_fkey" FOREIGN KEY ("stop_id") REFERENCES "stops"("stop_id") ON DELETE RESTRICT ON UPDATE CASCADE;
