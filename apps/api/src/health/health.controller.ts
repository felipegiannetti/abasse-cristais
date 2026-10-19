import { Controller, Get } from '@nestjs/common';

/** Liveness probe for the platform / uptime monitors: answers without touching the database. */
@Controller('health')
export class HealthController {
  @Get()
  ok() {
    return { status: 'ok' };
  }
}
