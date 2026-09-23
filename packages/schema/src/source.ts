import { z } from "zod";

export const RecipeSourceSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("file"),
    })
    .strict(),
  z
    .object({
      type: z.literal("registry"),
      url: z.url(),
    })
    .strict(),
]);

export type RecipeSource = z.infer<typeof RecipeSourceSchema>;
