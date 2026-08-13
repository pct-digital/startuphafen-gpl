-- Seed BNTK feature flag
INSERT INTO "FeatureFlag" ("name", "enabled", "description", "updatedBy", "updatedAt")
VALUES ('bntk', false, 'Enables BNTK integration', 'system', CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;
