import { Injectable } from '@nestjs/common';

@Injectable()
export class UpgradeService {
  health(): string {
    return 'UpgradeService is healthy';
  }
}
