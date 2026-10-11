# Zigbee2MQTT M1S ZoH Stable 0.1.5

Acest add-on este destinat exclusiv coordonatorului Aqara M1S JN5189 care
foloseste adaptorul `zoh`. Foloseste acelasi director de date ca add-onul
oficial: `/config/zigbee2mqtt`.

## Regula principala

Opreste add-onul Zigbee2MQTT oficial inainte de a porni acest add-on. Doua
procese nu pot controla simultan acelasi coordonator si nu pot folosi aceleasi
porturi.

La pornire, jurnalul trebuie sa contina:

`M1S ZoH hardened package: 0.2.4-m1s.2`

Configuratia Zigbee2MQTT trebuie sa pastreze `serial.adapter: zoh` si aceeasi
adresa a coordonatorului folosita in prezent.

## Instalare sigura

1. Fa un backup complet Home Assistant si o copie a directorului
   `/config/zigbee2mqtt`.
2. Pastreaza `data_path` la `/config/zigbee2mqtt`.
3. Opreste aplicatia Zigbee2MQTT standard.
4. Porneste aceasta aplicatie si urmareste jurnalul.
5. Confirma mesajul `M1S ZoH hardened package: 0.2.4-m1s.2`, apoi testeaza o
   comanda catre un router care a raportat recent LINK_STATUS.

## Asteptarea coordinatorului

Aplicatia porneste automat, iar watchdog-ul este activ. Gateway-ul de readiness
este activat implicit pentru instalari noi. El citeste prin Telnet starea
relay-ului si GPIO-urilor, apoi cere doua verificari identice inainte de a
porni Zigbee2MQTT. Pe .220, profilul Only Coordinator si scriptul de stare
trebuie sa fie instalate, iar datele Telnet din configuratia App trebuie sa fie
corecte. Verificarea nu probeaza direct protocolul Spinel si nu garanteaza ca
radio-ul Zigbee functioneaza complet.

Home Assistant pastreaza optiunile unei instalari existente la update. Daca
`coordinator_readiness.enabled` era deja `false`, activeaz-o manual in setarile
App-ului dupa actualizare. Pentru conexiunea M1S ZoH, portul host `8485` ramane
dezactivat implicit; daca Supervisor a salvat anterior o mapare explicita,
foloseste o data `Clear port configuration`. Portul serial Zigbee ramane TCP
`1886` pe coordinator.

## Revenire

Opreste aceasta aplicatie si porneste Zigbee2MQTT standard. Nu le porni
simultan.

## Componente

- aplicatie: `0.1.5`;
- Zigbee2MQTT: `2.14.2`;
- ZoH: `0.2.4-m1s.2`.
