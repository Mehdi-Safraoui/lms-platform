-- Accorder les permissions au rôle authenticated (utilisateurs avec JWT valide)
-- RLS filtre ensuite ce que chaque utilisateur peut voir
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON tenants TO authenticated;
GRANT SELECT ON users TO authenticated;
GRANT SELECT ON formations TO authenticated;
GRANT SELECT ON modules TO authenticated;
GRANT SELECT ON lecons TO authenticated;
