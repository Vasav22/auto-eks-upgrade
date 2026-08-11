import { SetMetadata } from '@nestjs/common';
import { IDEMPOTENCY_KEY } from '../guards/idempotency.guard';

export const Idempotent = () => SetMetadata(IDEMPOTENCY_KEY, true);
