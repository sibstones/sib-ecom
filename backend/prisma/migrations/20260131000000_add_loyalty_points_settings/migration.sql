-- Add loyalty program condition settings to feature_settings table
-- loyaltyPointsEarnPerUnit: points earned per 1 unit of currency (default 1)
-- loyaltyPointsSpendPerUnit: points required for 1 unit of currency discount (default 100)
INSERT INTO feature_settings (id, key, value, category, "updatedAt")
VALUES
  (gen_random_uuid(), 'loyaltyPointsEarnPerUnit', to_jsonb(1), 'LOYALTY', NOW()),
  (gen_random_uuid(), 'loyaltyPointsSpendPerUnit', to_jsonb(100), 'LOYALTY', NOW())
ON CONFLICT (key) DO NOTHING;
