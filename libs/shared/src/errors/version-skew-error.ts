import { AppError } from './app-error';

export class VersionSkewError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('VERSION_SKEW_ERROR', 400, message, details);
    this.name = 'VersionSkewError';
    Object.setPrototypeOf(this, VersionSkewError.prototype);
  }
}
