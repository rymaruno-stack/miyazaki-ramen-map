const SUPABASE_URL = "https://hqedufwlrmqiygoqqfkw.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxZWR1Zndscm1xaXlnb3FxZmt3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2ODQzODUsImV4cCI6MjA5MjI2MDM4NX0.PY_hquFX4AJZAzftr-lTkgkdyR_O2NKKIoFFb08PMVs";

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
