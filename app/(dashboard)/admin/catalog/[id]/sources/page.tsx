import SourcesStep from "@/components/authoring/sources/SourcesStep";

type Props = { params: Promise<{ id: string }> };

export default async function FormationSourcesPage({ params }: Props) {
  const { id } = await params;
  return <SourcesStep space="admin" formationId={id} />;
}
