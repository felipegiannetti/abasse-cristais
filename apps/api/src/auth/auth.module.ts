import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { config } from '../config';
import { AdminGuard } from './admin.guard';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Global()
@Module({
  imports: [JwtModule.register({ secret: config.jwtSecret, signOptions: { algorithm: 'HS256' } })],
  controllers: [AuthController],
  providers: [AuthService, AdminGuard],
  exports: [AdminGuard, JwtModule],
})
export class AuthModule {}
