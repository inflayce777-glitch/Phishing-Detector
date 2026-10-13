import joblib
from sentence_transformers import SentenceTransformer
embedder = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')
model = joblib.load("unified_model.pkl")
samples = [
    "Urgjente! Llogaria juaj do të pezullohet brenda 24 orësh. Verifikoni fjalëkalimin tuaj menjëherë.",  # SQ, no URL
    "Ju keni fituar 1,000,000 lekë! Dërgoni të dhënat tuaja bankare për të marrë çmimin.",  # SQ prize scam
    "A jeni i interesuar për një punë nga shtëpia? Fitoni 500 dollarë në ditë pa investime. Përgjigjuni tani!",  # SQ spam
]
X = embedder.encode(samples)
probs = model.predict_proba(X)
for t, p in zip(samples, probs):
    print(f"P(phishing) = {p[1]:.3f}  | {t[:70]}")
