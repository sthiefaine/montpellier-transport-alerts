-- CreateTable
CREATE TABLE "stops_list" (
    "id" SERIAL NOT NULL,
    "description" TEXT NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lignes_passantes" TEXT,
    "lignes_et_directions" TEXT,
    "station" TEXT,
    "commune" TEXT,
    "source" TEXT NOT NULL,
    "stopId" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stops_list_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stops_list_lon_lat_idx" ON "stops_list"("lon", "lat");

-- CreateIndex
CREATE INDEX "stops_list_stopId_idx" ON "stops_list"("stopId");

-- CreateIndex
CREATE INDEX "stops_list_description_idx" ON "stops_list"("description");

-- AddForeignKey
ALTER TABLE "stops_list" ADD CONSTRAINT "stops_list_stopId_fkey" FOREIGN KEY ("stopId") REFERENCES "stops"("stop_id") ON DELETE SET NULL ON UPDATE CASCADE;
