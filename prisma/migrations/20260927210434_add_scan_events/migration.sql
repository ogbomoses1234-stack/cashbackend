-- CreateTable
CREATE TABLE "scan_events" (
    "id" TEXT NOT NULL,
    "serial_number" VARCHAR(24) NOT NULL,
    "user_id" TEXT,
    "user_role" VARCHAR(20),
    "scan_type" VARCHAR(40) NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "error_code" VARCHAR(60),
    "error_message" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "geo_lat" DECIMAL(9,6),
    "geo_lng" DECIMAL(9,6),
    "scanned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scan_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scan_events_serial_number_idx" ON "scan_events"("serial_number");

-- CreateIndex
CREATE INDEX "scan_events_user_id_idx" ON "scan_events"("user_id");

-- CreateIndex
CREATE INDEX "scan_events_scanned_at_idx" ON "scan_events"("scanned_at");

-- CreateIndex
CREATE INDEX "scan_events_scan_type_idx" ON "scan_events"("scan_type");

-- AddForeignKey
ALTER TABLE "scan_events" ADD CONSTRAINT "scan_events_serial_number_fkey" FOREIGN KEY ("serial_number") REFERENCES "product_serials"("serial_number") ON DELETE CASCADE ON UPDATE CASCADE;
