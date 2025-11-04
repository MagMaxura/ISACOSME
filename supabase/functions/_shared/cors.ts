// supabase/functions/_shared/cors.ts

// These are standard CORS headers. You can customize them as needed for security.
// The 'OPTIONS' preflight request will be handled with these headers.
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
