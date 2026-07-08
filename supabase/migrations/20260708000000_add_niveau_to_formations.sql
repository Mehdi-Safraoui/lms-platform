-- Ajout du niveau de difficulté sur les formations (optionnel, choisi par le super_admin)
alter table public.formations
  add column if not exists niveau text
    check (niveau in ('debutant', 'intermediaire', 'avance'));
