-- Add typography settings to feature_settings table
INSERT INTO feature_settings (id, key, value, category, "updatedAt")
VALUES 
  (gen_random_uuid(), 'fontFamily', '"Inter"', 'UI', NOW()),
  (gen_random_uuid(), 'fontSizeH1', '"3rem"', 'UI', NOW()),
  (gen_random_uuid(), 'fontSizeH2', '"2.25rem"', 'UI', NOW()),
  (gen_random_uuid(), 'fontSizeH3', '"1.875rem"', 'UI', NOW()),
  (gen_random_uuid(), 'fontSizeH4', '"1.5rem"', 'UI', NOW()),
  (gen_random_uuid(), 'fontSizeBody', '"1rem"', 'UI', NOW()),
  (gen_random_uuid(), 'fontSizeSmall', '"0.875rem"', 'UI', NOW()),
  (gen_random_uuid(), 'fontSizeButton', '"1rem"', 'UI', NOW()),
  (gen_random_uuid(), 'textTransformUppercase', 'false', 'UI', NOW())
ON CONFLICT (key) DO NOTHING;