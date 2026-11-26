import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { AuditService } from '../audit/audit.service';
import { config } from '../config';
import { PrismaService } from '../prisma/prisma.service';
import { imageUrl } from '../products/products.service';
import type { TemplateLocale } from '../settings/settings.service';
import { TEMPLATE_LOCALES } from '../settings/settings.service';
import { renderCampaignEmail, type CampaignProduct } from './newsletter.templates';

const notConfigured = () =>
  new BadRequestException({
    code: 'EMAIL_NOT_CONFIGURED',
    message: 'Email sending is not configured (RESEND_API_KEY / RESEND_FROM_EMAIL).',
  });

const noSubscribers = () =>
  new BadRequestException({ code: 'NO_SUBSCRIBERS', message: 'There are no active subscribers to send to.' });

// Resend's batch API accepts up to 100 emails per call.
const BATCH_SIZE = 100;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

@Injectable()
export class NewsletterService {
  private readonly logger = new Logger(NewsletterService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async subscribe(email: string, locale?: string): Promise<{ subscribed: true }> {
    const safeLocale: TemplateLocale = (TEMPLATE_LOCALES as readonly string[]).includes(locale ?? '')
      ? (locale as TemplateLocale)
      : 'pt';
    const existing = await this.prisma.newsletterSubscriber.findUnique({ where: { email } });
    if (existing) {
      if (existing.unsubscribedAt) {
        await this.prisma.newsletterSubscriber.update({
          where: { id: existing.id },
          data: { unsubscribedAt: null, locale: safeLocale },
        });
      }
      // already subscribed and active: nothing to do, still a success from the visitor's point of view
      return { subscribed: true };
    }
    await this.prisma.newsletterSubscriber.create({ data: { email, locale: safeLocale } });
    return { subscribed: true };
  }

  /** Always succeeds from the caller's point of view — a bad/old token must not reveal whether it ever existed. */
  async unsubscribe(token: string): Promise<void> {
    await this.prisma.newsletterSubscriber
      .updateMany({ where: { unsubscribeToken: token, unsubscribedAt: null }, data: { unsubscribedAt: new Date() } })
      .catch(() => undefined);
  }

  async overview() {
    const [activeSubscribers, campaigns] = await this.prisma.$transaction([
      this.prisma.newsletterSubscriber.count({ where: { unsubscribedAt: null } }),
      this.prisma.newsletterCampaign.findMany({ orderBy: { sentAt: 'desc' }, take: 20 }),
    ]);
    return { activeSubscribers, campaigns };
  }

  async sendCampaign(
    input: { subject: string; body: string; productIds?: string[] },
    actorId: string,
  ): Promise<{ recipientCount: number; campaignId: string }> {
    if (!config.resendApiKey || !config.resendFromEmail) throw notConfigured();

    const subscribers = await this.prisma.newsletterSubscriber.findMany({
      where: { unsubscribedAt: null },
      select: { email: true, locale: true, unsubscribeToken: true },
    });
    if (subscribers.length === 0) throw noSubscribers();

    const productIds = input.productIds ?? [];
    const rows = productIds.length
      ? await this.prisma.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, slug: true, name: true, priceCents: true, images: { orderBy: { position: 'asc' }, take: 1, select: { id: true } } },
        })
      : [];
    const byId = new Map(rows.map((p) => [p.id, p]));
    const products: CampaignProduct[] = productIds
      .map((id) => byId.get(id))
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
      .map((p) => ({
        slug: p.slug,
        name: p.name,
        priceCents: p.priceCents,
        imageUrl: p.images[0] ? `${config.webOrigins[0]}${imageUrl(p.images[0].id)}` : null,
      }));

    const webOrigin = config.webOrigins[0] ?? '';
    const resend = new Resend(config.resendApiKey);

    const emails = subscribers.map((s) => {
      const locale = (TEMPLATE_LOCALES as readonly string[]).includes(s.locale) ? (s.locale as TemplateLocale) : 'pt';
      const html = renderCampaignEmail({
        subject: input.subject,
        bodyText: input.body,
        products,
        webOrigin,
        locale,
        subscriberEmail: s.email,
        unsubscribeUrl: `${webOrigin}/api/newsletter/unsubscribe/${s.unsubscribeToken}`,
      });
      return { from: config.resendFromEmail, to: [s.email], subject: input.subject, html };
    });

    let sent = 0;
    for (const batch of chunk(emails, BATCH_SIZE)) {
      const { error } = await resend.batch.send(batch);
      if (error) this.logger.warn(`Resend batch send failed for ${batch.length} emails: ${error.message}`);
      else sent += batch.length;
    }

    const campaign = await this.prisma.newsletterCampaign.create({
      data: {
        subject: input.subject,
        body: input.body,
        productIds,
        recipientCount: sent,
        sentById: actorId,
      },
    });

    await this.audit.record({
      actorId,
      action: 'newsletter.send',
      entityType: 'Newsletter',
      entityId: campaign.id,
      summary: `Enviou a notificação "${input.subject}" para ${sent} assinante(s).`,
    });

    return { recipientCount: sent, campaignId: campaign.id };
  }
}
