# Data model

Four collections. `User` holds the people who draw masks and the digests of their API keys,
`Project` groups work, `Image` is a frame waiting to be annotated, and `Annotation` is one
mask on one image.

Field names below are the ones in `src/models/`. Anything marked *derived* is written by the
server and ignored if a client sends it.

## User — `src/models/User.ts`

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | |
| `name` | string | required |
| `email` | string | required, unique |
| `role` | `annotator` \| `admin` | defaults to `annotator` |
| `apiKeyHash` | string | SHA-256 of the issued key, unique, `select: false` |
| `createdAt` / `updatedAt` | Date | Mongoose timestamps |

There is no password field. A user is issued one random API key when it is created, the key is
returned once in that response, and only its digest is stored. `select: false` keeps the digest
out of every query that does not ask for it by name.

## Project — `src/models/Project.ts`

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | |
| `name` | string | required |
| `description` | string | optional |
| `status` | `active` \| `archived` | defaults to `active` |
| `createdBy` | ObjectId(User) \| null | *derived* from the API key. Null when created with the bootstrap admin key, which has no user row |

## Image — `src/models/Image.ts`

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | |
| `project` | ObjectId(Project) | required |
| `uri` | string | required — an S3 or CDN path, not the pixels |
| `width` | number | required, at least 1 |
| `height` | number | required, at least 1 |
| `status` | `unassigned` \| `in_progress` \| `annotated` | defaults to `unassigned` |
| `assignedTo` | ObjectId(User) | optional |
| `metadata` | object | free-form |

`width` and `height` are load-bearing: every mask check in `src/domain/mask/checks.ts` is
relative to them, so an image row with the wrong dimensions silently changes what counts as a
valid mask.

### Status transitions

`status` is only ever written through the table in `src/domain/imageLifecycle.ts`:

| From | `assign` | `release` | `annotate` | `reopen` |
|---|---|---|---|---|
| `unassigned` | `in_progress` | — | `annotated` | — |
| `in_progress` | — | `unassigned` | `annotated` | — |
| `annotated` | — | — | — | `in_progress` |

A dash is a 409 from `PATCH /api/images/:id/status`, with the legal actions listed in the
error details. The write itself is a compare-and-set on the old status, so two annotators
finishing the same image cannot both believe they made the transition.

## Annotation — `src/models/Annotation.ts`

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | |
| `project` | ObjectId(Project) | *derived* from the image |
| `image` | ObjectId(Image) | required |
| `label` | string | required |
| `segmentation` | object | polygon or RLE, see below |
| `area` | number | *derived* — always the server's computation |
| `createdBy` | ObjectId(User) \| null | *derived* from the API key |
| `metadata` | object | free-form |

## Segmentation

Two encodings, discriminated on `type` and parsed by `src/domain/mask/schema.ts`.

Polygon — a multi-polygon where `rings[0]` is the outline and any further rings are holes:

```json
{
  "type": "polygon",
  "polygons": [
    { "rings": [[[100, 100], [300, 100], [300, 250], [100, 250]]] }
  ]
}
```

Area is the shoelace area of each outline minus the shoelace area of its holes, floored at
zero, summed over the polygons.

RLE — COCO-style run-length encoding, `size` as `[height, width]`, `counts` alternating
background and foreground runs starting with background:

```json
{ "type": "rle", "size": [1080, 1920], "counts": [1036800, 1036800] }
```

Area is the sum of the odd-indexed runs. The runs must total `height * width` exactly, because
a COCO run list is a complete walk of the frame.

## Indexes

| Collection | Index | What it serves |
|---|---|---|
| Annotation | `{ label: 1 }` | `GET /annotations?label=` |
| Annotation | `{ image: 1 }` | masks on one image |
| Annotation | `{ project: 1 }` | masks in one project |
| Annotation | `{ createdBy: 1 }` | `GET /annotations?annotator=` |
| Annotation | `{ image: 1, area: -1 }` | area ranking, both endpoints |
| Annotation | `{ project: 1, _id: -1 }` | keyset paging within a project |
| Annotation | `{ project: 1, createdBy: 1 }` | per-annotator counts on the stats endpoint |
| Image | `{ project: 1 }`, `{ status: 1 }`, `{ project: 1, status: 1 }` | the work queue |
| Project | `{ status: 1 }` | active projects |
| User | `{ email: 1 }` unique, `{ apiKeyHash: 1 }` unique | login lookup by key digest |

## Ranking

For an annotation `A` on image `I`:

```
rank(A) = 1 + count(annotations on I with area > area(A))
```

One-based competition ranking: equal areas share a rank, and the rank after a tie of `n` skips
`n - 1` places. `GET /annotations/:id/rank` answers this with two counted index seeks.
`GET /images/:id/masks` answers it for every mask on an image in one pass, which is the same
definition implemented in `src/domain/ranking.ts` and checked against the endpoint in
`tests/api/images.test.ts`.

## COCO export

`GET /api/projects/:id/export` re-shapes the four collections into a COCO
instance-segmentation document. Categories are the distinct labels present, sorted and
numbered from 1 — COCO reserves no category 0. `area` and `bbox` are recomputed from the
stored geometry rather than copied, so an export can never disagree with the mask it
describes. Polygon masks are emitted with `iscrowd: 0`, RLE masks with `iscrowd: 1`.
