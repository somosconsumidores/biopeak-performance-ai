-- Corrigir utm_source do usuário de teste
UPDATE profiles 
SET utm_source = 'teste_manual'
WHERE user_id = '708742a2-da8f-4cda-960b-9cd777273982';