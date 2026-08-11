import { Injectable } from '@nestjs/common';

@Injectable()
export class RemediationService {
  health(): string {
    return 'RemediationService is healthy';
  }
}
