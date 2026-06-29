# japan-transit-mcp

Languages: [English](README.md) | [日本語](README.ja.md)

Japan transit route-search MCP server for the public Transit API at <https://api.transit.ls8h.com/>.

This is an unofficial client/server wrapper around the public, read-only Transit API. It is not affiliated with, endorsed by, or guaranteed by Transit, transport operators, ODPT, or any other data provider.

## Setup

```bash
npm install
npm run build
```

## MCP configuration

Use the built stdio server:

```json
{
  "mcpServers": {
    "japan-transit": {
      "command": "node",
      "args": ["/path/to/japan-transit-mcp/dist/index.js"]
    }
  }
}
```

Replace `/path/to/japan-transit-mcp` with your local checkout path.

During development you can run:

```bash
npm run dev
```

## Tools

- `suggest_places`: Search stations, stops, facilities, and addresses. Use the returned `endpoint` in route planning.
- `suggest_stations`: Search station/stop IDs only.
- `reverse_places`: Find nearby route-planning endpoints from latitude/longitude.
- `plan_route`: Search routes for departure, arrival, first train, or last train.
- `guidance_plan`: Search ranked guidance options with strategy and tracking options.
- `get_station`: Get station detail, platforms, and serving routes.
- `station_departures`: Get a departure board where the source data license permits it.
- `list_feeds`: List ingested GTFS/ODPT feeds and attribution.
- `list_operators`: List operator branding and license metadata.
- `health`: Check API liveness.

Route endpoints can be station IDs such as `feedId:stopId` or geographic endpoints like `geo:35.680960,139.766386`.

## Example workflow

1. Call `suggest_places` with `q: "東京駅"`.
2. Call `suggest_places` with `q: "新宿駅"`.
3. Pass the returned `endpoint` values to `plan_route`.

Times returned by the API are seconds from service-date midnight in the result timezone. Values may exceed `86400` for after-midnight service.

## Terms, attribution, and reliability

Before publishing or operating this MCP server, review the Transit terms at <https://transit.ls8h.com/terms>.

- The Transit API is free, unauthenticated, and read-only, but excessive requests, uses that interfere with service operation, uses that harm third-party rights or terms, and displays that make the service look official are prohibited.
- Transit data may come from GTFS, ODPT, transport operators, municipalities, OpenStreetMap, GSI, PLATEAU, and other third-party sources. Source licenses and attribution must be respected.
- Route, timetable, fare, walking, place, map, and source data are not guaranteed to be accurate, complete, current, available, or fit for a particular purpose.
- Applications that expose API results should make clear that the service is unofficial and that important travel or business decisions should be checked against official operator information.
- This repository's MIT license covers only this MCP wrapper code. It does not grant rights to Transit API responses, operator marks/logos, timetable data, OpenStreetMap data, ODPT data, or other third-party content.

Use `list_feeds` and `list_operators` to retrieve source and license metadata for attribution. Avoid building a bulk timetable redistribution product from API responses, especially for ODPT-derived data.
