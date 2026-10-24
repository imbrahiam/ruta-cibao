/** Decode a Google encoded polyline (precision 5), rejecting corrupt geometry. */
export function decodePolyline(
  encoded: string,
): Array<{ lat: number; lng: number }> {
  const path: Array<{ lat: number; lng: number }> = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  const delta = () => {
    let result = 0;
    let shift = 0;
    while (true) {
      if (index >= encoded.length || shift > 30)
        throw new Error("Invalid encoded polyline");
      const byte = encoded.charCodeAt(index++) - 63;
      if (byte < 0 || byte > 63) throw new Error("Invalid encoded polyline");
      result += (byte & 31) * 2 ** shift;
      if (byte < 32) break;
      shift += 5;
    }
    return result % 2 === 1 ? -(Math.floor(result / 2) + 1) : result / 2;
  };

  while (index < encoded.length) {
    lat += delta();
    lng += delta();
    if (Math.abs(lat) > 9_000_000 || Math.abs(lng) > 18_000_000) {
      throw new Error("Encoded polyline coordinate out of range");
    }
    path.push({ lat: lat / 100_000, lng: lng / 100_000 });
  }
  return path;
}
