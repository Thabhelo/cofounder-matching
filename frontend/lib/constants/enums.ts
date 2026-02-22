export const IDEA_STATUSES = [
  { value: "not_set_on_idea", label: "Not set on a specific idea" },
  { value: "have_ideas_flexible", label: "Have ideas but flexible" },
  { value: "building_specific_idea", label: "Building a specific idea" },
] as const

export const READY_TO_START = [
  { value: "now", label: "Ready now" },
  { value: "1_month", label: "In 1 month" },
  { value: "3_months", label: "In 3 months" },
  { value: "6_months", label: "In 6 months" },
  { value: "exploring", label: "Just exploring" },
] as const

export const AREAS_OF_OWNERSHIP = [
  { value: "engineering", label: "Engineering" },
  { value: "product", label: "Product" },
  { value: "design", label: "Design" },
  { value: "sales_marketing", label: "Sales & Marketing" },
  { value: "operations", label: "Operations" },
] as const

export const IMPORTANCE_LEVELS = [
  { value: "required", label: "Required" },
  { value: "preferred", label: "Preferred but not required" },
  { value: "not_important", label: "Not important" },
] as const

export const GENDERS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "non_binary", label: "Non-binary" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
] as const

export const COMMITMENT_LEVELS = [
  { value: "full_time", label: "Full-time" },
  { value: "part_time", label: "Part-time" },
] as const

export const WORK_LOCATION_PREFERENCES = [
  { value: "remote", label: "Remote only" },
  { value: "in_person", label: "In-person only" },
  { value: "hybrid", label: "Hybrid (flexible)" },
] as const

export const STARTUP_PROGRESS = [
  { value: "pre_mvp", label: "Pre-MVP" },
  { value: "mvp_built", label: "MVP built" },
  { value: "launched", label: "Launched" },
  { value: "users_revenue", label: "Users / Revenue" },
] as const

export const STARTUP_FUNDING = [
  { value: "bootstrapped", label: "Bootstrapped" },
  { value: "pre_seed", label: "Pre-seed" },
  { value: "seed", label: "Seed" },
  { value: "none", label: "None" },
] as const

export const PREF_IDEA_STATUSES = [
  { value: "not_set_on_idea", label: "Not set on a specific idea" },
  { value: "has_their_own_ideas", label: "Has their own ideas" },
  { value: "no_preference", label: "No preference" },
] as const

export const PREF_LOCATION_TYPES = [
  { value: "within_distance", label: "Within distance" },
  { value: "same_country", label: "Same country" },
  { value: "same_region", label: "Same region" },
  { value: "no_preference", label: "No preference" },
] as const
