/** Thrown when the daemon's own policy refuses a command — distinct from
 * an execution failure (command not found, no display, network error).
 * The poller reports these as REJECTED rather than FAILED. */
export class PolicyRejectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PolicyRejectionError";
  }
}
