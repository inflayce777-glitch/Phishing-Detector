import os
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report
import joblib
import time
import urllib.request
import zipfile
import warnings
warnings.filterwarnings('ignore')

try:
    import xgboost as xgb
except ImportError:
    print("Будь ласка, встановіть бібліотеку xgboost: pip install xgboost")
    exit(1)

try:
    from sentence_transformers import SentenceTransformer
except ImportError:
    print("Будь ласка, встановіть бібліотеку sentence-transformers: pip install sentence-transformers")
    exit(1)

try:
    from datasets import load_dataset
except ImportError:
    print("Будь ласка, встановіть datasets: pip install datasets")
    exit(1)

DATASETS_DIR = "../datasets"

def download_and_extract(url, zip_name, extract_to):
    zip_path = os.path.join(DATASETS_DIR, zip_name)
    if not os.path.exists(extract_to):
        if not os.path.exists(zip_path):
            print(f"Завантаження {zip_name} напряму з {url} ...")
            try:
                urllib.request.urlretrieve(url, zip_path)
            except Exception as e:
                print(f"Помилка завантаження {zip_name}: {e}")
                return False
        
        print(f"Розпакування {zip_name} у локальну папку datasets...")
        try:
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                zip_ref.extractall(DATASETS_DIR)
            print(f"Успішно розпаковано в {DATASETS_DIR}")
        except Exception as e:
            print(f"Помилка розпакування {zip_name}: {e}")
            return False
    return True

def load_data():
    texts, labels = [], []
    
    # Створюємо папку datasets якщо її раптом немає
    os.makedirs(DATASETS_DIR, exist_ok=True)
    
    # === ЧАСТИНА 1: ЛОКАЛЬНІ ДАТАСЕТИ ===
    ps_path = os.path.join(DATASETS_DIR, "dataset_for_text_model.csv")
    if os.path.exists(ps_path):
        print(f"Завантаження локального датасету {ps_path}...")
        df_ps = pd.read_csv(ps_path).dropna(subset=["url"]).sample(n=100000, random_state=42)
        texts.extend(df_ps["url"].astype(str).tolist())
        labels.extend((df_ps["status"] == -1).astype(int).tolist())
        print(f"-> Додано {len(df_ps)} записів (локальні URL).")

    # === ЧАСТИНА 2: ПРЯМЕ ЗАВАНТАЖЕННЯ (БЕЗ HUGGINGFACE) ===
    # 2.1 SMS Spam Collection
    sms_url = "https://archive.ics.uci.edu/ml/machine-learning-databases/00228/smsspamcollection.zip"
    sms_txt = os.path.join(DATASETS_DIR, "SMSSpamCollection")
    if download_and_extract(sms_url, "smsspamcollection.zip", sms_txt):
        try:
            df_sms = pd.read_csv(sms_txt, sep='\t', header=None, names=['label', 'text']).dropna()
            texts.extend(df_sms['text'].astype(str).tolist())
            labels.extend((df_sms['label'] == 'spam').astype(int).tolist())
            print(f"-> Додано {len(df_sms)} повідомлень з прямих академічних джерел (SMS Spam).")
        except Exception as e:
            pass

    # 2.2 Enron Spam Data
    enron_url = "https://raw.githubusercontent.com/MWiechmann/enron_spam_data/master/enron_spam_data.zip"
    enron_csv = os.path.join(DATASETS_DIR, "enron_spam_data.csv")
    if download_and_extract(enron_url, "enron_spam_data.zip", enron_csv):
        try:
            df_enron = pd.read_csv(enron_csv, encoding='utf-8', on_bad_lines='skip').dropna(subset=['Message', 'Spam/Ham'])
            texts.extend(df_enron["Message"].astype(str).tolist())
            labels.extend((df_enron["Spam/Ham"] == "spam").astype(int).tolist())
            print(f"-> Додано {len(df_enron)} повідомлень з прямих джерел (Enron Github).")
        except Exception as e:
            pass

    # === ЧАСТИНА 3: ВЕЛЕТЕНСЬКІ РУЧНІ ДАТАСЕТИ З KAGGLE (1GB+) ===
    print("\nПошук велетенських датасетів з Kaggle у папці datasets...")
    
    # 3.1 Email Spam Dataset +360K
    huge_spam_path = os.path.join(DATASETS_DIR, "email_spam.csv")
    if os.path.exists(huge_spam_path):
        print("Знайдено email_spam.csv (+360K)! Читаємо масивні дані...")
        try:
            df_huge = pd.read_csv(huge_spam_path, on_bad_lines='skip').dropna(subset=['body', 'label'])
            # Можемо взяти 200к щоб не вийти за межі оперативної пам'яті (32GB RAM), але беремо все, що зможемо!
            texts.extend(df_huge['body'].astype(str).tolist())
            labels.extend(df_huge['label'].astype(int).tolist())
            print(f"-> ДОДАНО {len(df_huge)} ЛИСТІВ З KAGGLE 360K!")
        except Exception as e:
            print(f"Помилка читання email_spam.csv: {e}")

    # 3.2 Phishing Site URLs (500k+)
    phish_url_path = os.path.join(DATASETS_DIR, "phishing_site_urls.csv")
    if os.path.exists(phish_url_path):
        print("Знайдено phishing_site_urls.csv! Читаємо базу посилань...")
        try:
            df_url = pd.read_csv(phish_url_path, on_bad_lines='skip')
            # Колонки зазвичай URL і Label (bad/good)
            url_col = 'URL' if 'URL' in df_url.columns else 'url'
            lbl_col = 'Label' if 'Label' in df_url.columns else 'label'
            df_url = df_url.dropna(subset=[url_col, lbl_col])
            texts.extend(df_url[url_col].astype(str).tolist())
            # bad = 1, good = 0
            labels.extend((df_url[lbl_col].astype(str).str.lower() == 'bad').astype(int).tolist())
            print(f"-> ДОДАНО {len(df_url)} ПОСИЛАНЬ З KAGGLE!")
        except Exception as e:
            print(f"Помилка читання phishing_site_urls.csv: {e}")

    # 3.3 TREC 2007 Public Corpus Dataset (75k+)
    trec_path = os.path.join(DATASETS_DIR, "processed_data.csv")
    if os.path.exists(trec_path):
        print("Знайдено processed_data.csv (TREC 2007)! Читаємо академічний корпус...")
        try:
            df_trec = pd.read_csv(trec_path, on_bad_lines='skip').dropna(subset=['message', 'label'])
            texts.extend(df_trec['message'].astype(str).tolist())
            labels.extend(df_trec['label'].astype(int).tolist())
            print(f"-> ДОДАНО {len(df_trec)} ЛИСТІВ З TREC 2007!")
        except Exception as e:
            print(f"Помилка читання processed_data.csv: {e}")

    # === ЧАСТИНА 4: HUGGINGFACE ===
    print("\nПідключення до серверів HuggingFace для отримання додаткових датасетів...")
    try:
        ds_email = load_dataset("SetFit/enron_spam", split="train")
        texts.extend(ds_email["text"])
        labels.extend(ds_email["label"])
        print(f"-> Додано {len(ds_email)} текстів листів з HuggingFace (SetFit/enron_spam).")
    except Exception as e:
        print(f"Помилка завантаження з HuggingFace: {e}")

    # 5. Нові датасети (spam.csv та telegram_spam_cleaned.csv)
    spam_csv_path = os.path.join(DATASETS_DIR, "spam.csv")
    if os.path.exists(spam_csv_path):
        print("Знайдено spam.csv! Читаємо додатковий датасет...")
        try:
            df_spam = pd.read_csv(spam_csv_path, on_bad_lines='skip').dropna(subset=['text', 'spam'])
            texts.extend(df_spam['text'].astype(str).tolist())
            labels.extend(df_spam['spam'].astype(int).tolist())
            print(f"-> Додано {len(df_spam)} записів з spam.csv.")
        except Exception as e:
            print(f"Помилка читання spam.csv: {e}")

    telegram_csv_path = os.path.join(DATASETS_DIR, "telegram_spam_cleaned.csv")
    if os.path.exists(telegram_csv_path):
        print("Знайдено telegram_spam_cleaned.csv! Читаємо додатковий датасет...")
        try:
            df_tg = pd.read_csv(telegram_csv_path, on_bad_lines='skip').dropna(subset=['text', 'label'])
            texts.extend(df_tg['text'].astype(str).tolist())
            labels.extend((df_tg['label'] == 'spam').astype(int).tolist())
            print(f"-> Додано {len(df_tg)} записів з telegram_spam_cleaned.csv.")
        except Exception as e:
            print(f"Помилка читання telegram_spam_cleaned.csv: {e}")

    return texts, labels

def main():
    texts, labels = load_data()
    if not texts:
        print("Датасети відсутні!")
        return
        
    df = pd.DataFrame({"text": texts, "label": labels})
    df = df.dropna(subset=['text']).sample(frac=1, random_state=42).reset_index(drop=True)
    
    print(f"\n✅ Загалом зібрано {len(df)} записів для навчання! (Мікс локальних, прямих і HuggingFace)")
    
    X_train, X_test, y_train, y_test = train_test_split(df["text"], df["label"], test_size=0.1, random_state=42)
    
    print("\nЗавантаження Мультимовної ШІ-моделі (SentenceTransformer)...")
    embedder = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')
    
    print("Конвертація тексту у математичні вектори (Ембеддінги)...")
    start_time = time.time()
    X_train_vec = embedder.encode(X_train.tolist(), batch_size=256, show_progress_bar=True)
    X_test_vec = embedder.encode(X_test.tolist(), batch_size=256, show_progress_bar=True)
    print(f"Векторизація завершена за {time.time() - start_time:.1f} сек.")
    
    print("\nІніціалізація XGBoost...")
    try:
        model = xgb.XGBClassifier(
            n_estimators=300, 
            learning_rate=0.1, 
            max_depth=6, 
            tree_method='hist', 
            device='cuda', 
            n_jobs=-1,
            random_state=42
        )
        model.fit(X_train_vec[:10], y_train[:10])
        print("🚀 NVIDIA GPU (CUDA) успішно виявлено для XGBoost!")
    except Exception:
        print("⚠️ GPU (CUDA) для XGBoost не виявлено. Використовуємо CPU...")
        model = xgb.XGBClassifier(
            n_estimators=200, 
            learning_rate=0.1, 
            max_depth=6, 
            tree_method='hist', 
            device='cpu', 
            n_jobs=-1,
            random_state=42
        )
    
    print("Початок навчання мультимовної XGBoost моделі...")
    start_time = time.time()
    model.fit(X_train_vec, y_train)
    print(f"Навчання успішно завершено за {time.time() - start_time:.1f} сек.")
    
    print("\nОцінка результатів на тестовій вибірці:")
    y_pred = model.predict(X_test_vec)
    print(classification_report(y_test, y_pred))
    
    print("Збереження моделі для FastAPI...")
    joblib.dump(model, "unified_model.pkl")
    print("XGBoost модель збережено (unified_model.pkl)!")

if __name__ == "__main__":
    main()
