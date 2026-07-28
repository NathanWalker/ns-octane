import { defineConfig, mergeConfig } from "vite";
import { typescriptConfig } from "@nativescript/vite/typescript";
import { octane } from "@octanejs/vite-plugin";
import { nativeScriptRenderers } from "./src/octane/config";

export default defineConfig(({ mode }) => {
  return mergeConfig(typescriptConfig({ mode }), {
    plugins: [octane({ renderers: nativeScriptRenderers })],
  });
});
