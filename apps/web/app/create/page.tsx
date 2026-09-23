import type { Metadata } from "next";
import { RecipeBuilder } from "../../components/recipe-builder";

export const metadata: Metadata = {
  title: "Create",
  description:
    "Build a PromptMarket recipe, validate it, and download the package.",
};

export default function CreatePage() {
  return (
    <main className="docs">
      <div className="hero-copy">
        <p className="eyebrow rise">Author</p>
        <h1 className="rise" style={{ animationDelay: "80ms" }}>
          Create a recipe
        </h1>
        <p className="lede rise" style={{ animationDelay: "160ms" }}>
          Write the recipe, download the package, then open a pull request.
        </p>
      </div>
      <RecipeBuilder />
    </main>
  );
}
