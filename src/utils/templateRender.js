/**
 * Подстановка плейсхолдеров {{key}} в шаблоне.
 * @param {string} template
 * @param {Record<string, string>} vars
 */
export function renderTemplateString(template, vars) {
  if (!template) return ''
  return template.replace(/\{\{\s*([\w\.\u0400-\u04FF]+)\s*\}\}/gu, (_, key) => {
    const k = key.trim()
    if (Object.prototype.hasOwnProperty.call(vars, k)) {
      const v = vars[k]
      return v == null ? '' : String(v)
    }
    return ''
  })
}
