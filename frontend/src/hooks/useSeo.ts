import { useEffect } from 'react';

const SITE_URL = 'https://crowdbash.codingryder.com';
const DEFAULT_IMAGE = `${SITE_URL}/og.png`;

type JsonLd = Record<string, unknown> | Record<string, unknown>[];

interface SeoConfig {
  title?: string;
  description?: string;
  /** Path part of the canonical URL, e.g. "/games" or "/room/abc". Defaults to current location. */
  path?: string;
  /** Absolute or root-relative image URL. Defaults to /og.png. */
  image?: string;
  /** og:type — "website" (default) or "article". */
  type?: 'website' | 'article';
  /** Structured data — single object or array. Injected as <script type="application/ld+json">. */
  jsonLd?: JsonLd;
}

function setMeta(selector: string, attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

/**
 * Imperatively sync per-route SEO tags into <head>. Crowdbash is a SPA, so
 * the static index.html only has homepage defaults — every route component
 * calls this with its own values to keep titles, descriptions, OG tags, the
 * canonical URL and optional JSON-LD in step with what the user is seeing.
 */
export function useSeo(config: SeoConfig) {
  const { title, description, path, image, type = 'website', jsonLd } = config;

  useEffect(() => {
    if (title) document.title = title;

    const canonicalPath = path ?? window.location.pathname + window.location.search;
    const canonicalUrl = canonicalPath.startsWith('http')
      ? canonicalPath
      : `${SITE_URL}${canonicalPath.startsWith('/') ? '' : '/'}${canonicalPath}`;
    setLink('canonical', canonicalUrl);

    const imgUrl = image
      ? image.startsWith('http') ? image : `${SITE_URL}${image.startsWith('/') ? '' : '/'}${image}`
      : DEFAULT_IMAGE;

    if (description) {
      setMeta('meta[name="description"]', 'name', 'description', description);
      setMeta('meta[property="og:description"]', 'property', 'og:description', description);
      setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', description);
    }
    if (title) {
      setMeta('meta[property="og:title"]', 'property', 'og:title', title);
      setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', title);
    }
    setMeta('meta[property="og:url"]', 'property', 'og:url', canonicalUrl);
    setMeta('meta[name="twitter:url"]', 'name', 'twitter:url', canonicalUrl);
    setMeta('meta[property="og:type"]', 'property', 'og:type', type);
    setMeta('meta[property="og:image"]', 'property', 'og:image', imgUrl);
    setMeta('meta[name="twitter:image"]', 'name', 'twitter:image', imgUrl);
  }, [title, description, path, image, type]);

  // JSON-LD lifecycle: managed separately so it can be cleanly removed on
  // route change (otherwise stale schema lingers in <head> on the next page).
  useEffect(() => {
    if (!jsonLd) return;
    const el = document.createElement('script');
    el.type = 'application/ld+json';
    el.text = JSON.stringify(jsonLd);
    el.dataset.seo = 'route';
    document.head.appendChild(el);
    return () => {
      el.remove();
    };
    // Stringify the schema for the dep array so updates re-render the script.
  }, [jsonLd ? JSON.stringify(jsonLd) : null]); // eslint-disable-line react-hooks/exhaustive-deps
}
