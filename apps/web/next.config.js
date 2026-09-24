import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  agentRules: false,
  outputFileTracingRoot: repoRoot,
  async headers() {
    return ["/api/:path*", "/mcp"].map((source) => ({
      source,
      headers: [{ key: "X-Robots-Tag", value: "noindex" }],
    }));
  },
  outputFileTracingIncludes: {
    "/sitemap.xml": ["../../recipes/**/*", "../../content/**/*"],
    "/": ["../../recipes/**/*", "../../content/**/*"],
    "/docs": ["../../recipes/**/*", "../../content/**/*"],
    "/learn": ["../../content/**/*"],
    "/learn/*": ["../../content/**/*"],
    "/prompts": ["../../recipes/**/*", "../../content/**/*"],
    "/prompts/*": ["../../content/**/*"],
    "/recipes": ["../../recipes/**/*"],
    "/recipes/*": ["../../recipes/**/*"],
    "/api/registry/v1": ["../../recipes/**/*"],
    "/api/registry/v1/*": ["../../recipes/**/*"],
    "/mcp": ["../../recipes/**/*", "../../content/**/*"],
  },
};

export default nextConfig;
