import { defineConfig } from "vite";
import { octaneConfig } from "@nativescript/vite-octane";
import { nativeScriptRenderers } from "./src/octane/config";

export default defineConfig(({ mode }) =>
  octaneConfig({ mode }, { octane: { renderers: nativeScriptRenderers } }),
);
