
-- Remover trigger antigo se existir
DROP TRIGGER IF EXISTS trigger_notify_n8n_new_user ON public.profiles;

-- Criar o trigger novamente
CREATE TRIGGER trigger_notify_n8n_new_user
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_n8n_on_new_user();

COMMENT ON TRIGGER trigger_notify_n8n_new_user ON public.profiles IS 'Dispara notificação N8N para novos usuários com telefone';
