# Changelog

## 0.1.5

- Dezactiveaza maparea host a portului optional socat 8485 pentru a preveni conflictul cu App-ul oficial.
- Activeaza implicit readiness gate pentru instalari noi; optiunile existente din Home Assistant nu sunt rescrise automat.
- Nu schimba baza de date, canalul, PAN ID, cheia de retea sau driverul ZoH.

## 0.1.4

- Actualizeaza maparea persistenta la tipul Home Assistant `app_config`.
- Configureaza watchdog-ul Home Assistant cu verificare TCP pe portul ingress.
- Declara explicit portul ingress 8099; codul ZoH si reteaua Zigbee nu se schimba.

## 0.1.3

- Bump de versiune pentru detectarea update-ului Home Assistant fata de 0.1.2; ZoH ramane `0.2.4-m1s.2`.

## 0.1.2

- Repara adresele scurte ale routerelor cunoscute si autorizate pe baza LINK_STATUS.
- Refuza suprascrierea unei adrese detinute de alt IEEE si salveaza corectia imediat.
- Serializeaza salvarile periodice; o eroare de salvare este raportata fara sa opreasca procesarea radio.
- Pornire automata si watchdog Home Assistant.
- Gateway-ul coordinatorului este optional pana cand markerul compatibil este instalat.

## 0.1.1

- Corecteaza scriptul de pornire la terminatoare Linux LF.
- Elimina eroarea de interpretare a executabilului `bashio`.

## 0.1.0

- Prima versiune a aplicatiei Home Assistant.
- ZoH 0.2.4-m1s.1 compatibil cu Zigbee2MQTT 2.14.2.
- Cadre MAC complete de maximum 127 octeti.
- Fragmentare corecta pentru Link Status cu liste mari de vecini.
- Cadrele HDLC/Spinel defecte sunt eliminate fara oprirea procesului.
- Interogarile de identitate de la pornire sunt repetate controlat.
- Salvarea starii este atomica si are copie de recuperare.
- Puterea radio configurata explicit nu este suprascrisa din starea salvata.
