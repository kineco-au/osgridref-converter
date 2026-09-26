// First-principles implementation (Airy 1830 / Transverse Mercator inverse / Helmert inverse)
// Uses OS constants and Helmert parameters from Ordnance Survey.

// ---------- Helpers ----------
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

const GRID_LETTERS = "ABCDEFGHJKLMNOPQRSTUVWXYZ"; // 'I' omitted

// Build table: map two-letter -> 100km origin (easting, northing)
function build100kTable() {
  const table: { [key: string]: { e0: number; n0: number } } = {}; // key: 'AA', value: {e0, n0}
  for (let i1 = 0; i1 < GRID_LETTERS.length; i1++) {
    for (let i2 = 0; i2 < GRID_LETTERS.length; i2++) {
      const L1 = GRID_LETTERS[i1];
      const L2 = GRID_LETTERS[i2];
      // OS forward formula for e100k, n100k (metres)
      const e100k = ((i1 % 5) * 5 + (i2 % 5)) * 100000 - 1000000;
      const n100k =
        ((4 - Math.floor(i1 / 5)) * 5 + (4 - Math.floor(i2 / 5))) * 100000 -
        500000;
      table[L1! + L2!] = { e0: e100k, n0: n100k };
    }
  }
  return table;
}
const TABLE_100K = build100kTable();

// Returns true if the string is a valid Ordnance Survey grid reference (two letters, even number of digits)
export function isValidOsGridRef(gridref: string) {
  if (typeof gridref !== "string") return false;
  const s = gridref.replace(/\s+/g, "").toUpperCase();
  // Two letters followed by an even number of digits (at least 2 digits)
  if (!/^[A-Z]{2}\d{2,10}$/.test(s)) return false;
  const digits = s.slice(2);
  if (digits.length % 2 !== 0) return false;
  // Check valid grid letters (no I)
  const l1 = GRID_LETTERS.indexOf(s.charAt(0));
  const l2 = GRID_LETTERS.indexOf(s.charAt(1));
  if (l1 === -1 || l2 === -1) return false;
  return true;
}

// Haversine distance (meters)
export function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) {
  const R = 6371000; // mean Earth radius (m) for distance estimate
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// ---------- Grid ref parsing ----------
// converts two-letter + digits form (e.g. "TL 44982 57869" or "TL4498257869") to numeric Easting/Northing
export function parseGridRef(gridRef: string) {
  const s = String(gridRef)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (s.length < 2) throw new Error("Grid ref too short");
  const letters = s.slice(0, 2);
  const two = TABLE_100K[letters];
  if (!two) throw new Error("Invalid grid letters: " + letters);

  const rem = s.slice(2);
  if (rem.length === 0) {
    return { easting: two.e0 + 50000, northing: two.n0 + 50000 };
  }
  if (rem.length % 2 !== 0)
    throw new Error("Odd number of digits in grid ref numeric part");
  const half = rem.length / 2;
  const eDigits = rem.slice(0, half);
  const nDigits = rem.slice(half);
  const scale = Math.pow(10, 5 - half);
  const e_within = eDigits ? parseInt(eDigits, 10) * scale : 0;
  const n_within = nDigits ? parseInt(nDigits, 10) * scale : 0;
  return { easting: two.e0 + e_within, northing: two.n0 + n_within };
}

// ---------- Transverse Mercator inverse (OSGB36, Airy 1830 ellipsoid) ----------
// Converts OS Easting/Northing -> latitude (rad) and longitude (rad) on OSGB36 (Airy)
export function osEastNorthToLatLonOSGB36(easting: number, northing: number) {
  // OS / Airy 1830 constants (Ordnance Survey)
  const a = 6377563.396;
  const b = 6356256.909;
  const F0 = 0.9996012717; // scale factor on central meridian
  const lat0 = toRad(49.0); // true origin latitude
  const lon0 = toRad(-2.0); // true origin longitude
  const N0 = -100000.0; // northing of true origin
  const E0 = 400000.0; // easting of true origin

  const e2 = (a * a - b * b) / (a * a);
  const n = (a - b) / (a + b);

  // meridional arc M(phi)
  function meridionalArc(phi: number) {
    const n2 = n * n;
    const n3 = n2 * n;
    const term1 = (1 + n + (5 / 4) * (n2 + n3)) * (phi - lat0);
    const term2 =
      (3 * n + 3 * n * n + (21 / 8) * n3) *
      Math.sin(phi - lat0) *
      Math.cos(phi + lat0);
    const term3 =
      (15 / 8) *
      (n2 + n3) *
      Math.sin(2 * (phi - lat0)) *
      Math.cos(2 * (phi + lat0));
    const term4 =
      (35 / 24) * n3 * Math.sin(3 * (phi - lat0)) * Math.cos(3 * (phi + lat0));
    return b * F0 * (term1 - term2 + term3 - term4);
  }

  // initial phi' (phiPrime) iterative solution
  let phiPrime = lat0;
  let M = 0;
  // iterate until N - N0 - M is small
  for (let i = 0; i < 10; i++) {
    M = meridionalArc(phiPrime);
    const phiNext = (northing - N0 - M) / (a * F0) + phiPrime;
    if (Math.abs(phiNext - phiPrime) < 1e-12) {
      phiPrime = phiNext;
      break;
    }
    phiPrime = phiNext;
  }

  const nu = (a * F0) / Math.sqrt(1 - e2 * Math.sin(phiPrime) ** 2);
  const rho =
    (a * F0 * (1 - e2)) / Math.pow(1 - e2 * Math.sin(phiPrime) ** 2, 1.5);
  const eta2 = nu / rho - 1;

  const tanPhi = Math.tan(phiPrime);
  const tan2 = tanPhi * tanPhi;
  const secPhi = 1 / Math.cos(phiPrime);

  // Coefficients from OS's inverse series (Annex C)
  const VII = tanPhi / (2 * rho * nu);
  const VIII =
    (tanPhi / (24 * rho * Math.pow(nu, 3))) *
    (5 + 3 * tan2 + eta2 - 9 * eta2 * tan2);
  const IX =
    (tanPhi / (720 * rho * Math.pow(nu, 5))) *
    (61 + 90 * tan2 + 45 * tan2 * tan2);
  const X = secPhi / nu;
  const XI = (secPhi / (6 * Math.pow(nu, 3))) * (nu / rho + 2 * tan2);
  const XII =
    (secPhi / (120 * Math.pow(nu, 5))) * (5 + 28 * tan2 + 24 * tan2 * tan2);
  const XIIA =
    (secPhi / (5040 * Math.pow(nu, 7))) *
    (61 + 662 * tan2 + 1320 * tan2 * tan2 + 720 * tan2 * tan2 * tan2);

  const dE = easting - E0;
  const dE2 = dE * dE;
  const dE3 = dE2 * dE;
  const dE4 = dE3 * dE;
  const dE5 = dE4 * dE;
  const dE6 = dE5 * dE;
  const dE7 = dE6 * dE;

  const lat = phiPrime - VII * dE2 + VIII * dE4 - IX * dE6;
  const lon = lon0 + X * dE - XI * dE3 + XII * dE5 - XIIA * dE7;

  return { latRad: lat, lonRad: lon };
}

// ---------- Datum transform (OSGB36 -> WGS84) using Helmert inverse ----------
// Uses the inverse of OS's table (i.e. change signs) so we transform from OSGB36 -> WGS84.
// OS table (WGS84 -> OSGB36) and notation is in the OS guide; small-transform inverse is achieved by negating.
// See OS Guide Annex (parameters and warning about OSTN15 for higher accuracy). 2
export function helmertOsToWgs(x: number, y: number, z: number) {
  // (these are the inverse-signed parameters to go from OSGB36 -> WGS84)
  const tx = 446.448; // metres
  const ty = -125.157;
  const tz = 542.06;
  const s_ppm = -20.4894; // ppm (negated from table), unitless scale = s_ppm * 1e-6
  const s = s_ppm * 1e-6;
  // rotations in arc-seconds -> radians
  const rx = (0.1502 / 3600) * (Math.PI / 180);
  const ry = (0.247 / 3600) * (Math.PI / 180);
  const rz = (0.8421 / 3600) * (Math.PI / 180);

  const x2 = tx + (1 + s) * x - rz * y + ry * z;
  const y2 = ty + rz * x + (1 + s) * y - rx * z;
  const z2 = tz - ry * x + rx * y + (1 + s) * z;
  return { x: x2, y: y2, z: z2 };
}

// ---------- Helmert transform (WGS84 -> OSGB36) ----------
export function helmertWgsToOs(x: number, y: number, z: number) {
  // Parameters from OS guide: WGS84 -> OSGB36 (units: m, s, ppm)
  const tx = -446.448;
  const ty = 125.157;
  const tz = -542.06;
  const s_ppm = 20.4894; // scale in ppm
  const s = s_ppm * 1e-6;
  const rx = ((-0.1502 / 3600) * Math.PI) / 180; // radians
  const ry = ((-0.247 / 3600) * Math.PI) / 180;
  const rz = ((-0.8421 / 3600) * Math.PI) / 180;

  const x2 = tx + (1 + s) * x + -rz * y + ry * z;
  const y2 = ty + rz * x + (1 + s) * y + -rx * z;
  const z2 = tz + -ry * x + rx * y + (1 + s) * z;
  return { x: x2, y: y2, z: z2 };
}

// convert geodetic -> cartesian for given ellipsoid (a,b)
export function latLonToCartesian(
  phi: number,
  lambda: number,
  h: number,
  a: number,
  b: number,
) {
  const e2 = (a * a - b * b) / (a * a);
  const nu = a / Math.sqrt(1 - e2 * Math.sin(phi) ** 2);
  const x = (nu + h) * Math.cos(phi) * Math.cos(lambda);
  const y = (nu + h) * Math.cos(phi) * Math.sin(lambda);
  const z = ((1 - e2) * nu + h) * Math.sin(phi);
  return { x, y, z };
}

// ---------- Forward Transverse Mercator (OSGB36) ----------
export function latLonToOsEastNorth(latRad: number, lonRad: number) {
  // OSGB36 / Airy 1830 constants
  const a = 6377563.396;
  const b = 6356256.909;
  const F0 = 0.9996012717;
  const lat0 = toRad(49.0);
  const lon0 = toRad(-2.0);
  const N0 = -100000.0;
  const E0 = 400000.0;

  const e2 = (a * a - b * b) / (a * a);
  const n = (a - b) / (a + b);

  function meridionalArc(phi: number) {
    const n2 = n * n;
    const n3 = n2 * n;
    const term1 = (1 + n + (5 / 4) * (n2 + n3)) * (phi - lat0);
    const term2 =
      (3 * n + 3 * n2 + (21 / 8) * n3) *
      Math.sin(phi - lat0) *
      Math.cos(phi + lat0);
    const term3 =
      (15 / 8) *
      (n2 + n3) *
      Math.sin(2 * (phi - lat0)) *
      Math.cos(2 * (phi + lat0));
    const term4 =
      (35 / 24) * n3 * Math.sin(3 * (phi - lat0)) * Math.cos(3 * (phi + lat0));
    return b * F0 * (term1 - term2 + term3 - term4);
  }

  const nu = (a * F0) / Math.sqrt(1 - e2 * Math.sin(latRad) ** 2);
  const rho =
    (a * F0 * (1 - e2)) / Math.pow(1 - e2 * Math.sin(latRad) ** 2, 1.5);
  const eta2 = nu / rho - 1;

  const M = meridionalArc(latRad);
  const dLon = lonRad - lon0;
  const cosLat = Math.cos(latRad);
  const sinLat = Math.sin(latRad);
  const tanLat = Math.tan(latRad);

  const I = M + N0;
  const II = (nu / 2) * sinLat * cosLat;
  const III =
    (nu / 24) * sinLat * Math.pow(cosLat, 3) * (5 - tanLat * tanLat + 9 * eta2);
  const IIIA =
    (nu / 720) *
    sinLat *
    Math.pow(cosLat, 5) *
    (61 - 58 * tanLat * tanLat + Math.pow(tanLat, 4));
  const IV = nu * cosLat;
  const V = (nu / 6) * Math.pow(cosLat, 3) * (nu / rho - tanLat * tanLat);
  const VI =
    (nu / 120) *
    Math.pow(cosLat, 5) *
    (5 -
      18 * tanLat * tanLat +
      Math.pow(tanLat, 4) +
      14 * eta2 -
      58 * eta2 * tanLat * tanLat);

  const N =
    I + II * dLon * dLon + III * Math.pow(dLon, 4) + IIIA * Math.pow(dLon, 6);
  const E = E0 + IV * dLon + V * Math.pow(dLon, 3) + VI * Math.pow(dLon, 5);

  return { easting: E, northing: N };
}

// convert cartesian -> geodetic (lat/lon) via iteration (simple Newton)
export function cartesianToLatLon(
  x: number,
  y: number,
  z: number,
  a: number,
  b: number,
) {
  const e2 = (a * a - b * b) / (a * a);
  const p = Math.sqrt(x * x + y * y);
  // initial guess
  let phi = Math.atan2(z, p * (1 - e2));
  for (let i = 0; i < 20; i++) {
    const nu = a / Math.sqrt(1 - e2 * Math.sin(phi) ** 2);
    const phiNext = Math.atan2(z + e2 * nu * Math.sin(phi), p);
    if (Math.abs(phiNext - phi) < 1e-14) {
      phi = phiNext;
      break;
    }
    phi = phiNext;
  }
  const lambda = Math.atan2(y, x);
  const nuFinal = a / Math.sqrt(1 - e2 * Math.sin(phi) ** 2);
  const h = p / Math.cos(phi) - nuFinal;
  return { latRad: phi, lonRad: lambda, height: h };
}

/** Format numeric Easting/Northing -> grid ref string like "RL 44981 57869".
 *  digits = total numeric digits (2..10, even). default 10 (5+5).
 *  Accepts negative E (valid west of false origin).
 */
function eastingNorthingToGridRef(e: number, n: number, digits = 10) {
  if (!Number.isFinite(e) || !Number.isFinite(n))
    throw new Error("Easting/Northing must be numbers");
  if (digits % 2 !== 0 || digits < 2 || digits > 10)
    throw new Error("digits must be even 2..10");

  // find the 100km square that contains E,N (robust against negative E)
  let found = null;
  for (const [letters, origin] of Object.entries(TABLE_100K)) {
    if (
      e >= origin.e0 &&
      e < origin.e0 + 100000 &&
      n >= origin.n0 &&
      n < origin.n0 + 100000
    ) {
      found = { letters, e0: origin.e0, n0: origin.n0 };
      break;
    }
  }
  if (!found) return null; // outside grid

  const half = digits / 2;
  const factor = Math.pow(10, 5 - half);
  // round to nearest within-square metre *before* scaling to digits
  const ewithinMetres = Math.round(e - found.e0);
  const nwithinMetres = Math.round(n - found.n0);

  const eDigits = String(Math.floor(ewithinMetres / factor)).padStart(
    half,
    "0",
  );
  const nDigits = String(Math.floor(nwithinMetres / factor)).padStart(
    half,
    "0",
  );

  return `${found.letters} ${eDigits} ${nDigits}`;
}

// Convert OS Easting/Northing directly to WGS84 lat/lon (decimal degrees)
export function osGridToWgs84(easting: number, northing: number) {
  // 1) inverse projection (OSGB36 ellipsoid: Airy 1830)
  const { latRad: osLat, lonRad: osLon } = osEastNorthToLatLonOSGB36(
    easting,
    northing,
  );

  // 2) geodetic -> cartesian (Airy)
  const airyA = 6377563.396,
    airyB = 6356256.909;
  const cart = latLonToCartesian(osLat, osLon, 0, airyA, airyB);

  // 3) Helmert transform to WGS84 (approx.)
  const cartW = helmertOsToWgs(cart.x, cart.y, cart.z);

  // 4) cartesian -> geodetic (WGS84 / GRS80-type a/b)
  const wgsA = 6378137.0,
    wgsB = 6356752.3141;
  const { latRad, lonRad } = cartesianToLatLon(
    cartW.x,
    cartW.y,
    cartW.z,
    wgsA,
    wgsB,
  );

  return { lat: toDeg(latRad), lon: toDeg(lonRad) };
}

export function wgs84ToGridRef(latDeg: number, lonDeg: number, digits = 10) {
  // WGS84 ellipsoid
  const wgsA = 6378137.0;
  const wgsB = 6356752.3141;

  // 1) WGS84 geodetic -> Cartesian
  const wgsCart = latLonToCartesian(
    toRad(latDeg),
    toRad(lonDeg),
    0,
    wgsA,
    wgsB,
  );

  // 2) Helmert transform to OSGB36 Cartesian
  const airyCart = helmertWgsToOs(wgsCart.x, wgsCart.y, wgsCart.z);

  // 3) Cartesian -> OSGB36 geodetic
  const airyA = 6377563.396;
  const airyB = 6356256.909;
  const { latRad: osLat, lonRad: osLon } = cartesianToLatLon(
    airyCart.x,
    airyCart.y,
    airyCart.z,
    airyA,
    airyB,
  );

  // 4) Forward projection to Easting/Northing
  const { easting, northing } = latLonToOsEastNorth(osLat, osLon);

  // 5) Format grid reference
  return eastingNorthingToGridRef(easting, northing, digits);
}

// ---------- Convenience top-level function ----------
// Accepts gridref (string) OR two-numbers array OR {easting, northing}
export function gridRefToWgs84(gridref: string) {
  const { easting, northing } = parseGridRef(gridref);
  return osGridToWgs84(easting, northing);
}
