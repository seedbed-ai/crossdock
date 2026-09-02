import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MARKDOWN_LINK = /!?\[[^\]]*\]\(([^)]+)\)/g;
const SKIP_SCHEMES = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;
const SKIP_DIRS = new Set([".git", "node_modules"]);

function localTarget(rawTarget) {
  let target = rawTarget.trim();
  if (target.startsWith("<") && target.endsWith(">")) {
    target = target.slice(1, -1).trim();
  } else {
    // Markdown permits an optional quoted title after a whitespace-delimited URL.
    target = target.split(/\s+["']/u, 1)[0];
  }

  if (!target || target.startsWith("#") || SKIP_SCHEMES.test(target)) return null;
  const withoutFragment = target.split("#", 1)[0].split("?", 1)[0];
  if (!withoutFragment) return null;

  try {
    return decodeURIComponent(withoutFragment);
  } catch {
    return withoutFragment;
  }
}

export function extractLocalMarkdownTargets(markdown) {
  return [...markdown.matchAll(MARKDOWN_LINK)]
    .map((match) => localTarget(match[1]))
    .filter(Boolean);
}

async function markdownFiles(root) {
  const files = [];

  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      else if (entry.isFile() && entry.name.endsWith(".md")) files.push(absolute);
    }
  }

  await visit(root);
  return files.sort();
}

export async function findBrokenMarkdownLinks(root = process.cwd()) {
  const broken = [];
  for (const source of await markdownFiles(root)) {
    const markdown = await readFile(source, "utf8");
    for (const target of extractLocalMarkdownTargets(markdown)) {
      const resolved = target.startsWith("/")
        ? path.join(root, target.slice(1))
        : path.resolve(path.dirname(source), target);
      try {
        await access(resolved);
      } catch {
        broken.push({
          source: path.relative(root, source),
          target,
          resolved: path.relative(root, resolved),
        });
      }
    }
  }
  return broken;
}

async function main() {
  const root = process.cwd();
  const broken = await findBrokenMarkdownLinks(root);
  if (broken.length === 0) {
    console.log("Markdown links OK");
    return;
  }

  for (const link of broken) {
    console.error(`${link.source}: broken link ${link.target} -> ${link.resolved}`);
  }
  process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  await main();
}
