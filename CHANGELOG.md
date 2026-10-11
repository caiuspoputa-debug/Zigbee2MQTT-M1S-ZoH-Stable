# Changelog

## 0.1.5 - 2026-10-11

- Dezactiveaza maparea host pentru portul optional socat `8485`, eliminand conflictul cu App-ul Zigbee2MQTT standard cand acesta este instalat dar oprit.
- Activeaza implicit verificarea read-only de readiness pentru instalari noi; asteapta doua probe stabile ale relay-ului coordinatorului inainte sa porneasca Zigbee2MQTT.
- Pastreaza Zigbee2MQTT 2.14.2, ZoH 0.2.4-m1s.2, baza de date si configuratia retelei.
- Corecteaza documentatia care ramanea la versiunile 0.1.3/0.1.4.
- La actualizarile instalate, Home Assistant pastreaza optiunile existente; readiness trebuie activata manual daca era deja oprita.

## 0.1.4 - 2026-10-11

- Inlocuieste maparea legacy `addon_config` cu `app_config`, acceptata de manifestul curent Home Assistant.
- Schimba watchdog-ul din boolean in URL TCP valid si declara explicit portul ingress 8099.
- Nu modifica imaginea, ZoH, configuratia Zigbee sau datele persistente.

## 0.1.3 - 2026-10-11

- Bumpa versiunea aplicatiei pentru ca Home Assistant sa detecteze update-ul fata de 0.1.2.
- Pastreaza ZoH `0.2.4-m1s.2`; nu introduce modificari de protocol sau de configuratie Zigbee.

## 0.1.2 - 2026-10-11

- Reconcile la adresa scurta raportata de un dispozitiv deja cunoscut si autorizat in LINK_STATUS.
- Refuza reconcilierea daca adresa este deja asociata altui IEEE; persista imediat asocierea reparata.
- Serializeaza salvarile periodice ale starii si nu opreste procesarea radio daca salvarea unei corectii esueaza.
- Porneste App-ul automat si activeaza watchdog-ul Home Assistant.
- Pastreaza gateway-ul de readiness optional si dezactivat pana la instalarea markerului compatibil pe coordinator.
- Corecteaza verificarea de build pentru a valida efectiv patch-ul inclus in pachetul ZoH.
- Normalizeaza terminatoarele scriptului de pornire in imaginea Linux.

## 0.1.1 - 2026-10-08

- Corecteaza terminatoarele de linie ale scriptului de pornire la format LF.
- Elimina eroarea `env: can't execute 'bashio': No such file or directory`.

## 0.1.0 - 2026-10-08

- Prima versiune a repository-ului Home Assistant App.
- Include Zigbee2MQTT 2.14.2 si ZoH 0.2.4-m1s.1.
- Adauga protectii pentru cadre MAC mari si cadre HDLC/Spinel corupte.
- Adauga retry la pornire si salvare atomica a starii retelei.
- Adauga manifest JSON de integritate si amprente SHA-256.
