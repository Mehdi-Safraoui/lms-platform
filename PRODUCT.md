# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Apprenants (primary for the redesign):** employees of Ahead Digital's client companies, mostly not AI experts, following a training on a work computer and, for a significant share, on their phone (commute, between meetings). Short sessions; the product must make them want to finish the training.
- **Admin entreprise / tuteur:** HR or team leads at the client company. They activate Ahead catalogue trainings, create private trainings from internal documents with AI, invite learners, follow progress and manage the subscription.
- **Super admin (Ahead):** builds and publishes the Ahead catalogue with the AI authoring flow, manages client companies, follows revenue, consumption and AI cost.

## Product Purpose

Ahead LMS turns documents into interactive trainings with AI (RAG on the company's own documents), then lets learners follow them with quizzes, an AI assistant grounded in the lessons, badges, streaks and a verifiable certificate. Success = learners complete trainings (completion rate), companies keep subscribing.

## Positioning

A training platform by Ahead Digital, an AI and digital transformation consultancy: its own AI-acculturation catalogue (Copilot, Claude, prompting) plus private trainings generated from each client's documents in hours instead of weeks, with human validation of every lesson.

## Operating Context

- Learner journey: dashboard "Mes formations" → formation page (modules, progress, certificate) → lessons built from content blocks → end-of-module quiz → certificate PDF + LinkedIn.
- Lesson content blocks: heading, paragraph (inline markdown), list, callout (info, tip, warning, success, objective, example), comparison, feature grid, highlight, exercise, image + text, YouTube video, copyable prompt; quiz lessons; video lessons.
- Gamification: points, levels (500 pts), 8 badges, per-module competence badges, day streaks.
- Interface language: French.

## Capabilities and Constraints

- Next.js 16 App Router, CSS Modules with global tokens in `app/globals.css`, lucide-react icons, Clerk auth, Supabase, deployed on Vercel.
- Content is AI-generated then human-validated; any block type can be absent from a lesson; images and videos are only added by humans (placeholders otherwise).
- The site is not responsive yet; responsive work is planned as a second phase after the redesign.
- Three role areas: `/apprenant`, `/org`, `/admin`.

## Brand Commitments

- Product name: Ahead LMS, by Ahead Digital.
- Visual identity is **inspired by Ahead Digital, not bound to it** (user decision, 2026-10-01): recognizable Ahead colors (site: navy #191738, coral #FF555B, electric blue #2C33F2; Euclid typeface; space/astronaut illustrations), with freedom on the rest.

## Evidence on Hand

- Real trainings in production: "Formation Copilot", "Formation Claude" (13 modules, 45 lessons).
- No testimonials, client logos or learner statistics to display yet; do not fabricate them.

## Product Principles

1. Make finishing the training feel within reach: progress is always visible and the next step is obvious.
2. Content first: lessons are read; the interface must stay out of the way of reading.
3. Trust: everything comes from the company's documents and is validated by a human; never present invented content.
4. One product, three roles: learner experience gets the most care, admin screens favor clarity.
