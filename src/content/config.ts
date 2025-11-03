import { defineCollection, z } from 'astro:content';

const publicCollection = defineCollection({
  type: 'content',
  schema: ({ image }) => z.object({
    title: z.string().optional(),
    summary: z.string().optional(),
    publish: z.boolean().default(false),
    tags: z.array(z.string()).optional(),
    updated: z.date().or(z.string()).optional(),
  }),
});

export const collections = {
  public: publicCollection,
};
