import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const blog = defineCollection({
	// Load Markdown and MDX files in the `src/content/blog/` directory.
	loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
	// Type-check frontmatter using a flexible, robust schema
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			description: z.string().optional().default(''),
			// Support both pubDate and date frontmatter keys
			pubDate: z.coerce.date().optional(),
			date: z.coerce.date().optional(),
			updatedDate: z.coerce.date().optional(),
			author: z.string().optional().default('Yash'),
			tags: z.array(z.string()).optional().default([]),
			heroImage: z.optional(image()),
		}).transform((data) => ({
			...data,
			pubDate: data.pubDate ?? data.date ?? new Date(),
		})),
});

export const collections = { blog };

