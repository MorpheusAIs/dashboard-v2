import { createClient } from '@supabase/supabase-js';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_URL');
}
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Types based on our database schema
export interface BuilderDB {
  id: string;
  name: string;
  description: string | null;
  long_description: string | null;
  image_src: string | null;
  tags: string[] | null;
  github_url: string | null;
  twitter_url: string | null;
  discord_url: string | null;
  contributors: number;
  github_stars: number;
  reward_types: string[];
  reward_types_detail: string[];
  website: string | null;
  networks: string[];
  admin: string | null;
  created_at: string;
  updated_at: string;
} 