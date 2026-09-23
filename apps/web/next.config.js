import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  agentRules: false,
  outputFileTracingRoot: repoRoot,
  outputFileTracingIncludes: {
    "/": ["../../recipes/**/*"],
    "/docs": ["../../recipes/**/*"],
    "/recipes/*": ["../../recipes/**/*"],
    "/api/registry/v1": ["../../recipes/**/*"],
    "/api/registry/v1/*": ["../../recipes/**/*"],
    "/mcp": ["../../recipes/**/*"],
  },
};

export default nextConfig;
