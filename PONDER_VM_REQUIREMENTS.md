# Ponder Indexer VM Requirements

## 📊 Resource Requirements Analysis

### **Workload Characteristics for Morpheus Capital Claims**

- **Contracts**: 2 deposit pools (stETH + LINK)
- **Events**: `UserClaimed` events (~10-100 events/day initially)
- **Data Growth**: ~1MB-10MB/month of indexed data
- **API Load**: Frontend queries + potential external integrations
- **RPC Calls**: Real-time monitoring + historical sync

---

## 🖥️ VM Specifications by Scenario

### **Scenario 1: Development/Testing** 
*Low volume, single developer, non-critical*

```yaml
CPU: 1-2 vCPUs
RAM: 2-4 GB
Storage: 20-40 GB SSD
Network: 1 Gbps

Estimated Cost: $10-20/month
```

**Suitable for:**
- Local development
- Testing with testnet data
- Proof of concept

**Providers:**
- DigitalOcean: $12/month (1 vCPU, 2GB RAM, 50GB SSD)
- Linode: $10/month (1 vCPU, 2GB RAM, 50GB SSD)
- Vultr: $10/month (1 vCPU, 2GB RAM, 55GB SSD)

---

### **Scenario 2: Production - Small Scale** ⭐ **RECOMMENDED**
*Medium volume, production ready, room for growth*

```yaml
CPU: 2-4 vCPUs
RAM: 8 GB
Storage: 80-160 GB SSD
Network: 2-5 Gbps

Estimated Cost: $40-80/month
```

**Resource Breakdown:**
- **Node.js/Ponder**: 1-2 GB RAM, 1-2 vCPUs
- **PostgreSQL**: 4-6 GB RAM, 1-2 vCPUs
- **OS & Buffer**: 1-2 GB RAM
- **Database Growth**: ~5-10 GB/year
- **Logs & Temp**: ~10-20 GB

**Suitable for:**
- Production Morpheus dashboard
- Up to 1,000 UserClaimed events/day
- 10-50 concurrent API requests
- Multi-month data retention

**Providers:**
- **DigitalOcean**: $48/month (2 vCPUs, 8GB RAM, 160GB SSD)
- **Linode**: $40/month (2 vCPUs, 8GB RAM, 160GB SSD)
- **Hetzner**: €33/month (~$35) (2 vCPUs, 8GB RAM, 160GB SSD)

---

### **Scenario 3: Production - High Scale**
*High volume, multiple contracts, heavy API usage*

```yaml
CPU: 4-8 vCPUs
RAM: 16-32 GB
Storage: 200-500 GB SSD
Network: 5-10 Gbps

Estimated Cost: $100-200/month
```

**Suitable for:**
- Multiple Morpheus contracts indexing
- High API query volume
- Advanced analytics and reporting
- Long-term data retention (1+ years)

**Providers:**
- **DigitalOcean**: $96/month (4 vCPUs, 16GB RAM, 320GB SSD)
- **AWS EC2**: $120-150/month (c6i.xlarge + EBS)
- **Hetzner**: €59/month (~$65) (4 vCPUs, 16GB RAM, 320GB SSD)

---

## 🔧 Component-Specific Requirements

### **Ponder Application**
```yaml
Base Memory: 512MB - 2GB
Peak Memory: Up to 4GB during initial sync
CPU Usage: Low-medium (burst during sync)
Disk I/O: Low (mainly logs)
```

### **PostgreSQL Database**
```yaml
Shared Buffers: 25% of total RAM (2GB on 8GB system)
Work Memory: 4-16MB per connection
Maintenance Work Memory: 256MB - 1GB
Connection Pool: 10-30 connections max
```

### **System Overhead**
```yaml
OS (Ubuntu): ~500MB - 1GB RAM
Docker (if used): +200-500MB RAM
Monitoring: +100-300MB RAM
Nginx/Reverse Proxy: +50-100MB RAM
```

---

## 📈 Growth Planning

### **Data Growth Estimates**

| Timeframe | Events | Database Size | Storage Needed |
|-----------|--------|---------------|----------------|
| **1 Month** | 3,000 | ~5 MB | 20 GB total |
| **6 Months** | 18,000 | ~30 MB | 40 GB total |
| **1 Year** | 36,000 | ~60 MB | 80 GB total |
| **2 Years** | 72,000 | ~120 MB | 160 GB total |

*Assumes 100 UserClaimed events/day average*

### **Performance Scaling Points**

| Metric | Small VM | Medium VM | Large VM |
|--------|----------|-----------|----------|
| **Events/Day** | < 500 | 500-5,000 | 5,000+ |
| **API Queries/Min** | < 10 | 10-100 | 100+ |
| **Concurrent Users** | < 10 | 10-50 | 50+ |
| **Data Retention** | 6 months | 1-2 years | 2+ years |

---

## 🚀 Deployment Architectures

### **Single VM Setup** (Recommended for start)
```
┌─────────────────────────────────────────┐
│              VM (8GB RAM)                │
├─────────────────────────────────────────┤
│  Ponder App (2GB)                       │
│  PostgreSQL (4GB)                       │
│  Nginx + System (1GB)                   │
│  Buffer/Cache (1GB)                     │
└─────────────────────────────────────────┘
```

### **Separated Database** (For high scale)
```
┌─────────────────────┐    ┌──────────────────────┐
│   App Server        │    │   Database Server    │
│   (4GB RAM)         │────│   (16GB RAM)         │
│                     │    │                      │
│  Ponder App (2GB)   │    │  PostgreSQL (14GB)   │
│  Nginx (1GB)        │    │  System (2GB)        │
│  Buffer (1GB)       │    │                      │
└─────────────────────┘    └──────────────────────┘
```

---

## 💰 Cost Analysis

### **Monthly Costs by Provider** (Production Small Scale)

| Provider | Specs | Price | Notes |
|----------|--------|-------|-------|
| **Hetzner** | 4 vCPU, 8GB, 160GB | $35 | Best value, EU locations |
| **Linode** | 2 vCPU, 8GB, 160GB | $40 | Good performance, global |
| **DigitalOcean** | 2 vCPU, 8GB, 160GB | $48 | Excellent docs, managed DB option |
| **Vultr** | 2 vCPU, 8GB, 160GB | $40 | Good network, many locations |
| **AWS EC2** | t3.large | $60+ | Most features, higher cost |

### **Additional Costs**
- **Managed PostgreSQL**: +$15-30/month (optional)
- **Load Balancer**: +$10-20/month (if needed)
- **Backups**: +$5-15/month
- **Monitoring**: +$0-20/month
- **Domain & SSL**: +$10-20/year

---

## 🛠️ Optimization Strategies

### **Memory Optimization**
```bash
# PostgreSQL tuning
shared_buffers = 2GB           # 25% of RAM on 8GB system
effective_cache_size = 6GB     # 75% of RAM
work_mem = 16MB               # Per connection
maintenance_work_mem = 512MB   # For maintenance tasks
```

### **CPU Optimization**
- Use `max_parallel_workers = 2-4` in PostgreSQL
- Enable Node.js clustering for API serving
- Use nginx for static content serving
- Set appropriate process limits

### **Storage Optimization**
- Use SSD storage for database
- Set up log rotation
- Regular database maintenance (`VACUUM`, `ANALYZE`)
- Archive old data if not needed

### **Network Optimization**
- Use CDN for API responses (if global users)
- Connection pooling for database
- Gzip compression for API responses
- Rate limiting to prevent abuse

---

## 📋 **Final Recommendations**

### **For Morpheus Capital Claims (Start Here):**

```yaml
🎯 RECOMMENDED SETUP:
Provider: Hetzner or Linode
CPU: 2-4 vCPUs
RAM: 8 GB
Storage: 160 GB SSD
Cost: ~$35-45/month

Rationale:
✅ Handles expected load comfortably
✅ Room for 10x growth
✅ Cost-effective for the value
✅ Can upgrade easily when needed
```

### **Upgrade Triggers:**
- **CPU**: When sync takes > 1 hour or API response > 500ms
- **RAM**: When PostgreSQL cache hit ratio < 95%
- **Storage**: When > 80% full
- **Network**: When RPC calls get rate limited

### **Monitoring Setup:**
- **CPU/RAM/Disk**: Grafana + Prometheus
- **Database**: pgMonitor or built-in PostgreSQL stats  
- **Application**: Ponder built-in health checks
- **Alerts**: Discord/Slack webhooks for issues

---

## 🚀 Quick Start Command

```bash
# For a $40/month Linode instance
curl -H "Authorization: Bearer $LINODE_TOKEN" \
  -H "Content-Type: application/json" \
  -X POST https://api.linode.com/v4/linode/instances \
  -d '{
    "type": "g6-standard-2",
    "region": "us-east",
    "image": "linode/ubuntu22.04",
    "label": "morpheus-ponder-indexer",
    "tags": ["morpheus", "ponder", "indexer"],
    "root_pass": "your_secure_password"
  }'
```

This setup will handle the Morpheus Capital Claims indexing workload with plenty of headroom for growth! 🎉
