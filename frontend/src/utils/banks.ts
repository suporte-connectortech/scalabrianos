// Bank list and API helper for Brazilian and International financial institutions

export interface BankItem {
  code: string | number | null;
  name: string;
  fullName: string;
  ispb?: string;
}

export const POPULAR_BANKS: BankItem[] = [
  { code: '260', name: 'Nubank', fullName: 'Nu Pagamentos S.A. (Nubank)' },
  { code: '077', name: 'Banco Inter', fullName: 'Banco Inter S.A.' },
  { code: '336', name: 'C6 Bank', fullName: 'Banco C6 S.A.' },
  { code: '323', name: 'Mercado Pago', fullName: 'Mercado Pago Instituição de Pagamento Ltda.' },
  { code: '001', name: 'Banco do Brasil', fullName: 'Banco do Brasil S.A.' },
  { code: '104', name: 'Caixa Econômica', fullName: 'Caixa Econômica Federal' },
  { code: '237', name: 'Bradesco', fullName: 'Banco Bradesco S.A.' },
  { code: '341', name: 'Itaú Unibanco', fullName: 'Itaú Unibanco S.A.' },
  { code: '033', name: 'Santander', fullName: 'Banco Santander (Brasil) S.A.' },
  { code: '290', name: 'PagBank', fullName: 'PagBank / PagSeguro Internet S.A.' },
  { code: '380', name: 'PicPay', fullName: 'PicPay Serviços S.A.' },
  { code: '748', name: 'Sicredi', fullName: 'Banco Cooperativo Sicredi S.A.' },
  { code: '756', name: 'Sicoob', fullName: 'Banco Cooperativo Sicoob S.A.' },
  { code: '422', name: 'Banco Safra', fullName: 'Banco Safra S.A.' },
  { code: '208', name: 'BTG Pactual', fullName: 'Banco BTG Pactual S.A.' },
  { code: '655', name: 'Neon', fullName: 'Neon Pagamentos / Banco Votorantim' },
  { code: '212', name: 'Banco Original', fullName: 'Banco Original S.A.' },
  { code: '623', name: 'Banco PAN', fullName: 'Banco PAN S.A.' },
  { code: '102', name: 'XP Investimentos', fullName: 'XP Investimentos CCTVM S.A.' },
  { code: '041', name: 'Banrisul', fullName: 'Banco do Estado do Rio Grande do Sul S.A.' },
  { code: '070', name: 'BRB', fullName: 'BRB - Banco de Brasília S.A.' },
  { code: '004', name: 'Banco do Nordeste', fullName: 'Banco do Nordeste do Brasil S.A.' },
  { code: '003', name: 'Banco da Amazônia', fullName: 'Banco da Amazônia S.A.' },
  { code: '218', name: 'Banco BS2', fullName: 'Banco BS2 S.A.' },
  { code: '335', name: 'Banco Digio', fullName: 'Banco Digio S.A.' },
  { code: '637', name: 'Banco Sofisa', fullName: 'Banco Sofisa S.A.' },
  { code: '746', name: 'Banco Modal', fullName: 'Banco Modal S.A.' },
  { code: '085', name: 'Aillia (Viacredi)', fullName: 'Cooperativa Central Ailos' }
];

let cachedBanks: BankItem[] = [...POPULAR_BANKS];
let isFetching = false;

export const loadAllBanks = async (): Promise<BankItem[]> => {
  if (cachedBanks.length > POPULAR_BANKS.length) {
    return cachedBanks;
  }
  if (isFetching) return cachedBanks;

  isFetching = true;
  try {
    const res = await fetch('https://brasilapi.com.br/api/banks/v1');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        const apiBanks: BankItem[] = data.map((b: any) => ({
          code: b.code ? String(b.code).padStart(3, '0') : null,
          name: b.name || b.fullName || '',
          fullName: b.fullName || b.name || '',
          ispb: b.ispb
        }));

        // Merge popular on top, then the rest
        const map = new Map<string, BankItem>();
        POPULAR_BANKS.forEach(b => map.set(String(b.name).toLowerCase(), b));
        apiBanks.forEach(b => {
          const key = (b.name || b.fullName).toLowerCase();
          if (!map.has(key)) {
            map.set(key, b);
          }
        });
        cachedBanks = Array.from(map.values());
      }
    }
  } catch (err) {
    console.warn('Could not load BrasilAPI banks, using default list:', err);
  } finally {
    isFetching = false;
  }
  return cachedBanks;
};

// Initial background load
loadAllBanks();

export const searchBanks = (query: string, allBanks: BankItem[] = cachedBanks): BankItem[] => {
  if (!query || !query.trim()) return allBanks.slice(0, 15);
  const q = query.toLowerCase().trim();
  return allBanks
    .filter(b => {
      const codeStr = b.code ? String(b.code) : '';
      const nameStr = (b.name || '').toLowerCase();
      const fullNameStr = (b.fullName || '').toLowerCase();
      return codeStr.includes(q) || nameStr.includes(q) || fullNameStr.includes(q);
    })
    .slice(0, 20);
};

export const formatBankLabel = (b: BankItem): string => {
  if (b.code) {
    return `${b.code} - ${b.name || b.fullName}`;
  }
  return b.name || b.fullName;
};
