import { z } from "zod"

const optionalUrl = z.string().url().optional().or(z.literal(""))

const baseOnboardingSchema = z.object({
    linkedin_url: z.string().min(1, "LinkedIn URL is required").url("Invalid LinkedIn URL"),
    location: z.string().min(1, "Location is required"),
    introduction: z.string().min(50, "Please write at least 50 characters").max(2000),
    is_technical: z.boolean(),
    idea_status: z.enum(["not_set_on_idea", "have_ideas_flexible", "building_specific_idea"]),
    ready_to_start: z.enum(["now", "1_month", "3_months", "6_months", "exploring"]),
    areas_of_ownership: z.array(z.string()).min(1, "Select at least one area"),
    topics_of_interest: z.array(z.string()).min(1, "Select at least one topic"),
    equity_expectation: z.string().min(1, "Please describe your equity expectations").max(500),
    looking_for_description: z.string().min(50, "Please write at least 50 characters").max(1000),
    gender: z.enum(["male", "female", "non_binary", "prefer_not_to_say"]).optional(),
    birthdate: z.string().optional(),
    location_city: z.string().optional(),
    location_state: z.string().optional(),
    location_country: z.string().optional(),
    location_latitude: z.number().optional(),
    location_longitude: z.number().optional(),
    twitter_url: optionalUrl,
    instagram_url: optionalUrl,
    calendly_url: optionalUrl,
    video_intro_url: optionalUrl,
    life_story: z.string().max(2000).optional(),
    hobbies: z.string().max(1000).optional(),
    impressive_accomplishment: z.string().max(2000).optional(),
    education_history: z.string().max(2000).optional(),
    employment_history: z.string().max(2000).optional(),
    experience_years: z.coerce.number().min(0).max(70).optional(),
    previous_startups: z.coerce.number().min(0).max(50).default(0),
    github_url: optionalUrl,
    portfolio_url: optionalUrl,
    commitment: z.enum(["full_time", "part_time"]).optional(),
    work_location_preference: z.enum(["remote", "in_person", "hybrid"]).optional(),
    startup_name: z.string().max(255).optional(),
    startup_description: z.string().max(2000).optional(),
    startup_progress: z.enum(["pre_mvp", "mvp_built", "launched", "users_revenue"]).optional(),
    startup_funding: z.enum(["bootstrapped", "pre_seed", "seed", "none"]).optional(),
    domain_expertise: z.array(z.string()).optional(),
    pref_idea_status: z.enum(["not_set_on_idea", "has_their_own_ideas", "no_preference"]).optional(),
    pref_idea_importance: z.enum(["required", "preferred", "not_important"]).optional(),
    pref_technical: z.boolean().optional(),
    pref_technical_importance: z.enum(["required", "preferred", "not_important"]).optional(),
    pref_match_timing: z.boolean().optional(),
    pref_timing_importance: z.enum(["required", "preferred", "not_important"]).optional(),
    pref_location_type: z.enum(["within_distance", "same_country", "same_region", "no_preference"]).optional(),
    pref_location_distance_miles: z.coerce.number().min(1).max(5000).optional(),
    pref_location_importance: z.enum(["required", "preferred", "not_important"]).optional(),
    pref_age_min: z.coerce.number().min(18).max(100).optional(),
    pref_age_max: z.coerce.number().min(18).max(100).optional(),
    pref_age_importance: z.enum(["required", "preferred", "not_important"]).optional(),
    pref_cofounder_areas: z.array(z.string()).optional(),
    pref_areas_importance: z.enum(["required", "preferred", "not_important"]).optional(),
    pref_shared_interests: z.boolean().optional(),
    pref_interests_importance: z.enum(["required", "preferred", "not_important"]).optional(),
    alert_on_new_matches: z.boolean().default(false),
  })

export const onboardingSchema = baseOnboardingSchema.refine(
  (data) => {
    if (data.pref_age_min != null && data.pref_age_max != null) {
      return data.pref_age_min <= data.pref_age_max
    }
    return true
  },
  { message: "Minimum age must be less than or equal to maximum age", path: ["pref_age_min"] }
)

export type OnboardingFormData = z.infer<typeof onboardingSchema>

export const profileUpdateSchema = baseOnboardingSchema.partial()

export type ProfileUpdateFormData = z.infer<typeof profileUpdateSchema>
