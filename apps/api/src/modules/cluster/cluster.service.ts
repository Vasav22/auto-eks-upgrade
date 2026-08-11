import { Injectable } from '@nestjs/common';

@Injectable()
export class ClusterService {
  health(): string {
    return 'ClusterService is healthy';
  }
}
