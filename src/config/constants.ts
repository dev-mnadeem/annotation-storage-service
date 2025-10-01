/** Limits and tolerances that the API enforces. Named here so no route invents its own. */

/** Largest JSON body accepted. Masks are big: an RLE run list can be tens of thousands of integers. */
export const JSON_BODY_LIMIT = '10mb';

/** Default and maximum number of annotations returned by one page of a list query. */
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/**
 * Tolerance used when a client sends its own `area` alongside a mask. Polygon areas are
 * computed in floating point, so an exact comparison would reject correct clients.
 */
export const AREA_EPSILON = 1e-6;

/** A polygon ring needs at least three vertices before it encloses anything. */
export const MIN_RING_VERTICES = 3;

/** Bytes of randomness in a generated annotator API key. */
export const API_KEY_BYTES = 24;

/** Minimum length accepted for the bootstrap admin key, to keep "secret" from being "admin". */
export const MIN_ADMIN_KEY_LENGTH = 16;

/** Seconds the server waits for in-flight requests before forcing exit. */
export const SHUTDOWN_GRACE_SECONDS = 10;

/** Mongoose `readyState` values, which the driver reports as bare integers. */
export const DB_STATE = {
  disconnected: 0,
  connected: 1,
  connecting: 2,
  disconnecting: 3,
} as const;
