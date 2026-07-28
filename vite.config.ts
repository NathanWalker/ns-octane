import { defineConfig } from "vite";
import { reactConfig } from "@nativescript/vite/react";

export default defineConfig(({ mode }) => {
  return reactConfig({ mode });
});
