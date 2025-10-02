/** A single [x, y] vertex in image pixel space. */
export type Vertex = [number, number];

/** A closed ring of vertices. The first ring of a polygon is its outer boundary. */
export type Ring = Vertex[];

/** One polygon: `rings[0]` is the outline, any further rings are holes punched out of it. */
export type Polygon = { rings: Ring[] };

export type PolygonSegmentation = { type: 'polygon'; polygons: Polygon[] };

/**
 * COCO-style run-length encoding. `size` is `[height, width]`, and `counts` alternates
 * background/foreground run lengths starting with background, walking the mask in
 * column-major order.
 */
export type RLESegmentation = { type: 'rle'; size: [number, number]; counts: number[] };

export type Segmentation = PolygonSegmentation | RLESegmentation;

/** `[x, y, width, height]`, the bounding box convention COCO exports use. */
export type BBox = [number, number, number, number];

/** The image a mask claims to cover. Every integrity check is relative to these dimensions. */
export type ImageFrame = { width: number; height: number };
