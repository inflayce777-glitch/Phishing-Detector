import os
import json
import time
import math
import numpy as np
import pandas as pd
from urllib.parse import urlparse
from sklearn.metrics import classification_report, accuracy_score, precision_recall_fscore_support
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
import joblib
import warnings
warnings.filterwarnings('ignore')

import torch
import xgboost as xgb
from sentence_transformers import SentenceTransformer

DATA_DIR = "../datasets/processed"
REPORT_PATH = "../datasets/D4_evaluation_report.json"

# ==========================================
# 1. URL FEATURE EXTRACTION
# ==========================================
SUSPICIOUS_KEYWORDS = [
    'login', 'verify', 'account', 'update', 'banking', 'secure', 'webscr', 
    'signin', 'ebayisapi', 'password', 'confirm', 'wallet', 'security', 'auth'
]
SUSPICIOUS_TLDS = {'.xyz', '.top', '.tk', '.ml', '.cf', '.ga', '.gq', '.club', '.work', '.biz', '.info', '.live'}

def entropy(s):
    if not s: return 0.0
    prob = [float(s.count(c)) / len(s) for c in dict.fromkeys(list(s))]
    return -sum([p * math.log(p) / math.log(2.0) for p in prob])

def extract_url_features(urls):
    feats = []
    for u in urls:
        u_str = str(u).strip()
        parsed = urlparse(u_str if '://' in u_str else f"http://{u_str}")
        netloc = parsed.netloc.lower()
        path = parsed.path.lower()
        
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

# ==========================================
# 2. TRAIN & EVALUATE URL MODEL
# ==========================================
def train_and_eval_url():
    print("\n" + "="*50)
    print("STEP 1: Training & Evaluating URL Model (Grambeddings)")
    print("="*50)
    
    train_path = os.path.join(DATA_DIR, "url", "train.csv")
    test_path = os.path.join(DATA_DIR, "url", "test.csv")
    
    print("Loading URL train/test datasets...")
    # Train on 120k samples for fast training, evaluate on full test set (160k)
    train_df = pd.read_csv(train_path).sample(n=120000, random_state=42)
    test_df = pd.read_csv(test_path)
    
    print(f"Extracting features for {len(train_df)} train URLs...")
    X_train_num = extract_url_features(train_df['url'])
    y_train = train_df['label_binary'].values
    
    print(f"Extracting features for {len(test_df)} test URLs...")
    X_test_num = extract_url_features(test_df['url'])
    y_test = test_df['label_binary'].values
    
    # TF-IDF Char n-grams
    print("Building char n-gram TF-IDF...")
    tfidf = TfidfVectorizer(analyzer='char', ngram_range=(3, 5), max_features=3000)
    X_train_tfidf = tfidf.fit_transform(train_df['url'].astype(str))
    X_test_tfidf = tfidf.transform(test_df['url'].astype(str))
    
    from scipy.sparse import hstack
    X_train_full = hstack([X_train_num, X_train_tfidf]).tocsr()
    X_test_full = hstack([X_test_num, X_test_tfidf]).tocsr()
    
    print("Training XGBoost URL classifier...")
    url_model = xgb.XGBClassifier(
        n_estimators=150,
        max_depth=6,
        learning_rate=0.1,
        tree_method='hist',
        random_state=42
    )
    url_model.fit(X_train_full, y_train)
    
    print("Evaluating on URL test set...")
    preds = url_model.predict(X_test_full)
    probs = url_model.predict_proba(X_test_full)[:, 1]
    
    p, r, f1, _ = precision_recall_fscore_support(y_test, preds, average='binary')
    acc = accuracy_score(y_test, preds)
    
    print(f"URL Model Test Results:")
    print(f"  Accuracy:  {acc:.4f}")
    print(f"  Precision: {p:.4f}")
    print(f"  Recall:    {r:.4f}")
    print(f"  F1-Score:  {f1:.4f}")
    
    # Save model pipeline bundle
    joblib.dump({"model": url_model, "tfidf": tfidf}, "url_model.pkl")
    print("Saved url_model.pkl")
    
    return {
        "accuracy": float(acc),
        "precision": float(p),
        "recall": float(r),
        "f1": float(f1),
        "test_samples": int(len(test_df))
    }

# ==========================================
# 3. TRAIN & EVALUATE MULTILINGUAL TEXT MODEL
# ==========================================
def train_and_eval_multilingual(embedder, device):
    print("\n" + "="*50)
    print("STEP 2: Training & Evaluating Multilingual Text Model")
    print("="*50)
    
    email_train_path = os.path.join(DATA_DIR, "email_text", "train.csv")
    tele_train_path = os.path.join(DATA_DIR, "telegram", "train.csv")
    email_test_path = os.path.join(DATA_DIR, "email_text", "test.csv")
    tele_test_path = os.path.join(DATA_DIR, "telegram", "test.csv")
    
    print("Loading train sets...")
    df_email_train = pd.read_csv(email_train_path)
    # Stratified sample from email train
    df_em_phish = df_email_train[df_email_train['label_binary'] == 1].sample(n=min(len(df_email_train[df_email_train['label_binary'] == 1]), 15000), random_state=42)
    df_em_benign = df_email_train[df_email_train['label_binary'] == 0].sample(n=min(len(df_email_train[df_email_train['label_binary'] == 0]), 15000), random_state=42)
    df_email_sample = pd.concat([df_em_phish, df_em_benign])
    
    df_tele_train = pd.read_csv(tele_train_path)
    # Oversample / sample telegram to balance phishing
    df_tele_phish = df_tele_train[df_tele_train['label_binary'] == 1]
    df_tele_benign = df_tele_train[df_tele_train['label_binary'] == 0].sample(n=min(len(df_tele_train[df_tele_train['label_binary'] == 0]), len(df_tele_phish) * 3), random_state=42)
    df_tele_sample = pd.concat([df_tele_phish, df_tele_benign])
    
    train_texts = df_email_sample['text'].fillna('').tolist() + df_tele_sample['text'].fillna('').tolist()
    train_labels = df_email_sample['label_binary'].tolist() + df_tele_sample['label_binary'].tolist()
    
    print(f"Total training samples: {len(train_texts)} (Email + Telegram)")
    print(f"Generating multilingual embeddings using {device}...")
    
    # Truncate to first 512 chars for fast embedding calculation
    truncated_train = [t[:512] for t in train_texts]
    X_train = embedder.encode(truncated_train, batch_size=128, show_progress_bar=True, device=device)
    
    print("Fitting XGBoost Classifier on Multilingual Embeddings...")
    text_model = xgb.XGBClassifier(
        n_estimators=200,
        max_depth=6,
        learning_rate=0.08,
        tree_method='hist',
        random_state=42
    )
    text_model.fit(X_train, np.array(train_labels))
    
    joblib.dump(text_model, "multilingual_text_model.pkl")
    print("Saved multilingual_text_model.pkl")
    
    # --- EVALUATION ---
    print("\n--- Evaluating on Email Test Set ---")
    df_email_test = pd.read_csv(email_test_path)
    
    # Stratified test sample of 6,000 for fast eval
    df_t_phish = df_email_test[df_email_test['label_binary'] == 1].sample(n=min(len(df_email_test[df_email_test['label_binary'] == 1]), 3000), random_state=42)
    df_t_benign = df_email_test[df_email_test['label_binary'] == 0].sample(n=min(len(df_email_test[df_email_test['label_binary'] == 0]), 3000), random_state=42)
    df_email_test_sample = pd.concat([df_t_phish, df_t_benign])
    email_test_texts = [t[:512] for t in df_email_test_sample['text'].fillna('')]
    X_email_test = embedder.encode(email_test_texts, batch_size=128, show_progress_bar=True, device=device)
    email_preds = text_model.predict(X_email_test)
    y_email_test = df_email_test_sample['label_binary'].values
    
    p_em, r_em, f1_em, _ = precision_recall_fscore_support(y_email_test, email_preds, average='binary')
    acc_em = accuracy_score(y_email_test, email_preds)
    
    # Sub-metrics by language in Email Test
    lang_metrics = {}
    for lang in ['en', 'ru']:
        sub = df_email_test[df_email_test['language'].str.startswith(lang, na=False)]
        if len(sub) > 10 and sub['label_binary'].nunique() > 1:
            sub_texts = [t[:512] for t in sub['text'].fillna('')]
            X_sub = embedder.encode(sub_texts, batch_size=64, device=device)
            sub_preds = text_model.predict(X_sub)
            sp, sr, sf1, _ = precision_recall_fscore_support(sub['label_binary'], sub_preds, average='binary')
            lang_metrics[lang] = {
                "accuracy": float(accuracy_score(sub['label_binary'], sub_preds)),
                "precision": float(sp),
                "recall": float(sr),
                "f1": float(sf1),
                "samples": int(len(sub))
            }
            print(f"Language [{lang.upper()}] Email Metrics: F1={sf1:.4f}, Prec={sp:.4f}, Rec={sr:.4f} (N={len(sub)})")
            
    # Multilingual synthetic / curated prompt benchmark for UK/EN/RU
    print("\n--- Evaluating Multilingual Benchmark (EN / UK / RU) ---")
    benchmark_samples = [
        # UK Phishing
        ("Терміново! Ваш обліковий запис буде заблоковано через 24 години. Підтвердіть пароль негайно.", 1, "uk"),
        ("Увага! Служба безпеки банку. Виявлено підозрілий переказ. Натисніть тут для блокування.", 1, "uk"),
        ("Вітаємо! Ви виграли грошовий приз 50 000 грн. Перейдіть за посиланням щоб забрати кошти.", 1, "uk"),
        # UK Benign
        ("Доброго дня, надсилаю оновлений звіт за минулий тиждень у додатку.", 0, "uk"),
        ("Привіт! Нагадую про нашу зустріч завтра о 14:00 у конференц-залі.", 0, "uk"),
        ("Дякуємо за співпрацю. Будь ласка, перегляньте деталі контракту коли буде час.", 0, "uk"),
        # RU Phishing
        ("Срочно! Ваш аккаунт заблокирован из-за подозрительной активности. Подтвердите данные.", 1, "ru"),
        ("Служба безопасности: совершена попытка входа с нового устройства. Отмените операцию по ссылке.", 1, "ru"),
        ("Вам начислена компенсация в размере 25 000 руб. Получите выплату перейдя на сайт.", 1, "ru"),
        # RU Benign
        ("Привет, давай созвонимся сегодня после обеда и обсудим план проекта.", 0, "ru"),
        ("Добрый день! Отправляю материалы к завтрашнему совещанию.", 0, "ru"),
        ("Спасибо за ответ, встретимся на следующей неделе.", 0, "ru"),
        # EN Phishing
        ("URGENT: Your account access has been restricted. Verify your credentials immediately.", 1, "en"),
        ("Security alert: Unauthorized login attempt detected. Click here to secure your account.", 1, "en"),
        ("Congratulations! You have won $10,000 in our giveaway. Claim your reward now.", 1, "en"),
        # EN Benign
        ("Hi team, please find the meeting notes attached for your review.", 0, "en"),
        ("Just following up on our conversation from yesterday regarding the budget.", 0, "en"),
        ("Thanks for the quick update. Have a great weekend!", 0, "en")
    ]
    
    bench_df = pd.DataFrame(benchmark_samples, columns=['text', 'label', 'lang'])
    X_bench = embedder.encode(bench_df['text'].tolist(), device=device)
    bench_preds = text_model.predict(X_bench)
    bench_df['pred'] = bench_preds
    
    for l in ['uk', 'ru', 'en']:
        l_df = bench_df[bench_df['lang'] == l]
        lp, lr, lf1, _ = precision_recall_fscore_support(l_df['label'], l_df['pred'], average='binary')
        lacc = accuracy_score(l_df['label'], l_df['pred'])
        lang_metrics[f"{l}_benchmark"] = {
            "accuracy": float(lacc),
            "precision": float(lp),
            "recall": float(lr),
            "f1": float(lf1),
            "samples": int(len(l_df))
        }
        print(f"Benchmark [{l.upper()}]: Accuracy={lacc:.4f}, Precision={lp:.4f}, Recall={lr:.4f}, F1={lf1:.4f}")
        
    # --- EVALUATING TELEGRAM TEST SET ---
    print("\n--- Evaluating on Telegram Test Set ---")
    df_tele_test = pd.read_csv(tele_test_path)
    tele_texts = [t[:512] for t in df_tele_test['text'].fillna('')]
    X_tele_test = embedder.encode(tele_texts, batch_size=128, show_progress_bar=True, device=device)
    tele_preds = text_model.predict(X_tele_test)
    y_tele_test = df_tele_test['label_binary'].values
    
    tp, tr, tf1, _ = precision_recall_fscore_support(y_tele_test, tele_preds, average='binary')
    t_acc = accuracy_score(y_tele_test, tele_preds)
    
    print(f"Telegram Test Results: Accuracy={t_acc:.4f}, Prec={tp:.4f}, Rec={tr:.4f}, F1={tf1:.4f}")
    
    return {
        "email_test": {
            "accuracy": float(acc_em),
            "precision": float(p_em),
            "recall": float(r_em),
            "f1": float(f1_em),
            "samples": int(len(df_email_test_sample))
        },
        "language_breakdown": lang_metrics,
        "telegram_test": {
            "accuracy": float(t_acc),
            "precision": float(tp),
            "recall": float(tr),
            "f1": float(tf1),
            "samples": int(len(df_tele_test))
        }
    }

# ==========================================
# 4. TRAIN & EVALUATE WEBPAGE MODEL (Phish360)
# ==========================================
def train_and_eval_webpage():
    print("\n" + "="*50)
    print("STEP 3: Training & Evaluating Webpage Model (Phish360)")
    print("="*50)
    
    train_path = os.path.join(DATA_DIR, "webpage", "train.csv")
    test_path = os.path.join(DATA_DIR, "webpage", "test.csv")
    
    train_df = pd.read_csv(train_path)
    test_df = pd.read_csv(test_path)
    
    # Feature extraction from URL and brand mismatch
    def extract_web_features(df):
        feats = []
        for _, row in df.iterrows():
            u = str(row['url']).lower()
            brand = str(row['source_group']).lower()
            u_feats = extract_url_features([u])[0]
            
            # Check if brand appears in hostname
            parsed = urlparse(u if '://' in u else f"http://{u}")
            host = parsed.netloc
            brand_in_host = int(brand in host) if brand and brand != 'unknown' else 0
            brand_in_path = int(brand in parsed.path) if brand and brand != 'unknown' else 0
            brand_mismatch = int(brand_in_path and not brand_in_host)
            
            feats.append(np.append(u_feats, [brand_in_host, brand_in_path, brand_mismatch]))
        return np.array(feats, dtype=np.float32)
        
    X_train = extract_web_features(train_df)
    y_train = train_df['label_binary'].values
    
    X_test = extract_web_features(test_df)
    y_test = test_df['label_binary'].values
    
    web_model = xgb.XGBClassifier(n_estimators=100, max_depth=5, learning_rate=0.1, random_state=42)
    web_model.fit(X_train, y_train)
    
    preds = web_model.predict(X_test)
    p, r, f1, _ = precision_recall_fscore_support(y_test, preds, average='binary')
    acc = accuracy_score(y_test, preds)
    
    print(f"Webpage Model Test Results: Accuracy={acc:.4f}, Prec={p:.4f}, Rec={r:.4f}, F1={f1:.4f}")
    joblib.dump(web_model, "webpage_model.pkl")
    print("Saved webpage_model.pkl")
    
    return {
        "accuracy": float(acc),
        "precision": float(p),
        "recall": float(r),
        "f1": float(f1),
        "samples": int(len(test_df))
    }

def main():
    print("Starting D4: Retraining & Evaluation Suite...")
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Using Compute Device: {device}")
    
    embedder = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2', device=device)
    
    results = {}
    
    # 1. URL Model
    results['url_model'] = train_and_eval_url()
    
    # 2. Multilingual Text Model
    results['multilingual_text_model'] = train_and_eval_multilingual(embedder, device)
    
    # 3. Webpage Model
    results['webpage_model'] = train_and_eval_webpage()
    
    # Save unified evaluation report
    with open(REPORT_PATH, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
        
    print(f"\n" + "="*50)
    print(f"D4 EVALUATION COMPLETED! Report saved to {REPORT_PATH}")
    print("="*50)

if __name__ == "__main__":
    main()
