import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { isDbConfigured, isRedisConfigured } from '../config/env';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  health() {
    return {
      status: 'ok',
      service: 'hill-express-api',
      version: '0.1.0',
      db: isDbConfigured ? 'configured' : 'not configured',
      redis: isRedisConfigured ? 'configured' : 'not configured',
      time: new Date().toISOString(),
    };
  }
}
