import { z } from "zod";

// Semantic Versioning 2.0.0. https://semver.org/#is-there-a-suggested-regular-expression-regex-to-check-a-semver-string
const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

export const SemVerSchema = z
  .string()
  .regex(SEMVER_PATTERN, "Invalid semantic version");

type ParsedSemVer = {
  major: number;
  minor: number;
  patch: number;
  prerelease: string[];
};

function parseSemver(version: string): ParsedSemVer {
  const match = SEMVER_PATTERN.exec(version);
  if (!match?.[1] || !match[2] || !match[3]) {
    throw new Error(`Invalid semantic version: ${version}`);
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ? match[4].split(".") : [],
  };
}

function compareNumeric(left: string, right: string): number {
  if (left.length !== right.length) {
    return left.length < right.length ? -1 : 1;
  }
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

function compareIdentifier(left: string, right: string): number {
  const leftNumeric = /^(0|[1-9]\d*)$/.test(left);
  const rightNumeric = /^(0|[1-9]\d*)$/.test(right);
  if (leftNumeric && rightNumeric) {
    return compareNumeric(left, right);
  }
  if (leftNumeric) {
    return -1;
  }
  if (rightNumeric) {
    return 1;
  }
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

export function compareSemver(left: string, right: string): number {
  const parsedLeft = parseSemver(left);
  const parsedRight = parseSemver(right);
  if (parsedLeft.major !== parsedRight.major) {
    return parsedLeft.major < parsedRight.major ? -1 : 1;
  }
  if (parsedLeft.minor !== parsedRight.minor) {
    return parsedLeft.minor < parsedRight.minor ? -1 : 1;
  }
  if (parsedLeft.patch !== parsedRight.patch) {
    return parsedLeft.patch < parsedRight.patch ? -1 : 1;
  }
  if (
    parsedLeft.prerelease.length === 0 &&
    parsedRight.prerelease.length === 0
  ) {
    return 0;
  }
  if (parsedLeft.prerelease.length === 0) {
    return 1;
  }
  if (parsedRight.prerelease.length === 0) {
    return -1;
  }
  const length = Math.min(
    parsedLeft.prerelease.length,
    parsedRight.prerelease.length,
  );
  for (let index = 0; index < length; index += 1) {
    const compared = compareIdentifier(
      parsedLeft.prerelease[index] ?? "",
      parsedRight.prerelease[index] ?? "",
    );
    if (compared !== 0) {
      return compared;
    }
  }
  if (parsedLeft.prerelease.length === parsedRight.prerelease.length) {
    return 0;
  }
  return parsedLeft.prerelease.length < parsedRight.prerelease.length ? -1 : 1;
}

export function latestSemver(versions: readonly string[]): string {
  const first = versions[0];
  if (first === undefined) {
    throw new Error("Cannot resolve latest version from an empty list");
  }
  return versions.reduce(function pickLatest(best, candidate) {
    const compared = compareSemver(candidate, best);
    if (compared > 0) {
      return candidate;
    }
    if (compared < 0) {
      return best;
    }
    return candidate < best ? candidate : best;
  }, first);
}
