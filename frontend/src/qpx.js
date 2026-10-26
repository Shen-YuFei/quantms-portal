// qpx-explore client: query one content-addressed qpx dataset with DuckDB.
//
// The backend lives at api.quantms.org/qpx-explore and is addressed per dataset
// by a `ref` of the form "{accession}/{phash}" (e.g. MSV000085836/8e4c044b513d),
// URL-encoded via encodePath. Reads are GETs; the SQL editor POSTs a
// SELECT that the backend validates and confines to the dataset.

import { apiGet, apiPost, encodePath } from './api.js'
import { QPX_BASE } from './config.js'

// Catalogue of the curated DuckDB queries (ids, parameters) the backend allow-lists.
export const qpxQueries = () => apiGet(QPX_BASE, '/queries')


// Dataset-level summary: files present, views available, row counts, organisms, instruments.
export const qpxOverview = (ref) => apiGet(QPX_BASE, `/datasets/${encodePath(ref)}/overview`)

// Raw file inventory for the dataset (which qpx parquet files exist).
export const qpxFiles = (ref) => apiGet(QPX_BASE, `/datasets/${encodePath(ref)}/files`)

export const qpxRuns = (ref, params) => apiGet(QPX_BASE, `/datasets/${encodePath(ref)}/runs`, params)
export const qpxSamples = (ref, params) => apiGet(QPX_BASE, `/datasets/${encodePath(ref)}/samples`, params)

// Search protein groups / peptides (both accept an optional text filter `q`).
export const qpxSearchProteins = (ref, params) => apiGet(QPX_BASE, `/datasets/${encodePath(ref)}/proteins`, params)
export const qpxSearchPeptides = (ref, params) => apiGet(QPX_BASE, `/datasets/${encodePath(ref)}/peptides`, params)

// One protein group: its pg row plus the supporting peptides.
export const qpxProtein = (ref, protein) =>
  apiGet(QPX_BASE, `/datasets/${encodePath(ref)}/protein/${encodeURIComponent(protein)}`)

// Per-run abundance (summed feature intensity) for one protein group.
export const qpxProteinExpression = (ref, protein) =>
  apiGet(QPX_BASE, `/datasets/${encodePath(ref)}/protein/${encodeURIComponent(protein)}/expression`)

// Search peptidoform features with filters (q text, charge, run, qvalue_max, mod).
export const qpxSearchFeatures = (ref, params) =>
  apiGet(QPX_BASE, `/datasets/${encodePath(ref)}/features`, params)

// PTM (post-translational modification) distribution for the dataset.
export const qpxPtms = (ref, params) => apiGet(QPX_BASE, `/datasets/${encodePath(ref)}/ptms`, params)

// Browse scan-level spectral evidence from the psm table (raw peak lists are not
// stored in the parquet — this surfaces the scan/precursor metadata that is).
export const qpxPsms = (ref, params) => apiGet(QPX_BASE, `/datasets/${encodePath(ref)}/psms`, params)

// Run a curated query by id (allow-listed on the backend).
export const qpxRunQuery = (ref, queryId, params) =>
  apiGet(QPX_BASE, `/datasets/${encodePath(ref)}/query/${queryId}`, params)

// Expose each available view's columns+types (backing the SQL editor).
export const qpxSchema = (ref) => apiGet(QPX_BASE, `/datasets/${encodePath(ref)}/schema`)

// Run a free-form, SELECT-only DuckDB statement (validated + confined backend-side).
export const qpxRunSql = (ref, { sql, limit }) =>
  apiPost(QPX_BASE, `/datasets/${encodePath(ref)}/sql`, { sql, limit })
