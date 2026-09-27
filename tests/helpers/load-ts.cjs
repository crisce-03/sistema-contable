const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");
const ts = require("typescript");

const root = path.resolve(__dirname, "../..");

/** Load actual TypeScript modules with isolated caches and explicit dependency mocks. */
function loadTs(file, mocks = {}) {
  const cache = new Map();

  function resolveFile(candidate) {
    const files = [candidate];
    for (const extension of [".ts", ".tsx", ".js", ".cjs", ".json"]) {
      files.push(candidate + extension, path.join(candidate, "index" + extension));
    }
    const found = files.find((value) => fs.existsSync(value) && fs.statSync(value).isFile());
    if (!found) throw new Error(`Cannot resolve test module: ${candidate}`);
    return found;
  }

  function evaluate(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const loadedModule = { exports: {} };
    cache.set(filename, loadedModule);
    if (filename.endsWith(".json")) {
      loadedModule.exports = JSON.parse(fs.readFileSync(filename, "utf8"));
      return loadedModule.exports;
    }
    const nativeRequire = createRequire(filename);
    function requireModule(specifier) {
      if (Object.hasOwn(mocks, specifier)) return mocks[specifier];
      if (specifier.startsWith("@/")) return evaluate(resolveFile(path.join(root, specifier.slice(2))));
      if (specifier.startsWith(".") || path.isAbsolute(specifier)) {
        return evaluate(resolveFile(path.resolve(path.dirname(filename), specifier)));
      }
      return nativeRequire(specifier);
    }
    const source = fs.readFileSync(filename, "utf8");
    const code = /\.tsx?$/.test(filename)
      ? ts.transpileModule(source, {
          fileName: filename,
          compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2022,
            esModuleInterop: true,
            jsx: ts.JsxEmit.ReactJSX,
          },
        }).outputText
      : source;
    const wrapper = new vm.Script(`(function(exports, require, module, __filename, __dirname) {\n${code}\n})`, { filename });
    wrapper.runInThisContext()(loadedModule.exports, requireModule, loadedModule, filename, path.dirname(filename));
    return loadedModule.exports;
  }

  return evaluate(resolveFile(path.resolve(root, file)));
}

module.exports = { loadTs };
