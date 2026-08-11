import { Test, TestingModule } from '@nestjs/testing';
import { CacheService } from './cache.service';
import Redis from 'ioredis';

describe('CacheService', () => {
  let service: CacheService;
  let mockRedis: jest.Mocked<Redis>;

  beforeEach(async () => {
    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        {
          provide: 'REDIS_CACHE_CLIENT',
          useValue: mockRedis,
        },
      ],
    }).compile();

    service = module.get<CacheService>(CacheService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('get', () => {
    it('should return parsed value when key exists', async () => {
      const testData = { foo: 'bar' };
      mockRedis.get.mockResolvedValue(JSON.stringify(testData));

      const result = await service.get<typeof testData>('test-key');

      expect(result).toEqual(testData);
      expect(mockRedis.get).toHaveBeenCalledWith('test-key');
    });

    it('should return null when key does not exist', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await service.get('test-key');

      expect(result).toBeNull();
    });

    it('should return null on error and log it', async () => {
      mockRedis.get.mockRejectedValue(new Error('Connection failed'));

      const result = await service.get('test-key');

      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('should serialize and set value with TTL', async () => {
      const testData = { foo: 'bar' };
      mockRedis.set.mockResolvedValue('OK');

      await service.set('test-key', testData, 300);

      expect(mockRedis.set).toHaveBeenCalledWith(
        'test-key',
        JSON.stringify(testData),
        'EX',
        300,
      );
    });

    it('should handle errors gracefully and log them', async () => {
      mockRedis.set.mockRejectedValue(new Error('Connection failed'));

      await expect(
        service.set('test-key', { foo: 'bar' }, 300),
      ).resolves.not.toThrow();
    });
  });

  describe('del', () => {
    it('should delete key', async () => {
      mockRedis.del.mockResolvedValue(1);

      await service.del('test-key');

      expect(mockRedis.del).toHaveBeenCalledWith('test-key');
    });

    it('should handle errors gracefully and log them', async () => {
      mockRedis.del.mockRejectedValue(new Error('Connection failed'));

      await expect(service.del('test-key')).resolves.not.toThrow();
    });
  });

  describe('getOrSet', () => {
    it('should return cached value if exists', async () => {
      const testData = { foo: 'bar' };
      mockRedis.get.mockResolvedValue(JSON.stringify(testData));
      const factory = jest.fn();

      const result = await service.getOrSet('test-key', factory, 300);

      expect(result).toEqual(testData);
      expect(factory).not.toHaveBeenCalled();
      expect(mockRedis.set).not.toHaveBeenCalled();
    });

    it('should call factory and cache result if key does not exist', async () => {
      const testData = { foo: 'bar' };
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue('OK');
      const factory = jest.fn().mockResolvedValue(testData);

      const result = await service.getOrSet('test-key', factory, 300);

      expect(result).toEqual(testData);
      expect(factory).toHaveBeenCalled();
      expect(mockRedis.set).toHaveBeenCalledWith(
        'test-key',
        JSON.stringify(testData),
        'EX',
        300,
      );
    });
  });
});
