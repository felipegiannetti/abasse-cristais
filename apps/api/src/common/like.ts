/**
 * Prisma escapes `%` and `_` for `contains`/`equals` with `mode: 'insensitive'` but not the backslash,
 * so a search ending in a backslash makes Postgres fail ("LIKE pattern must not end with escape character").
 */
export const likeSafe = (value: string) => value.replace(/\\/g, '\\\\');
