import type Anthropic from '@anthropic-ai/sdk';

export const TOOL_DEFS: Anthropic.Tool[] = [
  {
    name: 'scrape_area',
    description:
      'Open Google Maps for the given keyword centered on (lat, lng), scrape every POI inside a circle of radius_m meters, and persist results to a fresh session in Supabase. Returns the new session_id and the number of POIs that fell inside the radius.',
    input_schema: {
      type: 'object',
      properties: {
        keyword: {
          type: 'string',
          description:
            'Google Maps search keyword. Use the most specific term the user mentioned (e.g. "specialty coffee", not "kafe"). Keep it under 60 chars.',
        },
        lat: {
          type: 'number',
          description: 'Latitude of the center point, in decimal degrees.',
        },
        lng: {
          type: 'number',
          description: 'Longitude of the center point, in decimal degrees.',
        },
        radius_m: {
          type: 'integer',
          description:
            'Radius in meters. Allowed range: 250 to 5000. Default to 1500 if the user did not specify.',
          minimum: 250,
          maximum: 5000,
        },
      },
      required: ['keyword', 'lat', 'lng', 'radius_m'],
    },
  },
  {
    name: 'query_places',
    description:
      'Read up to `limit` POIs from a scrape session, ordered by rating desc then review_count desc. Use to cite specific competitors by name.',
    input_schema: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: 'Session UUID returned by scrape_area.' },
        limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
      },
      required: ['session_id'],
    },
  },
  {
    name: 'analyze_session',
    description:
      'Aggregate stats for a scrape session. Returns count, avg_rating, total_reviews (proxy for market size), top_categories (with counts and avg rating), percent_closed, and price_level_distribution. Always call this after scrape_area before making any quantitative claim.',
    input_schema: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: 'Session UUID returned by scrape_area.' },
      },
      required: ['session_id'],
    },
  },
];

export type ToolName = 'scrape_area' | 'query_places' | 'analyze_session';

export interface ScrapeAreaInput {
  keyword: string;
  lat: number;
  lng: number;
  radius_m: number;
}

export interface QueryPlacesInput {
  session_id: string;
  limit?: number;
}

export interface AnalyzeSessionInput {
  session_id: string;
}
