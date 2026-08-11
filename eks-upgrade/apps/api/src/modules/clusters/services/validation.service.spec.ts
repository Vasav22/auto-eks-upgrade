import { ValidationService } from './validation.service';

describe('ValidationService', () => {
  let service: ValidationService;

  beforeEach(() => {
    service = new ValidationService();
  });

  describe('validateVersionSkew (BR-01)', () => {
    it('should pass when node groups are within 2 versions', () => {
      const result = service.validateVersionSkew('1.28', ['1.28', '1.27', '1.26']);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when node group exceeds max skew', () => {
      const result = service.validateVersionSkew('1.28', ['1.25']);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('3 versions behind');
    });

    it('should fail when node group is ahead of control plane', () => {
      const result = service.validateVersionSkew('1.28', ['1.29']);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('ahead of control plane');
    });

    it('should warn when node group is at max skew', () => {
      const result = service.validateVersionSkew('1.28', ['1.26']);
      expect(result.isValid).toBe(true);
      expect(result.warnings[0]).toContain('at maximum skew');
    });
  });

  describe('validateNodeGroupAlignment (BR-02)', () => {
    it('should pass when all node groups have same version', () => {
      const result = service.validateNodeGroupAlignment(['1.27', '1.27', '1.27']);
      expect(result.isValid).toBe(true);
    });

    it('should fail when node groups have different versions', () => {
      const result = service.validateNodeGroupAlignment(['1.27', '1.26']);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('must be on the same version');
    });

    it('should pass when there are no node groups', () => {
      const result = service.validateNodeGroupAlignment([]);
      expect(result.isValid).toBe(true);
    });
  });

  describe('validateNodeGroupUpgrade (BR-03/BR-04)', () => {
    it('should pass valid node group upgrade', () => {
      const result = service.validateNodeGroupUpgrade('1.26', '1.27', '1.28');
      expect(result.isValid).toBe(true);
    });

    it('should fail when upgrading past control plane', () => {
      const result = service.validateNodeGroupUpgrade('1.26', '1.28', '1.27');
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('exceeds control plane version');
    });

    it('should fail when skipping more than 2 versions', () => {
      const result = service.validateNodeGroupUpgrade('1.24', '1.27', '1.28');
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Cannot skip 3 versions');
    });

    it('should fail on downgrade', () => {
      const result = service.validateNodeGroupUpgrade('1.27', '1.26', '1.28');
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Cannot downgrade');
    });
  });

  describe('validateControlPlaneUpgrade', () => {
    it('should pass valid control plane upgrade', () => {
      const result = service.validateControlPlaneUpgrade(
        '1.27',
        '1.28',
        ['1.27', '1.27'],
      );
      expect(result.isValid).toBe(true);
    });

    it('should fail when skipping too many versions', () => {
      const result = service.validateControlPlaneUpgrade(
        '1.25',
        '1.28',
        ['1.25'],
      );
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('Cannot skip 3 versions'));
    });

    it('should fail when node groups are not aligned', () => {
      const result = service.validateControlPlaneUpgrade(
        '1.27',
        '1.28',
        ['1.27', '1.26'],
      );
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        expect.stringContaining('must be on the same version'),
      );
    });

    it('should fail when post-upgrade skew would exceed limit', () => {
      const result = service.validateControlPlaneUpgrade(
        '1.27',
        '1.29',
        ['1.26'],
      );
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        expect.stringContaining('would create skew of 3'),
      );
    });
  });
});
