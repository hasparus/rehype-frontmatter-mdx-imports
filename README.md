# rehype-frontmatter-mdx-imports

Rehype plugin that turns relative asset paths in MDX frontmatter into imports.

A frontmatter value like `image: ./cover.png` is just a string. Your bundler never sees it, so the file isn't copied, hashed or checked, and the path (relative to the `.mdx` file) means nothing at runtime. This plugin rewrites it into an `import`, so the bundler resolves the file and the frontmatter holds whatever your image loader returns, e.g. `{ src, width, height }` in Next.js.

## Install

```sh
npm install rehype-frontmatter-mdx-imports
```

ESM only.

## Example

```mdx
---
title: Hello
image: ./cover.png
---

# Hello
```

compiles to

```js
import _frontMatter_image from "./cover.png";
export const frontmatter = {
  "title": "Hello",
  "image": _frontMatter_image
};
// ...
```

## Usage

The plugin doesn't parse YAML. It edits an `export const frontmatter = {…}` (or `metadata`, or `data`) that something earlier in the pipeline created, e.g. [remark-mdx-frontmatter](https://github.com/remcohaszing/remark-mdx-frontmatter) or Nextra.

```js
import { compile } from '@mdx-js/mdx'
import remarkFrontmatter from 'remark-frontmatter'
import remarkMdxFrontmatter from 'remark-mdx-frontmatter'
import { read } from 'to-vfile'
import { rehypeFrontmatterMdxImports } from 'rehype-frontmatter-mdx-imports'

const file = await compile(await read('posts/hello.mdx'), {
  remarkPlugins: [remarkFrontmatter, remarkMdxFrontmatter],
  rehypePlugins: [
    [rehypeFrontmatterMdxImports, { importedAssetPathRegex: /\.(png|jpe?g|gif|webp|avif)$/ }],
  ],
})
```

The file needs a path (`file.path`). Files without one are left alone.

### Nextra

Nextra exports frontmatter as `metadata`, so the plugin works as is:

```js
// next.config.mjs
import nextra from 'nextra'
import { rehypeFrontmatterMdxImports } from 'rehype-frontmatter-mdx-imports'

const withNextra = nextra({
  mdxOptions: {
    rehypePlugins: [
      [
        rehypeFrontmatterMdxImports,
        {
          keys: ['image', 'thumbnail'],
          importedAssetPathRegex: /\.(png|jpe?g|gif|webp)$/,
          fileRegex: /\/blog\//,
        },
      ],
    ],
  },
})

export default withNextra({})
```

Function plugins can't be passed to Nextra under Turbopack ([docs](https://nextra.site/docs/guide/turbopack)), so this needs webpack.

## Options

- `importedAssetPathRegex` (`RegExp | string`, required): only paths matching this are imported. Use it to pick file extensions.
- `keys` (`string[]`, optional): only these frontmatter keys are processed. Default: all top-level keys.
- `fileRegex` (`RegExp | string`, optional): only files whose path matches this are processed, e.g. `/\/blog\//`.

A value is imported when it's a top-level string, starts with `./` or `../`, and matches `importedAssetPathRegex`. Two keys pointing at the same path share one import.

## Caveats

- Nested objects and arrays aren't traversed.
- The import name is `_frontMatter_<key>`. Keys that aren't valid JS identifiers (`og-image`) produce invalid code, so leave them out with `keys`.
- Only quoted keys are matched. That's what YAML frontmatter compiles to, but a handwritten `export const metadata = { image: './a.png' }` is skipped.
- It throws if the export isn't an object literal. remark-mdx-frontmatter emits `export const frontmatter = undefined` for files without frontmatter, so use `fileRegex` to skip those files.

## License

MIT
