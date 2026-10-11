# M1S ZoH Apps

Repository Home Assistant pentru coordonatorul Aqara M1S JN5189 folosit prin
adaptorul `zoh` din Zigbee2MQTT.

## Aplicatie inclusa

### Zigbee2MQTT M1S ZoH Stable

- versiune aplicatie: `0.1.5`;
- Zigbee2MQTT: `2.14.2`;
- ZoH modificat: `0.2.4-m1s.2`;
- arhitecturi: `amd64` si `aarch64`;
- stare: experimentala, pentru validare pe coordonatorul M1S real.

ZoH trateaza cadre MAC complete de 127 octeti, fragmenteaza mesajele Link
Status mari, elimina controlat cadrele HDLC/Spinel corupte, recupereaza
adresele scurte doar pentru dispozitive autorizate si protejeaza salvarea
starii retelei. Aplicatia porneste automat cu watchdog. Pentru adaptorul
`zoh`, verificarea read-only a coordinatorului este activata implicit si
asteapta doua verificari stabile inainte de pornirea Zigbee2MQTT. Ea confirma
relay-ul si starea GPIO raportata de profil, nu sanatatea completa a radio-ului.

Portul host `8485` este dezactivat implicit (socat este oprit); astfel nu
conflicteaza cu Zigbee2MQTT standard instalat, dar oprit. Portul ingress intern
`8099` ramane activ.

Manifestul foloseste tipurile actuale Home Assistant pentru configurarea
persistenta, watchdog si ingress.

## Instalare din repository

1. Publica continutul acestui director la radacina unui repository GitHub.
2. In Home Assistant deschide `Setari > Apps > App store`.
3. Adauga adresa repository-ului si reincarca magazinul.
4. Instaleaza `Zigbee2MQTT M1S ZoH Stable`.
5. Opreste Zigbee2MQTT standard inainte de a porni aceasta aplicatie.
6. Pentru instalarea existenta, verifica o singura data in Configurarea App:
   `Coordinator readiness` activat, Telnet `admin` si parola configurata pe
   hub. Actualizarea unei App instalate nu suprascrie optiunile deja salvate.
7. Daca Supervisor pastreaza inca maparea host veche `8485`, foloseste o data
   `Clear port configuration`; noul manifest nu mai publica acel port.

Nu porni niciodata doua instante Zigbee2MQTT pe acelasi coordonator sau cu
acelasi director de date.

## Instalare locala

Copiaza doar directorul `zigbee2mqtt_m1s_zoh` in `/addons/`, reincarca lista
de aplicatii locale si instaleaza-l de acolo.

## Integritate

`release-signature.json` si `SHA256SUMS.txt` contin amprente SHA-256 pentru
fisierele versiunii. Acestea verifica integritatea continutului, dar nu sunt o
semnatura de identitate cu o cheie privata. O semnatura de publicare poate fi
adaugata ulterior prin GitHub artifact attestation sau Cosign.

## Licente si afiliere

Acesta este un proiect independent, neoficial. Nu este afiliat sau aprobat de
Aqara, Xiaomi, Zigbee2MQTT ori Home Assistant. Consulta
`THIRD_PARTY_NOTICES.md` si `LICENSE`.
