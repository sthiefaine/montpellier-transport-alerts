-- CreateTable
CREATE TABLE "weather_data" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "hour" INTEGER,
    "temperature" DOUBLE PRECISION NOT NULL,
    "precipitation" DOUBLE PRECISION NOT NULL,
    "wind_speed" DOUBLE PRECISION NOT NULL,
    "humidity" DOUBLE PRECISION NOT NULL,
    "cloud_cover" DOUBLE PRECISION NOT NULL,
    "weather_code" INTEGER NOT NULL,
    "weather_type" TEXT NOT NULL,
    "snow_depth" DOUBLE PRECISION,
    "snowfall" DOUBLE PRECISION,
    "isRain" BOOLEAN NOT NULL DEFAULT false,
    "isSnow" BOOLEAN NOT NULL DEFAULT false,
    "isFog" BOOLEAN NOT NULL DEFAULT false,
    "isStorm" BOOLEAN NOT NULL DEFAULT false,
    "location" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'open-meteo',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weather_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_weather_impacts" (
    "id" SERIAL NOT NULL,
    "daily_metric_id" INTEGER NOT NULL,
    "weather_id" INTEGER NOT NULL,
    "impact_score" DOUBLE PRECISION,

    CONSTRAINT "daily_weather_impacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hourly_weather_impacts" (
    "id" SERIAL NOT NULL,
    "hourly_metric_id" INTEGER NOT NULL,
    "weather_id" INTEGER NOT NULL,
    "impact_score" DOUBLE PRECISION,

    CONSTRAINT "hourly_weather_impacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "weather_data_date_idx" ON "weather_data"("date");

-- CreateIndex
CREATE INDEX "weather_data_location_idx" ON "weather_data"("location");

-- CreateIndex
CREATE INDEX "weather_data_weather_code_idx" ON "weather_data"("weather_code");

-- CreateIndex
CREATE INDEX "weather_data_date_location_idx" ON "weather_data"("date", "location");

-- CreateIndex
CREATE UNIQUE INDEX "weather_data_date_hour_location_key" ON "weather_data"("date", "hour", "location");

-- CreateIndex
CREATE UNIQUE INDEX "daily_weather_impacts_daily_metric_id_weather_id_key" ON "daily_weather_impacts"("daily_metric_id", "weather_id");

-- CreateIndex
CREATE UNIQUE INDEX "hourly_weather_impacts_hourly_metric_id_weather_id_key" ON "hourly_weather_impacts"("hourly_metric_id", "weather_id");

-- AddForeignKey
ALTER TABLE "daily_weather_impacts" ADD CONSTRAINT "daily_weather_impacts_daily_metric_id_fkey" FOREIGN KEY ("daily_metric_id") REFERENCES "daily_metrics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_weather_impacts" ADD CONSTRAINT "daily_weather_impacts_weather_id_fkey" FOREIGN KEY ("weather_id") REFERENCES "weather_data"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hourly_weather_impacts" ADD CONSTRAINT "hourly_weather_impacts_hourly_metric_id_fkey" FOREIGN KEY ("hourly_metric_id") REFERENCES "hourly_metrics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hourly_weather_impacts" ADD CONSTRAINT "hourly_weather_impacts_weather_id_fkey" FOREIGN KEY ("weather_id") REFERENCES "weather_data"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
