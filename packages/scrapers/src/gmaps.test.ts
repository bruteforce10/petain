import { describe, expect, test } from 'bun:test';
import type { Place } from '@terramap/types';
import { dedupePlaces, namesMatch } from './gmaps';

describe('namesMatch', () => {
  test('accepts identical names ignoring case and extra spaces', () => {
    expect(namesMatch('One Eighty  Coffee', 'one eighty coffee')).toBe(true);
  });

  test('accepts detail names that truncate the list suffix', () => {
    // Detail h1 "Kopi Toko Djawa" vs list card "Kopi Toko Djawa (Braga)".
    expect(namesMatch('Kopi Toko Djawa', 'Kopi Toko Djawa (Braga)')).toBe(true);
    expect(namesMatch('Kopi Toko Djawa (Braga)', 'Kopi Toko Djawa')).toBe(true);
  });

  test('rejects different places', () => {
    expect(namesMatch('One Eighty Coffee and Music', 'Two Cents')).toBe(false);
  });

  test('rejects empty input', () => {
    expect(namesMatch('', 'Two Cents')).toBe(false);
    expect(namesMatch(null, 'Two Cents')).toBe(false);
  });
});

describe('dedupePlaces', () => {
  const place = (over: Partial<Place>): Place => ({
    name: 'X',
    address: null,
    category: null,
    rating: null,
    review_count: null,
    lat: null,
    lng: null,
    maps_url: null,
    ...over,
  });

  test('keeps places with distinct name+address', () => {
    const out = dedupePlaces([
      place({ name: 'A Coffee', address: 'Jl. Satu No.1' }),
      place({ name: 'B Coffee', address: 'Jl. Dua No.2' }),
    ]);
    expect(out).toHaveLength(2);
  });

  test('collapses byte-identical name+address duplicates', () => {
    const out = dedupePlaces([
      place({ name: 'A Coffee', address: 'Jl. Satu No.1' }),
      place({ name: 'A Coffee', address: 'Jl. Satu No.1' }),
    ]);
    expect(out).toHaveLength(1);
  });
});
