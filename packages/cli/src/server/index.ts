import * as fs from 'node:fs';
import * as http from 'node:http';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { currentDir, parseConfig, parseModsConfig, parseStatusInput, type ProjectConfig } from '@statuscraft/core';
import { installPlugin, pluginState, uninstallPlugin } from '../lib/claude-plugins';
import { getInstallState, install, uninstall } from '../lib/claude-settings';
import { loadConfig, loadMods, loadProject, saveConfig, saveMods, saveProjectFile } from '../lib/config-store';
import { paths } from '../lib/paths';
import { getGitInfo } from '../providers/git';
import { VERSION } from '../version';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
};

class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export function createServer(options: { port: number; projectDir: string; editorDir?: string }): http.Server {
  const editorDir = options.editorDir ?? path.join(path.dirname(fileURLToPath(import.meta.url)), 'editor');

  const routes: Record<string, (body: unknown) => Promise<unknown> | unknown> = {
    'GET /api/state': () => {
      const loaded = loadConfig();
      return {
        version: VERSION,
        config: loaded.config,
        configPath: loaded.path,
        configExists: loaded.exists,
        configError: loaded.error,
        importedFrom: loaded.importedFrom,
        install: getInstallState(),
        project: loadProject(options.projectDir),
        hasLastInput: fs.existsSync(paths.lastInputFile()),
      };
    },

    'GET /api/live': async () => {
      const raw = fs.existsSync(paths.lastInputFile()) ? fs.readFileSync(paths.lastInputFile(), 'utf8') : '';
      const input = parseStatusInput(raw);
      if (!input) throw new HttpError(404, 'No session seen yet. Use Claude Code once with StatusCraft installed.');
      const cwd = currentDir(input);
      const git = cwd && fs.existsSync(cwd) ? await getGitInfo(cwd, 'editor') : undefined;
      return { input, git, home: paths.home() };
    },

    'PUT /api/config': (body) => {
      const parsed = parseConfig((body as { config?: unknown })?.config);
      if (!parsed.ok) throw new HttpError(400, parsed.error);
      return { saved: true, path: paths.configFile(), ...saveConfig(parsed.value) };
    },

    'POST /api/install': () => {
      const result = install();
      return { installed: true, ...result };
    },

    'POST /api/uninstall': () => uninstall(),

    'GET /api/mods': async () => ({ ...loadMods(), plugin: await pluginState() }),

    'PUT /api/mods': (body) => {
      const raw = (body as { mods?: unknown } | undefined)?.mods;
      // An empty body would otherwise parse as "no mods" and wipe the file
      if (raw === undefined || raw === null) throw new HttpError(400, 'mods is missing');
      const parsed = parseModsConfig(raw);
      if (!parsed.ok) throw new HttpError(400, parsed.error);
      return { saved: true, ...saveMods(parsed.value) };
    },

    'POST /api/mods/install': () => installPlugin(),

    'POST /api/mods/uninstall': () => uninstallPlugin(),

    'PUT /api/project': (body) => {
      const { which, data } = body as { which?: 'project' | 'local'; data?: ProjectConfig | null };
      if (which !== 'project' && which !== 'local') throw new HttpError(400, 'which must be "project" or "local"');
      return { file: saveProjectFile(options.projectDir, which, data ?? null) };
    },
  };

  return http.createServer(async (req, res) => {
    try {
      assertLocal(req, options.port);
      const url = new URL(req.url ?? '/', `http://${req.headers.host}`);

      if (url.pathname.startsWith('/api/')) {
        const handler = routes[`${req.method} ${url.pathname}`];
        if (!handler) throw new HttpError(404, 'Not found');
        // A custom header cannot be sent cross-site without a CORS preflight, which this server never grants
        if (req.method !== 'GET' && req.headers['x-statuscraft'] !== '1') throw new HttpError(403, 'Missing x-statuscraft header');
        const body = req.method === 'GET' ? undefined : await readBody(req);
        return send(res, 200, { ok: true, data: await handler(body) });
      }

      serveStatic(res, editorDir, url.pathname);
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500;
      send(res, status, { ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  });
}

// Only answer requests addressed to localhost, which blocks DNS rebinding.
function assertLocal(req: http.IncomingMessage, port: number): void {
  const host = (req.headers.host ?? '').toLowerCase();
  const allowed = [`localhost:${port}`, `127.0.0.1:${port}`, `[::1]:${port}`];
  if (!allowed.includes(host)) throw new HttpError(403, 'StatusCraft only answers on localhost');
}

function readBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let text = '';
    req.setEncoding('utf8');
    req.on('data', (chunk: string) => {
      text += chunk;
      if (text.length > 2_000_000) reject(new HttpError(413, 'Request too large'));
    });
    req.on('end', () => {
      try {
        resolve(text ? JSON.parse(text) : undefined);
      } catch {
        reject(new HttpError(400, 'Body is not JSON'));
      }
    });
    req.on('error', reject);
  });
}

function send(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

function serveStatic(res: http.ServerResponse, root: string, pathname: string): void {
  const relative = path.normalize(decodeURIComponent(pathname)).replace(/^([/\\])+/, '');
  let file = path.join(root, relative);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    file = path.join(root, 'index.html');
  }
  if (!fs.existsSync(file)) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('The editor is not built. Run "bun run build" (or use "bun run dev" while developing).');
    return;
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}
