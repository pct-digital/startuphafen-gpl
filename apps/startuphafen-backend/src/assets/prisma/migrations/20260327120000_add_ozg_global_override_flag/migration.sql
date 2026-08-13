-- Seed OZG global override feature flag
INSERT INTO "FeatureFlag" ("name", "enabled", "description", "updatedBy", "updatedAt")
VALUES (
    'ozg_global_override',
    false,
    'Enables the OZG config global override',
    'system',
    CURRENT_TIMESTAMP
)
ON CONFLICT ("name") DO NOTHING;
