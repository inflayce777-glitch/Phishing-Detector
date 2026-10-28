import trustedDomainsList from './trusted_domains.json';
import { TRUSTED_APEX_DOMAINS, UNTRUSTED_PUBLIC_SUFFIXES } from './trustedDomains';

// Loaded once in server Node.js memory - NEVER bundled to the browser client!
const SERVER_TRUSTED_DOMAINS_SET = new Set(trustedDomainsList as string[]);

export function isServerTrustedDomain(hostnameOrUrl: string): boolean {
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

  // 1. REJECT public suffix / free deployment subdomains FIRST!
  for (const suffix of UNTRUSTED_PUBLIC_SUFFIXES) {
    if (host === suffix || host.endsWith('.' + suffix)) {
      return false;
    }
  }

  // 2. Direct or subdomain match against globally verified infrastructure providers
  for (const apex of TRUSTED_APEX_DOMAINS) {
    if (host === apex || host.endsWith('.' + apex)) {
      return true;
    }
  }

  // 3. Exact match in 150,000 top Alexa/Tranco domains list
  if (SERVER_TRUSTED_DOMAINS_SET.has(host)) {
    return true;
  }

  // 4. Subdomain match against 150,000 top domains (only if candidate is not in UNTRUSTED_PUBLIC_SUFFIXES)
  const parts = host.split('.');
  for (let i = 1; i < parts.length - 1; i++) {
    const candidate = parts.slice(i).join('.');
    if (UNTRUSTED_PUBLIC_SUFFIXES.has(candidate)) {
      return false;
    }
    if (SERVER_TRUSTED_DOMAINS_SET.has(candidate)) {
      return true;
    }
  }

  return false;
}
