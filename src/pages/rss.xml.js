import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import { SITE_TITLE, SITE_DESCRIPTION } from "../consts";
import { formatDate } from "../lib/utils";

export async function GET(context) {
  const posts = await getCollection("posts");
  return rss({
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    site: context.site,
    items: posts.map((post) => ({
      title: post.data.title ?? formatDate(post.data.date),
      description: post.data.description ?? "",
      pubDate: post.data.date,
      link: `/posts/${post.slug}/`,
    })),
  });
}
