-- Allow admins to view all activity_chart_data rows
CREATE POLICY "Admins can view all chart data"
ON public.activity_chart_data
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));