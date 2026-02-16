const crypto = require('crypto');
const {
  listEstablishments,
  listTopReviewedEstablishments,
  createEstablishment,
  findById,
  findByNameAndAddress,
  updateEstablishment,
} = require('../repositories/establishmentRepository');

async function listEstablishmentsService() {
  return listEstablishments();
}

async function createEstablishmentService({
  name,
  category,
  image_url,
  address = null,
  country = null,
  state_region = null,
  district = null,
  latitude = null,
  longitude = null,
}) {
  const id = crypto.randomUUID();
  return createEstablishment({
    id,
    name,
    category,
    image_url,
    address,
    country,
    state_region,
    district,
    latitude,
    longitude,
  });
}

async function listTopReviewedEstablishmentsService({ page, pageSize }) {
  const offset = (page - 1) * pageSize;
  const { rows, total } = await listTopReviewedEstablishments({ limit: pageSize, offset });

  return {
    data: rows.map((row) => ({
      ...row,
      review_count: Number(row.review_count || 0),
      avg_stars: Number(row.avg_stars || 0),
    })),
    meta: {
      page,
      page_size: pageSize,
      total,
    },
  };
}

async function getEstablishmentById(id) {
  return findById(id);
}

async function updateEstablishmentService({
  id,
  name,
  category,
  image_url,
  address = null,
  country = null,
  state_region = null,
  district = null,
  latitude = null,
  longitude = null,
}) {
  return updateEstablishment({
    id,
    name,
    category,
    image_url,
    address,
    country,
    state_region,
    district,
    latitude,
    longitude,
  });
}

async function resolveFromLocationService({
  name,
  address,
  country = null,
  state_region = null,
  district = null,
  latitude,
  longitude,
  category = 'Map Place',
  image_url = null,
}) {
  const existing = await findByNameAndAddress({ name, address });
  if (existing) {
    const shouldUpdate =
      (image_url && image_url !== existing.image_url) ||
      (category && category !== existing.category) ||
      (country && country !== existing.country) ||
      (state_region && state_region !== existing.state_region) ||
      (district && district !== existing.district) ||
      (latitude != null && Number(latitude) !== Number(existing.latitude)) ||
      (longitude != null && Number(longitude) !== Number(existing.longitude));

    if (!shouldUpdate) {
      return existing;
    }

    return updateEstablishmentService({
      id: existing.id,
      name: existing.name,
      category: category || existing.category,
      image_url: image_url || existing.image_url,
      address: existing.address,
      country: country || existing.country,
      state_region: state_region || existing.state_region,
      district: district || existing.district,
      latitude: latitude ?? existing.latitude,
      longitude: longitude ?? existing.longitude,
    });
  }

  try {
    return await createEstablishmentService({
      name,
      category,
      image_url,
      address,
      country,
      state_region,
      district,
      latitude,
      longitude,
    });
  } catch (err) {
    if (err?.code === '23505') {
      const duplicated = await findByNameAndAddress({ name, address });
      if (duplicated) return duplicated;
    }
    throw err;
  }
}

async function searchLocationService({ queryText, maxResults = 6 }) {
  const query = String(queryText || '').trim();
  if (!query) return [];

  const endpoint = new URL('https://nominatim.openstreetmap.org/search');
  endpoint.searchParams.set('q', query);
  endpoint.searchParams.set('format', 'jsonv2');
  endpoint.searchParams.set('addressdetails', '1');
  endpoint.searchParams.set('limit', String(Math.max(1, Math.min(Number(maxResults) || 6, 10))));

  const response = await fetch(endpoint.toString(), {
    headers: {
      'Accept-Language': 'es,en',
      'User-Agent': 'syspoints/1.0 establishment-search',
    },
  });

  if (!response.ok) {
    const err = new Error(`OSM search failed (${response.status})`);
    err.code = 'OSM_SEARCH_FAILED';
    throw err;
  }

  const payload = await response.json();
  const results = Array.isArray(payload) ? payload : [];
  return results
    .map((item) => {
      const lat = Number(item?.lat);
      const lon = Number(item?.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
      const addr = item?.address || {};
      const nameCandidate = [
        item?.name,
        addr?.amenity,
        addr?.shop,
        addr?.tourism,
        addr?.building,
      ].find((value) => String(value || '').trim().length > 0);
      return {
        id: String(item?.place_id || `${lat}-${lon}`),
        name: String(nameCandidate || String(item?.display_name || '').split(',')[0] || 'Establishment').trim(),
        address: String(item?.display_name || '').trim(),
        country: String(addr?.country || '').trim() || null,
        state_region: String(addr?.state || addr?.region || addr?.county || '').trim() || null,
        district: String(addr?.city_district || addr?.suburb || addr?.city || addr?.town || '').trim() || null,
        latitude: lat,
        longitude: lon,
      };
    })
    .filter(Boolean);
}

async function suggestImagesService() {
  const establishments = await listEstablishmentsService();
  const unique = [...new Set(
    (Array.isArray(establishments) ? establishments : [])
      .map((item) => String(item?.image_url || '').trim())
      .filter((url) => /^https?:\/\//i.test(url))
  )];
  return unique.slice(0, 40).map((image_url) => ({ image_url }));
}

module.exports = {
  establishmentService: {
    listEstablishments: listEstablishmentsService,
    listTopReviewedEstablishments: listTopReviewedEstablishmentsService,
    createEstablishment: createEstablishmentService,
    getEstablishmentById,
    updateEstablishment: updateEstablishmentService,
    searchLocation: searchLocationService,
    resolveFromLocation: resolveFromLocationService,
    suggestImages: suggestImagesService,
  },
};
