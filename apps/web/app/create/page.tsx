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
          The package on the right is the same <code>promptmarket.yaml</code>{" "}
          and <code>SKILL.md</code> the CLI writes. Download it, then submit a
          pull request with <code>promptmarket submit</code>.
        </p>
      </div>
      <RecipeBuilder />
    </main>
  );
}
