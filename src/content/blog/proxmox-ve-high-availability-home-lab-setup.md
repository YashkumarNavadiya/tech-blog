---
title: "Setting Up Proxmox VE High Availability Clusters for Home Labs"
description: "Master setting up Proxmox VE HA clusters for your home lab — from hardware requirements to fencing, shared storage, and failover automation. Build resilient virtual environments without breaking the bank."
pubDate: "2026-11-15"
updatedDate: "2026-11-15"
author: "Yash"
tags: ["devops", "homelab", "cloud", "security"]
---

## Why High Availability Matters in Your Home Lab

If you’ve invested time and money into building a home lab — whether it’s for learning Kubernetes, running VMs for testing, or even hosting personal services — then you’ve probably experienced the frustration of a single point of failure.

A server crash, a bad kernel update, or even a power outage can bring your entire lab to a halt. That’s where **Proxmox VE High Availability (HA)** comes in.

Proxmox VE is a powerful open-source virtualization platform built on Debian and Linux kernel — think of it as your own private VMware or Hyper-V — but with the added benefit of **built-in HA clustering and container support**.

In this post, you’ll learn how to:

✅ Set up a Proxmox HA cluster with two or more nodes  
✅ Configure shared storage (via iSCSI or NFS)  
✅ Enable fencing for node recovery  
✅ Automate failover using PVE’s built-in tools  
✅ Monitor and troubleshoot your cluster

---

## Prerequisites: Hardware and Software

Before you begin, you’ll need:

### Hardware
- **Minimum**: Two nodes with at least 2 x 4-core CPUs, 16GB RAM, 2x 250GB SSDs (one for OS, one for VMs/storage)
- **Recommended**: 3+ nodes for better redundancy and resilience
- **Network**: Two NICs per node — one for management (eth0), one for storage (eth1), and optionally one for HA heartbeat (eth2)
- **Storage**: Shared storage (iSCSI, NFS, or Ceph) for VMs and containers  
- **Power**: UPS or redundant power sources — HA won’t save you if your server dies from a power spike
- **OS**: Debian 12 or Ubuntu 22.04 LTS (Proxmox requires Debian-based OS)

### Software
- Proxmox VE 8.x or later  
- SSH access to all nodes  
- `sudo` or root privileges  
- `rsync`, `net-tools`, `iproute2`, `iscsi-initiator-utils` installed

> 💡 **Pro tip**: Use `pve-iscsi` or `pve-nfs` for shared storage. Proxmox’s own `pvesh` CLI and `qm` (qemu manager) are essential commands.

---

## Step 1: Prepare Your Nodes

Each node must be configured identically:

### 1. Install Proxmox VE
Download and install Proxmox VE on both nodes using the official ISO:

```bash
# Download Proxmox ISO (latest version)
wget https://download.proxmox.com/debian/pve/pve-9.2.iso -O pve-9.2.iso

# Burn to USB or boot from ISO
sudo dd if=pve-9.2.iso of=/dev/sdX bs=1M
```

> ⚠️ **Note**: Always create backups before installing. Use a clean USB or external drive.

### 2. Configure Network

Each node should have:

- **Management Network**: eth0 — `192.168.1.100` (Node 1), `192.168.1.101` (Node 2)
- **Storage Network**: eth1 — `192.168.2.100` (Node 1), `192.168.2.101` (Node 2)
- **Heartbeat Network (optional)**: eth2 — `192.168.3.100` (Node 1), `192.168.3.101` (Node 2)

> ⚠️ **Important**: Ensure all nodes are on the same subnet for storage and heartbeat.

### 3. Set Up Shared Storage

We’ll use **iSCSI** for shared storage — it’s reliable, performant, and well-supported.

#### On Node 1 (iSCSI Target):

```bash
# Install iscsi-target
apt install iscsitarget open-iscsi

# Configure target
echo "192.168.2.100" > /etc/iscsi/ifaces
echo "192.168.2.100" > /etc/iscsi/ifaces

# Create LUN
iscsiadm --mode target --targetname iqn.1992-01.com.linbit:storage1 --op new

# Add LUN
iscsiadm --mode target --targetname iqn.1992-01.com.linbit:storage1 --op add --lun 0 --device /dev/sdb

# Start target
systemctl start target
systemctl enable target
```

#### On Node 2 (iSCSI Initiator):

```bash
# Install iscsi-initiator
apt install open-iscsi

# Discover target
iscsiadm --mode discovery --type sendtargets --portal 192.168.2.100

# Login to target
iscsiadm --mode node --targetname iqn.1992-01.com.linbit:storage1 --portal 192.168.2.100:3260 --login
```

#### Mount the Storage in Proxmox

- Go to **Datacenter → Shared Storage → Add iSCSI Storage**  
- Use the target IQN: `iqn.1992-01.com.linbit:storage1`  
- Mount path: `/mnt/pve` (or `/var/lib/vz`)

> 💡 **Proxmox Tips**: Use `pvesh` to manage storage:  
```bash
pvesh get /cluster/ha/config
```

---

## Step 2: Configure Proxmox HA

### 1. Enable HA on Both Nodes

```bash
# Enable HA
pveam update
pvesh set /cluster/ha/config --enabled=1

# Set heartbeat network
pvesh set /cluster/ha/config --heartbeat-interface=eth2
```

> ⚠️ **Note**: HA is not enabled by default. You must explicitly enable it.

### 2. Configure Fencing

Fencing prevents split-brain scenarios — if one node fails, fencing ensures only one node can control VMs.

#### Enable Fencing

```bash
# Enable fencing
pvesh set /cluster/ha/fencing --enabled=1

# Set fencing device (e.g., IPMI)
pvesh set /cluster/ha/fencing --device=ipmi
```

#### Configure IPMI (if using)

```bash
# Install IPMI tools
apt install ipmitool

# Configure IPMI on Node 2
ipmitool lan set 1 staticaddr 192.168.3.101
ipmitool lan set 1 staticnetmask 255.255.255.0
ipmitool lan set 1 staticroute 192.168.3.100
```

> 💡 **Pro tip**: Use `pvecm` for CLI fencing:  
```bash
pvecm status
pvecm list
```

---

## Step 3: Add Nodes to Cluster

### 1. Add Node 2 to Cluster

```bash
# Add Node 2 to cluster
pveam add-node node2.example.com

# Configure node2
pvesh set /cluster/hosts/node2.example.com --ip=192.168.1.101 --hostname=node2
```

> ⚠️ **Important**: Ensure both nodes can ping each other and share the storage.

### 2. Verify Cluster Status

```bash
# Check cluster status
pvecm status

# Check HA status
pvesh get /cluster/ha/config

# Check fencing status
pvesh get /cluster/ha/fencing
```

---

## Step 4: Set Up VMs for HA

### 1. Enable HA on VMs

Go to **VM → VM ID → Options → HA**

Enable “High Availability” for VMs or containers.

> ✅ **Example**: VM 100 — enable HA for critical services like DNS, database, or web server.

### 2. Monitor VM Failover

You can monitor failover events via:

```bash
# View HA logs
journalctl -u pve-ha

# View cluster health
pve-ha --status
```

> 💡 **Pro tip**: Use `pvesh` to set custom failover policies — e.g., “run on node 1, then node 2” or “run on any available node”.

---

## Step 5: Automate and Monitor

### 1. Set Up Alerts

Use `pve-notify` for email/SMS alerts:

```bash
# Install notify
apt install pve-notify

# Configure alerts
pvesh set /cluster/notify --enabled=1 --smtp-server=smtp.gmail.com --smtp-user=your-email@gmail.com
```

### 2. Monitor via WebUI

Go to **HA → Cluster → VM Failover History**

You’ll see logs like:

```
VM 100 failed on node1 → migrated to node2 → success
```

> 💡 **Pro tip**: Set up Grafana + Prometheus for advanced monitoring.

---

## Troubleshooting Common Issues

| Issue | Solution |
|--------|----------|
| “Cluster not reachable” | Check network connectivity between nodes |
| “Storage not available” | Verify iSCSI connection, check `iscsiadm -m node -l` |
| “Node not joining cluster” | Ensure node IP and hostname are correct, check `pveam status` |
| “HA not enabled” | Run `pvesh set /cluster/ha/config --enabled=1` |
| “Fencing failed” | Ensure IPMI/SSH access, check `pvecm status` |

---

## Final Thoughts: Why HA Matters in Your Home Lab

Proxmox VE HA is not just for enterprise deployments — it’s a **powerful, cost-effective way** to ensure your home lab is resilient, scalable, and always available.

By setting up a cluster with shared storage, fencing, and VM failover, you’re not just building a lab — you’re building a **production-grade virtual infrastructure**.

> 🏆 Bonus: You can even automate backups, snapshots, and VM migrations using `proxmox-backup` or `pve-backup`.

---

## What’s Next?

- Set up Proxmox HA with **Ceph** for distributed storage  
- Configure **PVE Container HA**  
- Integrate with **Zabbix** or **Grafana** for monitoring  
- Automate VM provisioning using **Ansible** or **Terraform**

---

## Want to Go Further?

Join the Proxmox community — they’re active and helpful.  
Also, check out the official docs:  
👉 https://pve.proxmox.com/wiki/HA

---

**Thank you for reading!**  
If you found this helpful, share it with your home lab friends. Let me know if you want a step-by-step video or script for automation.

Yash — building resilient home labs, one cluster at a time. 🚀
