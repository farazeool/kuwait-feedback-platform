/**
 * Distribution token validator
 *
 * Tokens are generated as: encode(gen_random_bytes(18), 'hex') = 36 lowercase hex chars
 * Database constraint allows 24-128 chars to support future formats.
 *
 * This validator accepts:
 * - Lowercase hex: [a-f0-9]{24,128}
 * - Base62 (future): [a-zA-Z0-9-]{24,128}
 */

export const DISTRIBUTION_TOKEN_REGEX = /^(?:[a-f0-9]{24,128}|[a-zA-Z0-9-]{24,128})$/;

/**
 * Validates a distribution assignment public token.
 * Returns true if the token matches the expected format.
 */
export function isValidDistributionToken(token: string): boolean {
  return DISTRIBUTION_TOKEN_REGEX.test(token);
}
