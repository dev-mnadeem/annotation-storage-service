import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { registeredRoutes } from '../helpers/routes';
import { testApp } from '../helpers/api';

interface PostmanRequest {
  name: string;
  request?: { method: string; url: { raw: string } };
  item?: PostmanRequest[];
}

const collection = JSON.parse(
  readFileSync(join(__dirname, '../../.postman/PerleAI.postman_collection.json'), 'utf8'),
) as { item: PostmanRequest[]; variable: { key: string; value: string }[] };

function flatten(items: PostmanRequest[]): PostmanRequest[] {
  return items.flatMap((item) => (item.item ? flatten(item.item) : [item]));
}

/** `{{baseUrl}}/projects/{{projectId}}/stats` -> `GET /api/projects/:x/stats`. */
function toRoute(entry: PostmanRequest): string {
  const path = entry
    .request!.url.raw.replace('{{baseUrl}}', '')
    .split('?')[0]
    .replace(/\{\{[^}]+\}\}/g, ':x');
  return `${entry.request!.method} /api${path}`;
}

const requests = flatten(collection.item);
const documented = new Set(requests.map(toRoute));
const registered = new Set(registeredRoutes(testApp()).map((r) => r.replace(/:[A-Za-z]+/g, ':x')));

/**
 * The collection is the only client-facing description of the API, so it is checked against
 * the router the same way the tests are. A route added without a request here fails the suite
 * rather than quietly going undocumented.
 */
describe('the Postman collection', () => {
  it('has a request for every route the app registers', () => {
    const missing = [...registered].filter((r) => !documented.has(r));
    expect(missing).toEqual([]);
  });

  it('documents no route the app does not serve', () => {
    const extra = [...documented].filter((r) => !registered.has(r));
    expect(extra).toEqual([]);
  });

  it('asserts a status on every request', () => {
    const silent = requests.filter(
      (r) => !JSON.stringify(r).includes('pm.response.to.have.status'),
    );
    expect(silent.map((r) => r.name)).toEqual([]);
  });

  it('sends the API key header on every request', () => {
    const unauthenticated = requests.filter(
      (r) => !JSON.stringify(r.request).includes('X-API-Key'),
    );
    expect(unauthenticated.map((r) => r.name)).toEqual([]);
  });

  it('points at the port the server defaults to', () => {
    const baseUrl = collection.variable.find((v) => v.key === 'baseUrl');
    expect(baseUrl?.value).toBe('http://localhost:7331/api');
  });
});
