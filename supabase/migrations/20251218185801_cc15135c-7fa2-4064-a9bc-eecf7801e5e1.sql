-- Padronizar todos os telefones existentes usando o trigger
-- Esta query "toca" o campo phone, disparando o trigger de normalização

UPDATE profiles 
SET phone = phone 
WHERE phone IS NOT NULL AND phone != '';