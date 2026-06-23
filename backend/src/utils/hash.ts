import bcrypt from 'bcryptjs';

/**
 * Salt rounds for password hashing
 *
 * Security recommendations:
 * - 10 rounds: ~100ms (legacy/dev)
 * - 12 rounds: ~300–500ms — recommended for production
 *
 * Higher rounds = better security but slower hashing.
 */
const SALT_ROUNDS = 12;

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, SALT_ROUNDS);
};

export const comparePassword = async (
  password: string,
  hash: string
): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};
