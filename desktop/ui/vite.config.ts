import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'

// Vite plugin to create API endpoints for browser dev mode
function pythonApiPlugin() {
  return {
    name: 'python-api',
    configureServer(server: any) {
      server.middlewares.use('/api', (req: any, res: any) => {
        // req.url is like "/dashboard?from=..." (without /api prefix)
        const [path, queryString] = req.url.split('?');
        const params = new URLSearchParams(queryString || '');

        console.log('[Vite API] Request path:', path, 'query:', queryString);

        let command = '';

        if (path === '/dashboard') {
          const from = params.get('from') || '2025-01-01';
          const to = params.get('to') || '2025-12-27';
          const refreshParam = params.get('refresh');
          const refresh = refreshParam === 'true' || refreshParam === '1' ? '1' : '0';
          const granularity = params.get('granularity') || 'month';
          command = `uv run python -m command_center.tauri_api dashboard --from ${from} --to ${to} --refresh ${refresh} --granularity ${granularity}`;
        } else if (path === '/day') {
          const date = params.get('date');
          if (!date) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Missing date parameter' }));
            return;
          }
          command = `uv run python -m command_center.tauri_api day --date ${date}`;
        } else if (path === '/model') {
          const model = params.get('model');
          const from = params.get('from');
          const to = params.get('to');
          if (!model || !from || !to) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Missing parameters' }));
            return;
          }
          command = `uv run python -m command_center.tauri_api model --model ${model} --from ${from} --to ${to}`;
        } else if (path === '/session') {
          const id = params.get('sessionId') || params.get('id');
          if (!id) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Missing sessionId parameter' }));
            return;
          }
          command = `uv run python -m command_center.tauri_api session --id ${id}`;
        } else {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: 'Not found' }));
          return;
        }

        try {
          console.log('[Vite API] Executing:', command);
          const output = execSync(command, {
            cwd: '../..',
            encoding: 'utf-8',
          });
          console.log('[Vite API] Success, output length:', output.length);
          res.setHeader('Content-Type', 'application/json');
          res.end(output);
        } catch (error: any) {
          console.error('[Vite API] Error:', error.message);
          console.error('[Vite API] stderr:', error.stderr);
          console.error('[Vite API] stdout:', error.stdout);
          res.statusCode = 500;
          res.end(JSON.stringify({
            error: error.message,
            stderr: error.stderr,
            stdout: error.stdout
          }));
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), pythonApiPlugin()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }

          if (id.includes('@tauri-apps')) {
            return 'tauri';
          }
          if (id.includes('recharts')) {
            return 'charts';
          }
          if (id.includes('date-fns')) {
            return 'date-fns';
          }
          if (id.includes('react')) {
            return 'react';
          }

          return 'vendor';
        },
      },
    },
  },
})
