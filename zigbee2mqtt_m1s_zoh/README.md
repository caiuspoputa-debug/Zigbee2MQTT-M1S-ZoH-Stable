# Zigbee2MQTT M1S ZoH Stable

Home Assistant App `0.1.2` pentru testarea ZoH `0.2.4-m1s.2` cu
Zigbee2MQTT `2.14.2` pe coordonatorul Aqara M1S JN5189.

Citeste `DOCS.md` inainte de instalare. Opreste Zigbee2MQTT standard inainte
de a porni aceasta aplicatie; cele doua nu trebuie sa ruleze simultan.

Versiunea `0.1.2` repara asocierea dintre IEEE si adresa scurta cand un
router deja autorizat anunta o adresa schimbata in LINK_STATUS. Nu suprascrie
adrese detinute de alt dispozitiv si nu inscrie automat dispozitive necunoscute.
Aplicatia porneste automat si are watchdog activ. Gateway-ul optional de
readiness este dezactivat initial; activeaza-l doar dupa instalarea markerului
compatibil pe coordinator si configurarea datelor Telnet corecte.
