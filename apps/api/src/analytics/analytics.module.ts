import { Module } from '@nestjs/common';
import { AnalyticsController, TrackController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

@Module({ controllers: [TrackController, AnalyticsController], providers: [AnalyticsService] })
export class AnalyticsModule {}
