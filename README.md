# mcp-datagov-il

data.gov.il MCP — Israel national open-data portal (CKAN API).

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

## Tools

| Tool | Description |
|------|-------------|
| `search_datasets` | Search the data.gov.il catalogue (CKAN package_search). Returns matching datasets with titles/descriptions (mostly Hebrew). Query may be Hebrew or English. |
| `dataset_details` | Full dataset record by id or slug (CKAN package_show), including its resources. Read each resource's "id" (resource_id) and "datastore_active" flag to know which can be queried row-by-row via datastore_query. |
| `datastore_query` | Read actual table rows from a resource via CKAN datastore_search. Works only for resources with datastore_active=true (get the resource_id from dataset_details). Field names and values are often Hebrew (UTF-8). |
| `list_organizations` | List publishing organizations (ministries/agencies) on data.gov.il (CKAN organization_list). |
| `list_groups` | List thematic groups/categories on data.gov.il (CKAN group_list). |

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "datagov-il": {
      "url": "https://gateway.pipeworx.io/datagov-il/mcp"
    }
  }
}
```

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Datagov Il data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
