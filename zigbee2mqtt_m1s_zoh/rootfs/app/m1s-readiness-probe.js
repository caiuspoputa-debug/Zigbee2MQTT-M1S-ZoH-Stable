'use strict';

// Read-only BusyBox shell audit. Never open the radio socket or change hub files/GPIOs.
function statusCommand(port) {
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid relay port');
    return [
        '( p=' + port + '; n=0; pid=0; start=0; ready=false; reason=relay_not_ready;',
        'for f in /proc/[0-9]*/cmdline; do c=$(tr "\\000" " " < "$f" 2>/dev/null);',
        'case "$c" in "/data/m1s_coordinator/bin/uart_tcp_relay_mipsel /dev/ttyS1 $p "*)',
        'n=$((n+1)); pid=${f#/proc/}; pid=${pid%/cmdline};',
        'start=$(sed "s/.*) //" "/proc/$pid/stat" 2>/dev/null | awk \'{print $20}\');; esac; done;',
        'boot=$(cat /proc/sys/kernel/random/boot_id 2>/dev/null);',
        'mac=$(cat /sys/class/net/wlan0/address 2>/dev/null);',
        'sockets=$(netstat -ant 2>/dev/null);',
        'listen=$(printf "%s\\n" "$sockets" | awk -v p="$p" \'$1=="tcp" && $4 ~ ":"p"$" && $6=="LISTEN" {n++} END {print n+0}\');',
        'connections=$(printf "%s\\n" "$sockets" | awk -v p="$p" \'$1=="tcp" && $4 ~ ":"p"$" && $6=="ESTABLISHED" {n++} END {print n+0}\');',
        'if grep -q "^ENABLED=1$" /data/m1s_coordinator/coordinator.conf 2>/dev/null &&',
        '[ "$n" = 1 ] && [ "$listen" = 1 ] &&',
        '[ "$(cat /sys/class/gpio/gpio33/value 2>/dev/null)" = 1 ] &&',
        '[ "$(cat /sys/class/gpio/gpio18/value 2>/dev/null)" = 0 ]; then ready=true; reason=ready; fi;',
        'printf "M1S_%s_BEGIN\\n" READY;',
        'printf \'{"protocol":1,"ready":%s,"reason":"%s","wifi_mac":"%s","boot_id":"%s","relay_pid":%s,"relay_port":%s,"relay_start":"%s","connections":%s}\\n\' "$ready" "$reason" "$mac" "$boot" "$pid" "$p" "${start:-0}" "$connections";',
        'printf "M1S_%s_END\\n" READY; )\r\n',
    ].join(' ');
}

module.exports = {statusCommand};
