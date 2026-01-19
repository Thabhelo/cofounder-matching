export type RoleIntent = "founder" | "cofounder" | "early_employee"
export type Stage = "idea" | "mvp" | "revenue" | "growth"
export type Commitment = "full_time" | "part_time" | "exploratory"
export type WorkingStyle = "structured" | "chaotic" | "flexible"
export type CommunicationPreference = "async" | "sync" | "mixed"
export type AvailabilityStatus = "actively_looking" | "open" | "not_looking"
export type EventType = "workshop" | "networking" | "pitch" | "conference" | "webinar" | "other"
export type LocationType = "in_person" | "virtual" | "hybrid"
export type RSVPStatus = "going" | "maybe" | "not_going"
export type OrgType = "accelerator" | "university" | "nonprofit" | "coworking" | "government" | "other"
export type ResourceCategory = "funding" | "mentorship" | "legal" | "accounting" | "prototyping" | "program" | "other"

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
  bio?: string
  avatar_url?: string
  role_intent: RoleIntent
  stage_preference?: Stage
  commitment?: Commitment
  location?: string
  location_preference?: string[]
  travel_tolerance?: string
  working_style?: WorkingStyle
  communication_preference?: CommunicationPreference
  skills?: SkillItem[]
  experience_years?: number
  previous_startups: number
  proof_of_work?: ProofOfWork[]
  github_url?: string
  portfolio_url?: string
  linkedin_url?: string
  trust_score: number
  is_verified: boolean
  verification_method?: string
  availability_status?: AvailabilityStatus
  availability_date?: string
  created_at: string
  updated_at: string
  last_active_at: string
  is_active: boolean
}

export type UserPublic = {
  id: string
  name: string
  bio?: string
  avatar_url?: string
  role_intent: RoleIntent
  stage_preference?: Stage
  location?: string
  skills?: SkillItem[]
  experience_years?: number
  previous_startups: number
  trust_score: number
  is_verified: boolean
  availability_status?: AvailabilityStatus
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
