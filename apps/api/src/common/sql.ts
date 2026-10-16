import { Prisma } from '@prisma/client';

/**
 * A JS Date as a Postgres `timestamp` literal, for use inside `$queryRaw`.
 *
 * Columns such as Sale.soldAt and WhatsAppClick.createdAt are `timestamp without time zone`, and the Postgres
 * session's timezone is America/Sao_Paulo (not UTC). Interpolating a Date directly into $queryRaw sends it as a
 * timestamptz parameter, which Postgres then converts to the SESSION timezone before comparing against the
 * tz-naive column — silently shifting every raw-SQL date comparison by 3 hours (verified: a sale from a few
 * minutes ago compared as "not yet happened" against `now`). Formatting to an explicit UTC ISO string and casting
 * to `::timestamp` takes the wall-clock digits literally, with no timezone conversion, matching how Prisma's own
 * query builder (`aggregate`/`groupBy`, unaffected by this) already writes and reads those columns.
 *
 * Use this for EVERY Date that goes into a raw query against those columns.
 */
export const ts = (d: Date) => Prisma.sql`${d.toISOString()}::timestamp`;
