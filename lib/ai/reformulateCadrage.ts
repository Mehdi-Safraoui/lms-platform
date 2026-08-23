import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { openai, OPENAI_MODEL } from "@/lib/openai";

/**
 * Champs du cadrage reformulés par l'IA : réponse libre du Formateur → valeur
 * propre à stocker + courte relance pédagogique (l'aspect "guidé" du skill
 * d'accompagnement, voir cahier des charges 3.2). Les champs vraiment structurés
 * (niveau, nombre de modules, durée si on la passait en select) n'ont pas besoin
 * de ce traitement — un contrôle de formulaire classique suffit et évite de
 * dépendre d'un LLM pour parser une valeur qu'on pourrait juste demander proprement.
 */
export type OpenCadrageField = "objectif" | "public_vise" | "duree_estimee";
export type ListCadrageField = "notions_a_inclure" | "notions_a_exclure";

const openFieldResult = z.object({
  value: z.string().min(1),
  reply: z.string().min(1),
});

const listFieldResult = z.object({
  items: z.array(z.string().min(1)).min(1),
  reply: z.string().min(1),
});

const FIELD_INSTRUCTIONS: Record<OpenCadrageField | ListCadrageField, string> = {
  objectif:
    "L'objectif pédagogique global de la formation. Reformule en une ou deux phrases claires et actionnables (ce que l'apprenant doit être capable de faire à la fin), sans changer le sens de la réponse.",
  public_vise:
    "Le public visé par la formation. Reformule en une phrase concise décrivant qui sont les apprenants (rôle, niveau d'expérience si mentionné).",
  duree_estimee:
    "La durée estimée de la formation. Normalise en une expression courte et standard (ex : \"1h30\", \"une demi-journée\", \"3 heures\"), sans inventer de valeur si la réponse est vague.",
  notions_a_inclure:
    "Les notions que la formation doit absolument couvrir. Découpe la réponse en une liste de notions courtes et distinctes (une entrée par notion), sans en ajouter qui ne sont pas mentionnées.",
  notions_a_exclure:
    "Les notions à exclure de la formation. Découpe la réponse en une liste de notions courtes et distinctes, sans en ajouter qui ne sont pas mentionnées.",
};

const SYSTEM_PROMPT = `Tu es un assistant pédagogique qui accompagne un Formateur dans le cadrage d'une formation avant sa génération par IA. Pour chaque réponse qu'il te donne, tu dois :
1. Reformuler sa réponse de façon propre et exploitable, sans jamais inventer d'information qu'il n'a pas donnée.
2. Répondre avec une courte relance chaleureuse (1-2 phrases) qui confirme ce que tu as compris et, si la réponse est vague ou incomplète, invite gentiment à préciser — sans bloquer la progression.
Ne réponds jamais avec du texte hors du format demandé.`;

async function callModel<T extends z.ZodTypeAny>(
  field: OpenCadrageField | ListCadrageField,
  rawAnswer: string,
  schema: T,
  schemaName: string
): Promise<z.infer<T>> {
  const response = await openai.responses.create({
    model: OPENAI_MODEL,
    input: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Champ à traiter : ${field}\nConsigne : ${FIELD_INSTRUCTIONS[field]}\n\nRéponse brute du Formateur :\n${rawAnswer}`,
      },
    ],
    text: { format: zodTextFormat(schema, schemaName) },
    max_output_tokens: 500,
  });

  if (!response.output_text) {
    throw new Error("Le modèle n'a renvoyé aucun contenu.");
  }
  return schema.parse(JSON.parse(response.output_text));
}

export async function reformulateOpenField(
  field: OpenCadrageField,
  rawAnswer: string
): Promise<{ value: string; reply: string }> {
  return callModel(field, rawAnswer, openFieldResult, "cadrage_open_field");
}

export async function reformulateListField(
  field: ListCadrageField,
  rawAnswer: string
): Promise<{ items: string[]; reply: string }> {
  return callModel(field, rawAnswer, listFieldResult, "cadrage_list_field");
}
