const fs = require("node:fs");
const ts = require("typescript");
const cp = require("node:child_process");
fs.mkdirSync(".test-build", { recursive: true });
fs.writeFileSync(
  ".test-build/core.cjs",
  ts.transpileModule(fs.readFileSync("lib/accounting/core.ts", "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText,
);
fs.copyFileSync(".test-build/core.cjs", ".test-build/core.js");
fs.writeFileSync(
  ".test-build/local.cjs",
  ts.transpileModule(fs.readFileSync("lib/accounting/local.ts", "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText,
);
fs.copyFileSync("lib/accounting/families.json", ".test-build/families.json");
fs.copyFileSync("lib/accounting/classifications.json", ".test-build/classifications.json");
const r = cp.spawnSync(
  process.execPath,
  [
    "--test",
    "tests/core.test.cjs",
    "tests/local.test.cjs",
  ],
  { stdio: "inherit" },
);
fs.rmSync(".test-build", { recursive: true, force: true });
process.exit(r.status ?? 1);
