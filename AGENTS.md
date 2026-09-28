# Pokyny pro práci na projektu

- Zachovej hlavní pracovní tok tabule a živou synchronizaci přes Firebase/Firestore.
- Před změnou datového modelu ověř odpovídající pravidla ve `firestore.rules`.
- Neumisťuj tajné klíče do klientského kódu ani do repozitáře.
- Po změnách spusť `npm run lint` a `npm run build`, pokud jsou v prostředí dostupné závislosti.
- Změny dělej v samostatné větvi a před sloučením ověř hlavní scénáře na mobilu i desktopu.
