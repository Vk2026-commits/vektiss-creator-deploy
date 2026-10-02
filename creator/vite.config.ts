import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import {capturePlugin} from './server/capture-plugin';

export default defineConfig({
  plugins: [react(),capturePlugin()],
  server: { port: 5178, strictPort: true, fs:{deny:['.env','.env.*','*.{crt,pem}','**/.git/**','**/.local-captures/**']} },
});
