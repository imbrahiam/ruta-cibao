import { customType } from "drizzle-orm/pg-core";
import { decryptSensitive, encryptSensitive } from "@/lib/crypto";

/**
 * Text that is encrypted at rest and plain everywhere else.
 *
 * For personal data the app has to read back — the name the civil registry
 * holds for a cédula. Encryption happens on the way into the driver and
 * decryption on the way out, so every query, seed and script that touches the
 * column gets it right without remembering to. The price is that the column
 * cannot be searched or sorted by value; nothing needs to.
 *
 * A value without the ciphertext prefix is a row written before the column
 * was encrypted. It is read as-is so a development database keeps working,
 * and `scripts/encrypt-legacy-names.ts` rewrites it.
 */
export const encryptedText = customType<{ data: string; driverData: string }>({
  dataType() {
    return "text";
  },
  toDriver(value) {
    return encryptSensitive(value);
  },
  fromDriver(value) {
    return value.startsWith("v1:") ? decryptSensitive(value) : value;
  },
});

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

/**
 * Reads a line back from the wire.
 *
 * Same EWKB shape as a point, with a four-byte count in front of the
 * coordinates. Small enough to read directly rather than pull in a parser, and
 * the alternative — `ST_AsGeoJSON` on every select — would mean every query
 * that touches the column has to remember to ask for it.
 */
function parseLineStringEwkb(hex: string): LngLat[] {
  const buffer = Buffer.from(hex, "hex");
  const littleEndian = buffer.readUInt8(0) === 1;

  const readU32 = (offset: number) =>
    littleEndian ? buffer.readUInt32LE(offset) : buffer.readUInt32BE(offset);
  const readF64 = (offset: number) =>
    littleEndian ? buffer.readDoubleLE(offset) : buffer.readDoubleBE(offset);

  const type = readU32(1);
  const hasSrid = (type & 0x20000000) !== 0;
  let offset = hasSrid ? 9 : 5;

  const count = readU32(offset);
  offset += 4;

  const points: LngLat[] = [];
  for (let index = 0; index < count; index += 1) {
    points.push({ x: readF64(offset), y: readF64(offset + 8) });
    offset += 16;
  }

  return points;
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
 * A stretch of road.
 *
 * A traffic report can be a point — a hole, a fallen tree — or a length of
 * road that is blocked or flooded, and those are different facts. A point
 * standing in for a stretch tells a driver the wrong thing twice: it hides how
 * much road is affected, and it puts the whole problem at one end of it.
 */
export const lineString = customType<{ data: LngLat[]; driverData: string }>({
  dataType() {
    return `geometry(LineString,${WGS84})`;
  },
  toDriver(value) {
    const points = value.map((point) => `${point.x} ${point.y}`).join(",");
    return `SRID=${WGS84};LINESTRING(${points})`;
  },
  fromDriver(value) {
    return parseLineStringEwkb(value);
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
