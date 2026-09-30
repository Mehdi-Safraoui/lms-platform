import GenerationStep from "@/components/authoring/generation/GenerationStep";

type Props = { params: Promise<{ id: string }> };

export default async function FormationGenerationPage({ params }: Props) {
  const { id } = await params;
  return <GenerationStep space="admin" formationId={id} />;
}
