-- CreateTable
CREATE TABLE "DiscountFunction" (
    "id" SERIAL NOT NULL,
    "functionId" TEXT NOT NULL,
    "appKey" TEXT NOT NULL,
    "discountClasses" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscountFunction_pkey" PRIMARY KEY ("id")
);
