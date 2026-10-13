# Діагностика: чи працює поточна модель на інших мовах
import joblib
from sentence_transformers import SentenceTransformer

embedder = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')
model = joblib.load("unified_model.pkl")

samples = [
    ("EN phishing", "Urgent! Your account will be suspended within 24 hours. Verify your password immediately at http://secure-login-example.com"),
    ("UK phishing", "Терміново! Ваш обліковий запис буде заблоковано протягом 24 годин. Підтвердіть пароль зараз: http://secure-login-example.com"),
    ("SQ phishing (Albanian)", "Urgjente! Llogaria juaj do të pezullohet brenda 24 orësh. Verifikoni fjalëkalimin tuaj menjëherë në http://secure-login-example.com"),
    ("DE phishing (German)", "Dringend! Ihr Konto wird innerhalb von 24 Stunden gesperrt. Bestätigen Sie Ihr Passwort sofort unter http://secure-login-example.com"),
    ("FR phishing (French)", "Urgent ! Votre compte sera suspendu dans 24 heures. Vérifiez votre mot de passe immédiatement sur http://secure-login-example.com"),
    ("EN safe", "Hi team, the meeting is moved to Friday 3pm. Please review the attached agenda when you have a moment."),
    ("SQ safe (Albanian)", "Përshëndetje ekipi, mbledhja është shtyrë të premten në orën 3 pasdite. Ju lutemi shqyrtoni axhendën e bashkëngjitur kur keni kohë."),
]

texts = [t for _, t in samples]
X = embedder.encode(texts)
probs = model.predict_proba(X)

print(f"\n{'Sample':<28} {'P(phishing)':>12}  Verdict")
print("-" * 60)
for (name, _), p in zip(samples, probs):
    ph = p[1]
    verdict = "PHISHING" if ph > 0.5 else ("suspicious" if ph > 0.4 else "safe")
    print(f"{name:<28} {ph:>12.3f}  {verdict}")
