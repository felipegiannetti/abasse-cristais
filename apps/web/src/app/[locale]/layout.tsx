import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond, Manrope } from 'next/font/google';
import { notFound } from 'next/navigation';
import { site } from '@/content/site';
import { getMessages, getPublicMessages, htmlLang, isLocale, locales, ogLocale } from '@/i18n';
import { I18nProvider } from '@/i18n/provider';
import { fetchContact } from '@/lib/api';
import '../globals.css';

const display = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
  display: 'swap',
});

const sans = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
  display: 'swap',
});

// Only /en (served at "/"), /pt and /es exist.
export const dynamicParams = false;
export const generateStaticParams = () => locales.map((locale) => ({ locale }));

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const m = getMessages(locale);
  return {
    metadataBase: new URL(site.url),
    title: { default: m.meta.title, template: `%s · ${site.name}` },
    description: m.meta.description,
    openGraph: {
      type: 'website',
      locale: ogLocale[locale],
      siteName: site.name,
      title: m.meta.title,
      description: m.meta.description,
    },
  };
}

export const viewport: Viewport = { themeColor: '#061229' };

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const contact = await fetchContact();

  return (
    <html lang={htmlLang[locale]} className={`${display.variable} ${sans.variable}`}>
      <body className="min-h-dvh antialiased">
        <I18nProvider locale={locale} messages={getPublicMessages(locale)} {...contact}>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
