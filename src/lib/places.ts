export type PlaceSuggestion = {
  id: string;
  label: string;
  detail: string;
  latitude: number;
  longitude: number;
};

type PhotonFeature = {
  geometry?: { coordinates?: number[] };
  properties?: {
    osm_id?: number | string;
    osm_type?: string;
    name?: string;
    street?: string;
    housenumber?: string;
    district?: string;
    city?: string;
    town?: string;
    village?: string;
    county?: string;
    state?: string;
    country?: string;
    postcode?: string;
  };
};

type NominatimHit = {
  place_id?: number | string;
  lat?: string;
  lon?: string;
  display_name?: string;
  name?: string;
  address?: {
    road?: string;
    pedestrian?: string;
    house_number?: string;
    suburb?: string;
    neighbourhood?: string;
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    country?: string;
  };
};

function isAbort(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { name?: string; message?: string };
  return e.name === 'AbortError' || /abort/i.test(e.message ?? '');
}

function uniquePush(list: PlaceSuggestion[], item: PlaceSuggestion | null, seen: Set<string>) {
  if (!item || seen.has(item.id)) return;
  seen.add(item.id);
  list.push(item);
}

function formatPhoton(feature: PhotonFeature): PlaceSuggestion | null {
  const coords = feature.geometry?.coordinates;
  if (!coords || coords.length < 2) return null;
  const [longitude, latitude] = coords;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const p = feature.properties ?? {};
  const city = p.city || p.town || p.village || p.county;
  const street = [p.street, p.housenumber].filter(Boolean).join(', ');
  const title = p.name || street || city || p.state || 'Local';
  const detailBits = [street && p.name ? street : null, p.district, city, p.state].filter(
    (bit) => bit && bit !== title,
  );

  return {
    id: `ph-${p.osm_type ?? 'p'}-${p.osm_id ?? `${latitude},${longitude}`}`,
    label: title,
    detail: detailBits.join(' · '),
    latitude,
    longitude,
  };
}

function formatNominatim(hit: NominatimHit): PlaceSuggestion | null {
  const latitude = Number(hit.lat);
  const longitude = Number(hit.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const a = hit.address ?? {};
  const city = a.city || a.town || a.village;
  const street = [a.road || a.pedestrian, a.house_number].filter(Boolean).join(', ');
  const title = hit.name || street || city || a.state || 'Local';
  const detail =
    hit.display_name && hit.display_name !== title
      ? hit.display_name
      : [street && hit.name ? street : null, a.suburb || a.neighbourhood, city, a.state]
          .filter((bit) => bit && bit !== title)
          .join(' · ');

  return {
    id: `nm-${String(hit.place_id ?? `${latitude},${longitude}`)}`,
    label: title,
    detail,
    latitude,
    longitude,
  };
}

async function searchPhoton(
  query: string,
  bias: { latitude: number; longitude: number } | undefined,
  signal?: AbortSignal,
): Promise<PlaceSuggestion[]> {
  const params = [`q=${encodeURIComponent(query)}`, 'limit=8'];
  if (bias && Number.isFinite(bias.latitude) && Number.isFinite(bias.longitude)) {
    params.push(`lat=${bias.latitude}`, `lon=${bias.longitude}`);
  }
  const response = await fetch(`https://photon.komoot.io/api/?${params.join('&')}`, {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Photon ${response.status}`);
  }
  const json = (await response.json()) as { features?: PhotonFeature[] };
  const seen = new Set<string>();
  const results: PlaceSuggestion[] = [];
  for (const feature of json.features ?? []) {
    uniquePush(results, formatPhoton(feature), seen);
  }
  return results;
}

async function searchNominatim(query: string, signal?: AbortSignal): Promise<PlaceSuggestion[]> {
  const params = [
    'format=jsonv2',
    'addressdetails=1',
    'limit=8',
    'accept-language=pt-BR',
    `q=${encodeURIComponent(query)}`,
  ];
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.join('&')}`, {
    signal,
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Resenha/1.0 (mensagens-mobile)',
    },
  });
  if (!response.ok) {
    throw new Error(`Nominatim ${response.status}`);
  }
  const json = (await response.json()) as NominatimHit[];
  const seen = new Set<string>();
  const results: PlaceSuggestion[] = [];
  for (const hit of Array.isArray(json) ? json : []) {
    uniquePush(results, formatNominatim(hit), seen);
  }
  return results;
}

export async function searchPlaces(
  query: string,
  bias?: { latitude: number; longitude: number },
  signal?: AbortSignal,
): Promise<PlaceSuggestion[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const errors: string[] = [];

  try {
    const photon = await searchPhoton(q, bias, signal);
    if (photon.length > 0) return photon;
  } catch (e) {
    if (isAbort(e)) throw e;
    errors.push(e instanceof Error ? e.message : String(e));
  }

  try {
    const nominatim = await searchNominatim(q, signal);
    if (nominatim.length > 0) return nominatim;
  } catch (e) {
    if (isAbort(e)) throw e;
    errors.push(e instanceof Error ? e.message : String(e));
  }

  if (errors.length > 0) {
    throw new Error('Não foi possível buscar endereços. Confira a conexão e tente de novo.');
  }
  return [];
}

export function isAbortError(error: unknown): boolean {
  return isAbort(error);
}
