---
title: "Monitor Your Home Lab Like a Pro: Grafana & Prometheus for Real-Time Performance Insights"
description: "Turn your home lab into a production-grade monitoring system using Grafana and Prometheus. Learn how to track CPU, memory, disk, and network metrics — and set up alerts for when things go sideways."
pubDate: "2026-11-15"
updatedDate: "2026-11-15"
author: "Yash"
tags: ["devops", "cloud", "security", "homelab"]
---

## Why Monitor Your Home Lab?

You've spent weeks (or months) building your home lab — maybe it’s a Raspberry Pi cluster, a Proxmox VM farm, or even a bare-metal server running Docker and Kubernetes. You’ve got your tools, your configs, your custom scripts… but what happens when your lab starts to slow down? Or worse — when something breaks silently?

Without proper monitoring, your home lab becomes a black box. You’ll lose visibility into performance, availability, and health — and eventually, you’ll end up troubleshooting blind.

That’s where **Grafana** and **Prometheus** come in.

Together, they form one of the most powerful, open-source, and production-grade monitoring stacks available — and they’re *perfect* for home labs.

In this guide, you’ll learn how to:

- Install and configure Prometheus to scrape metrics from your systems.
- Visualize those metrics with Grafana dashboards.
- Set up alerts for CPU, memory, disk, and network usage.
- Extend monitoring to containers, VMs, and services.

By the end, you’ll have a real-time, self-service monitoring station that feels like you’re managing a cloud infrastructure — even if you’re running it from your garage.

---

## Architecture Overview: Prometheus + Grafana

### Prometheus: The Collector

Prometheus is a time-series database and monitoring system built for infrastructure monitoring. It scrapes metrics from targets (like servers, containers, or services) at regular intervals, stores them, and exposes them via a query API.

### Grafana: The Dashboard Engine

Grafana is a visualization tool that pulls metrics from Prometheus (or other data sources) and presents them in intuitive dashboards, graphs, and alerts. It’s the Swiss Army knife of operational visibility.

Together, Prometheus + Grafana = **The Home Lab Monitoring Stack**

---

## Prerequisites

Before we begin, ensure:

- A Linux server (Ubuntu 22.04+ recommended) to run Prometheus and Grafana.
- Network access from your home lab nodes to the monitoring server.
- Basic familiarity with Linux CLI, Docker, or systemd.

> 💡 *Tip: You can run everything in Docker if you prefer, but for production-grade stability, we’ll install Prometheus and Grafana natively.*

---

## Step 1: Install Prometheus

### Download and Extract

```bash
cd /tmp
wget https://github.com/prometheus/prometheus/releases/download/v2.55.0/prometheus-2.55.0.linux-amd64.tar.gz
tar -xzf prometheus-2.55.0.linux-amd64.tar.gz
cd prometheus-2.55.0.linux-amd64
```

### Configure Prometheus

Copy the default config:

```bash
cp prometheus.yml.example prometheus.yml
```

Edit `prometheus.yml`:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'nodes'
    static_configs:
      - targets: ['192.168.1.10', '192.168.1.11'] # ← Update with your lab IPs
```

> 💡 *Replace `192.168.1.10`, `192.168.1.11` with IPs of your lab nodes (servers, VMs, containers).*

### Start Prometheus

```bash
./prometheus --config.file=prometheus.yml --web.listen-address=:9090
```

Check status at: `http://localhost:9090`

---

## Step 2: Install Grafana

### Download and Extract

```bash
cd /tmp
wget https://github.com/grafana/grafana/releases/download/v10.4.0/grafana-10.4.0-linux-amd64.tar.gz
tar -xzf grafana-10.4.0-linux-amd64.tar.gz
cd grafana-10.4.0-linux-amd64
```

### Configure Grafana

Copy the default config:

```bash
cp conf/grafana.ini.example conf/grafana.ini
```

Edit `conf/grafana.ini`:

```ini
[server]
http_port = 3000

[database]
type = postgres
host = localhost
user = grafana
password = yourpassword
name = grafana
```

> 💡 *Set a strong password — Grafana stores secrets in config by default.*

### Start Grafana

```bash
./bin/grafana-server --config.conf
```

Access Grafana at: `http://localhost:3000`

> ✅ First time login: Username = `admin`, Password = `admin` (change this!)

---

## Step 3: Add Prometheus as a Data Source

1. Log in to Grafana → **Configuration** → **Data Sources** → **Add Data Source**
2. Select **Prometheus**
3. Set URL to: `http://localhost:9090`
4. Click **Save & Test**

> 💡 *Ensure Prometheus is reachable from Grafana. If you're running them on different hosts, update the URL accordingly.*

---

## Step 4: Create Dashboards

### Default Node Exporter Dashboard (CPU, Memory, Disk, Network)

1. In Grafana, navigate to **Dashboards** → **Import**
2. Import ID: `1860` (Node Exporter Dashboard) from [Grafana Cloud](https://grafana.com/grafana/dashboards/1860)

> 💡 *This dashboard pulls metrics from `node_exporter` installed on your lab nodes.*

### Install Node Exporter on Your Lab Nodes

Node Exporter is a Prometheus exporter that exposes system metrics.

#### On each node:

```bash
curl -L https://github.com/prometheus/node_exporter/releases/download/v1.44.0/node_exporter-1.44.0.linux-amd64.tar.gz | tar -xzf -
cd node_exporter-1.44.0.linux-amd64
./node_exporter --web.listen-address=:9100
```

> 💡 *Set up systemd service for persistence.*

#### Configure Prometheus to scrape Node Exporter

Edit `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'nodes'
    static_configs:
      - targets: ['192.168.1.10:9100', '192.168.1.11:9100']
```

Restart Prometheus:

```bash
./prometheus --config.file=prometheus.yml --web.listen-address=:9090
```

---

## Step 5: Set Up Alerts

### Create Alert Rules

Create a file: `/etc/prometheus/alert.rules.yml`

```yaml
groups:
  - name: node_alerts
    rules:
      - alert: HighCPUUsage
        expr: node_cpu_seconds_total{job="nodes"} > 80
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High CPU usage on {{ $labels.instance }}"
          description: "CPU usage has exceeded 80% for 5 minutes."

      - alert: LowMemory
        expr: node_memory_MemAvailable_bytes{job="nodes"} < 100Mi
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Low memory on {{ $labels.instance }}"
          description: "Available memory below 100Mi for 5 minutes."
```

### Load Alert Rules

In `prometheus.yml`:

```yaml
rule_files:
  - "/etc/prometheus/alert.rules.yml"
```

Restart Prometheus.

---

## Step 6: Configure Alert Notifications (email, Slack, etc.)

### Install Alertmanager

Download and install Alertmanager (Prometheus’s alert manager):

```bash
cd /tmp
wget https://github.com/prometheus/alertmanager/releases/download/v0.25.0/alertmanager-0.25.0.linux-amd64.tar.gz
tar -xzf alertmanager-0.25.0.linux-amd64.tar.gz
cd alertmanager-0.25.0.linux-amd64
```

Edit `alertmanager.yml`:

```yaml
global:
  resolve_timeout: 5m

route:
  group_by: ['alertname']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 1h
  receiver: 'email'

receivers:
  - name: 'email'
    email_configs:
      - to: 'your@email.com'
        from: 'alertmanager@yourhome.lab'
        smtphost: 'smtp.gmail.com:587'
        smtpuser: 'your@gmail.com'
        smtppassword: 'your-app-password'
        smtpauth: 'login'
        smtpfrom: 'alertmanager@yourhome.lab'
```

> 💡 *For Gmail, enable 2FA and generate an app password.*

Start Alertmanager:

```bash
./alertmanager --config.file=alertmanager.yml
```

Update `prometheus.yml` to include Alertmanager:

```yaml
alerting:
  alertmanagers:
    - static_configs:
        - targets: ['localhost:9093']
```

Restart Prometheus.

---

## Step 7: Create Grafana Alert Rules

1. In Grafana → **Alerting** → **Alert Rules**
2. Add a new rule using Prometheus as a data source.
3. Define condition (e.g., `node_cpu_seconds_total > 80`).
4. Set **Alertmanager** as the receiver.
5. Save.

> 💡 *You can also trigger alerts via Slack or Telegram by configuring `receivers` in Alertmanager.*

---

## Step 8: Advanced Monitoring (Optional)

### Monitor Docker Containers

Install `node_exporter` + `docker-exporter` on your Docker host.

```bash
curl -L https://github.com/prometheus/node_exporter/releases/download/v1.44.0/node_exporter-1.44.0.linux-amd64.tar.gz | tar -xzf -
cd node_exporter-1.44.0.linux-amd64
./node_exporter --web.listen-address=:9100
```

Install `docker-exporter`:

```bash
git clone https://github.com/prometheus-community/docker-exporter.git
cd docker-exporter
make build
./docker-exporter -listen-address :9300
```

Add to Prometheus:

```yaml
scrape_configs:
  - job_name: 'docker'
    static_configs:
      - targets: ['localhost:9300']
```

Import Docker Dashboard (ID: `1226`) from Grafana Cloud.

### Monitor Kubernetes (if you’re running K8s in your lab)

Install `kube-state-metrics` and `node-exporter` in your cluster.

Configure Prometheus to scrape metrics from:

```yaml
- job_name: 'kubernetes-apiservers'
  kubernetes_sd_configs:
    - role: endpoints
      namespaces:
        names: [kube-system]
```

Import Kubernetes Dashboard (ID: `1214`).

---

## Bonus: Auto-Discovery with Service Discovery

Instead of static IPs, use `kubernetes_sd`, `file_sd`, or `consul_sd` for automatic service discovery.

Example with `kubernetes_sd`:

```yaml
- job_name: 'kubernetes-nodes'
  kubernetes_sd_configs:
    - role: endpoints
  relabel_configs:
    - source_labels: [__address__]
      target_label: instance
```

> 💡 *This is great if you’re managing multiple VMs or containers dynamically.*

---

## Best Practices for Home Lab Monitoring

✅ **Use `node_exporter`** — it’s light, reliable, and exposes everything you need.

✅ **Set up alerts for 90th percentile metrics** — not just averages.

✅ **Use Grafana’s templating** — create reusable dashboard templates for VMs, containers, etc.

✅ **Back up Prometheus data** — use `--storage.tsdb.retention.time` to control how long metrics are stored.

✅ **Run Grafana with HTTPS** — enable TLS for secure access.

✅ **Set up Grafana authentication** — use basic auth, LDAP, or SSO.

✅ **Create custom dashboards** — for each VM, container, or service — with unique labels and metrics.

✅ **Use Grafana Loki** (optional) — for logs.

---

## Wrap-Up: Your Home Lab is Now Monitored

You’ve just built a full-stack monitoring system that:

- Visualizes real-time metrics (CPU, memory, disk, network).
- Sends alerts when things go wrong.
- Scales to containers, VMs, and Kubernetes.
- Is easily extensible for custom metrics or services.

You’re no longer guessing when your lab slows down or fails — you’re seeing it in real time, in a beautiful, interactive dashboard.

### Next Steps:

- Integrate with **Loki** for logs.
- Add **Telegraf** for custom metrics.
- Deploy **Prometheus Operator** if you’re running Kubernetes.
- Create **custom dashboards** for your specific services (e.g., Nginx, MySQL, Redis).
- Use **Grafana Cloud** to sync dashboards across multiple home labs.

---

## Final Thoughts

Monitoring is not optional — it’s **essential** for maintaining uptime, performance, and sanity in your home lab. Prometheus + Grafana are open-source, powerful, and production-ready — and they’re *perfect* for home labs.

So don’t wait — start today. Your lab will thank you.

> 🚀 *You’re not just managing a lab — you’re managing a small-scale production environment.*

---

## Want More?

Check out these resources:

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Node Exporter GitHub](https://github.com/prometheus/node_exporter)
- [Grafana Cloud Dashboards](https://grafana.com/grafana/dashboards/)

---

## Author

**Yash** — DevOps enthusiast and home lab builder. Loves open source, monitoring, and building automation. Currently running a 3-node Proxmox cluster with Prometheus + Grafana + Loki.

> Follow me for more home lab tips, automation scripts, and production-grade setups.

---
