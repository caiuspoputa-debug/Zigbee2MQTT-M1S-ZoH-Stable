# Zigbee2MQTT M1S ZoH Stable

Home Assistant App `0.1.5` pentru testarea ZoH `0.2.4-m1s.2` cu
Zigbee2MQTT `2.14.2` pe coordonatorul Aqara M1S JN5189.

Citeste `DOCS.md` inainte de instalare. Opreste Zigbee2MQTT standard inainte
de a porni aceasta aplicatie; cele doua nu trebuie sa ruleze simultan.

Versiunea `0.1.2` repara asocierea dintre IEEE si adresa scurta cand un
router deja autorizat anunta o adresa schimbata in LINK_STATUS. Nu suprascrie
adrese detinute de alt dispozitiv si nu inscrie automat dispozitive necunoscute.
Manifestul este compatibil cu tipurile de mapare curente ale Home Assistant.
Watchdog-ul Home Assistant verifica portul TCP al interfetei Zigbee2MQTT.
Pentru instalari noi, verificarea read-only a coordinatorului este activata
implicit; foloseste utilizatorul Telnet `admin` si parola configurata in App.
Pe actualizarile existente, optiunea salvata de Home Assistant nu se schimba
automat. Portul host 8485 este dezactivat implicit pentru a evita conflictul
cu App-ul oficial instalat.
