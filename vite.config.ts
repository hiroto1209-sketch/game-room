import { defineConfig } from "vite";

/**
 * Preserve the standalone old main.js as a safe fallback for branch-based Pages.
 * During Vite dev/build, swap only the HTML entry to the new TypeScript app.
 */
export default defineConfig({
  base:"/game-room/",
  plugins:[{
    name:"game-room-ts-entry",
    transformIndexHtml:{
      order:"pre",
      handler(html:string){
        const legacy='<script type="module" src="./main.js"></script>';
        if(!html.includes(legacy))throw new Error("Game Room legacy HTML entry is missing");
        return html.replace(legacy,'<script type="module" src="./src/main.ts"></script>');
      }
    }
  }],
  build:{outDir:"dist",emptyOutDir:true,target:"es2020",sourcemap:false},
  server:{host:true}
});
