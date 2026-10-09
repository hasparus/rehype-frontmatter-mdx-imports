import { expect, test } from "bun:test";
import { compile } from "@mdx-js/mdx";
import remarkFrontmatter from "remark-frontmatter";
import remarkMdxFrontmatter from "remark-mdx-frontmatter";
import { VFile } from "vfile";
import {
  rehypeFrontmatterMdxImports,
  type RehypeFrontmatterMdxImportsOptions,
} from "./index.tsx";

async function run(
  value: string,
  options: Partial<RehypeFrontmatterMdxImportsOptions> = {},
  path = "/posts/hello.mdx",
) {
  const file = await compile(new VFile({ path, value }), {
    remarkPlugins: [remarkFrontmatter, remarkMdxFrontmatter],
    rehypePlugins: [
      [
        rehypeFrontmatterMdxImports,
        { importedAssetPathRegex: /\.(png|jpe?g)$/, ...options },
      ],
    ],
  });
  return String(file);
}

test("turns a relative asset path into an import", async () => {
  const out = await run("---\nimage: ./cover.png\ntitle: Hi\n---\n\n# Hello");
  expect(out).toContain('import _frontMatter_image from "./cover.png"');
  expect(out).toContain('"image": _frontMatter_image');
  expect(out).toContain('"title": "Hi"');
});

test("leaves absolute paths and non-matching extensions alone", async () => {
  const out = await run("---\na: /cover.png\nb: ./notes.txt\n---\n");
  expect(out).not.toContain("import _frontMatter_");
});

test("makes a valid identifier from a hyphenated key", async () => {
  const out = await run("---\nog-image: ./og.png\n---\n");
  expect(out).toContain('import _frontMatter_og_image from "./og.png"');
  expect(out).toContain('"og-image": _frontMatter_og_image');
});

test("keeps import names unique when sanitized keys collide", async () => {
  const out = await run("---\nog-image: ./a.png\nog_image: ./b.png\n---\n");
  expect(out).toContain('import _frontMatter_og_image from "./a.png"');
  expect(out).toContain('import _frontMatter_og_image_2 from "./b.png"');
});

test("shares one import between keys with the same path", async () => {
  const out = await run("---\nimage: ./c.png\nthumbnail: ./c.png\n---\n");
  expect(out.match(/import _frontMatter_\w+ from "\.\/c\.png"/g)).toHaveLength(
    1,
  );
  expect(out).toContain('"thumbnail": _frontMatter_image');
});

test("does not crash on a file without frontmatter", async () => {
  const out = await run("# No frontmatter here");
  expect(out).not.toContain("import _frontMatter_");
});

test("respects keys and fileRegex", async () => {
  const src = "---\nimage: ./a.png\ncover: ./b.png\n---\n";
  const onlyImage = await run(src, { keys: ["image"] });
  expect(onlyImage).toContain("_frontMatter_image");
  expect(onlyImage).not.toContain("_frontMatter_cover");

  const skipped = await run(src, { fileRegex: /\/blog\// });
  expect(skipped).not.toContain("import _frontMatter_");
});
