---
title: "Backups & Disaster Recovery for Home Labs: Production-Grade with Borg Backup"
description: "Master backup and disaster recovery for your home lab using Borg Backup — secure, efficient, and production-ready strategies for self-hosted environments."
pubDate: "2026-11-19"
updatedDate: "2026-11-19"
author: "Yash"
tags: ["devops", "cloud", "security", "homelab"]
---

## Why Backup Your Home Lab — Seriously

You’ve spent months (or years) building your home lab — virtual machines, containerized services, custom configs, personal development stacks, and maybe even your own Kubernetes cluster. You’ve got it all running in a beautiful, self-hosted environment. But what if something goes wrong? A failed drive, a misconfigured VM, a ransomware attack, or even a simple typo that breaks your DNS? Without backups, you’re staring at a blank slate — and that’s unacceptable.

This post is your **production-grade guide to securing your home lab using Borg Backup**, the fast, deduplicated, and immutable backup tool designed for serious users. We’ll cover:

- Installing and configuring Borg Backup
- Setting up automated, incremental backups for VMs, containers, and system configs
- Building disaster recovery workflows
- Monitoring, restoring, and managing backups
- Best practices for long-term data retention and security

---

## What is Borg Backup?

Borg Backup is a deduplicated, immutable backup tool written in Go. It's designed for **enterprise-grade reliability** — not just for home labs, but for production systems too. Think of it as a hybrid between `rsync` and `tar` — with **deduplication**, **encryption**, **incremental backup**, and **immutable snapshots**.

Key features:

- **Deduplication** — saves space by storing unique data blocks only once.
- **Incremental backups** — only backup what’s changed since the last backup.
- **Immutable snapshots** — each backup is a read-only snapshot; no accidental overwrites.
- **Compression** — built-in, configurable compression for reduced storage.
- **Encryption** — supports AES-256 encryption with keys stored securely.
- **Remote backups** — backups can go to local disks, remote SSH servers, or cloud storage.

Borg is **not** a “backup for beginners.” It’s a tool that demands discipline — but with that discipline, it becomes **the most reliable backup system you’ll ever use**.

---

## Installation and Setup

### Prerequisites

Ensure you’re running a recent Linux distribution (Ubuntu 20.04+, CentOS 8+, Arch Linux, etc.). Borg Backup requires `python3` and `bash`, and optionally `ssh` if you’re backing up to remote systems.

Install Borg via package manager or from source:

#### Ubuntu/Debian

```bash
sudo apt update
sudo apt install borgbackup
```

#### Arch Linux

```bash
sudo pacman -S borgbackup
```

#### From Source

```bash
# Clone and build
git clone https://github.com/borgbackup/borg
cd borg
make

# Install
sudo make install
```

### Create a Borg Repository

A Borg repository is a single directory that holds all your backup data. You can store it locally or remotely.

```bash
# Create a repo (local example)
borg init --encryption=aes-256-plain --repo /path/to/my-backup-repo

# Or remote
borg init --encryption=aes-256-plain --repo ssh://user@backup-server:/path/to/repo
```

> 💡 **Security Tip**: Use `--encryption=aes-256-plain` for basic encryption. For production, consider `--encryption=aes-256-plain+keyfile` or `--encryption=none+keyfile` if you’re managing keys via external tools like `gpg`.

---

## Basic Backup Workflow

Let’s say you want to back up your entire home lab, including VMs, containers, configs, and data.

### Step 1: Define the Backup Path

```bash
BACKUP_DIR="/home/labs"
REPO="/mnt/backup/repo"
```

### Step 2: Create a Backup

```bash
borg create --stats \
  --compression lz4 \
  --exclude '*.log' \
  --exclude 'tmp/*' \
  --exclude 'cache/*' \
  --exclude 'swapfile' \
  --exclude '*.tmp' \
  --exclude 'node_modules' \
  --exclude 'venv' \
  --exclude 'docker-compose.yml' \
  --exclude 'vagrantfile' \
  --exclude 'snapshots' \
  --exclude 'logs' \
  $REPO::backup-$(date +%Y-%m-%d) \
  $BACKUP_DIR
```

### Step 3: Schedule with Cron

Add to your crontab:

```bash
# Backup every day at 2 AM
0 2 * * * /usr/bin/borg create --stats --compression=lz4 \
  /mnt/backup/repo::backup-$(date +%Y-%m-%d) \
  /home/labs \
  --exclude '*.log' \
  --exclude 'tmp/*' \
  --exclude 'cache/*' \
  --exclude 'swapfile' \
  --exclude '*.tmp' \
  --exclude 'node_modules' \
  --exclude 'venv' \
  --exclude 'docker-compose.yml' \
  --exclude 'vagrantfile' \
  --exclude 'snapshots' \
  --exclude 'logs'
```

> ✅ **Pro Tip**: Use `--exclude` carefully. Exclude logs, caches, temp dirs, and Docker layers to avoid bloating your repo.

---

## Backing Up Virtual Machines (VMs)

Backing up VMs is trickier — you can’t just `borg create /var/lib/libvirt` and expect to recover cleanly.

### Option 1: Backup VM Disk Images (Recommended)

If you’re using KVM/QEMU, back up the VM disk image directly:

```bash
borg create --stats \
  $REPO::vm-backup-$(date +%Y-%m-%d) \
  /var/lib/libvirt/images/myvm.qcow2

# OR if you’re using ZFS or BTRFS
borg create --stats \
  $REPO::vm-backup-$(date +%Y-%m-%d) \
  /mnt/zfs/myvm
```

> 💡 **Important**: Back up the disk image, not the VM config. Use `virsh dumpxml myvm > myvm.xml` to back up config separately.

### Option 2: Use `borgmatic` for Automation

`borgmatic` is a Python script that automates Borg backups with smart defaults, cron integration, and email alerts.

Install:

```bash
pip3 install borgmatic
```

Create `borgmatic.conf`:

```ini
[repo]
location = /mnt/backup/repo

[backup]
paths = /home/labs
exclude = '*.log', 'tmp/*', 'cache/*', 'swapfile', '*.tmp', 'node_modules', 'venv', 'docker-compose.yml', 'vagrantfile', 'snapshots', 'logs'

[remote]
location = ssh://user@backup-server:/mnt/repo

[encryption]
encryption = aes-256-plain
keyfile = /etc/borg/backup.key

[compression]
algorithm = lz4

[prune]
keep-daily = 7
keep-weekly = 4
keep-monthly = 6
```

Run:

```bash
borgmatic
```

> ✅ **Pros**: Self-contained, automated, and handles VCS, checksums, and pruning logically.

---

## Setting Up Disaster Recovery — The Real Test

Now comes the hard part: **restoring your lab**.

### Step 1: Restore a File or Directory

```bash
borg extract --stats \
  $REPO::backup-2026-11-18 \
  /home/labs/configs
```

> 🚨 **Warning**: This overwrites the target directory. Use `--dry-run` first:

```bash
borg extract --dry-run \
  $REPO::backup-2026-11-18 \
  /home/labs/configs
```

### Step 2: Restore a VM Disk

If you backed up `/var/lib/libvirt/images/myvm.qcow2`, restore it:

```bash
borg extract --stats \
  $REPO::vm-backup-2026-11-18 \
  /var/lib/libvirt/images/myvm.qcow2
```

Then use `virsh define myvm.xml` to restore the VM config.

### Step 3: Full System Restore

```bash
# Restore entire home lab
borg extract --stats \
  $REPO::backup-2026-11-18 \
  /home/labs

# Restore specific services
borg extract --stats \
  $REPO::backup-2026-11-18 \
  /home/labs/nginx/conf.d
```

> 💡 **Pro Tip**: Use `borg list` to inspect available snapshots:

```bash
borg list $REPO
```

---

## Monitoring and Maintenance

### 1. Monitor Backup Health

```bash
borg check $REPO
```

This checks for corruption, inconsistencies, and broken references.

### 2. Prune Old Backups

```bash
borg prune --stats \
  --keep-daily=7 \
  --keep-weekly=4 \
  --keep-monthly=6 \
  $REPO
```

> 🔁 **Why prune?** Prevents your repo from growing indefinitely.

### 3. Monitor Storage Usage

```bash
borg info $REPO
```

This shows total size, deduplication ratio, and available space.

---

## Best Practices for Home Labs

### 1. **Use Immutable Snapshots**
Never delete or overwrite a backup. Borg snapshots are immutable — they’re read-only. Use `--prefix` or `::` to version your snapshots.

### 2. **Encrypt Everything**
Use `--encryption=aes-256-plain` or `--encryption=aes-256-plain+keyfile` to protect your backups.

### 3. **Test Your Restores**
At least once a month, restore a backup — even if it’s just a single file. Your backup is only as good as your ability to restore.

### 4. **Separate Backup from Data**
Don’t store backups on the same disk as your data. Use separate drives or remote servers.

### 5. **Use Remote Repositories**
If possible, back up to a remote server or cloud storage (S3, GCS, etc.) for added resilience.

---

## Advanced: Managing Multiple VMs or Services

If you have multiple VMs, use `borg create` with `--exclude-file` to avoid duplicating config files.

Example:

```bash
# Create a backup for all VMs
borg create --stats \
  $REPO::vm-backup-$(date +%Y-%m-%d) \
  /var/lib/libvirt/images/myvm1.qcow2 \
  /var/lib/libvirt/images/myvm2.qcow2 \
  --exclude 'myvm1/*.log' \
  --exclude 'myvm2/*.tmp'
```

Or use `--exclude-file` to load a list of exclusions.

---

## Conclusion: Borg Backup — Your Home Lab’s Safety Net

Borg Backup isn’t just a backup tool — it’s a **disaster recovery ecosystem**. It’s fast, deduplicated, secure, and designed for serious users. By implementing it in your home lab, you’re not just protecting your data — you’re protecting your time, your sanity, and your passion for self-hosting.

You might think “I’m just a home lab user,” but your system is a **production environment** — with your own DNS, your own email, your own code, your own data. And that deserves production-grade backup.

Start simple. Use `borg create` and `borg extract`. Add cron. Add `borgmatic` for automation. Add encryption. Add remote repos. And test — test — test.

---

## Final Checklist

✅ Installed Borg Backup  
✅ Created a secure repo  
✅ Scheduled daily incremental backups  
✅ Excluded unnecessary files  
✅ Tested restore of a file  
✅ Set up pruning to avoid bloat  
✅ Used immutable snapshots  
✅ Encrypted backups  
✅ Tested full system restore  

---

## Your Home Lab — Your Responsibility

Backups are not optional. They’re the safety net for your digital existence. Borg Backup gives you that net — fast, secure, and elegant.

Go ahead. Backup your lab. Protect your work. And never again fear a broken VM or a corrupted config.

---

## Further Reading

- [Borg Backup Official Docs](https://borgbackup.readthedocs.io/)
- [Borgmatic GitHub](https://github.com/borgmatic/borgmatic)
- [Borg Backup Security Guide](https://borgbackup.readthedocs.io/en/stable/security.html)

---

**Yash** — DevOps Engineer & Home Lab Enthusiast  
*Building systems, not just servers — one backup at a time.*
