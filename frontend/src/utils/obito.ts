// Death certificate (certidão de óbito) attachments: PDF, PNG or JPG only
export const OBITO_ACCEPT = '.pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg';

export const OBITO_INVALID_MSG = 'Formato não permitido. Anexe a certidão de óbito em PDF, PNG ou JPG.';

export const isValidObitoFile = (file: File): boolean => {
  const ext = file.name.toLowerCase().split('.').pop() || '';
  return ['pdf', 'png', 'jpg', 'jpeg'].includes(ext);
};
