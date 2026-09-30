import CadrageStep from "@/components/authoring/cadrage/CadrageStep";

type Props = { params: Promise<{ id: string }> };

export default async function FormationCadragePage({ params }: Props) {
  const { id } = await params;
  return <CadrageStep space="admin" formationId={id} />;
}
