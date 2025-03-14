-- CreateEnum
CREATE TYPE "LeaveType" AS ENUM ('RUNNING_LATE', 'SICK', 'VACATION', 'PERSONAL', 'WFH', 'OTHER');

-- CreateTable
CREATE TABLE "Leave" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "duration" TEXT NOT NULL,
    "original_text" TEXT NOT NULL,
    "type" "LeaveType" NOT NULL DEFAULT 'OTHER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Leave_pkey" PRIMARY KEY ("id")
);
