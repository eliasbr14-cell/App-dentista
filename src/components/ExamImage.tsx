import { useEffect, useState, type ImgHTMLAttributes } from 'react';
import { supabase } from '../supabase';

// Os raios-X ficam privados no servidor; geramos um link temporário (1h) para exibir.
const cache = new Map<string, { url: string; exp: number }>();

export async function signedUrl(path: string): Promise<string> {
  if (path.startsWith('data:') || path.startsWith('http')) return path;
  const hit = cache.get(path);
  if (hit && hit.exp > Date.now()) return hit.url;
  const { data, error } = await supabase.storage.from('exames').createSignedUrl(path, 3600);
  if (error || !data) throw error ?? new Error('sem url');
  cache.set(path, { url: data.signedUrl, exp: Date.now() + 50 * 60 * 1000 });
  return data.signedUrl;
}

export function useImageUrl(path?: string) {
  const [url, setUrl] = useState<string | null>(() => {
    if (!path) return null;
    if (path.startsWith('data:') || path.startsWith('http')) return path;
    const hit = cache.get(path);
    return hit && hit.exp > Date.now() ? hit.url : null;
  });
  useEffect(() => {
    let ok = true;
    if (path) signedUrl(path).then((u) => ok && setUrl(u)).catch(() => ok && setUrl(null));
    return () => {
      ok = false;
    };
  }, [path]);
  return url;
}

export function ExamImage({ path, ...rest }: { path: string } & ImgHTMLAttributes<HTMLImageElement>) {
  const url = useImageUrl(path);
  if (!url) return <span className={`img-loading ${rest.className ?? ''}`} />;
  return <img src={url} {...rest} />;
}
