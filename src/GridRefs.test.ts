import { describe, expect, test } from "vitest";

import {
  gridRefToWgs84,
  haversineMeters,
  isValidOsGridRef,
  parseGridRef,
  wgs84ToGridRef,
} from "./GridRefs";

describe("gridRefToWgs84", () => {
  const assertCalculatedValueCloseToExpectedValue = (
    gridRef: string,
    expected: { lat: number; lon: number },
    tolerance: number = 0.05,
  ) => {
    // ---------- Self-test ----------
    const got = gridRefToWgs84(gridRef);
    const dist = haversineMeters(expected.lat, expected.lon, got.lat, got.lon);
    console.log("Sample grid ref:", gridRef);
    console.log("E/N parsed:", parseGridRef(gridRef));
    console.log("Result (WGS84):", got);
    console.log("Expected (approx):", expected);
    console.log("Difference distance ≈", dist.toFixed(3), "m");
    // Expect difference << 1e-6 degrees (distance a few mm if same algorithm, or a couple of metres due to Helmert approximation).

    expect(dist).toBeLessThan(tolerance);
  };

  test("lat lon object fields not null", () => {
    const { lat, lon } = gridRefToWgs84("TL 44982 57869");
    expect(lat).not.toBeNull();
    expect(lon).not.toBeNull();
  });

  test("TL 44982 57869", () => {
    assertCalculatedValueCloseToExpectedValue("TL 44982 57869", {
      lat: 52.199991739388686,
      lon: 0.119989929973185,
    });
  });

  test("SU 123 456", () => {
    assertCalculatedValueCloseToExpectedValue("SU 123 456", {
      lat: 51.209476,
      lon: -1.8253031,
    });
  });

  test("TQ3838102501", () => {
    assertCalculatedValueCloseToExpectedValue("TQ3838102501", {
      lat: 50.805547,
      lon: -0.037451998,
    });
  });
});

describe("isValidOsGridRef", () => {
  test("TL 44982 57869", () => {
    expect(isValidOsGridRef("TL 44982 57869")).toBe(true);
  });

  test("SU 123 456", () => {
    expect(isValidOsGridRef("SU 123 456")).toBe(true);
  });

  test("TQ3838102501", () => {
    expect(isValidOsGridRef("TQ3838102501")).toBe(true);
  });

  test("TQ", () => {
    expect(isValidOsGridRef("TQ")).toBe(false);
  });

  test("empty grid reference", () => {
    expect(isValidOsGridRef("")).toBe(false);
  });

  test("383810250", () => {
    expect(isValidOsGridRef("TQ383810250")).toBe(false);
  });

  test("TQ383810250", () => {
    expect(isValidOsGridRef("TQ383810250")).toBe(false);
  });
});

describe("wgs84ToGridRef", () => {
  test("TL 44982 57869", () => {
    const result = wgs84ToGridRef(52.199991739388686, 0.119989929973185);
    expect(result).toBe("TL 44982 57869");
  });
  test("SU 123 456", () => {
    const result = wgs84ToGridRef(51.209476, -1.8253031);
    expect(result).toBe("SU 12300 45600");
  });
  test("TQ3838102501", () => {
    const result = wgs84ToGridRef(50.805547, -0.037451998);
    expect(result).toBe("TQ 38381 02501");
  });
  test("TQ38381025", () => {
    const result = wgs84ToGridRef(50.805547, -0.037451998);
    expect(result).toBe("TQ 38381 02501");
  });
  test("TL 44981 57869", () => {
    const result = wgs84ToGridRef(52.199992, 0.11997531);
    expect(result).toBe("TL 44981 57869");
  });
});
