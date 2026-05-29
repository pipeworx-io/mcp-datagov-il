interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * data.gov.il MCP — Israel national open-data portal (CKAN API).
 *
 * Auth: none (keyless). Docs: https://docs.ckan.org/en/latest/api/
 *
 * Notes for callers:
 * - Most metadata (dataset titles, descriptions, organization display names,
 *   and datastore row values) is in HEBREW (UTF-8). Free-text `query`/`q`
 *   arguments may be passed in Hebrew or English; English matches a smaller
 *   subset of datasets. Records come back as UTF-8 JSON — no extra decoding.
 * - Many resources expose row-level data via the datastore (CKAN
 *   `datastore_active: true`). Use `datastore_query` with a `resource_id`
 *   pulled from `dataset_details` to read actual table rows.
 */


const BASE = 'https://data.gov.il/api/3/action';
const UA = 'pipeworx-mcp-datagov-il/1.0 (+https://pipeworx.io)';

const tools: McpToolExport['tools'] = [
  {
    name: 'search_datasets',
    description:
      'Search the data.gov.il catalogue (CKAN package_search). Returns matching datasets with titles/descriptions (mostly Hebrew). Query may be Hebrew or English.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search terms, Hebrew or English. e.g. "תחבורה", "health", "budget".' },
        fq: { type: 'string', description: 'Solr filter query, e.g. "organization:bank_israel" or "tags:gtfs".' },
        rows: { type: 'number', description: 'Max results, 1-1000 (default 25).' },
        start: { type: 'number', description: '0-based offset for paging.' },
        sort: { type: 'string', description: 'Sort spec, e.g. "metadata_modified desc".' },
      },
      required: ['query'],
    },
  },
  {
    name: 'dataset_details',
    description:
      'Full dataset record by id or slug (CKAN package_show), including its resources. Read each resource\'s "id" (resource_id) and "datastore_active" flag to know which can be queried row-by-row via datastore_query.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Dataset id or slug, e.g. "vaccine-codes-lot-nachlieli".' } },
      required: ['id'],
    },
  },
  {
    name: 'datastore_query',
    description:
      'Read actual table rows from a resource via CKAN datastore_search. Works only for resources with datastore_active=true (get the resource_id from dataset_details). Field names and values are often Hebrew (UTF-8).',
    inputSchema: {
      type: 'object',
      properties: {
        resource_id: { type: 'string', description: 'Resource UUID from dataset_details, e.g. "2d4cec2c-d153-4bf9-95c6-256860d7857e".' },
        q: { type: 'string', description: 'Full-text filter across the table (Hebrew or English).' },
        filters: { type: 'object', description: 'Exact-match column filters, e.g. {"city":"תל אביב"}.' },
        limit: { type: 'number', description: 'Max rows, 1-32000 (default 100).' },
        offset: { type: 'number', description: '0-based row offset for paging.' },
      },
      required: ['resource_id'],
    },
  },
  {
    name: 'list_organizations',
    description: 'List publishing organizations (ministries/agencies) on data.gov.il (CKAN organization_list).',
    inputSchema: {
      type: 'object',
      properties: { limit: { type: 'number', description: 'Max orgs, 1-1000 (default 100).' } },
    },
  },
  {
    name: 'list_groups',
    description: 'List thematic groups/categories on data.gov.il (CKAN group_list).',
    inputSchema: {
      type: 'object',
      properties: { limit: { type: 'number', description: 'Max groups, 1-1000 (default 100).' } },
    },
  },
];

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case 'search_datasets': {
      const params = new URLSearchParams({
        q: reqStr(args, 'query', '"תחבורה" or "health"'),
        rows: String(clamp(args.rows, 25, 1, 1000)),
        start: String(Math.max(0, (args.start as number) ?? 0)),
      });
      if (args.fq) params.set('fq', String(args.fq));
      if (args.sort) params.set('sort', String(args.sort));
      return ckanGet(`/package_search?${params}`);
    }
    case 'dataset_details':
      return ckanGet(`/package_show?id=${encodeURIComponent(reqStr(args, 'id', '"vaccine-codes-lot-nachlieli"'))}`);
    case 'datastore_query': {
      const params = new URLSearchParams({
        resource_id: reqStr(args, 'resource_id', '"2d4cec2c-d153-4bf9-95c6-256860d7857e"'),
        limit: String(clamp(args.limit, 100, 1, 32000)),
        offset: String(Math.max(0, (args.offset as number) ?? 0)),
      });
      if (args.q) params.set('q', String(args.q));
      if (args.filters && typeof args.filters === 'object') params.set('filters', JSON.stringify(args.filters));
      return ckanGet(`/datastore_search?${params}`);
    }
    case 'list_organizations': {
      const params = new URLSearchParams({ all_fields: 'true', limit: String(clamp(args.limit, 100, 1, 1000)) });
      return ckanGet(`/organization_list?${params}`);
    }
    case 'list_groups': {
      const params = new URLSearchParams({ all_fields: 'true', limit: String(clamp(args.limit, 100, 1, 1000)) });
      return ckanGet(`/group_list?${params}`);
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

async function ckanGet(path: string): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, { headers: { Accept: 'application/json', 'User-Agent': UA } });
  if (!res.ok) throw new Error(`data.gov.il: ${res.status} ${await res.text().then((t) => t.slice(0, 200))}`);
  const json = (await res.json()) as { success?: boolean; error?: { message?: string }; result?: unknown };
  if (json.success === false) throw new Error(`data.gov.il: ${json.error?.message ?? 'request failed'}`);
  return json.result ?? json;
}

function clamp(v: unknown, dflt: number, lo: number, hi: number): number {
  const n = typeof v === 'number' ? v : dflt;
  return Math.min(hi, Math.max(lo, n));
}

function reqStr(args: Record<string, unknown>, key: string, example: string): string {
  const v = args[key];
  if (typeof v !== 'string' || !v.trim()) {
    throw new Error(`Required argument "${key}" is missing. Pass a string like ${example}.`);
  }
  return v;
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;
