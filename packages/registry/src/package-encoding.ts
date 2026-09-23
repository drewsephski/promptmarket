import type { RecipePackageFileResponse } from "@promptmarket/schema";
import type { RecipeFile } from "./types.js";

export function encodePackageFile(file: RecipeFile): RecipePackageFileResponse {
  try {
    const content = new TextDecoder("utf-8", { fatal: true }).decode(
      file.contents,
    );
    return {
      path: file.path,
      encoding: "utf8",
      content,
    };
  } catch {
    return {
      path: file.path,
      encoding: "base64",
      content: Buffer.from(file.contents).toString("base64"),
    };
  }
}

export function decodePackageFile(file: RecipePackageFileResponse): Uint8Array {
  if (file.encoding === "utf8") {
    return new TextEncoder().encode(file.content);
  }
  return decodeBase64(file.content, file.path);
}

function decodeBase64(content: string, filePath: string): Uint8Array {
  if (content.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(content)) {
    throw new Error(`Invalid base64 recipe file: ${filePath}`);
  }
  const decoded = Buffer.from(content, "base64");
  if (decoded.toString("base64") !== content) {
    throw new Error(`Invalid base64 recipe file: ${filePath}`);
  }
  return decoded;
}
