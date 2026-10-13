import os
import pandas as pd
import torch
import joblib
from sentence_transformers import SentenceTransformer

DATASETS_DIR = "../datasets"

print("Завантаження моделі SentenceTransformer...")
embedder = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')

texts = []

# Завантажуємо трохи спаму (наприклад, 10 000 випадкових записів для швидкості пам'яті)
spam_csv_path = os.path.join(DATASETS_DIR, "spam.csv")
if os.path.exists(spam_csv_path):
    df_spam = pd.read_csv(spam_csv_path, on_bad_lines='skip').dropna(subset=['text', 'spam'])
    texts.extend(df_spam['text'].astype(str).tolist()[:5000])

telegram_csv_path = os.path.join(DATASETS_DIR, "telegram_spam_cleaned.csv")
if os.path.exists(telegram_csv_path):
    df_tg = pd.read_csv(telegram_csv_path, on_bad_lines='skip').dropna(subset=['text', 'label'])
    texts.extend(df_tg['text'].astype(str).tolist()[:5000])

print(f"Зібрано {len(texts)} спам-повідомлень. Починаємо векторизацію (це може зайняти хвилину)...")

embeddings = embedder.encode(texts, convert_to_tensor=True)

# Зберігаємо тексти та їх вектори
torch.save({'texts': texts, 'embeddings': embeddings}, 'spam_db.pt')

print("Базу спаму (spam_db.pt) успішно створено!")
