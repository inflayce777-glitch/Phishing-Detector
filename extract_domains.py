import pandas as pd
from urllib.parse import urlparse
import json

print("Reading CSV...")
df = pd.read_csv("datasets/phishing_site_urls.csv")
good_urls = df[df['Label'] == 'good']['URL'].dropna()

domains = set()
for url in good_urls:
    url = str(url).strip()
    if not url.startswith('http'):
        url = 'http://' + url
    try:
        domain = urlparse(url).netloc
        domain = domain.replace('www.', '').lower()
        if domain and '.' in domain:
            domains.add(domain)
    except:
        pass

print(f"Found {len(domains)} unique safe domains.")

# For frontend bundle size, we can output the top 20,000 domains. 
# But wait, we don't have frequency counts if we just use a set.
# Let's count domain frequency to get the most popular ones!

from collections import Counter
domain_counts = Counter()
for url in good_urls:
    url = str(url).strip()
    if not url.startswith('http'):
        url = 'http://' + url
    try:
        domain = urlparse(url).netloc
        domain = domain.replace('www.', '').lower()
        if domain and '.' in domain:
            domain_counts[domain] += 1
    except:
        pass

top_domains = [d for d, c in domain_counts.most_common(50000)]
print(f"Top domains count: {len(top_domains)}")
with open("src/core/trusted_domains.json", "w", encoding="utf-8") as f:
    json.dump(top_domains, f)
print("Saved to src/core/trusted_domains.json")
