import StructureStep from "@/components/authoring/structure/StructureStep";

type Props = { params: Promise<{ id: string }> };

export default async function FormationStructurePage({ params }: Props) {
  const { id } = await params;
  return <StructureStep space="admin" formationId={id} />;
}
