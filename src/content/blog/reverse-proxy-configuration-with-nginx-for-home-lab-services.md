---
title: "Reverse Proxy Nginx Setup for Home Lab Services"
description: "Master reverse proxy configuration with Nginx to securely expose and manage home lab services like Git, Docker, and Plex — production-grade, scalable, and beginner-friendly."
pubDate: "2026-11-16"
updatedDate: "2026-11-16"
author: "Yash"
tags: ["devops", "cloud", "security", "homelab"]
---

## Why Reverse Proxy with Nginx? The Home Lab Advantage

If you're running a home lab — whether it’s for learning, testing, or even small-scale production — you’re likely juggling multiple services: Docker containers, Git repositories, Plex media, SSH servers, and more. Each service typically runs on its own port, and managing direct access to them can become a logistical nightmare.

Enter **Nginx** — a lightweight, high-performance reverse proxy server that acts as a single entry point for all your services. It not only simplifies access, but also adds critical layers of security, performance optimization, and SSL termination.

In this post, we’ll walk you through a **production-grade Nginx reverse proxy setup** for your home lab — covering configuration, security, performance tuning, and real-world use cases.

---

## Prerequisites

Before diving in, ensure you have:

- A Linux machine (Ubuntu/Debian recommended) running your services
- Nginx installed and running (we’ll install it if needed)
- Services you want to proxy (e.g., Git, Docker, Plex, SSH, HTTP APIs)
- A domain name (or subdomains) pointing to your home lab IP
- Basic understanding of Linux CLI, ports, and service management

> 💡 Tip: Use subdomains like `git.yourlab.com`, `plex.yourlab.com`, `docker.yourlab.com` for clean routing.

---

## Step 1: Install and Configure Nginx

If Nginx isn't installed:

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install nginx

# Start and enable
sudo systemctl start nginx
sudo systemctl enable nginx
```

Check if it’s running:

```bash
sudo systemctl status nginx
```

Now, let’s create a basic configuration file for our reverse proxy.

---

## Step 2: Create Reverse Proxy Configuration

We’ll create a `reverse-proxy.conf` file in `/etc/nginx/sites-available/`:

```nginx
# /etc/nginx/sites-available/reverse-proxy.conf

server {
    listen 80;
    server_name yourlab.com;

    # Enable HTTPS (we’ll cover SSL later)
    # ssl_certificate /path/to/cert.crt;
    # ssl_certificate_key /path/to/cert.key;

    # Redirect HTTP to HTTPS (optional)
    # return 301 https://$host$request_uri;

    location / {
        proxy_pass http://localhost:8080; # Target service port
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

> 🔍 **Note**: `localhost:8080` is just an example. Replace it with your actual service port.

Enable this site:

```bash
sudo ln -s /etc/nginx/sites-available/reverse-proxy.conf /etc/nginx/sites-enabled/
sudo nginx -t  # Test config
sudo systemctl reload nginx
```

---

## Step 3: Proxy Multiple Services — The Real Power

One of the biggest advantages of reverse proxy is **service consolidation**. Let’s configure multiple services.

### Example Configurations

#### 1. Git Server (via SSH)

We’ll proxy SSH connections to a Git server:

```nginx
server {
    listen 22;
    server_name git.yourlab.com;

    # SSH proxy — this requires SSH server to be running on localhost:22
    # Important: This is NOT recommended for production SSH — use SSH keys only
    # But for home lab, it’s fine for testing
    proxy_pass http://localhost:22;
    # For SSH, we don’t use proxy_pass — use SSH tunneling or direct port forwarding
    # Instead, we’ll use SSH reverse proxy via SSH tunneling in next section
}
```

⚠️ **Important**: Nginx does **not** proxy SSH directly. SSH is a protocol that requires a different approach. Instead, we’ll use:

- SSH key-based authentication
- SSH tunneling
- Or, if you’re proxying Git over HTTP(S) (using GitLab/Gitea), you can proxy that via Nginx.

#### 2. Docker Registry (HTTP)

If you’re running a local Docker registry:

```nginx
server {
    listen 80;
    server_name registry.yourlab.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

#### 3. Plex Media Server

```nginx
server {
    listen 80;
    server_name plex.yourlab.com;

    location / {
        proxy_pass http://localhost:32400;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

#### 4. GitLab/Gitea via HTTP(S)

```nginx
server {
    listen 80;
    server_name gitlab.yourlab.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host gitlab.yourlab.com;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## Step 4: Enable HTTPS with Let’s Encrypt (Free SSL)

Nginx supports HTTPS, and we can automate SSL certificates using **Certbot**.

Install Certbot:

```bash
sudo apt install certbot python3-certbot-nginx
```

Run Certbot:

```bash
sudo certbot --nginx -d yourlab.com -d git.yourlab.com -d plex.yourlab.com -d registry.yourlab.com
```

> 📌 Certbot will auto-generate and install SSL certificates and modify your Nginx config to serve HTTPS.

Afterwards, update your server blocks to listen on 443:

```nginx
server {
    listen 443 ssl http2;
    server_name yourlab.com;

    ssl_certificate /etc/letsencrypt/live/yourlab.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourlab.com/privkey.pem;

    # ... rest of config
}
```

You can also redirect HTTP to HTTPS:

```nginx
server {
    listen 80;
    server_name yourlab.com;

    return 301 https://$host$request_uri;
}
```

---

## Step 5: Advanced Nginx Optimization for Home Lab

Let’s tune Nginx for performance and security.

### 1. Increase Worker Processes

```nginx
worker_processes auto;
worker_connections 1024;
```

### 2. Enable Gzip Compression

```nginx
gzip on;
gzip_types text/plain text/css application/json application/javascript text/javascript;
gzip_vary on;
```

### 3. Add Security Headers

```nginx
add_header X-Frame-Options "DENY" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header X-Content-Type-Options "nosniff" always;
```

### 4. Limit Request Size and Rate

```nginx
limit_req_zone $binary_remote_addr zone=limit_req_zone:10m rate=1r/s;
limit_req_zone $binary_remote_addr zone=limit_req_zone:10m rate=1r/s;
limit_req_zone $binary_remote_addr zone=limit_req_zone:10m rate=1r/s;
```

### 5. Use Cache (for static assets)

```nginx
location ~* \.(png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

---

## Step 6: Managing Multiple Configurations — Include Files

As your home lab grows, keep configs organized.

Create `/etc/nginx/sites-available/` and `/etc/nginx/sites-enabled/` for each service.

Example:

```nginx
# /etc/nginx/sites-available/gitlab.conf
server {
    listen 80;
    server_name gitlab.yourlab.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Then symlink:

```bash
sudo ln -s /etc/nginx/sites-available/gitlab.conf /etc/nginx/sites-enabled/
```

---

## Step 7: Testing and Troubleshooting

After configuration:

1. Test config: `sudo nginx -t`
2. Reload: `sudo systemctl reload nginx`
3. Check logs: `sudo journalctl -u nginx`
4. Test access: `curl https://git.yourlab.com`

> 🔍 If you see `502 Bad Gateway`, check:
> - Service is running
> - Ports are open
> - Nginx user has access to service
> - Proxy headers are correctly set

---

## Step 8: SSH Proxy — Advanced Setup (Optional)

Nginx doesn’t proxy SSH directly — use **SSH tunnels or SSH reverse proxy** instead.

Example: Use SSH tunneling to expose services.

```bash
ssh -R 8080:localhost:8080 user@yourlab.com
```

Or use **SSH forwarding**:

```bash
ssh -L 8080:localhost:8080 user@yourlab.com
```

Then, expose the port via Nginx:

```nginx
location / {
    proxy_pass http://localhost:8080;
}
```

---

## Step 9: DNS & Firewall Configuration

Ensure your DNS points to your home lab IP.

- Use `dig yourlab.com` to check
- Use `ufw allow 80,443` or `sudo ufw allow 'Nginx Full'`

---

## Step 10: Automate with Ansible (Optional)

For a more scalable home lab, automate with Ansible:

```yaml
- name: Configure Nginx reverse proxy
  hosts: lab-server
  tasks:
    - name: Install Nginx
      apt:
        name: nginx
        state: present

    - name: Copy proxy config
      copy:
        src: ./reverse-proxy.conf
        dest: /etc/nginx/sites-available/reverse-proxy.conf

    - name: Enable site
      file:
        path: /etc/nginx/sites-enabled/reverse-proxy.conf
        state: link

    - name: Reload nginx
      systemd:
        name: nginx
        state: reloaded
```

---

## Conclusion: Why This Setup Matters

Reverse proxying with Nginx is more than just “exposing services” — it’s about:

- **Centralized Management**: One entry point for all services.
- **Security**: SSL termination, rate limiting, and headers.
- **Performance**: Caching, compression, and static asset delivery.
- **Scalability**: Easy to add new services without changing IP/port rules.

Whether you’re hosting a GitLab instance, Plex, Docker registry, or even a personal website — this setup gives you a **production-grade**, **secure**, and **scalable** infrastructure for your home lab.

---

## Final Tips

- Always test configs before reloading Nginx.
- Use `sudo nginx -t` and `journalctl -u nginx`.
- Monitor logs for errors (e.g., `tail -f /var/log/nginx/error.log`).
- Keep Nginx updated: `sudo apt update && sudo apt upgrade nginx`.
- Consider using **Nginx Plus** for enterprise features (not necessary for home lab).

---

## Next Steps

- Add **Let’s Encrypt auto-renewal** using `certbot renew`
- Set up **rate limiting** for abusive users
- Integrate with **Cloudflare** for CDN and DDoS protection
- Explore **Nginx Unit** for containerized service management

---

## Want More?

Check out:

- **Nginx Official Docs**: https://nginx.org/en/docs/
- **Certbot Docs**: https://certbot.eff.org/
- **Home Lab Resources**: https://github.com/homelab/home-lab

You now have a **fully functional, production-ready reverse proxy** for your home lab — deploy it, scale it, and never worry about exposed ports again.

Happy proxying 🚀

---

**Author**: Yash  
**Published**: November 16, 2026  
**Tags**: #devops #nginx #home-lab #reverse-proxy #security #docker #git #plex #production-grade
