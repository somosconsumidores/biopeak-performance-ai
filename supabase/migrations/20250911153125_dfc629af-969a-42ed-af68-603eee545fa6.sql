-- Create trigger to automatically populate all_activities when healthkit_activities is updated
CREATE TRIGGER trigger_ins_all_from_healthkit
    AFTER INSERT OR UPDATE ON public.healthkit_activities
    FOR EACH ROW
    EXECUTE FUNCTION public._ins_all_from_healthkit();