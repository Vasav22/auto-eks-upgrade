import { Controller, Get } from '@nestjs/common';
import { RemediationService } from './remediation.service';

@Controller('remediations')
export class RemediationController {
  constructor(private readonly remediationService: RemediationService) {}

  @Get('health')
  health(): string {
    return this.remediationService.health();
  }
}
