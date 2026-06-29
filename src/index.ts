#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const DEFAULT_BASE_URL = "https://api.transit.ls8h.com";
const BASE_URL = (process.env.TRANSIT_API_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, "");

class TransitApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "TransitApiError";
  }
}

type QueryValue = string | number | boolean | readonly string[] | undefined;

function appendQuery(url: URL, params: Record<string, QueryValue>): void {
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== "") {
          url.searchParams.append(key, item);
        }
      }
      continue;
    }

    url.searchParams.set(key, String(value));
  }
}

async function transitGet(path: string, params: Record<string, QueryValue> = {}): Promise<unknown> {
  const url = new URL(path, BASE_URL);
  appendQuery(url, params);

  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "japan-transit-mcp/0.1.0",
    },
  });

  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    throw new TransitApiError(
      `Transit API request failed: ${response.status} ${response.statusText}`,
      response.status,
      body,
    );
  }

  return body;
}

function jsonContent(data: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

function errorContent(error: unknown) {
  const body = error instanceof TransitApiError
    ? { error: error.message, status: error.status, details: error.details }
    : { error: error instanceof Error ? error.message : String(error) };

  return {
    isError: true,
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(body, null, 2),
      },
    ],
  };
}

function withApiErrors<TArgs extends Record<string, unknown>>(
  handler: (args: TArgs) => Promise<unknown>,
) {
  return async (args: TArgs) => {
    try {
      return jsonContent(await handler(args));
    } catch (error) {
      return errorContent(error);
    }
  };
}

const limitSchema = z.number().int().min(1).max(30).default(10);
const endpointSchema = z.string().min(1).describe("Station id (feedId:stopId) or geo:<lat>,<lon>.");
const dateSchema = z.string().regex(/^\d{8}$/).optional().describe("Service date as YYYYMMDD.");
const timeSchema = z.string().regex(/^\d{1,2}:\d{2}(:\d{2})?$/).optional().describe("HH:MM or HH:MM:SS.");
const routeTypeSchema = z.enum(["departure", "arrival", "first", "last"]).default("departure");
const modesSchema = z.array(z.string().min(1)).max(8).optional();
const viaSchema = z.array(endpointSchema).max(3).optional();
const viaLabelSchema = z.array(z.string().min(1).max(120)).max(3).optional();

const server = new McpServer({
  name: "japan-transit-mcp",
  version: "0.1.0",
});

server.tool(
  "suggest_places",
  "Search Japanese stations, stops, facilities, and addresses. Use the returned endpoint field with plan_route or guidance_plan.",
  {
    q: z.string().min(1).describe("Place query, for example 東京駅, 新宿, 渋谷スクランブルスクエア."),
    limit: limitSchema,
  },
  withApiErrors(async ({ q, limit }) => transitGet("/api/v1/places/suggest", { q, limit })),
);

server.tool(
  "suggest_stations",
  "Search station/stop IDs by multilingual prefix. Use returned station ids with route planning.",
  {
    q: z.string().min(1).describe("Station query, for example 東京, Shinjuku, しぶや."),
    limit: limitSchema,
  },
  withApiErrors(async ({ q, limit }) => transitGet("/api/v1/locations/suggest", { q, limit })),
);

server.tool(
  "reverse_places",
  "Find nearby stations, stops, places, or addresses for a map coordinate.",
  {
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
    limit: z.number().int().min(1).max(10).default(3),
    radiusMeters: z.number().min(1).max(500).default(80),
  },
  withApiErrors(async (args) => transitGet("/api/v1/places/reverse", args)),
);

const routePlanningShape = {
  from: endpointSchema.describe("Origin endpoint from suggest_places/suggest_stations, or geo:<lat>,<lon>."),
  to: endpointSchema.describe("Destination endpoint from suggest_places/suggest_stations, or geo:<lat>,<lon>."),
  fromLabel: z.string().min(1).max(120).optional(),
  toLabel: z.string().min(1).max(120).optional(),
  date: dateSchema,
  time: timeSchema,
  type: routeTypeSchema.describe("departure: 出発, arrival: 到着, first: 始発, last: 終電."),
  allowModes: modesSchema.describe("Transit modes to allow, for example ['rail', 'bus']."),
  avoidModes: modesSchema.describe("Transit modes to avoid, for example ['bus', 'air', 'ferry']."),
  avoidWalk: z.boolean().default(false),
  maxTransfers: z.number().int().min(0).max(8).default(3),
  numItineraries: z.number().int().min(1).max(6).default(3),
  via: viaSchema.describe("Up to 3 waypoint endpoints. Departure/arrival searches only."),
  viaLabel: viaLabelSchema,
};

type RoutePlanningArgs = z.infer<z.ZodObject<typeof routePlanningShape>>;

function routeParams(args: RoutePlanningArgs & Record<string, unknown>): Record<string, QueryValue> {
  return {
    ...args,
    allowModes: args.allowModes?.join(","),
    avoidModes: args.avoidModes?.join(","),
    avoidWalk: String(args.avoidWalk),
  };
}

server.tool(
  "plan_route",
  "Search transit routes in Japan for departure, arrival, first train, or last train. Times are seconds from service-date midnight in the response timezone.",
  routePlanningShape,
  withApiErrors(async (args) => transitGet("/api/v1/plan", routeParams(args))),
);

server.tool(
  "guidance_plan",
  "Search ranked transit guidance options with comparison metrics, strategy, tracking, evidence, and map geometry.",
  {
    ...routePlanningShape,
    strategy: z.enum(["balanced", "fastest", "fewestTransfers", "lowestFare", "shortestWalk"]).default("balanced"),
    live: z.boolean().default(false),
    tracking: z.enum(["none", "origin", "destination", "both"]).default("none"),
  },
  withApiErrors(async (args) => transitGet("/api/v1/guidance/plan", routeParams({
    ...args,
    live: String(args.live),
  }))),
);

server.tool(
  "get_station",
  "Get station details, platforms, and serving routes.",
  {
    id: z.string().min(1).describe("Feed-qualified station id."),
  },
  withApiErrors(async ({ id }) => transitGet(`/api/v1/stations/${encodeURIComponent(id)}`)),
);

server.tool(
  "station_departures",
  "Get a station departure board where the source data license permits this presentation.",
  {
    id: z.string().min(1).describe("Feed-qualified station id."),
    date: dateSchema,
    time: timeSchema,
    limit: z.number().int().min(1).max(100).default(20),
  },
  withApiErrors(async ({ id, ...params }) => transitGet(`/api/v1/stations/${encodeURIComponent(id)}/departures`, params)),
);

server.tool(
  "list_feeds",
  "List ingested transit feeds with license attribution.",
  {},
  withApiErrors(async () => transitGet("/api/v1/feeds")),
);

server.tool(
  "list_operators",
  "List operator branding marks and logo/data license metadata.",
  {},
  withApiErrors(async () => transitGet("/api/v1/operators")),
);

server.tool(
  "health",
  "Check Transit API liveness.",
  {},
  withApiErrors(async () => transitGet("/api/health")),
);

const transport = new StdioServerTransport();
await server.connect(transport);
