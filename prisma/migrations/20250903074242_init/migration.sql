-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('ADMIN', 'TECHNICIAN', 'STAFF');

-- CreateEnum
CREATE TYPE "public"."JobType" AS ENUM ('INSTALL', 'RENEWAL', 'FAULT_CHECK');

-- CreateEnum
CREATE TYPE "public"."JobStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'DONE', 'NOT_DONE', 'ESCALATED');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "public"."Role" NOT NULL,
    "region" TEXT,
    "password" TEXT NOT NULL,
    "online" BOOLEAN NOT NULL DEFAULT false,
    "lastLogin" TIMESTAMP(3),
    "lastLogout" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RollCallUser" (
    "id" SERIAL NOT NULL,
    "rollCallId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "RollCallUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Job" (
    "id" SERIAL NOT NULL,
    "vehicleReg" TEXT NOT NULL,
    "jobType" "public"."JobType" NOT NULL,
    "status" "public"."JobStatus" NOT NULL DEFAULT 'PENDING',
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "governorSerial" TEXT,
    "governorStatus" TEXT,
    "clientName" TEXT,
    "clientPhone" TEXT,
    "remarks" TEXT,
    "photoUrl" TEXT,
    "clientSignature" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "technicianId" INTEGER,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Session" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "loginTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "logoutTime" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RollCall" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "region" TEXT,

    CONSTRAINT "RollCall_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- AddForeignKey
ALTER TABLE "public"."RollCallUser" ADD CONSTRAINT "RollCallUser_rollCallId_fkey" FOREIGN KEY ("rollCallId") REFERENCES "public"."RollCall"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RollCallUser" ADD CONSTRAINT "RollCallUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Job" ADD CONSTRAINT "Job_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
