import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env["OPENAI_API_KEY"],
});

const MODEL = "gpt-4o";
const DATETIME_SYSTEM_PROMPT = `
You should take the input tweet text and extract the timestamp of the Tweet in the format YYYY-MM-DDTHH:MM:00Z (assume it is UTC). The input text was extracted from the DOM using el.innerText, so may be messy or have formatting issues. Do not include any other output in your response, only the timestamp.
`.trim();

const MARKDOWN_SYSTEM_PROMPT = `
You should take the input tweet text and transform it into a cleaned markdown representation of the content (body) of the tweet. The input text was extracted from the DOM using el.innerText, so may be messy or have formatting issues (e.g. an @ tag may be split on multiple lines). Your output should only contain the cleaned markdown representation of the content of the tweet – do not include any other output or preamble in your response.

For any @mentions of other accounts, you should markdown hyperlink them to https://x.com/username. If a raw URL is included in the tweet, you should markdown hyperlink it using the URL itself (without the http/s protocol) as the label for the hyperlink – ellipsized if needed.

If the tweet is quoting another tweet, include a snippet of the quoted tweet at the top of the markdown using a blockquote, e.g.

> Responding to post from @user: [short snippet that truncates to ellipsis after 10-20 words, maximum 1 sentence]

`.trim();

(async () => {
  const homeDir = process.env.HOME;
  const url = process.argv[2];

  if (!url.includes("x.com")) {
    console.error("Only tweets are supported for now.");
    process.exit(1);
  }

  const browser = await puppeteer.launch({
    headless: false,
    userDataDir: `${homeDir}/Library/Application Support/Google/Chrome/Default`,
  });

  const page = await browser.newPage();
  await page.goto(url);
  const tweet = await page.waitForSelector('[data-testid="tweet"]', {
    timeout: 5000,
  });
  const tweetText = await tweet.evaluate((node) => node.innerText);
  const tweetImages = await tweet.evaluate((node) => {
    const images = node.querySelectorAll('[data-testid="tweetPhoto"] img');
    return [...images].map((img) => img.src);
  });

  const dtResopnse = await client.responses.create({
    model: MODEL,
    instructions: DATETIME_SYSTEM_PROMPT,
    input: tweetText,
  });

  const dt = new Date(dtResopnse.output_text);

  const mdResponse = await client.responses.create({
    model: MODEL,
    instructions: MARKDOWN_SYSTEM_PROMPT,
    input: tweetText,
  });

  let tweetMd = mdResponse.output_text;

  const tweetId = url.split("/").pop();
  const filenameTimestamp = dt
    .toISOString()
    .replace(/:/g, "-")
    .slice(0, 16)
    .replace("T", "-");

  // Deal with images
  const tweetMdImages = [];
  let i = 0;
  for (const imageUrl of tweetImages) {
    // e.g. https://pbs.twimg.com/media/Ge8z4yzaQAAJFPO?format=png&name=small
    const url = new URL(imageUrl);
    const format = url.searchParams.get("format");
    if (!format) {
      console.error("No format found in image URL: ", imageUrl);
      process.exit(1);
    }
    url.searchParams.set("name", "large");
    const imagePage = await browser.newPage();
    const imageResponse = await imagePage.goto(url.toString());
    const imageBuffer = await imageResponse.buffer();
    const imageFilename = `${filenameTimestamp}-${tweetId}-${i}.${format}`;
    const imageSafePath = path.resolve(
      import.meta.dirname,
      `../public/static/${imageFilename}`,
    );
    fs.writeFileSync(imageSafePath, imageBuffer);
    tweetMdImages.push(imageFilename);
    i++;
  }
  if (tweetMdImages.length > 0) {
    tweetMd = `
import ImageGrid from "../../components/ImageGrid.astro";

${tweetMd}

<ImageGrid
  images={[
    ${tweetMdImages.map((i) => `'/static/${i}',`).join("\n    ")}
  ]}
/>
`.trim();
  }

  const filename = `${filenameTimestamp}-${tweetId}.mdx`;
  const filePath = `../src/content/posts/${filename}`;
  const fileContent = `---
date: "${dt.toISOString()}"
source: ${url}
---

${tweetMd}
`.trim();

  // Resolve path from current dirname
  const safePath = path.resolve(import.meta.dirname, filePath);
  fs.writeFileSync(safePath, fileContent);
  console.log("Wrote markdown file to:", safePath);

  await browser.close();
})();
