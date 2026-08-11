import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from './app.module';

describe('AppModule', () => {
  it('should compile the module', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    expect(module).toBeDefined();
  });

  it('should have all 11 domain modules registered', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const moduleMetadata = Reflect.getMetadata('imports', AppModule);
    
    expect(moduleMetadata).toBeDefined();
    expect(moduleMetadata.length).toBeGreaterThanOrEqual(11);
  });
});
