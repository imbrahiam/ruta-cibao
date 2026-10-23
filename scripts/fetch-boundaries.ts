import { writeFile } from "node:fs/promises";

/**
 * Refreshes the three municipal polygons from the exact OpenStreetMap
 * relations used by the Protomaps basemap. Run deliberately, review the diff,
 * then `bun run scripts/import-boundaries.ts`; boundaries never change during
 * normal app operation.
 */
const OUTPUT = new URL(
  "../data/boundaries/santiago-rodriguez.geojson",
  import.meta.url,
);

const MUNICIPALITIES = {
  7391002: {
    id: "moncion",
    pcode: "DO020303",
    name: "Municipio Monción",
    areaSqKm: 138.87,
  },
  7390991: {
    id: "sabaneta",
    pcode: "DO020301",
    name: "Municipio San Ignacio de Sabaneta",
    areaSqKm: 800.83,
  },
  7390993: {
    id: "villa-los-almacigos",
    pcode: "DO020302",
    name: "Municipio Villa Los Almácigos",
    areaSqKm: 207.06,
  },
} as const;

const ids = Object.keys(MUNICIPALITIES)
  .map((id) => `R${id}`)
  .join(",");
const url = new URL("https://nominatim.openstreetmap.org/lookup");
url.searchParams.set("osm_ids", ids);
url.searchParams.set("format", "geojson");
url.searchParams.set("polygon_geojson", "1");

const response = await fetch(url, {
  headers: {
    "User-Agent":
      "RutaCibaoBoundaryRefresh/1.0 (https://github.com/imbrahiam/ruta-cibao)",
  },
});
if (!response.ok) throw new Error(`Nominatim returned ${response.status}`);

const source = (await response.json()) as GeoJSON.FeatureCollection<
  GeoJSON.Geometry,
  { osm_id: number; osm_type: string; name: string }
>;

const byId = new Map(
  source.features.map((feature) => [feature.properties.osm_id, feature]),
);
const features = Object.entries(MUNICIPALITIES).map(([osmId, properties]) => {
  const feature = byId.get(Number(osmId));
  if (feature?.properties.osm_type !== "relation") {
    throw new Error(`OSM relation ${osmId} was not returned`);
  }
  if (
    feature.geometry.type !== "Polygon" &&
    feature.geometry.type !== "MultiPolygon"
  ) {
    throw new Error(
      `OSM relation ${osmId} has ${feature.geometry.type}, expected a polygon`,
    );
  }
  return {
    type: "Feature" as const,
    properties: { ...properties, osmRelationId: Number(osmId) },
    geometry: feature.geometry,
  };
});

const collection = {
  type: "FeatureCollection" as const,
  source:
    "OpenStreetMap administrative relations 7390991, 7390993 and 7391002; ODbL 1.0; retrieved 2026-10-22 through Nominatim.",
  features,
};

await writeFile(OUTPUT, `${JSON.stringify(collection)}\n`);
console.log(`wrote ${features.length} OSM municipal boundaries`);
