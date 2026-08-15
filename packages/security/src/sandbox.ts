import { resolve, isAbsolute } from "node:path";

/**
 * Filesystem sandbox: every File/Developer agent operation must resolve
 * through this before touching disk. Prevents path traversal outside the
 * configured workspace root, independent of the risk/approval layer above.
 */
export class WorkspaceSandbox {
  readonly root: string;

  constructor(root: string) {
    this.root = resolve(root);
  }

  resolve(relativePath: string): string {
    const target = isAbsolute(relativePath) ? relativePath : resolve(this.root, relativePath);
    const normalized = resolve(target);
    if (normalized !== this.root && !normalized.startsWith(this.root + "/")) {
      throw new Error(
        `Path "${relativePath}" resolves outside the JARVIS workspace sandbox (${this.root}). Refusing.`,
      );
    }
    return normalized;
  }

  isInside(absolutePath: string): boolean {
    const normalized = resolve(absolutePath);
    return normalized === this.root || normalized.startsWith(this.root + "/");
  }
}
