-- Update ug-flag to have a start value of false
UPDATE "FeatureFlag" SET "enabled" = false, "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = 'ug_questionflow';