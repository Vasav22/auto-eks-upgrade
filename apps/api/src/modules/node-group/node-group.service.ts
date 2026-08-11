import { Injectable } from '@nestjs/common';

@Injectable()
export class NodeGroupService {
  health(): string {
    return 'NodeGroupService is healthy';
  }
}
