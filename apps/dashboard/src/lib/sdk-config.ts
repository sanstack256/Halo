/**
 * Canonical configuration for the Halo SDK and documentation endpoints.
 * 
 * Production Ingestion Service: https://halo-trace-ten.vercel.app/api
 * Local Development: http://localhost:3000/api
 */
export const SDK_PUBLIC_ENDPOINT =
    process.env.NEXT_PUBLIC_HALO_ENDPOINT ||
    process.env.HALO_ENDPOINT ||
    "https://halo-trace-ten.vercel.app/api";
