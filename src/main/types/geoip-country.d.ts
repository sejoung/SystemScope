declare module 'geoip-country' {
  interface GeoIpCountryResult {
    range: [number, number]
    country: string
    name?: string
    native?: string
    continent?: string
    continent_name?: string
    capital?: string
    currency?: string[]
    languages?: string[]
    phone?: number[]
  }
  export function lookup(ip: string): GeoIpCountryResult | null
}
