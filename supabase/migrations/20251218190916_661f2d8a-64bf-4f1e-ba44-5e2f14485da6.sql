-- Remover o símbolo + da frente dos telefones
UPDATE profiles 
SET phone = REPLACE(phone, '+', '')
WHERE phone LIKE '+%';