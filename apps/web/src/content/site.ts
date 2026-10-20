// Brand data. All visitor-facing text lives in src/i18n/messages (en.ts / pt.ts).

export const site = {
  name: 'Abasse Crystal',
  url: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
  whatsapp: (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '').replace(/\D/g, ''),
  // Leave empty to hide the footer link.
  instagram: '',
  // Company identification shown in the footer and in the privacy policy. Set the NEXT_PUBLIC_LEGAL_* variables
  // (see .env.example); whatever is empty is simply left out.
  legal: {
    name: (process.env.NEXT_PUBLIC_LEGAL_NAME || '').trim(),
    cnpj: (process.env.NEXT_PUBLIC_LEGAL_CNPJ || '').trim(),
    address: (process.env.NEXT_PUBLIC_LEGAL_ADDRESS || '').trim(),
    // "Encarregado" (LGPD art. 41): the person who answers data subjects. Empty = the contact channel is shown instead.
    dpoName: (process.env.NEXT_PUBLIC_LEGAL_DPO_NAME || '').trim(),
    dpoEmail: (process.env.NEXT_PUBLIC_LEGAL_DPO_EMAIL || '').trim(),
  },
};
