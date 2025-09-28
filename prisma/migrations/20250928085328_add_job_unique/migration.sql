/*
  Warnings:

  - A unique constraint covering the columns `[vehicleReg,status]` on the table `Job` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Job_vehicleReg_status_key" ON "public"."Job"("vehicleReg", "status");
