import type { TemplateLocale } from '../settings/settings.service';

export interface CampaignProduct {
  slug: string;
  name: string;
  priceCents: number | null;
  imageUrl: string | null;
}

const FOOTER: Record<TemplateLocale, { onRequest: string; viewOnSite: string; unsubscribe: string; sentTo: string }> = {
  en: { onRequest: 'On request', viewOnSite: 'View on the site', unsubscribe: 'Unsubscribe', sentTo: 'You are receiving this because you signed up on our website with {email}.' },
  pt: { onRequest: 'Sob consulta', viewOnSite: 'Ver no site', unsubscribe: 'Cancelar inscrição', sentTo: 'Você está recebendo este e-mail porque se cadastrou no nosso site com {email}.' },
  es: { onRequest: 'Consultar', viewOnSite: 'Ver en el sitio', unsubscribe: 'Cancelar suscripción', sentTo: 'Recibes este correo porque te registraste en nuestro sitio con {email}.' },
};

/** English site has no URL prefix; pt/es do (mirrors apps/web/src/i18n/config.ts localePath). */
function productUrl(webOrigin: string, locale: TemplateLocale, slug: string): string {
  const prefix = locale === 'en' ? '' : `/${locale}`;
  return `${webOrigin}${prefix}/products/${encodeURIComponent(slug)}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Admin-authored free text: escaped, blank lines become paragraph breaks. */
function renderBody(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((para) => `<p style="margin:0 0 16px;color:#1f2430;line-height:1.6;font-size:15px;">${escapeHtml(para).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

function renderProducts(products: CampaignProduct[], webOrigin: string, locale: TemplateLocale): string {
  if (products.length === 0) return '';
  const t = FOOTER[locale];
  const cards = products.map((p) => {
    const price = p.priceCents == null ? t.onRequest : `US$ ${(p.priceCents / 100).toFixed(2)}`;
    const url = productUrl(webOrigin, locale, p.slug);
    const img = p.imageUrl
      ? `<img src="${escapeHtml(p.imageUrl)}" alt="${escapeHtml(p.name)}" width="160" height="160" style="width:160px;height:160px;object-fit:cover;border-radius:12px;display:block;">`
      : '';
    return `<td style="padding:8px;vertical-align:top;width:180px;">
          <a href="${escapeHtml(url)}" style="text-decoration:none;color:inherit;">
            ${img}
            <p style="margin:10px 0 2px;font-size:14px;font-weight:600;color:#1f2430;">${escapeHtml(p.name)}</p>
            <p style="margin:0 0 6px;font-size:13px;color:#8a6d2f;">${escapeHtml(price)}</p>
            <span style="font-size:12px;color:#8a6d2f;text-decoration:underline;">${escapeHtml(t.viewOnSite)} →</span>
          </a>
        </td>`;
  });
  // 2 columns per row, wrapped in a table for email-client compatibility
  const rows: string[] = [];
  for (let i = 0; i < cards.length; i += 2) rows.push(`<tr>${cards[i]}${cards[i + 1] ?? ''}</tr>`);
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;"><tbody>${rows.join('')}</tbody></table>`;
}

export function renderCampaignEmail(opts: {
  subject: string;
  bodyText: string;
  products: CampaignProduct[];
  webOrigin: string;
  locale: TemplateLocale;
  subscriberEmail: string;
  unsubscribeUrl: string;
}): string {
  const t = FOOTER[opts.locale];
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f1ea;font-family:Georgia,'Times New Roman',serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tbody>
        <tr>
          <td align="center" style="padding:32px 16px;">
            <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;">
              <tbody>
                <tr>
                  <td style="background:#0f1420;padding:24px 28px;">
                    <p style="margin:0;color:#e8c766;font-size:13px;letter-spacing:0.12em;text-transform:uppercase;">Abasse Crystal</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:28px;">
                    <h1 style="margin:0 0 16px;font-size:22px;color:#0f1420;">${escapeHtml(opts.subject)}</h1>
                    ${renderBody(opts.bodyText)}
                    ${renderProducts(opts.products, opts.webOrigin, opts.locale)}
                  </td>
                </tr>
                <tr>
                  <td style="padding:20px 28px;border-top:1px solid #ececec;">
                    <p style="margin:0 0 8px;font-size:12px;color:#8a8a8a;">${escapeHtml(t.sentTo.replace('{email}', opts.subscriberEmail))}</p>
                    <a href="${escapeHtml(opts.unsubscribeUrl)}" style="font-size:12px;color:#8a8a8a;text-decoration:underline;">${escapeHtml(t.unsubscribe)}</a>
                  </td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table>
  </body>
</html>`;
}
