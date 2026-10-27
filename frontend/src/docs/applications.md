# Applications

The portal is organized around a small set of focused apps. Each one answers a
specific kind of question over the same standardized corpus, and each has its own
documentation section (linked below). Every app is also available to AI agents
through MCP tools that mirror the exact same queries — see [AI & MCP](/docs/ai-mcp).

## Peptide & Protein Search

**Find where a peptide or protein has been observed across every indexed dataset,
and explore it biologically** — gene-centric protein search, per-peptide biological
profiles, per-residue coverage maps, and a calibrated evidence-quality score (GPP).
[Open the app →](/apps/peptide-search) · [Overview](/docs/ps-overview) ·
[How search works](/docs/ps-how-search-works) · [Evidence quality (GPP)](/docs/ps-gpp)

## Dataset Search

**Browse and search datasets and the collections that group them** — free-text
search, organism/instrument/collection facets, and per-dataset metadata.
[Open the app →](/apps/dataset-search) · [Overview](/docs/ds-overview)

## Statistics

**Understand the portal at the corpus level** — counts, species/tissue/instrument
distributions, per-organism proteome coverage, and modification breakdowns.
[Open the app →](/statistics) · [Overview](/docs/stats-overview)

## qpx Dataset Explorer

**Review one qpx dataset's quality and the evidence behind it**, read directly with
DuckDB. The **Overview** shows headline counts and QC distributions (identifications
per run, charge, peptide length, missed cleavages, precursor mass error, retention
time, intensity, PEP, peptides per protein group) and the sample annotations. The
**QC** tab lists per-run metrics and per-sample protein intensity, and flags outliers
with a robust z-score (runs against runs of the same fraction, TMT channels within
their plex; pooled references are not judged). Tables cover runs, samples, protein
groups, peptides, features, PTMs and PSMs, all sortable, with a protein's supporting
peptides and per-run expression. The **Query** tab has a filter builder and a
read-only SQL editor confined to the dataset's own files.

Reads are on-demand DuckDB with column projection, so there is no build step. A
dataset missing an optional table (no `sample`, `psm` or PTM annotation) disables
that tab rather than erroring. Open it from a dataset's page →
*Downloads → “🧪 Explore with DuckDB”*, deep-link with `?ref=accession/phash`, or
start from an example on the app's start page. [Open the app →](/apps/qpx-explore)

## Also available to AI agents

Every app above mirrors its queries as **MCP tools**, so an AI assistant can run the
same peptide search, protein profile, coverage map, dataset search and statistics
lookups you can. The [AI & MCP](/docs/ai-mcp) page lists the tools.
