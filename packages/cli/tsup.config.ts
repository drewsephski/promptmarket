import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node22",
  platform: "node",
  splitting: false,
  sourcemap: false,
  clean: true,
  noExternal: [/@promptmarket\//, "yaml", "zod", "commander"],
});
