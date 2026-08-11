import { Controller, Get, Header } from '@nestjs/common';
import { Public } from '../../auth/decorators/public.decorator';
import { PrometheusService } from './prometheus.service';

@Controller()
export class MetricsController {
  constructor(private readonly prometheusService: PrometheusService) {}

  @Get('metrics')
  @Public()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async getMetrics(): Promise<string> {
    return this.prometheusService.scrapeMetrics();
  }
}
