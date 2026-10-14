/**
 * Universal MIME & Email Content Parser
 * Robust decoding for Base64 (UTF-8 safe), Quoted-Printable (multi-byte UTF-8 safe),
 * RFC 2047 encoded headers, and nested multipart/alternative/mixed structures.
 */

export interface ParsedEmailData {
  isMime: boolean;
  sender: string;
  subject: string;
  htmlBody: string;
  plainBody: string;
  displayText: string;
  extractedUrls: string[];
}

/**
 * Decodes RFC 2047 encoded words in email headers (e.g. =?UTF-8?B?...?= or =?UTF-8?Q?...?=)
 */
export function decodeRfc2047(header: string): string {
  if (!header || !header.includes('=?')) return header;
  
  // Unfold multi-line folded headers and normalize whitespace between adjacent encoded words
  const unfolded = header.replace(/\r?\n[\t ]+/g, ' ').replace(/\?=\s+=\?/g, '?==?');
  
  return unfolded.replace(/=\?([^?]+)\?([BQbq])\?([^?]+)\?=/g, (match, charset, encoding, content) => {
    try {
      const enc = encoding.toUpperCase();
      if (enc === 'B') {
        return decodeBase64(content, charset);
      } else if (enc === 'Q') {
        return decodeQuotedPrintable(content.replace(/_/g, ' '), charset);
      }
    } catch {
      return match;
    }
    return match;
  });
}

/**
 * Decodes Base64 into UTF-8 (or specified charset) string safely handling multi-byte characters
 */
export function decodeBase64(b64: string, charset = 'utf-8'): string {
  try {
    const clean = b64.replace(/[^A-Za-z0-9+/=]/g, '');
    if (!clean) return '';
    
    // In browser or node, decode base64 to binary bytes
    let binary = '';
    if (typeof atob === 'function') {
      binary = atob(clean);
    } else if (typeof Buffer !== 'undefined') {
      binary = Buffer.from(clean, 'base64').toString('binary');
    } else {
      return b64;
    }
    
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    
    return new TextDecoder(charset, { fatal: false }).decode(bytes);
  } catch {
    return b64;
  }
}

/**
 * Decodes Quoted-Printable strings safely assembling multi-byte UTF-8 sequences
 */
export function decodeQuotedPrintable(qp: string, charset = 'utf-8'): string {
  try {
    // 1. Remove soft line-breaks (=\r\n or =\n)
    const noSoftBreaks = qp.replace(/=\r?\n/g, '');
    
    // 2. Collect bytes
    const byteArray: number[] = [];
    let i = 0;
    while (i < noSoftBreaks.length) {
      if (noSoftBreaks[i] === '=' && i + 2 < noSoftBreaks.length && /^[0-9A-Fa-f]{2}$/.test(noSoftBreaks.substring(i + 1, i + 3))) {
        byteArray.push(parseInt(noSoftBreaks.substring(i + 1, i + 3), 16));
        i += 3;
      } else {
        byteArray.push(noSoftBreaks.charCodeAt(i));
        i++;
      }
    }
    
    const bytes = new Uint8Array(byteArray);
    return new TextDecoder(charset, { fatal: false }).decode(bytes);
  } catch {
    return qp;
  }
}

/**
 * Converts HTML into readable, formatted plain text with proper paragraph spacing
 */
export function htmlToPlainText(html: string): string {
  if (!html) return '';
  
  let text = html;
  
  // 1. Strip CSS, scripts, comments, head
  text = text.replace(/<!--[\s\S]*?-->/g, ' ');
  text = text.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, ' ');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ');
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ');
  
  // 2. Remove display:none hidden elements in DOM if available
  if (typeof window !== 'undefined' && typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'text/html');
      const hidden = doc.querySelectorAll('[style*="display:none"], [style*="display: none"]');
      hidden.forEach(el => el.remove());
      text = doc.body.innerHTML;
    } catch {}
  }
  
  // 3. Replace block and break elements with newlines
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/p>/gi, '\n\n');
  text = text.replace(/<\/div>/gi, '\n');
  text = text.replace(/<\/h[1-6]>/gi, '\n\n');
  text = text.replace(/<\/tr>/gi, '\n');
  text = text.replace(/<\/li>/gi, '\n');
  text = text.replace(/<hr\s*\/?>/gi, '\n---\n');
  
  // 4. Remove all remaining tags
  text = text.replace(/<[^>]+>/g, '');
  
  // 5. Decode HTML entities
  text = text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#x2F;/gi, '/');
  
  // 6. Normalize whitespace and empty lines
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\r/g, '');
  text = text.replace(/\n\s+\n/g, '\n\n');
  text = text.replace(/\n{3,}/g, '\n\n');
  
  return text.trim();
}

interface LeafMimePart {
  headers: string;
  body: string;
}

/**
 * Recursively parses MIME parts to handle nested multipart boundaries (e.g. multipart/mixed -> multipart/alternative)
 */
function extractAllParts(content: string, boundary?: string): LeafMimePart[] {
  let targetBoundary = boundary;
  if (!targetBoundary) {
    const boundaryMatch = content.match(/boundary=["']?([^"';\r\n]+)["']?/i);
    if (boundaryMatch && boundaryMatch[1]) {
      targetBoundary = boundaryMatch[1].trim();
    }
  }

  if (!targetBoundary) {
    const split = content.split(/\r?\n\r?\n/);
    if (split.length >= 2) {
      return [{ headers: split[0], body: split.slice(1).join('\n\n') }];
    }
    return [{ headers: '', body: content }];
  }

  const delimiter = '--' + targetBoundary;
  const rawParts = content.split(delimiter);
  const results: LeafMimePart[] = [];

  for (const part of rawParts) {
    const trimmed = part.trim();
    if (!trimmed || trimmed === '--' || trimmed.startsWith('--')) continue;

    const split = trimmed.split(/\r?\n\r?\n/);
    if (split.length < 2) continue;

    const partHeaders = split[0];
    const partBody = split.slice(1).join('\n\n');

    // Check for nested multipart boundary
    const nestedBoundaryMatch = partHeaders.match(/boundary=["']?([^"';\r\n]+)["']?/i);
    if (nestedBoundaryMatch && nestedBoundaryMatch[1]) {
      const nestedParts = extractAllParts(partBody, nestedBoundaryMatch[1].trim());
      results.push(...nestedParts);
    } else {
      results.push({ headers: partHeaders, body: partBody });
    }
  }

  return results;
}

/**
 * Universal MIME parser that handles multipart boundaries, base64, quoted-printable,
 * and extracts clean plain text, HTML, and sender metadata.
 */
export function parseMimeEmail(rawText: string, providedSender?: string): ParsedEmailData {
  if (!rawText || !rawText.trim()) {
    return {
      isMime: false,
      sender: providedSender || '',
      subject: '',
      htmlBody: '',
      plainBody: '',
      displayText: '',
      extractedUrls: []
    };
  }

  const isMime = /MIME-Version:|Content-Type:|Delivered-To:|Received:/i.test(rawText);
  let sender = (providedSender || '').trim();
  let subject = '';
  let htmlBody = '';
  let plainBody = '';
  
  if (!isMime) {
    // Check if rawText is standalone Base64 encoded payload
    const trimmed = rawText.trim();
    if (/^[A-Za-z0-9+/=\r\n\s]{60,}$/.test(trimmed) && trimmed.length % 4 === 0) {
      const decoded = decodeBase64(trimmed);
      if (decoded && decoded.length > 10) {
        return parseMimeEmail(decoded, providedSender);
      }
    }

    // Check if raw text is raw HTML
    const isHtml = /<html[\s\S]*?<\/html>|<body[\s\S]*?<\/body>|<div[\s\S]*?<\/div>/i.test(rawText);
    const displayText = isHtml ? htmlToPlainText(rawText) : rawText;

    return {
      isMime: false,
      sender,
      subject: '',
      htmlBody: isHtml ? rawText : '',
      plainBody: rawText,
      displayText: displayText,
      extractedUrls: extractUrlsFromText(rawText)
    };
  }
  
  // 1. Extract and decode Subject
  const subjectMatch = rawText.match(/(?:^|\n)Subject:\s*([^\r\n]+(?:\r?\n[\t ][^\r\n]+)*)/i);
  if (subjectMatch && subjectMatch[1]) {
    subject = decodeRfc2047(subjectMatch[1].trim());
  }
  
  // 2. Extract sender from headers if not provided
  if (!sender) {
    const fwdMatch = rawText.match(/(?:-{3,}\s*Forwarded message\s*-{3,}|Переслане повідомлення|Пересылаемое сообщение)[\s\S]*?(?:Від|From):\s*([^\r\n]+)/i);
    if (fwdMatch && fwdMatch[1]) {
      const decodedFwd = decodeRfc2047(fwdMatch[1]);
      const emailInFwd = decodedFwd.match(/<([^>]+)>/) || decodedFwd.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      if (emailInFwd) sender = emailInFwd[1];
    }
    
    if (!sender) {
      const fromMatch = rawText.match(/(?:^|\n)(?:From|Від):\s*([^\r\n]+)/i);
      if (fromMatch && fromMatch[1]) {
        const decodedFrom = decodeRfc2047(fromMatch[1]);
        const emailInFrom = decodedFrom.match(/<([^>]+)>/) || decodedFrom.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
        if (emailInFrom) sender = emailInFrom[1];
      }
    }
  }
  
  // 3. Extract all leaf parts (handles recursive multipart boundaries)
  const leafParts = extractAllParts(rawText);
  
  for (const part of leafParts) {
    const isHtml = /Content-Type:\s*text\/html/i.test(part.headers);
    const isPlain = /Content-Type:\s*text\/plain/i.test(part.headers);
    const isBase64 = /Content-Transfer-Encoding:\s*base64/i.test(part.headers);
    const isQp = /Content-Transfer-Encoding:\s*quoted-printable/i.test(part.headers);
    
    const charsetMatch = part.headers.match(/charset=["']?([^"';\r\n]+)["']?/i);
    const charset = charsetMatch ? charsetMatch[1] : 'utf-8';
    
    let decodedPart = part.body.trim();
    if (isBase64) {
      decodedPart = decodeBase64(decodedPart, charset);
    } else if (isQp) {
      decodedPart = decodeQuotedPrintable(decodedPart, charset);
    }
    
    if (isHtml && !htmlBody) {
      htmlBody = decodedPart;
    } else if (isPlain && !plainBody) {
      plainBody = decodedPart;
    }
  }
  
  // 4. Fallback if single part without explicit boundary
  if (!htmlBody && !plainBody) {
    const headerBodySplit = rawText.split(/\r?\n\r?\n/);
    if (headerBodySplit.length >= 2) {
      const headers = headerBodySplit[0];
      const body = headerBodySplit.slice(1).join('\n\n').trim();
      
      const isHtml = /Content-Type:\s*text\/html/i.test(headers);
      const isBase64 = /Content-Transfer-Encoding:\s*base64/i.test(headers);
      const isQp = /Content-Transfer-Encoding:\s*quoted-printable/i.test(headers);
      const charsetMatch = headers.match(/charset=["']?([^"';\r\n]+)["']?/i);
      const charset = charsetMatch ? charsetMatch[1] : 'utf-8';
      
      let decoded = body;
      if (isBase64) decoded = decodeBase64(body, charset);
      else if (isQp) decoded = decodeQuotedPrintable(body, charset);
      
      if (isHtml) htmlBody = decoded;
      else plainBody = decoded;
    }
  }
  
  // 5. Construct clean displayText
  let displayText = '';
  if (plainBody && plainBody.trim().length > 20) {
    displayText = plainBody;
  } else if (htmlBody) {
    displayText = htmlToPlainText(htmlBody);
  } else {
    // Strip email headers and boundaries from rawText
    displayText = decodeQuotedPrintable(rawText.replace(/^([a-zA-Z0-9\-]+):\s*[\s\S]*?(?=\n[A-Z][a-zA-Z\-]+:|\n\n|\n--)/gm, ''));
    displayText = displayText.replace(/--[\w\d_=+\-]+(?:--)?/g, '');
  }

  // 6. Check decoded plain/display text for forwarded message sender if still missing
  if (!sender) {
    const checkText = plainBody || displayText;
    const fwdMatch = checkText.match(/(?:-{3,}\s*Forwarded message\s*-{3,}|Переслане повідомлення|Пересылаемое сообщение)[\s\S]*?(?:Від|From):\s*([^\r\n]+)/i);
    if (fwdMatch && fwdMatch[1]) {
      const decodedFwd = decodeRfc2047(fwdMatch[1]);
      const emailInFwd = decodedFwd.match(/<([^>]+)>/) || decodedFwd.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      if (emailInFwd) sender = emailInFwd[1];
    }
  }

  // Normalize displayText
  displayText = displayText
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();
  
  // 7. Extract all URLs from all decoded sources
  const combinedForUrls = (htmlBody + ' ' + plainBody + ' ' + displayText + ' ' + rawText);
  const extractedUrls = extractUrlsFromText(combinedForUrls);
  
  return {
    isMime: true,
    sender,
    subject,
    htmlBody,
    plainBody,
    displayText,
    extractedUrls
  };
}

export function extractUrlsFromText(text: string): string[] {
  if (!text) return [];
  const urlRegex = /https?:\/\/[^\s<>"'{}|\\^`\[\]]+/gi;
  const matches = text.match(urlRegex) || [];
  const clean = matches.map(u => {
    return u
      .replace(/&amp;/gi, '&')
      .replace(/&#38;/gi, '&')
      .trim()
      .replace(/^[`'"]+|[`'"]+$/g, '')
      .replace(/[.,;:)\]}>`]+$/g, '');
  }).filter(u => u.length > 8);
  return Array.from(new Set(clean));
}
