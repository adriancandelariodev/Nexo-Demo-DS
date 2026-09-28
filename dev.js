// Levanta backend (http://localhost:3001) y frontend SvelteKit (http://localhost:3000) juntos.
// Uso, desde la raíz del proyecto: npm run dev   ·   Ctrl + C detiene los dos.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const raiz = (carpeta) => fileURLToPath(new URL(`./${carpeta}/`, import.meta.url));
const procesos = [
  spawn(process.execPath, ['scripts/dev-server.js'], { cwd: raiz('backend'), stdio: 'inherit' }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'dev'], { cwd: raiz('frontend'), stdio: 'inherit' }),
];

const detener = () => { for (const p of procesos) p.kill(); process.exit(); };
process.on('SIGINT', detener);
process.on('SIGTERM', detener);
for (const p of procesos) p.on('exit', (code) => { if (code) { console.error('Un servidor se detuvo con error; deteniendo el otro.'); detener(); } });
