import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';

describe('HealthController', () => {
  let controller: HealthController;
  let healthCheckService: HealthCheckService;
  let dbHealthIndicator: TypeOrmHealthIndicator;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthCheckService,
          useValue: {
            check: jest.fn(),
          },
        },
        {
          provide: TypeOrmHealthIndicator,
          useValue: {
            pingCheck: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    healthCheckService = module.get<HealthCheckService>(HealthCheckService);
    dbHealthIndicator = module.get<TypeOrmHealthIndicator>(
      TypeOrmHealthIndicator,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('readiness', () => {
    it('should return 200 when database is healthy', async () => {
      const mockHealthyResult = {
        status: 'ok',
        info: {
          database: {
            status: 'up',
          },
        },
        error: {},
        details: {
          database: {
            status: 'up',
          },
        },
      };

      jest
        .spyOn(healthCheckService, 'check')
        .mockResolvedValue(mockHealthyResult as any);

      const result = await controller.readiness();

      expect(result).toEqual(mockHealthyResult);
      expect(healthCheckService.check).toHaveBeenCalledWith([
        expect.any(Function),
      ]);
    });

    it('should return 503 when database is unhealthy', async () => {
      const mockUnhealthyResult = {
        status: 'error',
        info: {},
        error: {
          database: {
            status: 'down',
            message: 'Connection refused',
          },
        },
        details: {
          database: {
            status: 'down',
            message: 'Connection refused',
          },
        },
      };

      jest
        .spyOn(healthCheckService, 'check')
        .mockRejectedValue(mockUnhealthyResult);

      await expect(controller.readiness()).rejects.toEqual(
        mockUnhealthyResult,
      );
    });

    it('should call database ping check', async () => {
      const mockResult = {
        status: 'ok',
        info: { database: { status: 'up' } },
        error: {},
        details: { database: { status: 'up' } },
      };

      jest.spyOn(healthCheckService, 'check').mockResolvedValue(mockResult as any);
      jest
        .spyOn(dbHealthIndicator, 'pingCheck')
        .mockResolvedValue({ database: { status: 'up' } } as any);

      await controller.readiness();

      expect(dbHealthIndicator.pingCheck).toHaveBeenCalledWith('database');
    });
  });
});
