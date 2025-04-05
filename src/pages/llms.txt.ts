import rss from "@astrojs/rss";
import { getCollection, type CollectionEntry } from "astro:content";

function stripTags(str: string) {
  return str.replace(/<\/?[^>]+(>|$)/g, "");
}

function postToString(post: CollectionEntry<"posts">) {
  const tags: Record<string, string> = {};
  if (post.data.title) {
    tags.title = post.data.title;
  }
  if (post.data.source) {
    tags.source = post.data.source;
  }
  if (post.data.description) {
    tags.description = post.data.description;
  }
  tags.url = `https://dschnurr.com/posts/${post.slug}`;
  tags.pubDate = post.data.date.toUTCString();
  tags.body = stripTags(post.body ?? '');
  const tagString = Object.entries(tags)
    .map(([key, value]) => {
      return `\n\t<${key}>${value}</${key}>`;
    })
    .join('');

  return `<post>${tagString}\n</post>`;
}

export async function GET() {
  const posts = await getCollection("posts");
  posts.sort((a, b) => {
    return b.data.date.getTime() - a.data.date.getTime();
  });
    
  return new Response(posts.map(postToString).join("\n"));
}
