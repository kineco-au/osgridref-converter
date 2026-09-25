import { defineConfig } from "vite";

export default defineConfig({
  test: {
    // Vitest options here
    environment: "node", // Example: for testing DOM environments
    globals: true, // Example: to make Vitest APIs global
  },
});
