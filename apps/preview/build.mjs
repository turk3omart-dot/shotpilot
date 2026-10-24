// Bundles the browser-only preview into ONE self-contained HTML fragment (dist/preview.html).
// It reuses the real parser, estimation, scheduler and permission code from the packages.
import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const result = await build({
  entryPoints: ["src/main.js"],
  bundle: true,
  minify: true,
  format: "iife",
  target: "es2020",
  write: false,
  loader: { ".fountain": "text" },
  logLevel: "warning",
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
const css = readFileSync("src/style.css", "utf8");
const html = readFileSync("src/template.html", "utf8").replace("/*CSS*/", () => css).replace("/*JS*/", () => js);
mkdirSync("dist", { recursive: true });
writeFileSync("dist/preview.html", html);
console.log(`dist/preview.html ${(html.length / 1024).toFixed(0)} KB`);
