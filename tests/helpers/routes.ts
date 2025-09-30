import type { Express } from 'express';

/**
 * Reads the routes Express actually registered, rather than a list somebody maintains by
 * hand. Anything that asserts against this is asserting against the running app.
 */
interface Layer {
  route?: { path: string; methods: Record<string, boolean> };
  name: string;
  slash: boolean;
  matchers: ((path: string) => { path: string } | false)[];
  handle?: { stack?: Layer[] };
}

/**
 * Express 5 keeps a mount path only inside a compiled matcher, so it is recovered by probing
 * that matcher with candidate segments. A router mounted under a segment no candidate covers
 * is reported as `/<unknown-mount>`, which can never match a documented route.
 */
function mountPath(layer: Layer, segments: string[]): string {
  if (layer.slash) return '';
  const hit = segments.find((segment) => {
    const match = layer.matchers[0](`/${segment}/probe`);
    return match && match.path === `/${segment}`;
  });
  return hit ? `/${hit}` : '/<unknown-mount>';
}

function walk(stack: Layer[], prefix: string, segments: string[], out: string[]): void {
  for (const layer of stack) {
    if (layer.route) {
      const path = layer.route.path === '/' ? '' : layer.route.path;
      for (const method of Object.keys(layer.route.methods)) {
        out.push(`${method.toUpperCase()} ${prefix}${path}`);
      }
    } else if (layer.name === 'router' && layer.handle?.stack) {
      walk(layer.handle.stack, prefix + mountPath(layer, segments), segments, out);
    }
  }
}

/** `segments` are the static path segments a mount could use, e.g. `['api', 'projects']`. */
export function registeredRoutes(app: Express, segments: string[]): string[] {
  const out: string[] = [];
  walk((app as any).router.stack as Layer[], '', segments, out);
  return out.sort();
}
