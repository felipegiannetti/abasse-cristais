// Brand data. All visitor-facing text lives in src/i18n/messages (en.ts / pt.ts).

export const site = {
  name: 'Abasse Crystal',
  url: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
  whatsapp: (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '').replace(/\D/g, ''),
  // Leave empty to hide the footer link.
  instagram: '',
};
