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

**Open one qpx dataset and query it directly with DuckDB** — see which qpx tables
it ships (feature, protein groups, PSM, sample, run) and their row counts, browse
runs and samples, search protein groups and peptides, **search peptidoform
features** (by sequence/charge/q-value/PTM), view the dataset's **PTM
distribution**, **browse PSMs** (scan, RT, PEP), drill into a
single protein's supporting peptides and **per-run protein expression** (summed
feature intensity), and run a curated gallery of DuckDB queries (PSMs per run,
charge-state and q-value distributions, decoy rate, top protein groups).

All reads are on-demand DuckDB with column projection and a hot in-memory query
cache, so exploration stays fast. Reads are also **schema-aware and degrade
gracefully**: a dataset missing an optional table (no `sample`/`psm`, no PTM
annotation) shows empty tabs rather than errors, so the app works across
heterogeneous qpx files. Trigger it for a specific dataset from that
dataset's page → *Downloads → “🧪 Explore with DuckDB”* (or deep-link with
`?ref=accession/phash`). [Open the app →](/apps/qpx-explore)

## Also available to AI agents

Every app above mirrors its queries as **MCP tools**, so an AI assistant can run the
same peptide search, protein profile, coverage map, dataset search and statistics
lookups you can. The [AI & MCP](/docs/ai-mcp) page lists the tools.
