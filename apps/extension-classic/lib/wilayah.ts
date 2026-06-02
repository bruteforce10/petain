import provinces from './data/provinces.json';
import regencies from './data/regencies.json';
import districts from './data/districts.json';

export interface Province { id: string; name: string }
export interface Regency { id: string; name: string; province_id: string }
export interface District { id: string; name: string; regency_id: string }

export function getProvinces(): Province[] {
  return provinces as Province[];
}

export function getRegenciesByProvince(provinceId: string): Regency[] {
  return (regencies as Regency[]).filter((r) => r.province_id === provinceId);
}

export function getDistrictsByRegency(regencyId: string): District[] {
  return (districts as District[]).filter((d) => d.regency_id === regencyId);
}
