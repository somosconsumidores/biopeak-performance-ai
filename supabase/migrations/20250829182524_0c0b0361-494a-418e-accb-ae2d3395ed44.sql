-- Enable realtime for premium stats tables
ALTER TABLE public.all_activities REPLICA IDENTITY FULL;
ALTER TABLE public.activity_coordinates REPLICA IDENTITY FULL;  
ALTER TABLE public.user_achievements REPLICA IDENTITY FULL;

-- Add tables to realtime publication
ALTER publication supabase_realtime ADD TABLE public.all_activities;
ALTER publication supabase_realtime ADD TABLE public.activity_coordinates;
ALTER publication supabase_realtime ADD TABLE public.user_achievements;