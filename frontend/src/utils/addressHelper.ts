// Address & CEP Helper Utilities

export const formatCEP = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length > 5) {
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  }
  return digits;
};

export const cleanCEP = (value: string): string => {
  return value.replace(/\D/g, '').slice(0, 8);
};

export const isValidCEP = (value: string): boolean => {
  const clean = cleanCEP(value);
  return clean.length === 8 && !/^(\d)\1{7}$/.test(clean);
};

const BR_STATES = new Set([
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
]);

/**
 * Extracts clean "Cidade / UF" from cidade field or complete endereco text.
 */
export const extractCidadeUf = (cidade?: string | null, endereco?: string | null): string => {
  if (cidade && cidade.trim()) {
    const clean = cidade.trim();
    if (clean.includes('/')) {
      const parts = clean.split('/').map(p => p.trim()).filter(Boolean);
      if (parts.length >= 2) return `${parts[0]} / ${parts[1]}`;
    }
    if (clean.includes('-')) {
      const parts = clean.split('-').map(p => p.trim()).filter(Boolean);
      if (parts.length >= 2 && BR_STATES.has(parts[1].toUpperCase())) {
        return `${parts[0]} / ${parts[1].toUpperCase()}`;
      }
    }
    return clean;
  }

  if (!endereco || !endereco.trim()) return '---';

  const text = endereco.trim();

  // 1. Look for City/UF pattern with valid Brazilian 2-letter UF:
  // e.g. "São Paulo, SP" or "Guaporé/RS" or "Curitiba - PR" or "São Paulo/SP 01514-000"
  const brMatch = text.match(/(?:,\s*|\s*-\s*|\s+)([A-Za-zÀ-ÿ\s.'-]+?)\s*[,/-]\s*([A-Z]{2})\b/);
  if (brMatch) {
    const rawUf = brMatch[2].trim().toUpperCase();
    if (BR_STATES.has(rawUf)) {
      let rawCity = brMatch[1].trim();
      // Clean leading noise if street names were included in match
      rawCity = rawCity
        .replace(/^(?:rua|av|avenida|alameda|travessa|praça|estrada|rodovia|bairro|compl|complemento|cep|\d+)\b.*?[,-]\s*/i, '')
        .replace(/^[0-9\s-]+/, '')
        .replace(/^(?:bairro\s+[A-Za-zÀ-ÿ]+|liberdade|ipiranga|centro|vila\s+[A-Za-zÀ-ÿ]+)\s+/i, '')
        .trim();

      if (rawCity && rawCity.length >= 2) {
        return `${rawCity} / ${rawUf}`;
      }
    }
  }

  // 2. Check for international cities or trailing City after '-' or ','
  // e.g. "Avda Independencia, 20 C1099AAN - Buenos Aires" -> "Buenos Aires"
  // e.g. "... - Ciudad del Este/Alto Paraná" -> "Ciudad del Este / Alto Paraná"
  const dashParts = text.split('-').map(s => s.trim()).filter(Boolean);
  if (dashParts.length > 1) {
    const last = dashParts[dashParts.length - 1];
    // If last is not pure CEP/postal code
    if (!/^\d{5}-?\d{3}$/.test(last) && !/^\d+$/.test(last) && !/^CEP/i.test(last)) {
      const cleanLast = last.replace(/CEP\s*[\d-]+/i, '').trim();
      if (cleanLast.length > 2) {
        if (cleanLast.includes('/')) {
          const p = cleanLast.split('/').map(x => x.trim());
          return `${p[0]} / ${p[1]}`;
        }
        return cleanLast;
      }
    }
    const secondLast = dashParts[dashParts.length - 2];
    if (secondLast && !/^\d+$/.test(secondLast) && !/^CEP/i.test(secondLast)) {
      const cleanSecond = secondLast.replace(/CEP\s*[\d-]+/i, '').trim();
      if (cleanSecond.length > 2) {
        return cleanSecond;
      }
    }
  }

  // 3. Comma-separated parts fallback
  const commaParts = text.split(',').map(s => s.trim()).filter(Boolean);
  if (commaParts.length >= 2) {
    const nonPostal = commaParts.filter(p => !/^cep\b/i.test(p) && !/^\d{5}-?\d{3}$/.test(p) && !/^\d+$/.test(p));
    if (nonPostal.length > 0) {
      return nonPostal[nonPostal.length - 1];
    }
  }

  return text;
};
