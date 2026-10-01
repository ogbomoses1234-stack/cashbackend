export function getPagination(
  query: Record<string, unknown>,
  defaults = { page: 1, perPage: 20 }
) {
  const rawPage = Number(query.page) || defaults.page;
  const rawPer = Number(query.perPage) || defaults.perPage;
  const page = Math.max(1, Math.floor(rawPage));
  const perPage = Math.min(100, Math.max(1, Math.floor(rawPer)));
  return { page, perPage, skip: (page - 1) * perPage, take: perPage };
}
