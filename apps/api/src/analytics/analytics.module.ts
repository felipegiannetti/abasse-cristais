import { Module } from '@nestjs/common';
import { AnalyticsController, TrackController } from './analytics.controller';

@Module({ controllers: [TrackController, AnalyticsController] })
export class AnalyticsModule {}
