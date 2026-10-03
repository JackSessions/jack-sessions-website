import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// --- Blog: same shape as the Astro starter, so your existing posts keep working.
const blog = defineCollection({
  loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    heroImage: z.string().optional(),
    tags: z.array(z.string()).default([]),
  }),
});

// --- Talks: one markdown file per talk in src/content/talks/
const talks = defineCollection({
  loader: glob({ base: './src/content/talks', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    title: z.string(),
    event: z.string(),              // e.g. "BSides Canberra"
    date: z.coerce.date(),
    datePrecision: z.enum(['day', 'month', 'year']).default('day'), // how much of the date to show
    location: z.string().optional(),
    description: z.string(),
    slidesUrl: z.string().optional(),   // link or /slides/xyz.pdf in public/
    slidesPptxUrl: z.string().optional(), // editable deck, e.g. /slides/xyz.pptx
    videoUrl: z.string().optional(),    // recording
    tags: z.array(z.string()).default([]),
  }),
});

// --- Projects: tools, CVEs, research in src/content/projects/
const projects = defineCollection({
  loader: glob({ base: './src/content/projects', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date().optional(),
    repoUrl: z.string().optional(),
    url: z.string().optional(),         // write-up, release, CVE link
    status: z.enum(['active', 'released', 'archived', 'research']).default('active'),
    featured: z.boolean().default(false),
    tags: z.array(z.string()).default([]),
  }),
});

export const collections = { blog, talks, projects };
