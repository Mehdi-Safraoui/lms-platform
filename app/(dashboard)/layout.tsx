/**
 * Layout partagé pour toutes les pages authentifiées.
 * Contiendra la sidebar, la navbar, et la vérification du tenant.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      {/* Sidebar + Navbar à ajouter */}
      <main>{children}</main>
    </div>
  );
}
