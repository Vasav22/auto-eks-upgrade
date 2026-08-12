import { NestFactory, NestApplication } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { CorrelationIdInterceptor } from './common/interceptors/correlation-id.interceptor';

async function bootstrap(): Promise<void> {
  try {
    const app = await NestFactory.create(AppModule);

    app.setGlobalPrefix('api', { exclude: ['health', 'health/ready'] });
    app.enableCors({ origin: true, credentials: true });

    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalInterceptors(new CorrelationIdInterceptor());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );

    const port = process.env['PORT'] || 3000;
    const host = process.env['HOST'] || '0.0.0.0';

    await app.listen(port, host);

    Logger.log(`Application started on ${host}:${port}`, 'Bootstrap');
  } catch (error) {
    console.error('Failed to start application:', error);
    process.exit(1);
  }
}

bootstrap();
