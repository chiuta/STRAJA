// Copiază runtime-ul @capacitor/core (browser) în www/, ca pagina să poată folosi Capacitor.registerPlugin.
// Comentariul de licență (cu URL) este eliminat: aplicația nu conține referințe externe.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const src = new URL('../node_modules/@capacitor/core/dist/capacitor.js', import.meta.url);
if (existsSync(src)) {
  const js = readFileSync(src, 'utf8').replace(/^\/\*![\s\S]*?\*\/\s*/, '');
  writeFileSync(new URL('../www/capacitor.js', import.meta.url), '/* @capacitor/core runtime (MIT) */\n' + js);
  console.log('www/capacitor.js actualizat');
}
