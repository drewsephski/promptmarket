export const HOSTED_MCP_URL = "https://promptmarket.sh/mcp";

export function latestInstallCommand(name: string): string {
  return `pnpm dlx @promptmarket/cli add ${name}`;
}

export function exactInstallCommand(name: string, version: string): string {
  return `pnpm dlx @promptmarket/cli add ${name}@${version}`;
}

export function recipeHref(name: string, version?: string): string {
  if (!version) {
    return `/recipes/${name}`;
  }
  return `/recipes/${name}?version=${encodeURIComponent(version)}`;
}

export function searchQuery(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

export function versionQuery(
  value: string | string[] | undefined,
): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) {
    return undefined;
  }
  return raw;
}
