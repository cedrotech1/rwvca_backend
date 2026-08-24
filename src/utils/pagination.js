export function getPagination(req, defaults = {}) {
  const defPage = defaults.page ?? 1;
  const defLimit = defaults.limit ?? 20;
  const defMax = defaults.max ?? 100;
  const page = Math.max(parseInt(req.query.page, 10) || defPage, 1);
  const limit = Math.min(
    Math.max(parseInt(req.query.limit, 10) || defLimit, 1),
    defMax
  );
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

export function paginationMeta(count, page, limit) {
  return {
    total: count,
    page,
    limit,
    pages: Math.ceil(count / limit) || 1,
  };
}
