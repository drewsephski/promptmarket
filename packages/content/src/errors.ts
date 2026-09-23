export class ContentError extends Error {
  constructor(file: string, message: string) {
    super(`${file}: ${message}`);
    this.name = "ContentError";
  }
}

export class ContentNotFoundError extends Error {
  constructor(kind: "prompt" | "topic", slug: string) {
    super(`Unknown ${kind}: ${slug}`);
    this.name = "ContentNotFoundError";
  }
}
