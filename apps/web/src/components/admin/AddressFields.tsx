'use client';

import { countryOptions, flag } from '@/lib/countries';

export interface AddressForm {
  recipient: string;
  line1: string;
  line2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
}

export const emptyAddress = (): AddressForm => ({ recipient: '', line1: '', line2: '', city: '', region: '', postalCode: '', country: 'BR' });

export const addressFilled = (a: AddressForm) => Boolean(a.line1.trim() || a.city.trim() || a.postalCode.trim() || a.line2.trim());
export const addressComplete = (a: AddressForm) => Boolean(a.line1.trim() && a.city.trim() && a.country);

export function CountrySelect({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return (
    <select id={id} className="field" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Selecione o país…</option>
      {countryOptions().map((c) => (
        <option key={c.code} value={c.code}>
          {flag(c.code)} {c.name}
        </option>
      ))}
    </select>
  );
}

/** Postal address fields. The shop ships worldwide, so the country is always chosen from the full ISO list. */
export function AddressFields({
  value,
  onChange,
  idPrefix,
  showRecipient = true,
}: {
  value: AddressForm;
  onChange: (v: AddressForm) => void;
  idPrefix: string;
  showRecipient?: boolean;
}) {
  const set = (k: keyof AddressForm) => (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...value, [k]: e.target.value });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {showRecipient && (
        <div className="sm:col-span-2">
          <label htmlFor={`${idPrefix}-recipient`} className="label">Destinatário <span className="normal-case tracking-normal text-pearl/30">(se for diferente do cliente)</span></label>
          <input id={`${idPrefix}-recipient`} className="field" maxLength={120} value={value.recipient} onChange={set('recipient')} />
        </div>
      )}
      <div className="sm:col-span-2">
        <label htmlFor={`${idPrefix}-line1`} className="label">Endereço</label>
        <input id={`${idPrefix}-line1`} className="field" maxLength={160} value={value.line1} onChange={set('line1')} placeholder="Rua, número" />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor={`${idPrefix}-line2`} className="label">Complemento</label>
        <input id={`${idPrefix}-line2`} className="field" maxLength={160} value={value.line2} onChange={set('line2')} placeholder="Apto, bloco, referência…" />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-city`} className="label">Cidade</label>
        <input id={`${idPrefix}-city`} className="field" maxLength={100} value={value.city} onChange={set('city')} />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-region`} className="label">Estado / província</label>
        <input id={`${idPrefix}-region`} className="field" maxLength={100} value={value.region} onChange={set('region')} />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-postal`} className="label">CEP / código postal</label>
        <input id={`${idPrefix}-postal`} className="field" maxLength={20} value={value.postalCode} onChange={set('postalCode')} />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-country`} className="label">País</label>
        <CountrySelect id={`${idPrefix}-country`} value={value.country} onChange={(country) => onChange({ ...value, country })} />
      </div>
    </div>
  );
}
