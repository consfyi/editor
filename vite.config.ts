import { lingui } from "@lingui/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import macrosPlugin from "vite-plugin-babel-macros";

// https://vite.dev/config/
export default defineConfig({
  plugins: [macrosPlugin(), lingui(), react()],
});
