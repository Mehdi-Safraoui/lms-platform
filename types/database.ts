export type Role = "super_admin" | "admin_tenant" | "tuteur" | "formateur" | "apprenant";

export type SubscriptionPlan = "decouverte" | "creation" | "entreprise";

export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled" | "unpaid";

export type LessonContentType = "markdown" | "video" | "quiz";

export type MediaType = "video" | "image" | "document" | "audio";

export type ProgressStatus = "not_started" | "in_progress" | "completed";

// --- Tenant ---
export interface Tenant {
  id: string;
  clerk_org_id: string;
  name: string;
  slug: string;
  subscription_plan: SubscriptionPlan | null;
  subscription_status: SubscriptionStatus | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
  updated_at: string;
}

// --- User ---
export interface User {
  id: string;
  clerk_user_id: string;
  tenant_id: string;
  role: Role;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

// --- Subscription ---
export interface Subscription {
  id: string;
  tenant_id: string;
  stripe_subscription_id: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  current_period_start: string;
  current_period_end: string;
  created_at: string;
  updated_at: string;
}

// --- Formation (NULL tenant_id = globale Ahead, sinon spécifique au tenant) ---
export interface Formation {
  id: string;
  tenant_id: string | null;
  title: string;
  slug: string;
  description: string | null;
  thumbnail_url: string | null;
  is_published: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// --- Module ---
export interface Module {
  id: string;
  formation_id: string;
  title: string;
  order_index: number;
  created_at: string;
  updated_at: string;
}

// --- Leçon ---
export interface Lesson {
  id: string;
  module_id: string;
  title: string;
  content_type: LessonContentType;
  content_markdown: string | null;
  video_url: string | null;
  order_index: number;
  duration_minutes: number | null;
  is_preview: boolean;
  created_at: string;
  updated_at: string;
}

// --- Media ---
export interface Media {
  id: string;
  tenant_id: string | null;
  type: MediaType;
  title: string;
  url: string;
  storage_path: string | null;
  size_bytes: number | null;
  uploaded_by: string | null;
  created_at: string;
}

// --- Quiz ---
export interface Quiz {
  id: string;
  lecon_id: string;
  title: string;
  pass_score: number;
  created_at: string;
  updated_at: string;
}

// options: [{ text: string; is_correct: boolean }]
export interface QuizQuestion {
  id: string;
  quiz_id: string;
  question_text: string;
  options: { text: string; is_correct: boolean }[];
  order_index: number;
  points: number;
  created_at: string;
}

// --- Enrollment (un utilisateur est inscrit à une formation) ---
export interface Enrollment {
  id: string;
  user_id: string;
  formation_id: string;
  tenant_id: string;
  is_trial: boolean;
  enrolled_at: string;
}

// --- Progress (avancement d'un enrollment sur une leçon) ---
export interface Progress {
  id: string;
  enrollment_id: string;
  lecon_id: string;
  tenant_id: string;
  status: ProgressStatus;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

// --- Quiz Result (résultat d'un quiz pour un enrollment) ---
// answers: [{ question_id: string; selected_option_index: number }]
export interface QuizResult {
  id: string;
  enrollment_id: string;
  quiz_id: string;
  tenant_id: string;
  score: number;
  max_score: number;
  passed: boolean;
  answers: { question_id: string; selected_option_index: number }[] | null;
  attempted_at: string;
}

// --- Attestation (certificat de complétion par enrollment) ---
export interface Attestation {
  id: string;
  enrollment_id: string;
  tenant_id: string;
  issued_at: string;
  certificate_url: string | null;
}
