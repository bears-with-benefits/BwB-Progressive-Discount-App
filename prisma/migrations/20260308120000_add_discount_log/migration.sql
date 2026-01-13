CREATE TABLE "DiscountLog" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shop" TEXT,
    "triggerCode" TEXT NOT NULL,
    "codeDiscountId" TEXT,
    "automaticDiscountId" TEXT,

    CONSTRAINT "DiscountLog_pkey" PRIMARY KEY ("id")
);
