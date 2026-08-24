import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..", "..");
const zodRoot = path.join(root, "lib", "api-zod", "src");
const generatedApi = path.join(zodRoot, "generated", "api.ts");
const index = path.join(zodRoot, "index.ts");

const api = await readFile(generatedApi, "utf8");
const normalizedApi = api
  .replaceAll("export const GetNewsParams =", "export const GetNewsParamsSchema =")
  .replaceAll("export const GetAssetAnalysisParams =", "export const GetAssetAnalysisParamsSchema =");

await Promise.all([
  writeFile(generatedApi, normalizedApi),
  writeFile(index, 'export * from "./generated/api";\nexport * from "./generated/types";\n'),
]);