/*
  Warnings:

  - Made the column `reference` on table `transactions` required. This step will fail if there are existing NULL values in that column.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_transactions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "description" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "customFields" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_transactions" ("amount", "createdAt", "customFields", "date", "description", "id", "reference", "updatedAt") SELECT "amount", "createdAt", "customFields", "date", "description", "id", "reference", "updatedAt" FROM "transactions";
DROP TABLE "transactions";
ALTER TABLE "new_transactions" RENAME TO "transactions";
CREATE UNIQUE INDEX "transactions_reference_key" ON "transactions"("reference");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
