import type { Root, RootContent } from "hast";
import type { Plugin } from "unified";
import type {} from "mdast-util-mdx";
import type { MdxjsEsm, MdxjsEsmHast } from "mdast-util-mdxjs-esm";
import type { Property } from "estree";

export interface RehypeFrontmatterMdxImportsOptions {
  /**
   * frontmatter keys to process
   */
  keys?: string[];
  /**
   * regex to match imported asset paths
   */
  importedAssetPathRegex: string | RegExp;
  /**
   * pattern to match .mdx file paths, e.g. include only a subset of blog posts
   */
  fileRegex?: string | RegExp;
}

export const rehypeFrontmatterMdxImports: Plugin<
  [RehypeFrontmatterMdxImportsOptions],
  Root
> = (options) => {
  const assetPattern =
    options.importedAssetPathRegex instanceof RegExp
      ? options.importedAssetPathRegex
      : new RegExp(options.importedAssetPathRegex);

  const filePattern =
    options.fileRegex &&
    (options.fileRegex instanceof RegExp
      ? options.fileRegex
      : new RegExp(options.fileRegex));

  return function transformer(ast, file) {
    if (!file.history || !file.history[0]) {
      // skip processing if there's no file path
      return ast;
    }
    const filePath = file.history[0];
    if (filePattern && !filePattern.test(filePath)) {
      // we're not interested in this file
      return ast;
    }

    const imports = [];
    const imported = new Map();

    // find frontmatter node - check for metadata, frontmatter, or data exports
    const frontMatterNode = ast.children.find((node) =>
      isExportNode(node, ["metadata", "frontmatter", "data"])
    );

    if (!frontMatterNode) return ast;

    const properties = getFrontMatterASTObject(frontMatterNode);

    for (const prop of properties) {
      if (!prop.key || prop.key.type !== "Literal") continue;
      const key = prop.key.value;

      // skip if the key is not in the options, and options.keys is set
      if (options.keys && !options.keys.includes(key as string)) continue;

      // skip if the value is not a path
      if (
        prop.value?.type !== "Literal" ||
        typeof prop.value.value !== "string"
      )
        continue;

      const imagePath = prop.value.value;

      // only process relative paths (./ or ../)
      if (!imagePath.startsWith("./") && !imagePath.startsWith("../")) continue;

      // the path doesn't match the asset pattern, e.g. wrong extension
      if (!assetPattern.test(imagePath)) continue;

      const value = imagePath;

      // create a unique import name based on the property key
      let name = imported.get(imagePath);

      if (!name) {
        // use the property key in the variable name
        name = `_frontMatter_${key}`;

        // create an import declaration
        imports.push({
          type: "ImportDeclaration",
          source: { type: "Literal", value },
          specifiers: [
            {
              type: "ImportDefaultSpecifier",
              local: { type: "Identifier", name },
            },
          ],
        });

        imported.set(value, name);
      }

      // Replace the string value with the identifier reference
      prop.value = { type: "Identifier", name };
    }

    // Add the imports to the AST if we have any
    if (imports.length > 0) {
      // Add imports to the beginning of the AST as a new mdxjsEsm node
      ast.children.unshift({
        type: "mdxjsEsm",
        data: {
          estree: {
            type: "Program",
            sourceType: "module",
            // @ts-expect-error: i'll fix it when it breaks
            body: imports,
          },
        },
      } satisfies MdxjsEsm as any);
    }

    return ast;
  };
};

export function getFrontMatterASTObject(node: MdxjsEsmHast): Property[] {
  const [n] = node.data!.estree!.body;
  return (n as any).declaration.declarations[0].init.properties;
}

export function isExportNode(
  node: MdxjsEsmHast | RootContent,
  varNames: string[]
): node is MdxjsEsmHast {
  if (node.type !== "mdxjsEsm") return false;
  const n = node.data!.estree!.body[0]!;
  if (n.type !== "ExportNamedDeclaration") return false;
  const name = (n as any).declaration?.declarations?.[0].id.name;
  return varNames.includes(name);
}
