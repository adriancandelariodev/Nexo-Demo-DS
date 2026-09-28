import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
export default {
  kit: {
    // App de una sola página: se compila a archivos estáticos en build/ y todas las rutas caen en index.html
    adapter: adapter({ pages: 'build', assets: 'build', fallback: 'index.html', strict: true }),
  },
};
