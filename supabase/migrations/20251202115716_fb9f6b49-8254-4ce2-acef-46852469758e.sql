-- URGENT: Reativar assinatura do usuário 41bbc36f-ff3c-4704-9e24-95ca8907760c
-- Evento UNCANCELLATION do RevenueCat em 30/11 não foi processado

UPDATE subscribers 
SET 
  subscribed = true,
  subscription_tier = 'premium',
  subscription_type = 'revenuecat',
  subscription_end = '2025-12-30T23:59:59.000Z', -- Estimado: 30 dias após reativação em 30/11
  updated_at = NOW()
WHERE user_id = '41bbc36f-ff3c-4704-9e24-95ca8907760c';