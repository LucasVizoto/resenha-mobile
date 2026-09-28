export type PasswordStrength = {
  minLength: boolean;
  upper: boolean;
  lower: boolean;
  number: boolean;
  special: boolean;
};

const SPECIAL_RE = /[^A-Za-z0-9]/;

export function inspectPassword(password: string): PasswordStrength {
  return {
    minLength: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /\d/.test(password),
    special: SPECIAL_RE.test(password),
  };
}

export function isStrongPassword(password: string): boolean {
  const rules = inspectPassword(password);
  return rules.minLength && rules.upper && rules.lower && rules.number && rules.special;
}

export function validateStrongPassword(password: string): string | null {
  const rules = inspectPassword(password);
  if (!rules.minLength) return 'A senha precisa ter pelo menos 8 caracteres.';
  if (!rules.upper) return 'Inclua pelo menos uma letra maiúscula.';
  if (!rules.lower) return 'Inclua pelo menos uma letra minúscula.';
  if (!rules.number) return 'Inclua pelo menos um número.';
  if (!rules.special) return 'Inclua pelo menos um caractere especial.';
  return null;
}

export function validatePasswordConfirmation(password: string, confirm: string): string | null {
  if (!confirm) return 'Confirme a senha.';
  if (password !== confirm) return 'As senhas não coincidem.';
  return null;
}

export const PASSWORD_RULES: { key: keyof PasswordStrength; label: string }[] = [
  { key: 'minLength', label: 'Mínimo de 8 caracteres' },
  { key: 'upper', label: 'Uma letra maiúscula' },
  { key: 'lower', label: 'Uma letra minúscula' },
  { key: 'number', label: 'Um número' },
  { key: 'special', label: 'Um caractere especial' },
];
