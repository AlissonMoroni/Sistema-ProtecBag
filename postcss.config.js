import { fileURLToPath } from 'node:url';

// Caminho absoluto: funciona mesmo se o Vite for iniciado de outra pasta.
const tailwindConfig = fileURLToPath(new URL('./tailwind.config.js', import.meta.url));

export default {
  plugins: {
    tailwindcss: { config: tailwindConfig },
    autoprefixer: {},
  },
};
