import { customType } from "drizzle-orm/pg-core";

/**
 * PostGIS columns that carry their SRID.
 *
 * Drizzle's built-in `geometry()` is not usable here for two reasons found the
 * hard way: drizzle-kit emits `geometry(point)` regardless of the declared
 * type — a column meant to hold a MultiPolygon came out as a Point — and it
 * drops the SRID entirely. On insert it writes `point(x y)`, which lands in the
 * database as SRID 0, and `ST_Transform` then refuses to work at all.
 *
 * These types fix both ends: the DDL says what the column really is, and values
 * are written as EWKT (`SRID=4326;POINT(x y)`), which PostGIS parses directly.
 *
 * 4326 is WGS 84 — the coordinate system GPS and GeoJSON speak. Tiles are
 * served in 3857, but that is a projection done at query time; what is stored
 * stays in the system the data arrives in.
 */
const WGS84 = 4326;

export type LngLat = { x: number; y: number };

/**
 * Reads a point back from the wire.
 *
 * `pg` hands geometry over as hex-encoded EWKB. For a 2D point that is a
 * one-byte endianness flag, a four-byte type with the SRID bit set, the SRID,
 * then two doubles — small enough to read directly rather than pull in a
 * parser.
 */
function parsePointEwkb(hex: string): LngLat {
  const buffer = Buffer.from(hex, "hex");
  const littleEndian = buffer.readUInt8(0) === 1;

  const type = littleEndian ? buffer.readUInt32LE(1) : buffer.readUInt32BE(1);
  const hasSrid = (type & 0x20000000) !== 0;
  const offset = hasSrid ? 9 : 5;

  return littleEndian
    ? { x: buffer.readDoubleLE(offset), y: buffer.readDoubleLE(offset + 8) }
    : { x: buffer.readDoubleBE(offset), y: buffer.readDoubleBE(offset + 8) };
}

/** A longitude/latitude point. `x` is longitude, `y` is latitude, as PostGIS orders them. */
export const point = customType<{ data: LngLat; driverData: string }>({
  dataType() {
    return `geometry(Point,${WGS84})`;
  },
  toDriver(value) {
    return `SRID=${WGS84};POINT(${value.x} ${value.y})`;
  },
  fromDriver(value) {
    return parsePointEwkb(value);
  },
});

/**
 * A municipal boundary.
 *
 * Kept as GeoJSON on the TypeScript side: boundaries are read whole and handed
 * to the map, never inspected coordinate by coordinate, so a structured
 * representation buys nothing over the format the map already speaks.
 */
export const multiPolygon = customType<{ data: string; driverData: string }>({
  dataType() {
    return `geometry(MultiPolygon,${WGS84})`;
  },
  toDriver(value) {
    return value;
  },
});
