import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  parseFeatureContract,
  serializeFeatureContract,
  type FeatureContract,
  type ProjectContext,
} from "@promptmarket/content";
import { detectTelemetry } from "./observe.js";
import { EVAL_WORKFLOW } from "./verify.js";

export const FEATURE_ROOT = ".promptmarket/features";

export async function readFeatureContracts(root: string): Promise<
  Array<{ file: string; contract: FeatureContract } | { file: string; error: string }>
> {
  const directory = path.join(root, FEATURE_ROOT);
  let names: string[] = [];
  try {
    names = await readdir(directory);
  } catch {
    return [];
  }
  const files = names.filter(function yaml(name) {
    return name.endsWith(".yaml") || name.endsWith(".yml");
  }).sort();
  const contracts = [];
  for (const name of files) {
    const file = path.join(FEATURE_ROOT, name);
    try {
      const raw = await readFile(path.join(root, file), "utf8");
      contracts.push({ file, contract: parseFeatureContract(raw, file) });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      contracts.push({ file, error: message });
    }
  }
  return contracts;
}

export async function featureEvidence(
  root: string,
  contract: FeatureContract,
  project?: ProjectContext,
) {
  const suite = contract.eval
    ? await access(path.join(root, contract.eval.suite)).then(
        function present() {
          return true;
        },
        function missing() {
          return false;
        },
      )
    : false;
  const workflow = await access(path.join(root, EVAL_WORKFLOW)).then(
    function present() {
      return true;
    },
    function missing() {
      return false;
    },
  );
  const telemetry = detectTelemetry(root, project);
  return {
    evalSuiteExists: suite,
    workflowExists: workflow,
    langfuseDetected: telemetry.packages.length > 0 || telemetry.files.length > 0,
  };
}

export async function writeFeatureContract(
  root: string,
  contract: FeatureContract,
): Promise<string> {
  const relative = path.join(FEATURE_ROOT, `${contract.id}.yaml`);
  const destination = path.join(root, relative);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, serializeFeatureContract(contract), "utf8");
  return relative;
}
