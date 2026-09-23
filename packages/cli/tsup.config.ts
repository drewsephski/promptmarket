import { cpSync } from "node:fs";
import path from "node:path";
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node22",
  platform: "node",
  splitting: false,
  sourcemap: false,
  clean: true,
  noExternal: [/@promptmarket\//, "zod", "commander"],
  onSuccess() {
    cpSync(
      path.resolve(import.meta.dirname, "../../content"),
      path.resolve(import.meta.dirname, "dist/content"),
      { recursive: true },
    );
  },
});
