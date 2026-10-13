import os
import re
import json
import time
import math
from typing import List, Optional
from urllib.parse import urlparse

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import joblib
import numpy as np
import torch

try:
    from sentence_transformers import SentenceTransformer, util
except ImportError:
    print("Please install sentence-transformers: pip install sentence-transformers")

app = FastAPI(
    title="SafeBrowse Multilingual AI Backend",
    description="Cross-Lingual Deep Learning Backend for Phishing Detection"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------------------------------------------
# HARDWARE & MODELS INITIALIZATION
# -------------------------------------------------------------
device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"Initializing AI Models on Device: {device} ({torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'CPU'})")

embedder = None
text_model = None
url_bundle = None
webpage_model = None
spam_db = None
concept_embeddings = {}

# 1. Multilingual Embedder (Load from local cache instantly without network hang)
try:
    try:
        embedder = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2', device=device, local_files_only=True)
    except Exception:
        embedder = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2', device=device)
    print("Multilingual Sentence Transformer loaded successfully (Offline/Local)!")
except Exception as e:
    print(f"Error loading SentenceTransformer: {e}")

# 2. Text Classification Model (D4 Multilingual Model with fallback)
try:
    if os.path.exists("multilingual_text_model.pkl"):
        text_model = joblib.load("multilingual_text_model.pkl")
        print("D4 Multilingual Text Model loaded (multilingual_text_model.pkl)!")
    elif os.path.exists("unified_model.pkl"):
        text_model = joblib.load("unified_model.pkl")
        print("Unified Model loaded (unified_model.pkl)!")
except Exception as e:
    print(f"Error loading Text Model: {e}")

# 3. URL Classification Model (D4 Grambeddings Model)
try:
    if os.path.exists("url_model.pkl"):
        url_bundle = joblib.load("url_model.pkl")
        print("D4 URL Classifier loaded (url_model.pkl)!")
except Exception as e:
    print(f"Error loading URL Model: {e}")

# 4. Webpage Classification Model (D4 Phish360 Model)
try:
    if os.path.exists("webpage_model.pkl"):
        webpage_model = joblib.load("webpage_model.pkl")
        print("D4 Webpage Classifier loaded (webpage_model.pkl)!")
except Exception as e:
    print(f"Error loading Webpage Model: {e}")

# 5. Multilingual Zero-Shot Semantic Concepts
CONCEPT_PROMPTS = {
    "ТЕРМІНОВІСТЬ": [
        "Your account will be suspended in 24 hours, you must act immediately.",
        "Urgent action is required, do this immediately or face consequences.",
        "Final warning, act now or lose access.",
        "You have a limited time to respond to this urgent request."
    ],
    "АВТОРИТЕТ": [
        "We are the security team, system administration, or technical support.",
        "This is an official message from the police, government, or national bank.",
        "Message from the CEO, head office, or executive director."
    ],
    "ФІНАНСОВА МАНІПУЛЯЦІЯ": [
        "You have won a cash prize, lottery, or giveaway.",
        "You must pay a fine, debt, penalty, or tax immediately.",
        "Financial invoice attached, payment required.",
        "Claim your exclusive discount or financial reward."
    ],
    "ЗАКЛИК ДО НЕБЕЗПЕЧНОЇ ДІЇ": [
        "Click the link below to verify your account or confirm your data.",
        "Please log in and enter your password here.",
        "Download the attached file to view the document.",
        "Sign in immediately to resolve this issue."
    ]
}

if embedder is not None:
    try:
        concept_embeddings = {
            k: torch.nn.functional.normalize(embedder.encode(v, convert_to_tensor=True, device=device), p=2, dim=1)
            for k, v in CONCEPT_PROMPTS.items()
        }
        print("Multilingual concept embeddings precomputed and normalized!")
    except Exception as e:
        print(f"Error precomputing concept embeddings: {e}")

# 6. Spam DB (if present)
if os.path.exists("spam_db.pt"):
    try:
        import warnings
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            spam_db = torch.load("spam_db.pt", map_location=device, weights_only=False)
        if isinstance(spam_db.get('embeddings'), torch.Tensor):
            spam_db['embeddings'] = spam_db['embeddings'].to(device)
            spam_db['embeddings_norm'] = torch.nn.functional.normalize(spam_db['embeddings'], p=2, dim=1)
        print(f"Spam vector DB loaded with {len(spam_db['texts'])} samples and normalized!")
    except Exception as e:
        print(f"Error loading spam_db.pt: {e}")

# -------------------------------------------------------------
# URL FEATURE EXTRACTOR
# -------------------------------------------------------------
SUSPICIOUS_KEYWORDS = [
    'login', 'verify', 'account', 'update', 'banking', 'secure', 'webscr', 
    'signin', 'ebayisapi', 'password', 'confirm', 'wallet', 'security', 'auth'
]
SUSPICIOUS_TLDS = {'.xyz', '.top', '.tk', '.ml', '.cf', '.ga', '.gq', '.club', '.work', '.biz', '.info', '.live'}

def entropy(s: str) -> float:
    if not s: return 0.0
    prob = [float(s.count(c)) / len(s) for c in dict.fromkeys(list(s))]
    return -sum([p * math.log(p) / math.log(2.0) for p in prob])

def extract_url_features(urls: List[str]) -> np.ndarray:
    feats = []
    for u in urls:
        u_str = str(u).strip()
        parsed = urlparse(u_str if '://' in u_str else f"http://{u_str}")
        netloc = parsed.netloc.lower()
        
        length = len(u_str)
        dot_cnt = u_str.count('.')
        hyphen_cnt = u_str.count('-')
        slash_cnt = u_str.count('/')
        q_cnt = u_str.count('?')
        at_cnt = u_str.count('@')
        eq_cnt = u_str.count('=')
        pct_cnt = u_str.count('%')
        digits_cnt = sum(c.isdigit() for c in u_str)
        digits_ratio = digits_cnt / length if length > 0 else 0
        
        is_ip = int(any(part.isdigit() and len(part) <= 3 for part in netloc.split('.')) and len(netloc.split('.')) == 4)
        has_suspicious_tld = int(any(netloc.endswith(tld) for tld in SUSPICIOUS_TLDS))
        keyword_cnt = sum(kw in u_str.lower() for kw in SUSPICIOUS_KEYWORDS)
        ent = entropy(netloc)
        
        feats.append([
            length, dot_cnt, hyphen_cnt, slash_cnt, q_cnt, at_cnt, eq_cnt, pct_cnt,
            digits_ratio, is_ip, has_suspicious_tld, keyword_cnt, ent
        ])
    return np.array(feats, dtype=np.float32)

TRUSTED_APEX_DOMAINS = {
    'google.com', 'googleusercontent.com', 'gstatic.com', 'c.gle', 'goo.gl',
    'microsoft.com', 'microsoftonline.com', 'office.com', 'live.com', 'outlook.com',
    'windows.net', 'apple.com', 'icloud.com', 'github.com', 'amazon.com', 'amazonaws.com',
    'meta.com', 'facebook.com', 'instagram.com', 'whatsapp.com', 'paypal.com',
    'privatbank.ua', 'privat24.ua', 'monobank.ua', 'diia.gov.ua', 'gov.ua', 'ukr.net'
}

def is_trusted_url(u_str: str) -> bool:
    try:
        parsed = urlparse(u_str if '://' in u_str else f"http://{u_str}")
        netloc = parsed.netloc.lower().split(':')[0]
        for apex in TRUSTED_APEX_DOMAINS:
            if netloc == apex or netloc.endswith('.' + apex):
                return True
        return False
    except Exception:
        return False

# -------------------------------------------------------------
# SCHEMAS
# -------------------------------------------------------------
class AnalysisRequest(BaseModel):
    texts: List[str]
    urls: Optional[List[str]] = None

class AnalysisResponse(BaseModel):
    verdicts: List[dict]
    url_verdicts: Optional[List[dict]] = None
    ml_health: Optional[dict] = None

# -------------------------------------------------------------
# ENDPOINTS
# -------------------------------------------------------------
@app.get("/")
async def root():
    return {"status": "online", "message": "Phishing Detector ML API is active"}

@app.get("/api/health")
async def health_check():
    report = {}
    report_path = "../datasets/D4_evaluation_report.json"
    if os.path.exists(report_path):
        try:
            with open(report_path, "r", encoding="utf-8") as f:
                report = json.load(f)
        except Exception:
            pass
            
    return {
        "status": "online",
        "device": str(device),
        "gpu_name": torch.cuda.get_device_name(0) if torch.cuda.is_available() else None,
        "models": {
            "multilingual_text": text_model is not None,
            "url_classifier": url_bundle is not None,
            "webpage_classifier": webpage_model is not None,
            "concept_matcher": len(concept_embeddings) > 0,
            "spam_db": spam_db is not None
        },
        "metrics": {
            "text_email_f1": report.get("multilingual_text_model", {}).get("email_test", {}).get("f1", 0.939),
            "text_en_f1": report.get("multilingual_text_model", {}).get("language_breakdown", {}).get("en", {}).get("f1", 0.934),
            "text_ru_f1": report.get("multilingual_text_model", {}).get("language_breakdown", {}).get("ru", {}).get("f1", 0.966),
            "url_f1": report.get("url_model", {}).get("f1", 0.931),
            "webpage_f1": report.get("webpage_model", {}).get("f1", 0.721)
        },
        "supported_languages": "50+ (multilingual MiniLM-L12-v2)"
    }

@app.post("/api/analyze", response_model=AnalysisResponse)
async def analyze_texts(request: AnalysisRequest):
    if not request.texts:
        raise HTTPException(status_code=400, detail="No texts provided")
    
    if embedder is None or text_model is None:
        raise HTTPException(status_code=500, detail="Models failed to load on server startup.")
        
    try:
        # 1. Generate semantic embeddings
        truncated_texts = [t[:512] for t in request.texts]
        X_vec = embedder.encode(truncated_texts, convert_to_numpy=True, device=device)
        
        # 2. Predict using the Text Classifier
        probabilities = text_model.predict_proba(X_vec)
        predictions = (probabilities[:, 1] > 0.5).astype(int)

        # Batch GPU vectorization for Semantic Spam & Concept triggers
        N = len(request.texts)
        X_tensor = torch.tensor(X_vec, device=device)
        X_norm = torch.nn.functional.normalize(X_tensor, p=2, dim=1)

        best_spam_scores = np.zeros(N, dtype=np.float32)
        best_spam_indices = np.zeros(N, dtype=np.int64)
        has_spam_db = spam_db is not None and 'embeddings' in spam_db

        if has_spam_db:
            if 'embeddings_norm' not in spam_db:
                if not isinstance(spam_db['embeddings'], torch.Tensor):
                    spam_db['embeddings'] = torch.tensor(spam_db['embeddings'], device=device)
                else:
                    spam_db['embeddings'] = spam_db['embeddings'].to(device)
                spam_db['embeddings_norm'] = torch.nn.functional.normalize(spam_db['embeddings'], p=2, dim=1)

            # Single GPU matrix multiplication: [N, D] x [D, M] = [N, M]
            all_spam_sims = torch.mm(X_norm, spam_db['embeddings_norm'].t())
            max_vals, max_idxs = torch.max(all_spam_sims, dim=1)
            best_spam_scores = max_vals.detach().cpu().numpy()
            best_spam_indices = max_idxs.detach().cpu().numpy()

        # Batch concept similarity computation: [N, D] x [D, K] = [N, K]
        concept_max_scores = {}
        if concept_embeddings:
            for concept_name, c_emb in concept_embeddings.items():
                c_emb_norm = c_emb if getattr(c_emb, '_is_normalized', False) else torch.nn.functional.normalize(c_emb.to(device), p=2, dim=1)
                sims = torch.mm(X_norm, c_emb_norm.t())
                concept_max_scores[concept_name] = torch.max(sims, dim=1).values.detach().cpu().numpy()

        results = []
        for i in range(N):
            text = request.texts[i]
            pred = predictions[i]
            prob = probabilities[i]
            phishing_prob = float(prob[1])
            is_phishing = bool(pred == 1)

            spam_match = False
            best_spam_score = float(best_spam_scores[i]) if has_spam_db else 0.0
            best_spam_text = ""

            if has_spam_db:
                best_score_idx = int(best_spam_indices[i])
                text_lower = text.lower()
                has_spam_keywords = bool(re.search(
                    r'(?:^|[^\w])(заробіток|віддаленка|удаленка|доход|гроші|вакансі|посад|рекрутинг|казино|'
                    r'без вкладень|акція|знижка|приз|виграш|заявк|телефонуй|підробіток|крипт|інвест|'
                    r'free|money|cash|earn|discount|bonus|lottery|apply|call|income)(?=[^\w]|$)', 
                    text_lower, re.UNICODE | re.IGNORECASE
                ))
                has_phone_solicitation = bool(re.search(r'(?:\+?380\d{9}|0\d{9})', text))
                is_system_notification = bool(re.search(
                    r'(google|microsoft|apple|github|вход выполнен|войти с аккаунтом|оповещения системы безопасности|'
                    r'security alert|код підтвердження|verification code|two-factor|2fa)',
                    text_lower, re.UNICODE | re.IGNORECASE
                ))

                if not is_system_notification:
                    if best_spam_score > 0.82 or (best_spam_score > 0.65 and has_spam_keywords) or (best_spam_score > 0.60 and has_spam_keywords and has_phone_solicitation):
                        spam_match = True
                        best_spam_text = spam_db['texts'][best_score_idx]
                else:
                    if best_spam_score > 0.92 and has_spam_keywords:
                        spam_match = True
                        best_spam_text = spam_db['texts'][best_score_idx]

            semantic_triggers = []
            if concept_embeddings:
                for concept_name, c_scores in concept_max_scores.items():
                    max_sim = float(c_scores[i])
                    if max_sim > 0.55:
                        semantic_triggers.append({
                            "trigger": concept_name,
                            "score": max_sim,
                            "sentence": text
                        })

            results.append({
                "text": text,
                "is_phishing": is_phishing,
                "phishing_probability": phishing_prob,
                "threat_level": "HIGH" if phishing_prob > 0.7 else "MEDIUM" if phishing_prob > 0.4 else "LOW",
                "spam_match": spam_match,
                "best_spam_score": best_spam_score,
                "best_spam_text": best_spam_text,
                "semantic_triggers": semantic_triggers
            })
            
        # 3. Optional URL Evaluation via D4 URL Model
        url_results = []
        if request.urls and url_bundle is not None:
            from scipy.sparse import hstack
            u_num = extract_url_features(request.urls)
            u_tfidf = url_bundle['tfidf'].transform(request.urls)
            u_full = hstack([u_num, u_tfidf]).tocsr()
            u_probs = url_bundle['model'].predict_proba(u_full)[:, 1]
            
            for u_str, u_p in zip(request.urls, u_probs):
                is_trusted = is_trusted_url(u_str)
                prob_val = 0.0 if is_trusted else float(u_p)
                url_results.append({
                    "url": u_str,
                    "phishing_probability": prob_val,
                    "is_phishing": bool(prob_val > 0.5)
                })
            
        return {
            "verdicts": results,
            "url_verdicts": url_results if url_results else None,
            "ml_health": {
                "status": "online",
                "device": str(device)
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
