export const HIDDEN_TEST_USERS = [
  'felipisousa604@gmail.com',
  'missionario.egresso@teste.com',
  'felipe@teste.com',
  'economo.regional@teste.com'
];

export const isHiddenTestUser = (login?: string | null): boolean => {
  if (!login) return false;
  const normalized = login.trim().toLowerCase();
  return HIDDEN_TEST_USERS.includes(normalized);
};
