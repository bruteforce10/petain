import { describe, expect, test } from 'bun:test';
import { passesGeofence } from './area';

describe('passesGeofence', () => {
  test('keeps rows whose address is null (membership unknowable)', () => {
    expect(passesGeofence(null, ['Coblong', 'Kota Bandung'])).toBe(true);
    expect(passesGeofence(undefined, ['Coblong'])).toBe(true);
  });

  test('keeps street-only list-pass addresses that carry no area info', () => {
    // List cards render only "Jl. X No.N" — the kecamatan appears solely in the
    // detail panel. A row that failed enrichment must not be silently dropped.
    expect(passesGeofence('Jl. Ganesha No.3', ['Coblong', 'Kota Bandung'])).toBe(true);
  });

  test('keeps full addresses that contain a filter term', () => {
    expect(
      passesGeofence(
        'Jl. Ganesha No.3, Lb. Siliwangi, Kecamatan Coblong, Kota Bandung, Jawa Barat 40132',
        ['Coblong', 'Kota Bandung', 'Jawa Barat'],
      ),
    ).toBe(true);
  });

  test('rejects full addresses that match no filter term', () => {
    expect(
      passesGeofence(
        'Jl. Asia Afrika No.8, Braga, Kecamatan Sumur Bandung, Kota Bandung, Jawa Barat',
        ['Pondok Aren', 'Kota Tangerang Selatan'],
      ),
    ).toBe(false);
  });

  test('matches Indonesian abbreviations (Kec. Pd. Aren vs Pondok Aren)', () => {
    expect(
      passesGeofence('Jl. Raya No.1, Kec. Pd. Aren, Kota Tangerang Selatan', ['Pondok Aren']),
    ).toBe(true);
  });

  test('strips Kabupaten/Kota prefix from filter terms', () => {
    expect(
      passesGeofence('Jl. Merdeka No.2, Kecamatan Regol, Bandung, Jawa Barat', ['Kota Bandung']),
    ).toBe(true);
  });
});
