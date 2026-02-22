export type RoleIntent = "founder" | "cofounder" | "early_employee"
export type Commitment = "full_time" | "part_time" | "exploratory"
export type AvailabilityStatus = "actively_looking" | "open" | "not_looking"
export type EventType = "workshop" | "networking" | "pitch" | "conference" | "webinar" | "other"
export type LocationType = "in_person" | "virtual" | "hybrid"
export type RSVPStatus = "going" | "maybe" | "not_going"
export type OrgType = "accelerator" | "university" | "nonprofit" | "coworking" | "government" | "other"
export type ResourceCategory = "funding" | "mentorship" | "legal" | "accounting" | "prototyping" | "program" | "other"

export type IdeaStatus = "not_set_on_idea" | "have_ideas_flexible" | "building_specific_idea"
export type ReadyToStart = "now" | "1_month" | "3_months" | "6_months" | "exploring"
export type ImportanceLevel = "required" | "preferred" | "not_important"
export type ProfileStatus = "incomplete" | "pending_review" | "approved" | "rejected"
export type WorkLocationPreference = "remote" | "in_person" | "hybrid"

export type SkillItem = {
  name: string
  level: string
  years: number
}

export type ProofOfWork = {
  type: string
  url: string
  description?: string
}

export type User = {
  id: string
  email: string
  name: string
  avatar_url?: string
  introduction?: string
  location?: string
  location_city?: string
  location_state?: string
  location_country?: string
  location_latitude?: number
  location_longitude?: number
  gender?: "male" | "female" | "non_binary" | "prefer_not_to_say"
  birthdate?: string
  linkedin_url?: string
  twitter_url?: string
  instagram_url?: string
  github_url?: string
  portfolio_url?: string
  calendly_url?: string
  video_intro_url?: string
  life_story?: string
  hobbies?: string
  impressive_accomplishment?: string
  education_history?: string
  employment_history?: string
  experience_years?: number
  previous_startups: number
  idea_status?: IdeaStatus
  is_technical?: boolean
  startup_name?: string
  startup_description?: string
  startup_progress?: "pre_mvp" | "mvp_built" | "launched" | "users_revenue"
  startup_funding?: "bootstrapped" | "pre_seed" | "seed" | "none"
  ready_to_start?: ReadyToStart
  commitment?: Commitment
  areas_of_ownership?: string[]
  topics_of_interest?: string[]
  domain_expertise?: string[]
  equity_expectation?: string
  work_location_preference?: WorkLocationPreference
  looking_for_description?: string
  pref_idea_status?: string
  pref_idea_importance?: ImportanceLevel
  pref_technical?: boolean
  pref_technical_importance?: ImportanceLevel
  pref_match_timing?: boolean
  pref_timing_importance?: ImportanceLevel
  pref_location_type?: "within_distance" | "same_country" | "same_region" | "no_preference"
  pref_location_distance_miles?: number
  pref_location_importance?: ImportanceLevel
  pref_age_min?: number
  pref_age_max?: number
  pref_age_importance?: ImportanceLevel
  pref_cofounder_areas?: string[]
  pref_areas_importance?: ImportanceLevel
  pref_shared_interests?: boolean
  pref_interests_importance?: ImportanceLevel
  alert_on_new_matches: boolean
  behavior_agreement_accepted_at?: string
  profile_status?: ProfileStatus
  created_at: string
  updated_at: string
  is_active: boolean
  is_banned?: boolean
}

export type UserPublic = {
  id: string
  name: string
  avatar_url?: string
  introduction?: string
  location?: string
  location_city?: string
  location_country?: string
  idea_status?: IdeaStatus
  is_technical?: boolean
  commitment?: Commitment
  areas_of_ownership?: string[]
  topics_of_interest?: string[]
  experience_years?: number
  previous_startups: number
  github_url?: string
  linkedin_url?: string
  portfolio_url?: string
}

/** Discover/recommendations item: profile plus "matched before" tag when they can reappear after unmatch/dismiss. */
export type ProfileDiscoverItem = {
  profile: UserPublic
  matched_before: boolean
}

export type Organization = {
  id: string
  name: string
  slug: string
  description?: string
  website_url?: string
  logo_url?: string
  org_type?: OrgType
  focus_areas?: string[]
  location?: string
  is_verified: boolean
  verification_method?: string
  verified_at?: string
  contact_email?: string
  contact_phone?: string
  created_at: string
  updated_at: string
  is_active: boolean
}

export type Resource = {
  id: string
  organization_id?: string
  created_by?: string
  title: string
  description: string
  category: ResourceCategory
  resource_type?: string
  stage_eligibility?: string[]
  location_eligibility?: string[]
  other_eligibility?: string
  amount_min?: number
  amount_max?: number
  currency: string
  application_url?: string
  deadline?: string
  tags?: string[]
  is_featured: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export type Event = {
  id: string
  organization_id?: string
  created_by?: string
  title: string
  description: string
  event_type?: EventType
  start_datetime: string
  end_datetime?: string
  timezone: string
  location_type?: LocationType
  location_address?: string
  location_url?: string
  registration_url?: string
  registration_required: boolean
  max_attendees?: number
  current_attendees: number
  tags?: string[]
  is_featured: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}
