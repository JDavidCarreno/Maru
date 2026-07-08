/**
 * supabase.js — configuración de conexión con Supabase.
 * Reemplazá los valores de SUPABASE_URL y SUPABASE_ANON_KEY con los tuyos.
 */

const SUPABASE_URL = "https://krvuetcsfwfvjunqujtc.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtydnVldGNzZndmdmp1bnF1anRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0NTk1NTUsImV4cCI6MjA5OTAzNTU1NX0.WjRrxp5GXWOcCnoyoOCH_XIRk7noQMmAsFhDH9wLrb4";

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
