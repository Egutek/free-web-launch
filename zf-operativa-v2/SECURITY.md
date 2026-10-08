# Security baseline
- MVP je local-first: fotografie ani směna nemají být odesílány na backend bez schválené infrastruktury.
- Produkční varianta musí mít autentizaci, autorizaci podle role, auditní log a ochranu dat při přenosu i uložení.
- Žádné tajné klíče v klientovi. Externí OCR služby až po posouzení pracovních/osobních dat.
- OWASP ASVS cílově Level 2 pro produkční verzi; testování podle relevantních WSTG scénářů.
- Fotografie tabule mají být považovány za citlivá pracovní data a retence má být minimální.
