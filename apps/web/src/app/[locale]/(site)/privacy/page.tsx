import type { Metadata } from 'next';
import { site } from '@/content/site';
import { isLocale, type Locale } from '@/i18n';
import { LGPD_URL, PRIVACY_UPDATED, privacy } from '@/i18n/privacy';
import { alternates } from '@/i18n/seo';
import { fetchContact } from '@/lib/api';
import { Reveal } from '@/components/Reveal';

export const revalidate = 3600;

type Props = { params: Promise<{ locale: string }> };

const intl: Record<Locale, string> = { en: 'en-US', pt: 'pt-BR', es: 'es-ES' };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : 'en';
  return { title: privacy[locale].title, alternates: alternates(locale, '/privacy') };
}

export default async function PrivacyPage({ params }: Props) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : 'en';
  const doc = privacy[locale];
  const contact = await fetchContact();

  // who is responsible: the company if its data is configured, else the brand
  const controller = [site.legal.name || site.name, site.legal.cnpj && `CNPJ ${site.legal.cnpj}`, site.legal.address].filter(Boolean).join(', ');
  // how to reach them: the email set in the admin settings, else the WhatsApp number, else the site's contact buttons
  const channel = contact.email || (contact.whatsapp ? `WhatsApp +${contact.whatsapp}` : { en: 'the contact buttons on this site', pt: 'os botões de contato deste site', es: 'los botones de contacto de este sitio' }[locale]);
  // the "encarregado" (LGPD art. 41): the named person if configured, else the contact channel
  const dpo = site.legal.dpoName
    ? doc.dpoNamed.replaceAll('{name}', site.legal.dpoName).replaceAll('{email}', site.legal.dpoEmail ? ` (${site.legal.dpoEmail})` : '')
    : doc.dpoChannel;
  const fill = (t: string) => t.replaceAll('{dpo}', dpo).replaceAll('{controller}', controller).replaceAll('{contact}', channel);
  const updated = new Intl.DateTimeFormat(intl[locale], { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(PRIVACY_UPDATED));

  return (
    <div className="mx-auto max-w-3xl px-5 pb-10 pt-32 sm:px-8">
      <Reveal>
        <p className="eyebrow">{doc.updatedLabel}: {updated}</p>
        <h1 className="mt-4 font-display text-4xl font-medium leading-tight text-pearl sm:text-5xl">{doc.title}</h1>
        <p className="mt-6 text-lg leading-relaxed text-pearl/70">{fill(doc.intro)}</p>
      </Reveal>

      <div className="mt-12 space-y-10">
        {doc.sections.map((s, i) => (
          <section key={s.h} aria-labelledby={`sec-${i}`}>
            <h2 id={`sec-${i}`} className="font-display text-2xl font-semibold text-pearl">{i + 1}. {s.h}</h2>
            {s.p?.map((t) => (
              <p key={t} className="mt-3 leading-relaxed text-pearl/70">{fill(t)}</p>
            ))}
            {s.ul && (
              <ul className="mt-3 list-disc space-y-2 pl-5 leading-relaxed text-pearl/70 marker:text-gold-400">
                {s.ul.map((t) => (
                  <li key={t}>{fill(t)}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      <p className="mt-12 text-sm text-pearl/60">
        <a href={LGPD_URL} target="_blank" rel="noopener noreferrer" className="underline decoration-gold-400/50 underline-offset-4 hover:text-pearl">
          {doc.lawLabel}
        </a>
      </p>
    </div>
  );
}
