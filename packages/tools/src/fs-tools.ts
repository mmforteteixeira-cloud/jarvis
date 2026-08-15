import { promises as fs } from "node:fs";
import { dirname } from "node:path";
import { WorkspaceSandbox } from "@jarvis/security";

export interface FsToolsOptions {
  sandbox: WorkspaceSandbox;
}

/** Real, working filesystem tools — sandboxed to a single workspace root. */
export class FsTools {
  private readonly sandbox: WorkspaceSandbox;

  constructor(options: FsToolsOptions) {
    this.sandbox = options.sandbox;
  }

  async readFile(path: string): Promise<string> {
    const abs = this.sandbox.resolve(path);
    return fs.readFile(abs, "utf-8");
  }

  async writeFile(path: string, content: string): Promise<void> {
    const abs = this.sandbox.resolve(path);
    await fs.mkdir(dirname(abs), { recursive: true });
    await fs.writeFile(abs, content, "utf-8");
  }

  async listDir(path = "."): Promise<Array<{ name: string; type: "file" | "directory" }>> {
    const abs = this.sandbox.resolve(path);
    const entries = await fs.readdir(abs, { withFileTypes: true });
    return entries.map((e) => ({ name: e.name, type: e.isDirectory() ? "directory" : "file" }));
  }

  async exists(path: string): Promise<boolean> {
    try {
      await fs.access(this.sandbox.resolve(path));
      return true;
    } catch {
      return false;
    }
  }

  async searchFiles(query: string, path = "."): Promise<string[]> {
    const abs = this.sandbox.resolve(path);
    const results: string[] = [];
    async function walk(dir: string, sandbox: WorkspaceSandbox) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === "node_modules" || entry.name === ".git") continue;
        const full = `${dir}/${entry.name}`;
        if (entry.isDirectory()) {
          await walk(full, sandbox);
        } else if (entry.name.toLowerCase().includes(query.toLowerCase())) {
          results.push(full);
        }
      }
    }
    await walk(abs, this.sandbox);
    return results;
  }
}
