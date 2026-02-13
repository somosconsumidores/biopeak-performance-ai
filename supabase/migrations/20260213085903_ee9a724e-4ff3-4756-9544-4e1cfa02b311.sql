
DROP MATERIALIZED VIEW IF EXISTS mv_biopeak_nutritional_profile;

CREATE MATERIALIZED VIEW mv_biopeak_nutritional_profile AS
WITH user_biometrics AS (
    SELECT p.user_id,
        p.weight_kg,
        p.height_cm,
        p.gender,
        EXTRACT(year FROM age(CURRENT_DATE::timestamp with time zone, p.birth_date::timestamp with time zone)) AS age,
        uo.goal
    FROM profiles p
        LEFT JOIN user_onboarding uo ON p.user_id = uo.user_id
    WHERE p.weight_kg IS NOT NULL AND p.height_cm IS NOT NULL AND p.birth_date IS NOT NULL
), activity_burn AS (
    SELECT all_activities.user_id,
        count(*) AS active_days,
        sum(all_activities.active_kilocalories)::numeric / 30.0 AS avg_daily_active_kcal,
        mode() WITHIN GROUP (ORDER BY all_activities.activity_type) AS main_sport
    FROM all_activities
    WHERE all_activities.activity_date >= (CURRENT_DATE - '30 days'::interval)
    GROUP BY all_activities.user_id
)
SELECT bio.user_id,
    bio.goal,
    bio.weight_kg,
    bio.age,
    round(
        CASE
            WHEN bio.gender ~~* 'f%'::text THEN 10::numeric * bio.weight_kg + 6.25 * bio.height_cm::numeric - 5::numeric * bio.age - 161::numeric
            ELSE 10::numeric * bio.weight_kg + 6.25 * bio.height_cm::numeric - 5::numeric * bio.age + 5::numeric
        END, 0) AS bmr_kcal,
    round(COALESCE(act.avg_daily_active_kcal, 0::numeric), 0) AS avg_active_kcal,
    round((
        CASE
            WHEN bio.gender ~~* 'f%'::text THEN 10::numeric * bio.weight_kg + 6.25 * bio.height_cm::numeric - 5::numeric * bio.age - 161::numeric
            ELSE 10::numeric * bio.weight_kg + 6.25 * bio.height_cm::numeric - 5::numeric * bio.age + 5::numeric
        END + COALESCE(act.avg_daily_active_kcal, 0::numeric)) * 1.1, 0) AS tdee_kcal,
    COALESCE(act.main_sport, 'General'::text) AS sport_type
FROM user_biometrics bio
    LEFT JOIN activity_burn act ON bio.user_id = act.user_id;

REFRESH MATERIALIZED VIEW mv_biopeak_nutritional_profile;
