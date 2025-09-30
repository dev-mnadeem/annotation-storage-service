import type { Express } from 'express';

/**
 * Reads the routes Express actually registered, rather than a list somebody maintains by
 * hand. Anything that asserts against this is asserting against the running app.
 */
interface Layer {
  route?: { path: string; methods: Record<string, boolean> };
  name: string;
  regexp: RegExp;
  handle?: { stack?: Layer[] };
}

/** `^\/api\/?(?=\/|$)` is how Express 4 stores the mount path of a nested router. */
function mountPath(re: RegExp): string {
  const match = re.source.match(/^\^\\\/(.*?)\\\/\?\(\?=\\\/\|\$\)$/);
  if (!match) return '';
  return `/${match[1].replace(/\\\//g, '/')}`;
}

function walk(stack: Layer[], prefix: string, out: string[]): void {
  for (const layer of stack) {
    if (layer.route) {
      const path = layer.route.path === '/' ? '' : layer.route.path;
      for (const method of Object.keys(layer.route.methods)) {
        out.push(`${method.toUpperCase()} ${prefix}${path}`);
      }
    } else if (layer.name === 'router' && layer.handle?.stack) {
      walk(layer.handle.stack, prefix + mountPath(layer.regexp), out);
    }
  }
}

export function registeredRoutes(app: Express): string[] {
  const out: string[] = [];

  walk((app as any)._router.stack as Layer[], '', out);
  return out.sort();
}
