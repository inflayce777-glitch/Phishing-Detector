import templatesData from '@/data/threat_templates.json';

export interface ThreatTemplate {
  id: string;
  title: string;
  category: 'banking' | 'accounts' | 'delivery' | 'blackmail' | 'spam' | 'safe';
  categoryLabel: string;
  threatType: 'phishing' | 'spam' | 'safe';
  threatTypeLabel: string;
  mode: 'email' | 'messenger';
  senderEmail?: string;
  linkUrl?: string;
  text: string;
  description: string;
}

export const THREAT_CATEGORIES = templatesData.categories;
export const THREAT_TEMPLATES: ThreatTemplate[] = templatesData.templates as ThreatTemplate[];

export function getTemplatesByCategory(category: string): ThreatTemplate[] {
  if (category === 'all') return THREAT_TEMPLATES;
  return THREAT_TEMPLATES.filter(t => t.category === category);
}

export function searchTemplates(query: string, category: string = 'all'): ThreatTemplate[] {
  const normalized = query.toLowerCase().trim();
  const byCat = getTemplatesByCategory(category);
  if (!normalized) return byCat;
  
  return byCat.filter(t => 
    t.title.toLowerCase().includes(normalized) ||
    t.description.toLowerCase().includes(normalized) ||
    t.text.toLowerCase().includes(normalized) ||
    (t.senderEmail && t.senderEmail.toLowerCase().includes(normalized))
  );
}
