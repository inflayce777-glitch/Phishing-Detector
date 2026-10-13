import json
import csv

input_file = "datasets/top-1m.csv"
output_file = "src/core/trusted_domains.json"

top_limit = 150000
domains = set()

print(f"Reading top {top_limit} domains from {input_file}...")

with open(input_file, 'r', encoding='utf-8') as f:
    reader = csv.reader(f)
    for i, row in enumerate(reader):
        if i >= top_limit:
            break
        if len(row) >= 2:
            domain = row[1].strip().lower()
            domains.add(domain)

# Manually add some important Ukrainian domains just in case they are outside top 150k
ukrainian_domains = [
    'privatbank.ua', 'monobank.ua', 'diia.gov.ua', 'gov.ua', 
    'oschadbank.ua', 'pumb.ua', 'ukr.net', 'rozetka.com.ua', 
    'novaposhta.ua', 'prom.ua', 'ria.com', 'olx.ua', 'silpo.ua'
]
for d in ukrainian_domains:
    domains.add(d)

domains_list = list(domains)

print(f"Total domains to save: {len(domains_list)}")

with open(output_file, "w", encoding="utf-8") as f:
    json.dump(domains_list, f)

print(f"Successfully saved to {output_file}")
