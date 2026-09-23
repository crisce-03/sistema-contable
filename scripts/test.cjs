const fs = require("node:fs");
const ts = require("typescript");
const cp = require("node:child_process");
fs.mkdirSync(".test-build", { recursive: true });
for (const name of ["core", "reports", "local"]) {
  fs.writeFileSync(
    `.test-build/${name}.cjs`,
    ts.transpileModule(fs.readFileSync(`lib/accounting/${name}.ts`, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText,
  );
}
fs.copyFileSync(".test-build/core.cjs", ".test-build/core.js");
fs.copyFileSync(".test-build/reports.cjs", ".test-build/reports.js");
fs.copyFileSync("lib/accounting/families.json", ".test-build/families.json");
fs.copyFileSync("lib/accounting/classifications.json", ".test-build/classifications.json");
const r = cp.spawnSync(
  process.execPath,
  [
    "--test",
    "tests/core.test.cjs",
    "tests/local.test.cjs",
    "tests/reports.test.cjs",
  ],
  { stdio: "inherit" },
);
fs.rmSync(".test-build", { recursive: true, force: true });
process.exit(r.status ?? 1);
