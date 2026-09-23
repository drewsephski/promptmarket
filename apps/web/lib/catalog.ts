import { FileRegistry, type Registry } from "@promptmarket/registry";

export function catalogRegistry(): Registry {
  const recipesDir = process.env.PROMPTMARKET_RECIPES_DIR;
  if (recipesDir) {
    return new FileRegistry({ recipesDir });
  }
  return new FileRegistry();
}
