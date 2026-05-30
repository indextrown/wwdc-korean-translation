import { cp, mkdir, rm } from "node:fs/promises";
import { build } from "esbuild";

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
await cp("public", "dist", { recursive: true });

const common = {
  bundle: true,
  minify: false,
  sourcemap: true,
  target: "chrome138",
  platform: "browser",
  logLevel: "info"
};

await Promise.all([
  build({
    ...common,
    entryPoints: ["src/content/content-script.ts"],
    outfile: "dist/content/content-script.js",
    format: "iife"
  }),
  build({
    ...common,
    entryPoints: ["src/background/service-worker.ts"],
    outfile: "dist/background/service-worker.js",
    format: "esm"
  }),
  build({
    ...common,
    entryPoints: ["src/options/options.ts"],
    outfile: "dist/options/options.js",
    format: "iife"
  }),
  build({
    ...common,
    entryPoints: ["src/popup/popup.ts"],
    outfile: "dist/popup/popup.js",
    format: "iife"
  })
]);
