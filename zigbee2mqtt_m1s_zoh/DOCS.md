# Zigbee2MQTT M1S ZoH Stable 0.1.1

Acest add-on este destinat exclusiv coordonatorului Aqara M1S JN5189 care
foloseste adaptorul `zoh`. Foloseste acelasi director de date ca add-onul
oficial: `/config/zigbee2mqtt`.

## Regula principala

Opreste add-onul Zigbee2MQTT oficial inainte de a porni acest add-on. Doua
procese nu pot controla simultan acelasi coordonator si nu pot folosi aceleasi
porturi.

La pornire, jurnalul trebuie sa contina:

`M1S ZoH hardened package: 0.2.4-m1s.1`

Configuratia Zigbee2MQTT trebuie sa pastreze `serial.adapter: zoh` si aceeasi
adresa a coordonatorului folosita in prezent.

## Instalare sigura

1. Fa un backup complet Home Assistant si o copie a directorului
   `/config/zigbee2mqtt`.
2. Pastreaza `data_path` la `/config/zigbee2mqtt`.
3. Opreste aplicatia Zigbee2MQTT standard.
4. Porneste aceasta aplicatie si urmareste jurnalul.
5. Confirma mesajul `M1S ZoH hardened package: 0.2.4-m1s.1`, apoi testeaza o
   comanda Zigbee.

## Revenire

Opreste aceasta aplicatie si porneste Zigbee2MQTT standard. Nu le porni
simultan.

## Componente

- aplicatie: `0.1.1`;
- Zigbee2MQTT: `2.14.2`;
- ZoH: `0.2.4-m1s.1`.
