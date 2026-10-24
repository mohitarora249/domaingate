/**
 * An error whose message is written for end users and is safe to return from
 * an API route. Any other error is treated as internal and never shown as-is.
 */
export class UserError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = "UserError";
  }
}
