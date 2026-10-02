-- AlterTable
ALTER TABLE "Order" ADD COLUMN "pickupCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Order_storeId_pickupCode_key" ON "Order"("storeId", "pickupCode");
