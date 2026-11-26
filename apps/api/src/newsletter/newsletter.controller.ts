import { Body, Controller, Get, HttpCode, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AdminGuard } from '../auth/admin.guard';
import type { AdminRequestUser } from '../auth/auth.decorators';
import { config } from '../config';
import { SendCampaignDto, SubscribeDto } from './newsletter.dto';
import { NewsletterService } from './newsletter.service';

type AdminRequest = Request & { admin: AdminRequestUser };

const unsubscribePage = (webOrigin: string) => `<!doctype html>
<html>
  <head><meta charset="utf-8"><title>Unsubscribed</title></head>
  <body style="font-family:Georgia,'Times New Roman',serif;background:#0f1420;color:#f4f1ea;min-height:100vh;display:flex;align-items:center;justify-content:center;margin:0;padding:24px;">
    <div style="max-width:420px;text-align:center;">
      <h1 style="font-size:22px;margin-bottom:12px;">You're unsubscribed / Você foi descadastrado</h1>
      <p style="opacity:0.7;line-height:1.6;">You won't receive any more newsletter emails from us.<br>Você não receberá mais e-mails de novidades.</p>
      <a href="${webOrigin}" style="display:inline-block;margin-top:20px;color:#e8c766;text-decoration:underline;">Abasse Crystal</a>
    </div>
  </body>
</html>`;

/** Public: a visitor subscribes from the site, or unsubscribes from a link in an email. */
@Controller('newsletter')
export class PublicNewsletterController {
  constructor(private readonly newsletter: NewsletterService) {}

  @Post('subscribe')
  @HttpCode(200)
  // Generous on purpose: the web app's domain rewrites to this api on a separate Vercel project, an extra proxy
  // hop the IP-based bucketing isn't tuned for — several real visitors can land in the same bucket. Subscribing
  // is low-risk (worst case: a stray fake email, trivial to remove later), so a tight limit isn't worth the
  // false positives it was causing real visitors.
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  subscribe(@Body() dto: SubscribeDto) {
    return this.newsletter.subscribe(dto.email, dto.locale);
  }

  @Get('unsubscribe/:token')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async unsubscribe(@Param('token') token: string, @Res() res: Response) {
    await this.newsletter.unsubscribe(token);
    res.setHeader('Content-Type', 'text/html; charset=utf-8').setHeader('Cache-Control', 'no-store');
    res.send(unsubscribePage(config.webOrigins[0] ?? ''));
  }
}

/** Composing and sending a campaign, and seeing how many subscribers there are — admin only. */
@Controller('admin/newsletter')
@UseGuards(AdminGuard)
@SkipThrottle()
export class AdminNewsletterController {
  constructor(private readonly newsletter: NewsletterService) {}

  @Get()
  overview() {
    return this.newsletter.overview();
  }

  @Post('send')
  send(@Req() req: AdminRequest, @Body() dto: SendCampaignDto) {
    return this.newsletter.sendCampaign(dto, req.admin.id);
  }
}
