/** Tìm kiếm không phân biệt dấu tiếng Việt, chữ hoa/thường, khoảng trắng. */
export function normalizeVietnameseSearch(value: string): string {
  return value.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function matchesVietnameseSearch(value: string, query: string): boolean {
  return normalizeVietnameseSearch(value).includes(normalizeVietnameseSearch(query))
}
