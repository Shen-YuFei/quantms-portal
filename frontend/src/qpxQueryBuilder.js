// Filter builder for the qpx explorer: turns a structured query spec into one
// DuckDB SELECT over a dataset view. The backend still validates and sandboxes
// the SQL; this module only has to produce a correct, safely quoted statement.

export const MAX_LIMIT = 2000

export const AGGREGATES = ['count', 'sum', 'avg', 'min', 'max']

const NUMERIC = /^(TINYINT|SMALLINT|INTEGER|BIGINT|HUGEINT|UTINYINT|USMALLINT|UINTEGER|UBIGINT|UHUGEINT|FLOAT|DOUBLE|REAL|DECIMAL)/

// 'number' | 'text' | 'bool' | 'other' (lists, structs, maps: only null checks)
export function typeClass(duckType) {
  const t = String(duckType || '').toUpperCase()
  if (t.endsWith('[]') || t.startsWith('STRUCT') || t.startsWith('MAP') || t.startsWith('UNION')) return 'other'
  if (NUMERIC.test(t)) return 'number'
  if (t === 'BOOLEAN') return 'bool'
  if (t.startsWith('VARCHAR') || t === 'TEXT' || t === 'STRING') return 'text'
  return 'other'
}

const OPS = {
  number: ['=', '!=', '<', '<=', '>', '>=', 'is null', 'is not null'],
  text: ['=', '!=', 'contains', 'starts with', 'is null', 'is not null'],
  bool: ['is true', 'is false', 'is null'],
  other: ['is null', 'is not null'],
}

export function opsFor(duckType) {
  return OPS[typeClass(duckType)]
}

export function needsValue(op) {
  return !['is null', 'is not null', 'is true', 'is false'].includes(op)
}

export function quoteIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`
}

function quoteText(value) {
  return `'${String(value).replace(/'/g, "''")}'`
}

function likePattern(value, prefix) {
  const escaped = String(value).replace(/[\\%_]/g, (c) => `\\${c}`)
  return quoteText(prefix ? `${escaped}%` : `%${escaped}%`)
}

// Output name of an aggregate, used as its alias and for ORDER BY.
export function aggAlias(agg) {
  return agg.fn === 'count' ? 'n' : `${agg.fn}_${agg.column}`
}

function filterSql(f, type) {
  const col = quoteIdent(f.column)
  const cls = typeClass(type)
  if (!OPS[cls].includes(f.op)) return { problem: `"${f.op}" does not apply to ${f.column}` }
  if (!needsValue(f.op)) return { sql: `${col} ${f.op.toUpperCase()}` }
  const raw = f.value == null ? '' : String(f.value).trim()
  if (raw === '') return { problem: `${f.column}: enter a value` }
  if (cls === 'number') {
    const n = Number(raw)
    if (!Number.isFinite(n)) return { problem: `${f.column}: "${raw}" is not a number` }
    return { sql: `${col} ${f.op} ${n}` }
  }
  if (f.op === 'contains') return { sql: `${col} ILIKE ${likePattern(raw, false)} ESCAPE '\\'` }
  if (f.op === 'starts with') return { sql: `${col} ILIKE ${likePattern(raw, true)} ESCAPE '\\'` }
  return { sql: `${col} ${f.op} ${quoteText(raw)}` }
}

/**
 * Build SQL from a spec over one view.
 *
 * spec = { table, columns: [name], filters: [{ column, op, value }],
 *          groupBy: [name], aggregates: [{ fn, column }], orderBy: { column, dir }, limit }
 * types = { columnName: duckdbType } for the chosen view.
 *
 * Returns { sql, problems }: incomplete or invalid filters are left out and reported.
 */
export function buildSql(spec, types = {}) {
  const problems = []
  if (!spec || !spec.table) return { sql: '', problems: ['choose a table'] }
  const known = (c) => Object.prototype.hasOwnProperty.call(types, c)

  const groupBy = (spec.groupBy || []).filter(known)
  const aggregates = []
  for (const a of spec.aggregates || []) {
    if (AGGREGATES.includes(a.fn) && (a.fn === 'count' || (known(a.column) && typeClass(types[a.column]) === 'number'))) {
      aggregates.push(a)
    } else {
      problems.push(`${a.fn}(${a.column || ''}) needs a numeric column`)
    }
  }
  const grouped = groupBy.length > 0 || aggregates.length > 0

  let select
  let outputs
  if (grouped) {
    const aggs = aggregates.length ? aggregates : [{ fn: 'count' }]
    const aggSql = aggs.map((a) => (a.fn === 'count'
      ? `count(*) AS ${quoteIdent(aggAlias(a))}`
      : `${a.fn}(${quoteIdent(a.column)}) AS ${quoteIdent(aggAlias(a))}`))
    select = [...groupBy.map(quoteIdent), ...aggSql]
    outputs = [...groupBy, ...aggs.map(aggAlias)]
  } else {
    const cols = (spec.columns || []).filter(known)
    select = cols.length ? cols.map(quoteIdent) : ['*']
    outputs = cols.length ? cols : Object.keys(types)
  }

  const where = []
  for (const f of spec.filters || []) {
    if (!f || !f.column) continue
    if (!known(f.column)) { problems.push(`unknown column ${f.column}`); continue }
    const r = filterSql(f, types[f.column])
    if (r.problem) problems.push(r.problem)
    else where.push(r.sql)
  }

  let sql = `SELECT ${select.join(', ')}\nFROM ${quoteIdent(spec.table)}`
  if (where.length) sql += `\nWHERE ${where.join('\n  AND ')}`
  if (groupBy.length) sql += `\nGROUP BY ${groupBy.map(quoteIdent).join(', ')}`
  const order = spec.orderBy
  if (order && order.column && outputs.includes(order.column)) {
    sql += `\nORDER BY ${quoteIdent(order.column)} ${order.dir === 'asc' ? 'ASC' : 'DESC'} NULLS LAST`
  }
  const limit = Math.min(Math.max(parseInt(spec.limit, 10) || 50, 1), MAX_LIMIT)
  sql += `\nLIMIT ${limit}`
  return { sql, problems }
}
