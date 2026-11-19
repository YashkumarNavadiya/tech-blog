---
title: "Build a Production-Grade Raspberry Pi Wireless Access Point with OpenWrt"
description: "Turn your Raspberry Pi into a hardened, enterprise-ready wireless access point using OpenWrt — complete with firewall, VLANs, and DHCP automation."
pubDate: "2026-11-19"
updatedDate: "2026-11-19"
author: "Yash"
tags: ["devops", "cloud", "security", "homelab"]
---

## Why Build a Raspberry Pi Wireless Access Point?

In today’s distributed and edge-computing world, having a lightweight, customizable, and secure wireless access point (AP) is invaluable — especially for home labs, small offices, or IoT deployments. While commercial APs are reliable, they often lack flexibility and transparency.

A Raspberry Pi running OpenWrt transforms into a **production-grade wireless access point** — allowing you to:

- Customize firmware, firewall rules, and network topology.
- Support VLANs, QoS, and traffic shaping.
- Deploy enterprise-grade security (WPA3, static IPs, captive portals).
- Integrate with cloud monitoring or scripting tools.
- Avoid vendor lock-in.

This guide walks you through building a hardened OpenWrt-based Pi AP — from flashing to securing to automating — with real-world production considerations.

---

## Prerequisites

Before diving in, ensure you have:

- A Raspberry Pi 3 or 4 (4GB+ recommended for stability).
- A microSD card (16GB+).
- A USB mouse + keyboard + HDMI monitor (optional — for initial setup).
- A wireless USB adapter (if your Pi lacks onboard Wi-Fi — not needed for Pi 4).
- A router or modem to tether your Pi (for initial setup — Pi doesn’t have Ethernet by default unless you're using Pi 4+ with Ethernet port).
- A power adapter (5V/3A minimum).

> **Note**: We assume you’re comfortable with terminal commands, SSH, and basic Linux administration.

---

## Step 1: Flash OpenWrt to Your SD Card

### Download OpenWrt Image

Go to the official [OpenWrt website](https://openwrt.org/).

1. Navigate to **Supported Targets → Raspberry Pi 4 (or 3)**.
2. Download the **“OpenWrt SNAPSHOT for Raspberry Pi 4 (64-bit)”** — the latest build.
   > *Why 64-bit?* Pi 4 supports it natively. 32-bit is slower and less stable.
3. Alternatively, use `openwrt-23.05.1-raspi4` if you want a stable version.

### Flash the Image

Use `dd` (Linux/macOS) or `balenaEtcher` (GUI):

```bash
# Linux/macOS
sudo dd if=OpenWrt-SNAPSHOT-raspi4-64-23.05.1-squashfs-sysupgrade.img of=/dev/sdX bs=4M

# Replace /dev/sdX with your actual device (e.g., /dev/sdb)
# Use 'lsblk' to find correct device before flashing
```

> ⚠️ **Critical**: Always verify your device with `lsblk` — accidentally writing to the wrong drive can erase your OS!

### Boot and Initial Setup

Insert the SD card, power on the Pi, and connect via SSH or HDMI:

```bash
ssh root@192.168.1.1
# Default password: openwrt
```

> **Note**: OpenWrt ships with a static IP `192.168.1.1` — but you may need to adjust it depending on your network.

---

## Step 2: Configure Your Pi as a Wireless Access Point

### 2.1 Enable Wireless Interface

First, check device names:

```bash
cat /proc/cpuinfo
ip link show
```

On Pi 4, you’ll typically see:

```
wlan0   # your Wi-Fi adapter
eth0    # if using Ethernet (optional)
```

### 2.2 Configure WiFi Interfaces

Edit the wireless configuration using `uci`:

```bash
uci set wireless.radio0.disabled=0
uci set wireless.radio0.channel=6
uci set wireless.radio0.htmode=HT40
uci set wireless.radio0.bandwidth=20
uci commit wireless
```

> **HT40/HT80**: For 5GHz, use HT80 for max throughput. Use HT40 for 2.4GHz to avoid channel congestion.

### 2.3 Set Up the Access Point

#### Configure WiFi Interface as AP

Edit `/etc/config/wireless`:

```bash
uci set wireless.radio0.mode=ap
uci set wireless.radio0.ssid="MyPiAP"
uci set wireless.radio0.encryption="psk2"
uci set wireless.radio0.key="your-strong-ap-password-here"
uci commit wireless
```

> **Important**: Replace `your-strong-ap-password-here` with a strong password (16+ chars, preferably ASCII only).

#### Configure WiFi Interface as Client (Optional for Dual-Role)

If you want your Pi to connect to another router for internet access (not always necessary — AP can route via Ethernet or hotspot):

```bash
uci set wireless.radio0.mode=sta
uci set wireless.radio0.ssid="YourRouterSSID"
uci set wireless.radio0.encryption="psk2"
uci set wireless.radio0.key="your-router-password"
uci commit wireless
```

---

## Step 3: Configure Networking for the AP

### 3.1 Set Static IP for the AP

Edit `/etc/config/network`:

```bash
uci set network.wan.proto=static
uci set network.wan.ipaddr=192.168.1.2
uci set network.wan.netmask=255.255.255.0
uci set network.wan.gateway=192.168.1.1
uci set network.wan.dns=8.8.8.8
uci commit network
```

> **Why 192.168.1.2?** So your AP doesn’t conflict with 192.168.1.1 (default router).

### 3.2 Enable DHCP Server

Edit `/etc/config/dhcp`:

```bash
uci set dhcp.@dnsmasq[0].interface=wlan0
uci set dhcp.@dnsmasq[0].dhcp_option=1
uci set dhcp.@dnsmasq[0].domain=local
uci set dhcp.@dnsmasq[0].domain=lan
uci commit dhcp
```

> **Tip**: This allows DHCP clients to get IPs from 192.168.1.100–192.168.1.199.

### 3.3 Enable Firewall for AP

Edit `/etc/config/firewall`:

```bash
uci set firewall.@zone[0].name=wan
uci set firewall.@zone[0].network=wan
uci set firewall.@zone[0].input=REJECT
uci set firewall.@zone[0].output=ACCEPT
uci set firewall.@zone[0].forward=REJECT

uci set firewall.@zone[1].name=lan
uci set firewall.@zone[1].network=lan
uci set firewall.@zone[1].input=ACCEPT
uci set firewall.@zone[1].output=ACCEPT
uci set firewall.@zone[1].forward=ACCEPT

uci set firewall.@rule[0].name='Allow WAN to LAN'
uci set firewall.@rule[0].target=ACCEPT
uci set firewall.@rule[0].src=wan
uci set firewall.@rule[0].dest=lan
uci set firewall.@rule[0].proto=any
uci commit firewall
```

> **Security Tip**: Only allow traffic necessary — such as SSH and HTTP — and block all else.

---

## Step 4: Harden Your Access Point for Production

### 4.1 Disable SSH Root Login (Optional)

Edit `/etc/ssh/sshd_config`:

```bash
PermitRootLogin no
PasswordAuthentication yes
```

> **Recommendation**: Use SSH key authentication for production.

### 4.2 Set Up a Non-Root User

Create a user:

```bash
adduser piuser
passwd piuser
```

Then configure SSH to allow `piuser`:

```bash
# Edit /etc/ssh/sshd_config
AllowUsers piuser
```

---

## Step 5: Use VLANs for Network Segmentation (Advanced)

If you want to isolate traffic, set up VLANs:

```bash
# Create VLAN interface
uci set network.@switch[0].name=switch
uci set network.@switch[0].vlan=1
uci set network.@switch[0].vlanid=100

# Create VLAN interface
uci set network.@switch[0].name=vlan100
uci set network.@switch[0].vlanid=100
uci set network.@switch[0].bridge=br0
uci set network.@switch[0].type=bridge
uci commit network

# Enable VLAN on wireless interface
uci set wireless.radio0.vlan=100
uci commit wireless
```

> **Use Case**: Isolate IoT devices or guest networks from internal traffic.

---

## Step 6: Automate Setup with Scripts

Create a startup script:

```bash
# /usr/local/bin/piap-setup.sh

#!/bin/sh
# Enable wireless AP
uci set wireless.radio0.mode=ap
uci set wireless.radio0.ssid="MyPiAP"
uci set wireless.radio0.encryption="psk2"
uci set wireless.radio0.key="your-strong-ap-password-here"
uci commit wireless

# Set static IP
uci set network.wan.proto=static
uci set network.wan.ipaddr=192.168.1.2
uci set network.wan.netmask=255.255.255.0
uci set network.wan.gateway=192.168.1.1
uci set network.wan.dns=8.8.8.8
uci commit network

# Enable firewall
uci set firewall.@zone[0].name=wan
uci set firewall.@zone[0].network=wan
uci set firewall.@zone[0].input=REJECT
uci set firewall.@zone[0].output=ACCEPT
uci set firewall.@zone[0].forward=REJECT
uci set firewall.@zone[1].name=lan
uci set firewall.@zone[1].network=lan
uci set firewall.@zone[1].input=ACCEPT
uci set firewall.@zone[1].output=ACCEPT
uci set firewall.@zone[1].forward=ACCEPT
uci commit firewall

# Enable DHCP
uci set dhcp.@dnsmasq[0].interface=wlan0
uci set dhcp.@dnsmasq[0].dhcp_option=1
uci set dhcp.@dnsmasq[0].domain=local
uci commit dhcp

# Reboot
reboot
```

Make executable:

```bash
chmod +x /usr/local/bin/piap-setup.sh
```

Run on boot:

```bash
ln -s /usr/local/bin/piap-setup.sh /etc/rc.local
```

---

## Step 7: Monitoring and Logging

Enable logging:

```bash
# Edit /etc/config/system
uci set system.@system[0].loglevel=5
uci set system.@system[0].log_size=1024
uci commit system
```

Enable log rotation:

```bash
# Edit /etc/crontab
0 * * * * logger -t piap-logrotate -p user.info "Log rotated"
```

---

## Step 8: Optional: Set Up a Captive Portal

Install `captiveportal`:

```bash
opkg update
opkg install captiveportal
```

Configure:

```bash
uci set captiveportal.@portal[0].enabled=1
uci set captiveportal.@portal[0].ssid="MyPiAP"
uci set captiveportal.@portal[0].password="your-captive-password"
uci set captiveportal.@portal[0].login_page="http://login.local"
uci commit captiveportal
```

This allows users to authenticate before accessing the network — ideal for guest access.

---

## Step 9: Production Deployment Checklist

✅ Flash OpenWrt correctly  
✅ Configure AP SSID, password, and encryption  
✅ Set static IP for the AP (avoid conflicts)  
✅ Enable DHCP for clients  
✅ Harden firewall (block all non-essential traffic)  
✅ Disable root SSH (use non-root user)  
✅ Set up VLANs (if needed)  
✅ Automate setup with script  
✅ Enable logging and monitoring  
✅ Test with multiple devices  
✅ Backup config with `uci export > config.backup`

---

## Conclusion

You now have a **production-ready Raspberry Pi wireless access point** running OpenWrt — capable of handling enterprise-grade requirements: VLANs, VLAN isolation, captive portals, hardened firewall, and automation.

This setup is ideal for:

- Home labs and micro-data centers
- IoT network segregation
- Guest Wi-Fi with captive portal
- Learning and experimentation

> **Pro Tip**: Use OpenWrt’s built-in `sysupgrade` for seamless updates — no need to reflash every time.

---

## Bonus: Useful Commands for Maintenance

```bash
# Check wireless status
iwconfig

# Check network interfaces
ip addr show

# Check firewall rules
iptables -L

# View logs
journalctl -u ssh
cat /var/log/messages

# Export config
uci export > config.backup

# Backup to SD card
dd if=/dev/sdX of=backup.img
```

---

## Final Thoughts

Building your own wireless access point isn’t just a fun project — it’s a **strategic decision** for control, security, and scalability. OpenWrt on Raspberry Pi gives you that control — and with the right configuration, your AP can outperform many commercial devices.

Keep your AP updated, log its activity, and never underestimate the power of a simple Linux box with a Wi-Fi dongle.

---

## Author

**Yash** — DevOps Engineer, Open Source Advocate, and Raspberry Pi Enthusiast. Specializes in edge computing, embedded systems, and network infrastructure.

---

## Related Reading

- [OpenWrt Wiki: Wireless Access Point](https://openwrt.org/docs/guide-user-guide-wireless-access-point)
- [Raspberry Pi as a Router](https://www.raspberrypi.org/documentation/configuration/wireless/)
- [How to Harden OpenWrt for Production](https://openwrt.org/docs/development/security)

---

## Resources

- [OpenWrt Downloads](https://openwrt.org/releases)
- [Raspberry Pi Foundation](https://www.raspberrypi.org/)
- [Pi-hole (optional for ad-blocking)](https://pi-hole.net/)

---

## Let’s Build Better Networks, Together 🚀

Got questions? Drop them in the comments — or reach out on [Twitter](https://twitter.com/yash_devops). Let’s make every Pi a production-grade node.

---
