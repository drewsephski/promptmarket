# AI Engineer Roadmap illustrations

These WebP assets are cropped from Matt Pocock / AI Hero's **AI Engineer Roadmap**,
supplied as the visual source for the landing page:

https://res.cloudinary.com/total-typescript/image/upload/v1743077873/aihero.dev/ai-roadmap/ai-engineer-roadmap_qeny18.pdf

Source attribution is recorded here alongside the assets. These are third-party
illustrations; the repository's code license does not establish a license for
the original artwork.

## Source pages

- Page 1: `structuring-data`, `agents`, `question-answering`, `summarization`,
  `classification`, `translation`.
- Page 2: `building-ai-products`.
- Page 3: `experimentation`.
- Page 4: `evals`.
- Page 5: `rag`, `structured-outputs`, `tool-calling`, `workflows`, `agentic-loops`.
- Page 6: `optimization`.

Pages were rendered with Poppler at 2200 × 1700 pixels, cropped to individual
diagrams, and encoded as WebP at quality 88. Headings and descriptions live in
`components/roadmap-bento.tsx` rather than being baked into the images. The CSS
uses contain sizing to preserve each complete illustration and multiply blending
to match the site's paper surfaces. All fifteen assets total approximately 235 KiB.
