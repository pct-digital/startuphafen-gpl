-- CreateTable
CREATE TABLE "FeatureFlag" (
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("name")
);

-- Seed initial feature flags
INSERT INTO "FeatureFlag" ("name", "enabled", "description", "updatedBy", "updatedAt")
VALUES
    ('chat', true, 'Enables chatbot functionality', 'system', CURRENT_TIMESTAMP),
    ('ug_questionflow', true, 'Enables UG question flow', 'system', CURRENT_TIMESTAMP),
    ('eu_questionflow', true, 'Enables EU question flow', 'system', CURRENT_TIMESTAMP);
