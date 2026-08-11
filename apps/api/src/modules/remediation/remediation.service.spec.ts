import { Test, TestingModule } from '@nestjs/testing';
import { RemediationService } from './remediation.service';

describe('RemediationService', () => {
  let service: RemediationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RemediationService],
    }).compile();

    service = module.get<RemediationService>(RemediationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
