import { defineConfig } from "vite";
export default defineConfig({
  base:"/game-room/",
  build:{outDir:"dist",emptyOutDir:true,target:"es2020",sourcemap:false},
  server:{host:true}
});
