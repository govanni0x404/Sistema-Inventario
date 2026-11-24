export function normalizeSearch(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLocaleLowerCase("es");
}

export function matchesSearch(query: string, fields: (string | null | undefined)[]) {
  const target = normalizeSearch(fields.join(" "));
  return query.split(/\s+/).every((term) => target.includes(term));
}
