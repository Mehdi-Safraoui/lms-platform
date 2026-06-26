/**
 * Types représentant le schéma de la base de données Supabase.
 * Ces types seront générés automatiquement par `supabase gen types typescript`
 * une fois la DB configurée. Pour l'instant, on pose les types manuellement.
 */

export type Role = "super_admin" | "admin_tenant" | "tuteur" | "formateur" | "apprenant";

export type SubscriptionPlan = "decouverte" | "creation" | "entreprise";

export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled" | "unpaid";

export type LessonContentType = "markdown" | "video" | "quiz";

// --- Tenant ---
export interface Tenant {
  id: string;
  clerk_org_id: string; // ID de l'Organisation Clerk
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

// --- Formation ---
export interface Formation {
  id: string;
  tenant_id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  is_published: boolean;
  created_by: string; // user_id
  created_at: string;
  updated_at: string;
}

// --- Module ---
export interface Module {
  id: string;
  formation_id: string;
  tenant_id: string;
  title: string;
  order_index: number;
  created_at: string;
  updated_at: string;
}

// --- Leçon ---
export interface Lesson {
  id: string;
  module_id: string;
  tenant_id: string;
  title: string;
  content_type: LessonContentType;
  content_markdown: string | null;
  video_url: string | null;
  order_index: number;
  duration_minutes: number | null;
  is_preview: boolean; // accessible sans abonnement (essai gratuit)
  created_at: string;
  updated_at: string;
}

// --- Quiz ---
export interface QuizQuestion {
  id: string;
  lesson_id: string;
  tenant_id: string;
  question: string;
  options: string[]; // JSON array
  correct_option_index: number;
  order_index: number;
}

// --- Progression ---
export interface Enrollment {
  id: string;
  user_id: string;
  formation_id: string;
  tenant_id: string;
  enrolled_at: string;
  completed_at: string | null;
}

export interface LessonProgress {
  id: string;
  user_id: string;
  lesson_id: string;
  tenant_id: string;
  completed: boolean;
  time_spent_seconds: number;
  completed_at: string | null;
}

export interface QuizAttempt {
  id: string;
  user_id: string;
  lesson_id: string;
  tenant_id: string;
  score: number; // 0-100
  answers: number[]; // index des réponses choisies
  attempted_at: string;
}

// --- Gamification ---
export interface UserPoints {
  user_id: string;
  tenant_id: string;
  total_points: number;
  updated_at: string;
}

export interface Badge {
  id: string;
  tenant_id: string;
  name: string;
  description: string;
  icon_url: string | null;
  condition_type: string; // ex: "formation_completed", "quiz_perfect"
  condition_value: number;
}

export interface UserBadge {
  user_id: string;
  badge_id: string;
  tenant_id: string;
  awarded_at: string;
}
