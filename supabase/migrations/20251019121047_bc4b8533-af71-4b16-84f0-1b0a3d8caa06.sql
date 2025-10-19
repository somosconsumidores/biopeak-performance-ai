
-- Recriar trigger SEM a condição WHEN para sempre disparar
DROP TRIGGER IF EXISTS on_phone_update_trigger ON public.profiles;

CREATE TRIGGER on_phone_update_trigger
  AFTER UPDATE OF phone ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_phone_update();
