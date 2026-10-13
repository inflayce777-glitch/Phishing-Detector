/**
 * Client-Optimized Trusted Domains & Apex Infrastructure Matrix
 * Ultra-lightweight (<5 KB) bundle designed for client-side zero-latency execution.
 * Full 150,000+ domain dataset is delegated to server-side `trustedDomainsServer.ts`.
 */

export const TRUSTED_APEX_DOMAINS = new Set([
  // Google & Workspace
  'google.com',
  'googleusercontent.com',
  'gstatic.com',
  'c.gle',
  'goo.gl',
  'youtube.com',
  'youtu.be',
  'gmail.com',

  // Microsoft & Office
  'microsoft.com',
  'microsoftonline.com',
  'office.com',
  'live.com',
  'outlook.com',
  'windows.net',
  'azure.com',
  'msn.com',

  // Apple & Cloud
  'apple.com',
  'icloud.com',
  'me.com',

  // Ukrainian Government & Defense
  'diia.gov.ua',
  'gov.ua',
  'mil.gov.ua',
  'mod.gov.ua',
  'zsu.gov.ua',
  '33polk.army',
  'mvs.gov.ua',
  'hsc.gov.ua',
  'court.gov.ua',
  'rada.gov.ua',
  'president.gov.ua',

  // Ukrainian Banking & Finance
  'privatbank.ua',
  'privat24.ua',
  'pb.ua',
  'monobank.ua',
  'mono.me',
  'oschadbank.ua',
  'raiffeisen.ua',
  'aval.ua',
  'pumb.ua',
  'ukrsibbank.com',
  'sensebank.com.ua',
  'bank.gov.ua',

  // Global Finance & Crypto
  'paypal.com',
  'paypal.me',
  'binance.com',
  'binance.info',
  'stripe.com',
  'visa.com',
  'mastercard.com',

  // Logistics & E-Commerce (UA & Global)
  'novaposhta.ua',
  'novapost.com',
  'ukrposhta.ua',
  'olx.ua',
  'rozetka.com.ua',
  'rozetka.ua',
  'prom.ua',
  'amazon.com',
  'amazonaws.com',
  'ebay.com',

  // Communication & Tech
  'telegram.org',
  't.me',
  'meta.com',
  'facebook.com',
  'instagram.com',
  'whatsapp.com',
  'fb.com',
  'github.com',
  'gitlab.com',
  'stackoverflow.com',
  'wikipedia.org',
  'wikimedia.org',
  'ukr.net'
]);

// Shared hosting / free subdomains where anyone can deploy apps - these must NOT inherit trust from apex!
export const UNTRUSTED_PUBLIC_SUFFIXES = new Set([
  'workers.dev',
  'pages.dev',
  'firebaseapp.com',
  'web.app',
  'github.io',
  'gitlab.io',
  'ngrok.io',
  'herokuapp.com',
  'vercel.app',
  'netlify.app',
  'glitch.me',
  'render.com',
  'railway.app'
]);

export function isTrustedDomain(hostnameOrUrl: string): boolean {
  if (!hostnameOrUrl) return false;
  let host = hostnameOrUrl.toLowerCase().trim();

  if (host.includes('://')) {
    try {
      const u = new URL(host);
      host = u.hostname.toLowerCase();
    } catch {
      return false;
    }
  }

  // Remove trailing dots or ports
  host = host.split(':')[0].replace(/\.+$/, '');

  // 1. Direct or subdomain match against globally verified infrastructure providers
  for (const apex of TRUSTED_APEX_DOMAINS) {
    if (host === apex || host.endsWith('.' + apex)) {
      return true;
    }
  }

  // 2. Reject public suffix / free deployment subdomains from inheriting general whitelist trust
  for (const suffix of UNTRUSTED_PUBLIC_SUFFIXES) {
    if (host === suffix || host.endsWith('.' + suffix)) {
      return false;
    }
  }

  return false;
}
