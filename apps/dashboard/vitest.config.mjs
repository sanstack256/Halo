import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
  test: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
};
