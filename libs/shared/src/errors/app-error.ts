export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
    Object.setPrototypeOf(this, AppError.prototype);
  }

  toJSON(): Record<string, unknown> {
    return {
      code: this.code,
      status: this.status,
      message: this.message,
      details: this.details,
    };
  }
}
