export type DomainErrorDetails = Record<string, unknown> | undefined;

export class DomainError extends Error {
  readonly code: string;
  readonly details: DomainErrorDetails;

  constructor(code: string, message: string, details?: DomainErrorDetails) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.details = details;
  }
}
