-- Seed HWK feature flag
INSERT INTO "FeatureFlag" ("name", "enabled", "description", "updatedBy", "updatedAt")
VALUES ('hwk', false, 'Enables HWK flow and PDF/mail', 'system', CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;
