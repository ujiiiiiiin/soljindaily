import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    'Supabase 환경변수가 없습니다. VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY 를 .env.local(로컬) 또는 Vercel 프로젝트 설정에 추가하세요.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);
