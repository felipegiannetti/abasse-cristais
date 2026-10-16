import { describe, expect, it } from 'vitest';
import { scrubAuditSummary } from './customers.service';

describe('scrubAuditSummary', () => {
  it('keeps the sale number but drops the customer name', () => {
    expect(scrubAuditSummary('sale.create', 'Registrou a venda #62 para Lucía Fernández')).toBe('Registrou a venda #62 (cliente apagado)');
  });

  it('drops a name that itself contains " para "', () => {
    expect(scrubAuditSummary('sale.create', 'Registrou a venda #7 para Maria para Todos')).toBe('Registrou a venda #7 (cliente apagado)');
  });

  it('rewrites customer create and update sentences', () => {
    expect(scrubAuditSummary('customer.create', 'Cadastrou o cliente "Emily Carter"')).toBe('Cadastrou um cliente (dados pessoais apagados)');
    expect(scrubAuditSummary('customer.update', 'Atualizou o cliente "Emily "Em" Carter"')).toBe('Atualizou um cliente (dados pessoais apagados)');
  });

  it('replaces anything it does not recognise instead of leaving it behind', () => {
    expect(scrubAuditSummary('sale.create', 'Texto inesperado com Fulano')).not.toContain('Fulano');
    expect(scrubAuditSummary('something.else', 'qualquer coisa com Fulano')).not.toContain('Fulano');
  });
});
