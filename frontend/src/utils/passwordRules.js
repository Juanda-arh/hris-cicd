export const PASSWORD_RULES = [
  { id: 'length', label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { id: 'upper', label: 'One uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { id: 'number', label: 'One number', test: (p) => /\d/.test(p) },
  { id: 'symbol', label: 'One symbol (!@#$…)', test: (p) => /[^A-Za-z0-9]/.test(p) },
];

export function meetsAllRules(password) {
  return PASSWORD_RULES.every((rule) => rule.test(password));
}
