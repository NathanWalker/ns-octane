import { defineConfig } from "vite";
import { octaneConfig } from "@nativescript-community/vite-octane";

export default defineConfig(({ mode }) => octaneConfig({ mode }));
