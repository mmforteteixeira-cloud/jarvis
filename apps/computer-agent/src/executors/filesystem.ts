import { promises as fs } from "node:fs";
import { dirname, relative } from "node:path";
import { WorkspaceSandbox, isSensitivePath } from "@jarvis/security";
import { PolicyRejectionError } from "../errors.js";

export class FilesystemExecutor {
  constructor(private readonly sandbox: WorkspaceSandbox) {}

  private assertNotSensitive(relativePath: string) {
    if (isSensitivePath(relativePath)) {
      throw new PolicyRejectionError(`Refusing to touch "${relativePath}" — it looks like a credential/secret file.`);
    }
  }

  /** WorkspaceSandbox throws a plain Error on path-traversal escapes —
   * re-tagged as a policy rejection so the daemon reports REJECTED, not a
   * generic FAILED, for what is actually a security refusal. */
  private resolveInSandbox(path: string): string {
    try {
      return this.sandbox.resolve(path);
    } catch (error) {
      throw new PolicyRejectionError((error as Error).message);
    }
  }

  async listDirectory(path = "."): Promise<Array<{ name: string; type: "file" | "directory" }>> {
    const abs = this.resolveInSandbox(path);
    const entries = await fs.readdir(abs, { withFileTypes: true });
    return entries.map((e) => ({ name: e.name, type: e.isDirectory() ? "directory" : "file" }));
  }

  async readFile(path: string): Promise<string> {
    this.assertNotSensitive(path);
    const abs = this.resolveInSandbox(path);
    return fs.readFile(abs, "utf-8");
  }

  async writeFile(path: string, content: string): Promise<{ written: string; bytes: number }> {
    this.assertNotSensitive(path);
    const abs = this.resolveInSandbox(path);
    await fs.mkdir(dirname(abs), { recursive: true });
    await fs.writeFile(abs, content, "utf-8");
    return { written: relative(this.sandbox.root, abs), bytes: Buffer.byteLength(content, "utf-8") };
  }

  async createDirectory(path: string): Promise<{ created: string }> {
    const abs = this.resolveInSandbox(path);
    await fs.mkdir(abs, { recursive: true });
    return { created: relative(this.sandbox.root, abs) };
  }
}
