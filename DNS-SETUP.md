# DNS Configuration Guide for lukasnilsson.com

## Quick Setup Checklist

### ✅ Step 1: Configure DNS at Your Domain Registrar

Go to where you bought the domain (GoDaddy, Namecheap, Cloudflare, etc.) and add these DNS records:

#### For Apex Domain (lukasnilsson.com):
Add **4 A records** pointing to GitHub Pages IPs:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | @ | 185.199.108.153 | 3600 |
| A | @ | 185.199.109.153 | 3600 |
| A | @ | 185.199.110.153 | 3600 |
| A | @ | 185.199.111.153 | 3600 |

**Note:** Some registrars use different notation:
- `@` = apex domain (lukasnilsson.com)
- Blank/empty = apex domain
- `lukasnilsson.com` = apex domain

#### For WWW Subdomain (www.lukasnilsson.com) - Optional:
| Type | Name | Value | TTL |
|------|------|-------|-----|
| CNAME | www | lukas-nilsson.github.io | 3600 |

### ✅ Step 2: Configure GitHub Pages

1. Go to: https://github.com/Lukas-Nilsson/lukas-nilsson.github.io/settings/pages
2. Under "Custom domain", enter: `lukasnilsson.com`
3. Click "Save"
4. **Wait** for GitHub to verify (can take 5-60 minutes)
5. Once verified, check "Enforce HTTPS"

### ✅ Step 3: Verify DNS Propagation

Check if DNS is working:
- https://www.whatsmydns.net/#A/lukasnilsson.com
- https://dnschecker.org/#A/lukasnilsson.com

All locations should show the 4 GitHub IPs listed above.

## Common Issues & Solutions

### ❌ "Domain does not resolve to the GitHub Pages server"

**Cause:** DNS records not configured or not propagated yet.

**Solution:**
1. Verify DNS records are added at your registrar
2. Wait 24-48 hours for full propagation
3. Check DNS propagation status (links above)
4. Make sure you're using the correct IPs (GitHub Pages IPs, not generic GitHub IPs)

### ❌ "NotServedByPagesError"

**Cause:** GitHub can't find your site content under the domain.

**Solution:**
1. Verify GitHub Pages source is set to **"GitHub Actions"** (not "Deploy from a branch")
2. Check that the `CNAME` file exists in `public/CNAME` (✅ it does)
3. Verify the GitHub Actions workflow completed successfully
4. Make sure the domain is entered correctly in GitHub Pages settings

### ❌ Site loads but shows "404" or GitHub's default page

**Cause:** DNS is working but GitHub Pages isn't configured correctly.

**Solution:**
1. Go to Settings → Pages
2. Verify "Source" is set to **"GitHub Actions"**
3. Check Actions tab - ensure the latest deployment succeeded
4. Try removing and re-adding the custom domain

### ❌ HTTPS not working / "Not Secure"

**Cause:** HTTPS not enabled or DNS not fully verified.

**Solution:**
1. Wait for GitHub to verify your domain (check Settings → Pages)
2. Once verified, check "Enforce HTTPS"
3. Wait 5-10 minutes for SSL certificate to provision

## Testing Your Setup

### Check DNS Records:
```bash
# Check A records
dig lukasnilsson.com A

# Should return 4 IPs:
# 185.199.108.153
# 185.199.109.153
# 185.199.110.153
# 185.199.111.153
```

### Check GitHub Pages Status:
- Go to: https://github.com/Lukas-Nilsson/lukas-nilsson.github.io/settings/pages
- Look for green checkmark next to your domain
- Check "Enforce HTTPS" is available (means domain is verified)

## Registrar-Specific Guides

### Cloudflare
1. Go to DNS → Records
2. Add 4 A records with name `@` and the 4 GitHub IPs
3. Set proxy status to "DNS only" (gray cloud, not orange)
4. Wait for propagation

### GoDaddy
1. Go to DNS Management
2. Add 4 A records with Host `@` and the 4 GitHub IPs
3. Save and wait

### Namecheap
1. Go to Advanced DNS
2. Add 4 A records with Host `@` and the 4 GitHub IPs
3. Save and wait

## Still Having Issues?

1. **Double-check DNS records** - Make sure all 4 A records are added
2. **Wait longer** - DNS can take up to 48 hours to fully propagate
3. **Check GitHub Actions** - Ensure deployments are succeeding
4. **Verify CNAME file** - Should contain `lukasnilsson.com` (✅ it does)
5. **Clear browser cache** - Try incognito/private browsing mode

## Current Status

- ✅ CNAME file exists: `public/CNAME` contains `lukasnilsson.com`
- ✅ GitHub Actions workflow configured
- ✅ Workflow copies CNAME to dist folder
- ⏳ DNS configuration needed at registrar
- ⏳ GitHub Pages custom domain needs to be set


