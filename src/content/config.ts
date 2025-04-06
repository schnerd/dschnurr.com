import { defineCollection, z } from "astro:content";

const posts = defineCollection({
  type: "content",
  schema: z.object({
    // Datetime
    date: z.coerce.date(),
    // Source URL
    source: z.string().optional(),
    // Image
    image: z.string().optional(),
    // Optional title (e.g. longer form blog-post)
    title: z.string().optional(),
    // Optional description (e.g. short form blog-post)
    description: z.string().optional(),
  }),
});

export const collections = { posts };
