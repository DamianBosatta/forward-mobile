/** "aaaa-mm-dd" (or an ISO datetime, time part ignored) → "dd/mm/aaaa". Calendar date, no timezone conversion. */
export const ddmmaaaa = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')
