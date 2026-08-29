import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.error(
    'Missing Supabase env vars. Copy .env.example to .env and fill in VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.'
  );
}

// Main client — used for the logged-in user's session throughout the app.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: 'pos-auth-main',
  },
});

// Secondary, isolated client — used ONLY when an owner/admin creates a new
// employee account (calls supabase.auth.signUp for someone else). Using a
// separate storage key means that signUp call does not overwrite the
// currently logged-in owner's session in this browser tab.
//
// NOTE: this is a stopgap for the "no backend yet" phase described in the
// project instructions. The correct long-term approach is a small backend
// (or Supabase Edge Function) that uses the service_role key server-side
// and calls supabase.auth.admin.createUser() so the new employee never
// touches the owner's session and doesn't need to verify their own email
// to be provisioned. Do not ship the service_role key to the browser.
export const supabaseAdminAction = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    storageKey: 'pos-auth-admin-action',
  },
});

export function extractStoragePath(url, bucket) {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${bucket}/`;
  const index = url.indexOf(marker);
  if (index !== -1) {
    return decodeURIComponent(url.slice(index + marker.length));
  }
  return null;
}

export async function deleteStorageFile(url, bucket) {
  const path = extractStoragePath(url, bucket);
  if (path) {
    const { error } = await supabase.storage.from(bucket).remove([path]);
    if (error) {
      console.error('Failed to delete storage file:', error.message);
    }
  }
}

export async function deleteStorageFiles(urls, bucket) {
  const paths = urls.map((url) => extractStoragePath(url, bucket)).filter(Boolean);
  if (paths.length > 0) {
    const { error } = await supabase.storage.from(bucket).remove(paths);
    if (error) {
      console.error('Failed to delete storage files:', error.message);
    }
  }
}
