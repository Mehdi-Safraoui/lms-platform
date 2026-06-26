/**
 * Types pour les réponses et requêtes de l'API (Route Handlers Next.js)
 */

export interface ApiResponse<T = unknown> {
  data: T | null;
  error: string | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
