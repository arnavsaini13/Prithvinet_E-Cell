const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

function getToken(): string | null {
  return localStorage.getItem("prithvinet_token");
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  const token = getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `API error ${res.status}`);
  }
  return res.json();
}

/** For multipart/form-data uploads — browser sets Content-Type with boundary automatically */
async function requestForm<T>(path: string, body: FormData): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers,
    body,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? `API error ${res.status}`);
  }
  return res.json();
}

// ── Auth ──────────────────────────────────────────

export interface TokenOut {
  access_token: string;
  token_type: string;
  role: string;
}

export interface UserOut {
  id: number;
  name: string;
  email: string;
  role: string;
  region: string | null;
  created_at: string;
}

export const authApi = {
  login: (email: string, password: string) =>
    request<TokenOut>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  register: (data: {
    name: string;
    email: string;
    password: string;
    role?: string;
    region?: string;
  }) =>
    request<UserOut>("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  me: () => request<UserOut>("/users/me"),
};

// ── Stations ──────────────────────────────────────

export interface Station {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  region: string;
}

export const stationsApi = {
  list: (region?: string) =>
    request<Station[]>(`/stations${region ? `?region=${region}` : ""}`),
};

// ── Pollution ─────────────────────────────────────

export interface PollutionReading {
  id: number;
  station_id: number;
  pm25: number;
  pm10: number;
  co2: number;
  no2: number;
  ph: number;
  turbidity: number;
  dissolved_oxygen: number;
  noise_level: number;
  timestamp: string;
}

export const pollutionApi = {
  list: (stationId?: number, limit = 50) => {
    const params = new URLSearchParams();
    if (stationId != null) params.set("station_id", String(stationId));
    params.set("limit", String(limit));
    return request<PollutionReading[]>(`/pollution-data?${params}`);
  },
};

// ── Heatmap ───────────────────────────────────────

export interface HeatmapPoint {
  latitude: number;
  longitude: number;
  intensity: number;
  pollutant: string;
}

export const heatmapApi = {
  get: (pollutant = "pm25") =>
    request<HeatmapPoint[]>(`/heatmap-data?pollutant=${pollutant}`),
};

// ── Alerts ────────────────────────────────────────

export interface Alert {
  id: number;
  station_id: number;
  pollutant: string;
  value: number;
  severity: string;
  timestamp: string;
}

export const alertsApi = {
  list: (stationId?: number, severity?: string, limit = 50) => {
    const params = new URLSearchParams();
    if (stationId != null) params.set("station_id", String(stationId));
    if (severity) params.set("severity", severity);
    params.set("limit", String(limit));
    return request<Alert[]>(`/alerts?${params}`);
  },
};

// ── Risk Score ────────────────────────────────────

export interface RiskScore {
  station_id: number;
  station_name: string;
  air_quality_index: number;
  water_quality_index: number;
  noise_index: number;
  overall_risk: number;
  risk_level: string;
}

export const riskApi = {
  list: (stationId?: number) =>
    request<RiskScore[]>(
      `/risk-score${stationId != null ? `?station_id=${stationId}` : ""}`,
    ),
};

// ── Forecast ──────────────────────────────────────

export interface ForecastPoint {
  timestamp: string;
  predicted_value: number;
  lower_bound: number;
  upper_bound: number;
}

export interface ForecastOut {
  station_id: number;
  pollutant: string;
  forecast: ForecastPoint[];
}

export const forecastApi = {
  get: (stationId: number, pollutant = "pm25", steps = 12) =>
    request<ForecastOut>(
      `/forecast?station_id=${stationId}&pollutant=${pollutant}&steps=${steps}`,
    ),
};

// ── Industries ────────────────────────────────────

export interface Industry {
  id: number;
  name: string;
  location: string;
  compliance_score: number;
}

export interface EnrichedIndustry {
  id: number;
  name: string;
  location: string;
  latitude: number;
  longitude: number;
  compliance_score: number;
  pm25: number;
  pm10: number;
  so2: number;
  no2: number;
  eaqi: number;
  source: string;
}

export const industriesApi = {
  list: (minCompliance?: number) =>
    request<Industry[]>(
      `/industries${minCompliance != null ? `?min_compliance=${minCompliance}` : ""}`,
    ),
  /** Live-enriched industry data — compliance score + PM2.5/PM10/SO2/NO2/AQI from Open-Meteo */
  enriched: () => request<EnrichedIndustry[]>("/industries/enriched"),
};

// ── GBIF Biodiversity (free, no API key) ─────────

export interface GbifFacetCount {
  name: string;
  count: number;
}

export const gbifApi = {
  /** Occurrence counts for India by basis of record (observed, specimen, etc.) */
  indiaOccurrences: async (): Promise<{ total: number; byBasis: GbifFacetCount[] }> => {
    const url = `https://api.gbif.org/v1/occurrence/search?country=IN&limit=0&facet=basisOfRecord&facetLimit=10`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("GBIF occurrence fetch failed");
    const data = await res.json();
    return {
      total: data.count,
      byBasis: data.facets?.[0]?.counts ?? [],
    };
  },

  /** Species counts for India by kingdom */
  indiaSpeciesByKingdom: async (): Promise<GbifFacetCount[]> => {
    const url = `https://api.gbif.org/v1/occurrence/search?country=IN&limit=0&facet=kingdom&facetLimit=10`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("GBIF kingdom fetch failed");
    const data = await res.json();
    return data.facets?.[0]?.counts ?? [];
  },

  /** Species occurrence counts per Indian state (using stateProvince facet) */
  indiaByState: async (): Promise<GbifFacetCount[]> => {
    const url = `https://api.gbif.org/v1/occurrence/search?country=IN&limit=0&facet=stateProvince&facetLimit=15`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("GBIF state fetch failed");
    const data = await res.json();
    return data.facets?.[0]?.counts ?? [];
  },

  /** Threatened species metrics (IUCN threat status facet) */
  indiaThreatStatus: async (): Promise<GbifFacetCount[]> => {
    const url = `https://api.gbif.org/v1/occurrence/search?country=IN&limit=0&facet=iucnRedListCategory&facetLimit=10`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("GBIF threat status fetch failed");
    const data = await res.json();
    return data.facets?.[0]?.counts ?? [];
  },
};

// ── Open-Meteo (free, no API key) ────────────────

// Average coordinates for India stations (Delhi-centric)
const INDIA_LAT = 21.0;
const INDIA_LNG = 78.0;

export interface WeatherCurrent {
  temperature_2m: number;
  wind_speed_10m: number;
  surface_pressure: number;
  relative_humidity_2m: number;
  shortwave_radiation: number;
  uv_index: number;
}

export interface WeatherHourly {
  time: string[];
  temperature_2m: number[];
  wind_speed_10m: number[];
  surface_pressure: number[];
  shortwave_radiation: number[];
}

export interface MarineCurrent {
  wave_height: number;
  ocean_current_velocity: number;
  sea_surface_temperature: number;
}

export const openMeteoApi = {
  /** Fetch current weather (pressure, wind, solar, temperature, humidity, UV) for given coordinates */
  weather: async (lat = INDIA_LAT, lng = INDIA_LNG): Promise<{ current: WeatherCurrent; hourly: WeatherHourly }> => {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,wind_speed_10m,surface_pressure,relative_humidity_2m,shortwave_radiation,uv_index&hourly=temperature_2m,wind_speed_10m,surface_pressure,shortwave_radiation&past_hours=24&forecast_hours=0&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Open-Meteo weather fetch failed");
    const data = await res.json();
    return { current: data.current, hourly: data.hourly };
  },

  /** Fetch marine data for given coastal coordinates */
  marine: async (lat = 19.076, lng = 72.878): Promise<{ current: MarineCurrent }> => {
    const url = `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lng}&current=wave_height,ocean_current_velocity,sea_surface_temperature&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Open-Meteo marine fetch failed");
    const data = await res.json();
    return { current: data.current };
  },

  /** Fetch air quality for a specific station (includes extended pollutants: SO2, ozone, methane, dust, AQI) */
  airQuality: async (lat: number, lng: number): Promise<any> => {
    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&current=pm10,pm2_5,carbon_dioxide,nitrogen_dioxide,sulphur_dioxide,ozone,methane,aerosol_optical_depth,dust,uv_index,european_aqi&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Open-Meteo air quality fetch failed");
    return res.json();
  },
};

// ── Citizen Complaints ─────────────────────────────

export interface Complaint {
  id: number;
  user_id: number;
  title: string;
  description: string;
  photo_data: string | null;
  photo_filename: string | null;
  location: string | null;
  status: string;
  created_at: string;
}

export const complaintsApi = {
  submit: (data: FormData) => requestForm<Complaint>("/complaints", data),
  list: () => request<Complaint[]>("/complaints"),
};

// ── Community ─────────────────────────────────────

export interface CommunityPost {
  id: number;
  user_id: number;
  author_name: string;
  content: string;
  photo_data: string | null;
  photo_filename: string | null;
  likes_count: number;
  comments_count: number;
  liked_by_me: boolean;
  created_at: string;
}

export interface CommunityComment {
  id: number;
  post_id: number;
  user_id: number;
  author_name: string;
  content: string;
  created_at: string;
}

export interface LeaderboardEntry {
  rank: number;
  user_id: number;
  name: string;
  posts_count: number;
  total_likes: number;
  total_comments: number;
  score: number;
}

export const communityApi = {
  createPost: (data: FormData) => requestForm<CommunityPost>("/community/posts", data),
  listPosts: (limit = 50) => request<CommunityPost[]>(`/community/posts?limit=${limit}`),
  toggleLike: (postId: number) =>
    request<CommunityPost>(`/community/posts/${postId}/like`, { method: "POST" }),
  getComments: (postId: number) =>
    request<CommunityComment[]>(`/community/posts/${postId}/comments`),
  addComment: (postId: number, content: string) => {
    const fd = new FormData();
    fd.append("content", content);
    return requestForm<CommunityComment>(`/community/posts/${postId}/comments`, fd);
  },
  leaderboard: () => request<LeaderboardEntry[]>("/community/leaderboard"),
};
