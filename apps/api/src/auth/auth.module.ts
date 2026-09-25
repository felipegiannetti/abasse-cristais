import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { config } from '../config';
import { AdminGuard } from './admin.guard';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';

@Global()
@Module({
  imports: [JwtModule.register({
      secret: config.jwtSecret,
      signOptions: { algorithm: 'HS256', issuer: config.jwtIssuer, audience: config.jwtAudience },
    })],
  controllers: [AuthController],
  providers: [AuthService, AdminGuard, SessionService],
  exports: [AdminGuard, JwtModule, SessionService],
})
export class AuthModule {}
