-- Add color settings to feature_settings table
INSERT INTO feature_settings (id, key, value, category, "updatedAt")
VALUES 
  (gen_random_uuid(), 'colorWhite', '"#ffffff"', 'UI', NOW()),
  (gen_random_uuid(), 'colorDark', '"#e8e5e5"', 'UI', NOW()),
  (gen_random_uuid(), 'colorDarkLight', '"#f5f5f5"', 'UI', NOW()),
  (gen_random_uuid(), 'colorDarkLighter', '"#e5e5e5"', 'UI', NOW()),
  (gen_random_uuid(), 'colorAccent', '"#1c1b1b"', 'UI', NOW()),
  (gen_random_uuid(), 'colorAccentMuted', '"#666666"', 'UI', NOW()),
  (gen_random_uuid(), 'colorAccentLight', '"#ded9d9"', 'UI', NOW()),
  (gen_random_uuid(), 'colorBackground', '"#ffffff"', 'UI', NOW()),
  (gen_random_uuid(), 'colorBackgroundSecondary', '"#f9f9f9"', 'UI', NOW()),
  (gen_random_uuid(), 'colorBlack', '"#000000"', 'UI', NOW())
ON CONFLICT (key) DO NOTHING;