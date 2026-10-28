import { setup, assign, fromPromise } from 'xstate';
import { analyzeCoreHeuristics } from '../core/heuristics';
import { analyzeEmailAuthentication, EmailAuthResult } from '../core/emailAuth';
import { detectBrandImpersonation, BrandImpersonationResult } from '../core/typosquatting';

export type ScannerContext = {
  inputText: string;
  senderEmail: string;
  linkUrl: string;
  tokens: string[];
  threatScores: Record<string, number>;
  oracleScore?: number;
  oracleVerdict?: string;
  obfuscation?: {
    score: number;
    flags: string[];
  };
  isTrusted?: boolean;
  effectiveSender?: string;
  cleanText?: string;
  extractedIndicators?: {
    urls: string[];
    ips: string[];
  };
  vectors: Array<{
    id: string;
    trigger: string;
    score: number;
    color: string;
    explanation: string;
    sentences?: string[];
  }>;
  isSpam?: boolean;
  emailAuth?: EmailAuthResult | null;
  brandResults?: BrandImpersonationResult[];
  rdapResults?: Record<string, any>;
  safeBrowsingMatches?: any[];
  modelProgress: string;
};

export type ScannerEvent =
  | { type: 'START_SCAN'; payload: { text: string; senderEmail?: string; linkUrl?: string } }
  | { type: 'RENDER_COMPLETE' }
  | { type: 'RESET' }
  | { type: 'INFERENCE_DONE'; payload: any }
  | { type: 'INFERENCE_ERROR' };

const tokenizeTextActor = fromPromise(
  async ({ input }: { input: { text: string } }) => {
    return new Promise<{ tokens: string[] }>((resolve) => {
      setTimeout(() => {
        resolve({ tokens: input.text.split(/\s+/) });
      }, 300);
    });
  }
);

const runInferenceActor = fromPromise(
  async ({ input }: { input: any }) => {
    const text = input.tokens.join(' ');
    
    // 1. Run ultra-fast local heuristics
    const heuristics = analyzeCoreHeuristics(input.rawText || text, input.senderEmail, input.linkUrl);
    
    // 2. Fetch ML prediction from Python Backend
    let mlVerdict = null;
    let sentenceVerdicts: any[] = [];
    try {
      const textToAnalyze = heuristics.cleanText || input.rawText || text;
      // Split text into logical sentences
      const sentences = textToAnalyze.split(/(?<=[.!?])\s+/).map((s: string) => s.trim()).filter((s: string) => s.length > 5);
      const requestTexts = [textToAnalyze, ...sentences];

      const response = await fetch('/api/python-ml', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts: requestTexts })
      });
      if (response.ok) {
        const data = await response.json();
        if (data.verdicts && data.verdicts.length > 0) {
          mlVerdict = data.verdicts[0];
          sentenceVerdicts = data.verdicts.slice(1);
          
          // Inject Multilingual Zero-Shot Semantic Triggers from Sentence level!
          const aggregatedTriggers: Record<string, { score: number; sentences: string[] }> = {};
          
          // First, check the overall text (if it triggered something that didn't trigger in a specific sentence)
          if (mlVerdict.semantic_triggers) {
            mlVerdict.semantic_triggers.forEach((trigger: any) => {
              aggregatedTriggers[trigger.trigger] = { score: trigger.score, sentences: [] };
            });
          }
          
          // Now, aggregate matching sentences for each trigger
          sentenceVerdicts.forEach((sVerdict: any) => {
            if (sVerdict.semantic_triggers) {
              sVerdict.semantic_triggers.forEach((trigger: any) => {
                if (!aggregatedTriggers[trigger.trigger]) {
                  aggregatedTriggers[trigger.trigger] = { score: trigger.score, sentences: [] };
                }
                // Keep the max score
                if (trigger.score > aggregatedTriggers[trigger.trigger].score) {
                  aggregatedTriggers[trigger.trigger].score = trigger.score;
                }
                aggregatedTriggers[trigger.trigger].sentences.push(sVerdict.text);
              });
            }
          });

          // Push them into heuristics vectors
          Object.entries(aggregatedTriggers).forEach(([triggerName, data], index) => {
            const exists = heuristics.vectors.some(v => v.trigger.toLowerCase() === triggerName.toLowerCase());
            if (!exists) {
              heuristics.vectors.push({
                id: `semantic-${index}`,
                trigger: triggerName,
                score: data.score,
                explanation: `(ML-Детекція) Нейромережа виявила цей маніпулятивний патерн.`,
                color: '#9b59b6', // Purple to distinguish from Regex
                sentences: data.sentences // MAGIC: This allows UI highlighting!
              });
            }
          });
        }
      }
    } catch (e) {
      console.error("ML Backend error:", e);
    }
    
    // 3. Blend logic
    let finalScore = mlVerdict ? mlVerdict.phishing_probability : (heuristics.vectors.length > 0 ? Math.max(...heuristics.vectors.map(v => v.score)) : 0);
    
    // If Python ML is highly confident, add it as a vector
    if (mlVerdict && mlVerdict.phishing_probability > 0.6) {
      const hasHeuristics = heuristics.vectors.length > 0 || (heuristics.extractedIndicators.urls.length > 0);
      
      if (hasHeuristics) {
        heuristics.vectors.push({
          id: 'ml-1',
          trigger: mlVerdict.spam_match ? 'ML: підтверджений спам' : 'Глобальна ML-модель',
          score: mlVerdict.phishing_probability,
          explanation: mlVerdict.spam_match 
            ? `Знаходження в базі. Цей текст на ${(mlVerdict.best_spam_score * 100).toFixed(1)}% схожий на відомий спам з датасету (редагування оцінки на фішинг).`
            : 'Нейромережа підтверджує наявність фішингових патернів.',
          color: mlVerdict.spam_match ? '#f39c12' : '#ff003c'
        });
        if (mlVerdict.spam_match) {
           finalScore = Math.min(mlVerdict.phishing_probability, 0.45);
        }
      } else {
        // If ML flags it but NO heuristics/URLs found, it's likely spam/gibberish
        const cappedScore = Math.min(mlVerdict.phishing_probability, 0.45);
        heuristics.vectors.push({
          id: 'ml-1',
          trigger: mlVerdict.spam_match ? 'ML: підтверджений спам' : 'Аномальний текст (спам)',
          score: cappedScore,
          explanation: mlVerdict.spam_match
            ? `Цей текст на ${(mlVerdict.best_spam_score * 100).toFixed(1)}% ідентичний до відомого спаму з наших датасетів. Повідомлення не несе прямої фішингової загрози, але є сміттєвим.`
            : 'Текст не містить прямих загроз, але класифікований нейромережею як спам або беззмістовна аномалія.',
          color: '#f39c12'
        });
        finalScore = cappedScore; // Override the final score to prevent CRITICAL THREAT
      }
    }

    // Inject multilingual sentence highlights!
    if (sentenceVerdicts.length > 0) {
      // A sentence should only be treated as a contextual threat if:
      // 1. It matched an actual semantic threat trigger (urgency, authority, financial, danger) OR
      // 2. The full text itself is not benign (mlVerdict.phishing_probability > 0.35) and sentence has substantial length
      const maliciousSentences = sentenceVerdicts
        .filter((v: any) => {
          const hasSemanticTrigger = v.semantic_triggers && v.semantic_triggers.length > 0;
          const isHighProb = v.phishing_probability > 0.65 && v.text.trim().split(/\s+/).length >= 5;
          const isFullTextSuspicious = mlVerdict && mlVerdict.phishing_probability > 0.35;
          return hasSemanticTrigger || (isHighProb && isFullTextSuspicious);
        })
        .map((v: any) => v.text);
        
      if (maliciousSentences.length > 0) {
        const sentenceMaxScore = Math.min(Math.max(...sentenceVerdicts.map((v: any) => v.phishing_probability)), 0.85);
        heuristics.vectors.push({
          id: 'ml-sentence',
          trigger: 'ML-аналіз контексту',
          score: Math.max(sentenceMaxScore, 0.6),
          explanation: 'Штучний інтелект виявив маніпулятивний або фішинговий патерн безпосередньо у виділених реченнях.',
          color: '#ff4d4d',
          sentences: maliciousSentences
        });
        if (finalScore < 0.6 && mlVerdict && mlVerdict.phishing_probability > 0.35) {
          finalScore = 0.6;
        }
      }
    }

    // Dedicated Spam DB Match handler
    if (mlVerdict && mlVerdict.spam_match) {
      heuristics.vectors.push({
        id: 'ml-spam',
        trigger: 'ML: збіг зі спам-базою',
        score: Math.max(mlVerdict.best_spam_score, 0.6),
        explanation: `Семантичний збіг на ${(mlVerdict.best_spam_score * 100).toFixed(1)}% зі зразком із бази масових розсилок («${mlVerdict.best_spam_text.slice(0, 60)}...»).`,
        color: '#f39c12'
      });
      if (finalScore < 0.55) {
        finalScore = 0.55;
      }
    }

    // 3. Forensic Email Authentication (SPF, DKIM, DMARC Alignment, BEC Spoofing)
    const emailAuth = analyzeEmailAuthentication(input.rawText || text, input.senderEmail);

    // Live Server-Side DNS & Header Verification via /api/email-auth
    const effectiveSender = heuristics.effectiveSender || input.senderEmail || emailAuth.visibleFromDomain || '';
    const senderDomain = effectiveSender.includes('@') ? effectiveSender.split('@')[1] : effectiveSender;

    if (senderDomain && senderDomain.includes('.') && !senderDomain.includes('=')) {
      try {
        const authRes = await fetch('/api/email-auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            domain: senderDomain,
            senderEmail: effectiveSender,
            rawHeaders: input.rawText || text
          }),
          signal: AbortSignal.timeout(3500)
        });

        if (authRes.ok) {
          const liveAuth = await authRes.json();
          if (liveAuth.spf && liveAuth.spf.status !== 'none') {
            emailAuth.spf = liveAuth.spf;
          }
          if (liveAuth.dkim && liveAuth.dkim.status !== 'none') {
            emailAuth.dkim = liveAuth.dkim;
          }
          if (liveAuth.dmarc && liveAuth.dmarc.status !== 'none') {
            emailAuth.dmarc = liveAuth.dmarc;
          }
          if (liveAuth.isSpoofed) {
            emailAuth.isSpoofed = true;
            emailAuth.spoofingReason = liveAuth.spoofingReason;
          }
          emailAuth.hasHeaders = true;
        }
      } catch (e) {
        // Fallback gracefully if network call times out
      }
    }

    if (emailAuth.hasHeaders) {
      if (emailAuth.isSpoofed) {
        heuristics.vectors.push({
          id: 'email-spoofing',
          trigger: 'Спуфінг відправника (SPF/DKIM fail)',
          score: 0.95,
          explanation: emailAuth.spoofingReason || 'Виявлено фальсифікацію адреси відправника або провал DMARC Alignment.',
          color: '#ff003c'
        });
        finalScore = Math.max(finalScore, 0.95);
      } else if ((emailAuth.dmarc.status === 'pass' || emailAuth.dmarc.status === 'dns_active') && !emailAuth.isSpoofed) {
        heuristics.isTrusted = true;
      }
    }

    // 4. Brand Impersonation & RDAP Newly Registered Domain (NRD) Forensics
    const brandResults: BrandImpersonationResult[] = [];
    const rdapResults: Record<string, any> = {};

    const candidateUrls = [...(heuristics.extractedIndicators?.urls || [])];
    if (input.linkUrl && !candidateUrls.includes(input.linkUrl)) {
      const isPresentInContent = Boolean(
        (input.rawText && input.rawText.includes(input.linkUrl)) ||
        (text && text.includes(input.linkUrl))
      );
      if (isPresentInContent || candidateUrls.length === 0) {
        candidateUrls.push(input.linkUrl);
      }
    }

    const seenCandidateDomains = new Set<string>();

    for (const urlStr of candidateUrls) {
      const bRes = detectBrandImpersonation(urlStr);
      if (!bRes.candidateDomain || bRes.candidateDomain.includes('=') || !bRes.candidateDomain.includes('.')) continue;
      if (seenCandidateDomains.has(bRes.candidateDomain)) continue;
      seenCandidateDomains.add(bRes.candidateDomain);

      brandResults.push(bRes);

      if (bRes.isImpersonation) {
        const triggerPrefix = 
          bRes.technique === 'Visual Homoglyph' ? 'Оптичний гомогліф' :
          bRes.technique === 'Keyboard Proximity' ? 'Клавіатурний промах' :
          bRes.technique === 'Combosquatting' ? 'Комбосквотинг' :
          'Тайпосквотинг';

        heuristics.vectors.push({
          id: `typosquatting-${bRes.candidateDomain}`,
          trigger: `${triggerPrefix}: ${bRes.targetBrand?.name || 'бренд'}`,
          score: Math.max(bRes.similarityScore, 0.90),
          explanation: bRes.explanation,
          color: '#ff003c'
        });
        finalScore = Math.max(finalScore, bRes.similarityScore);
      }

      // Check RDAP for domain age
      try {
        const rdapResp = await fetch(`/api/rdap?domain=${encodeURIComponent(bRes.candidateDomain)}`);
        if (rdapResp.ok) {
          const rdapData = await rdapResp.json();
          rdapResults[bRes.candidateDomain] = rdapData;

          if (rdapData.isCritical0Day) {
            heuristics.vectors.push({
              id: `rdap-0day-${bRes.candidateDomain}`,
              trigger: 'Свіжий домен (0-day NRD)',
              score: 0.85,
              explanation: rdapData.details,
              color: '#ff003c'
            });
            finalScore = Math.max(finalScore, 0.85);
          } else if (rdapData.isNewlyRegistered) {
            heuristics.vectors.push({
              id: `rdap-nrd-${bRes.candidateDomain}`,
              trigger: 'Нещодавно створений домен (<30 днів)',
              score: 0.60,
              explanation: rdapData.details,
              color: '#f39c12'
            });
            finalScore = Math.max(finalScore, 0.60);
          }
        }
      } catch (err) {
        console.warn('RDAP check error:', err);
      }
    }

    if (heuristics.isTrusted) {
      finalScore = 0; // Trusted sender overrides ML hallucination
    }

    // 5. Query Safe Browsing, OpenPhish, PhishTank, and URLhaus feeds before finishing inference
    let safeBrowsingMatches: any[] = [];
    const candidateIps = heuristics.extractedIndicators?.ips || [];
    if (candidateUrls.length > 0 || candidateIps.length > 0) {
      try {
        const sbRes = await fetch('/api/safebrowsing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ urls: candidateUrls, ips: candidateIps }),
          signal: AbortSignal.timeout(4500)
        });
        if (sbRes.ok) {
          const sbData = await sbRes.json();
          if (Array.isArray(sbData.matches)) {
            safeBrowsingMatches = sbData.matches;
          }
        }
      } catch (e) {
        console.warn('SafeBrowsing check error:', e);
      }
    }

    const hasHardBlacklist = safeBrowsingMatches.some((m: any) =>
      m.threatType?.includes('NXDOMAIN') ||
      m.threatType?.includes('URLhaus') ||
      m.threatType?.includes('OpenPhish') ||
      m.threatType?.includes('PhishTank')
    );
    if (hasHardBlacklist) {
      finalScore = 1.0;
    }
    
    const hasSpamTriggers = heuristics.vectors.some(v => 
      (v.id && v.id.includes('spam')) || 
      (v.trigger && v.trigger.toLowerCase().includes('спам'))
    );
    const hasMaliciousUrls = heuristics.vectors.some(v => 
      v.id === 'safe-browsing' || (v.id === 'ml-url' && v.score > 0.6) || (v.id && v.id.startsWith('typosquatting')) || (v.id && v.id.startsWith('rdap-0day'))
    ) || safeBrowsingMatches.length > 0;

    const isSpam = Boolean(
      (mlVerdict?.spam_match || hasSpamTriggers) &&
      !hasMaliciousUrls &&
      finalScore >= 0.4 && finalScore <= 0.75
    );

    const oracleLabel = finalScore > 0.5 ? 'phishing' : 'safe';
    const oracleScore = finalScore > 0.5 ? finalScore : (1 - finalScore);
    
    return {
      results: heuristics.vectors,
      oracle: [{ label: oracleLabel, score: oracleScore }],
      obfuscation: heuristics.obfuscation,
      isTrusted: heuristics.isTrusted,
      isSpam,
      effectiveSender: heuristics.effectiveSender,
      cleanText: heuristics.cleanText,
      extractedIndicators: heuristics.extractedIndicators,
      emailAuth,
      brandResults,
      rdapResults,
      safeBrowsingMatches
    };
  }
);

export const phishingScannerMachine = setup({
  types: {
    context: {} as ScannerContext,
    events: {} as ScannerEvent,
  },
  actors: {
    tokenizeText: tokenizeTextActor,
    runInference: runInferenceActor,
  },
}).createMachine({
  id: 'phishingScanner',
  initial: 'idle',
  context: {
    inputText: '',
    senderEmail: '',
    linkUrl: '',
    tokens: [],
    threatScores: {},
    vectors: [],
    isSpam: false,
    emailAuth: null,
    brandResults: [],
    rdapResults: {},
    safeBrowsingMatches: [],
    modelProgress: '',
  },
  states: {
    idle: {
      on: {
        START_SCAN: {
          target: 'tokenizing',
          actions: assign({
            inputText: ({ event }) => event.payload.text,
            senderEmail: ({ event }) => event.payload.senderEmail || '',
            linkUrl: ({ event }) => event.payload.linkUrl || '',
            tokens: [],
            threatScores: {},
            vectors: [],
            isSpam: false,
            emailAuth: null,
            brandResults: [],
            rdapResults: {},
            safeBrowsingMatches: [],
            obfuscation: { score: 0, flags: [] },
            oracleVerdict: null as any,
            oracleScore: 0,
            extractedIndicators: { urls: [], ips: [] },
            isTrusted: false,
            modelProgress: () => 'Підготовка тексту...',
          }),
        },
      },
    },
    tokenizing: {
      invoke: {
        src: 'tokenizeText',
        input: ({ context }) => ({ text: context.inputText }),
        onDone: {
          target: 'inferencing',
          actions: assign({
            tokens: ({ event }) => event.output.tokens,
            modelProgress: () => 'Комплексний семантичний та інфраструктурний аналіз (ML, DNS, OpenPhish)...',
          }),
        },
        onError: 'idle',
      },
    },
    inferencing: {
      invoke: {
        src: 'runInference',
        input: ({ context }: any) => ({ 
          tokens: context.tokens,
          rawText: context.inputText,
          senderEmail: context.senderEmail,
          linkUrl: context.linkUrl
        }),
        onDone: {
          target: 'rendering_3d',
          actions: assign({
            modelProgress: () => 'Синтез фінальних результатів та XAI графу...',
            oracleVerdict: ({ event }) => event.output.oracle[0].label,
            oracleScore: ({ event }) => event.output.oracle[0].score,
            obfuscation: ({ event }) => event.output.obfuscation,
            extractedIndicators: ({ event }) => event.output.extractedIndicators,
            isTrusted: ({ event }) => event.output.isTrusted,
            isSpam: ({ event }) => Boolean(event.output.isSpam),
            emailAuth: ({ event }) => event.output.emailAuth,
            brandResults: ({ event }) => event.output.brandResults,
            rdapResults: ({ event }) => event.output.rdapResults,
            safeBrowsingMatches: ({ event }) => event.output.safeBrowsingMatches || [],
            senderEmail: ({ context, event }) => context.senderEmail || event.output.effectiveSender || '',
            effectiveSender: ({ event }) => event.output.effectiveSender,
            cleanText: ({ event }) => event.output.cleanText,
            vectors: ({ event }) => event.output.results.map((vec: any) => ({
              ...vec,
              color: vec.color || '#ffffff'
            }))
          })
        },
        onError: {
          target: 'idle',
        }
      }
    },
    rendering_3d: {
      after: {
        700: 'complete_with_xai',
      },
    },
    complete_with_xai: {
      on: {
        RESET: 'idle',
        START_SCAN: {
          target: 'tokenizing',
          actions: assign({
            inputText: ({ event }) => event.payload.text,
            senderEmail: ({ event }) => event.payload.senderEmail || '',
            linkUrl: ({ event }) => event.payload.linkUrl || '',
            tokens: [],
            threatScores: {},
            vectors: [],
            isSpam: false,
            emailAuth: null,
            brandResults: [],
            rdapResults: {},
            safeBrowsingMatches: [],
            obfuscation: { score: 0, flags: [] },
            oracleVerdict: null as any,
            oracleScore: 0,
            extractedIndicators: { urls: [], ips: [] },
            isTrusted: false,
            modelProgress: () => 'Підготовка тексту...',
          }),
        },
      },
    },
  },
});
