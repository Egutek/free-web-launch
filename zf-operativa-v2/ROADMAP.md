# Roadmap
## P0 OCR reliability
- Perspective correction a detekce hran tabule.
- Detekce magnetek jako ROI, OCR po magnetkách místo OCR celé fotky.
- Geometrická klasifikace magnetka -> pracoviště.
- Druhý nezávislý OCR průchod a disagreement gate.
- Dataset anonymizovaných/reálně reprezentativních snímků a benchmark: missed magnet, wrong identity, wrong area, false positive.
## P0 Shift safety
- Hard gate před startem směny pro nejisté/duplicitní/nezařazené výsledky.
- Obnova rozpracované směny, explicitní ukončení, export historie.
## P1 UX
- One-hand mobile flow, rychlé Vrátit, filtr Transport, hledání OP, velké dotykové cíle, WCAG AA audit.
## P1 Operations
- PWA cache/service worker, crash recovery, verzování uloženého stavu.
## P2 Production
- Schválená autentizace a backend až podle firemní infrastruktury; audit, monitoring, backup/restore, CI/CD.

## Added in v0.5
- Service worker cache foundation for offline shell.
- Search by OP/workplace and Transport-only mode that keeps moved Transport OP visible.
- Stored-state schema guard groundwork.
- Expanded automated regression suite.

## Added in v0.6 - board vision
- Edge-envelope board detection with automatic crop before OCR.
- Magnet candidate segmentation using local dark-text density and connected components.
- Candidate overlays in OCR preview and explicit board-detection status.
- Vision regression tests with synthetic board geometry.

### Known limitation
Current board correction is automatic crop of the detected edge envelope, not a true four-corner homography. True perspective rectification remains P0 and requires robust corner/line estimation on representative real board photos. Magnet segmentation is candidate generation, not yet authoritative identification.
