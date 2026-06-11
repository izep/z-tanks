import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
    base: '/z-tanks/',
    clearScreen: false,
    server: {
        port: 5174
    },
    build: {
        rollupOptions: {
            input: {
                main: 'index.html',
                viewer: 'viewer.html'
            }
        }
    },
    plugins: [
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['favicon.ico', 'favicon.svg', 'z-logo.svg', 'tanks.png'],
            manifest: {
                name: 'Z-Tanks',
                short_name: 'Z-Tanks',
                description: 'A TypeScript port of the classic tank artillery game.',
                theme_color: '#242424',
                background_color: '#242424',
                display: 'standalone',
                orientation: 'landscape',
                start_url: '.',
                icons: [
                    {
                        src: 'pwa-192x192.png',
                        sizes: '192x192',
                        type: 'image/png'
                    },
                    {
                        src: 'pwa-512x512.png',
                        sizes: '512x512',
                        type: 'image/png'
                    },
                    {
                        src: 'pwa-512x512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'any maskable'
                    }
                ]
            },
            workbox: {
                globPatterns: ['**/*.{js,css,html,ico,png,svg}']
            }
        })
    ],
    test: {
        // *.spec.ts files are Playwright e2e tests; vitest runs *.test.ts only
        exclude: ['**/node_modules/**', '**/dist/**', 'tests/**/*.spec.ts'],
        setupFiles: ['./tests/setup.ts']
    }
});
