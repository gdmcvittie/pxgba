# NOTE: THIS IS OUTDATED AND MAY BE INCORRECT NOW

# PxGBA Build Server Deployment Guide

This guide provides step-by-step instructions for deploying the standalone GBA build server on a Virtual Private Server (VPS) running **Debian Linux**.

---

## Prerequisites
1. A Debian Linux VPS with root or sudo access.
2. The IP address of your VPS (referred to as `YOUR_VPS_IP` in this guide).
3. A terminal client (Windows Command Prompt, PowerShell, or Git Bash).

---

## Step 1: Connect to Your VPS
Open PowerShell or Command Prompt on your computer and run the following command to connect to your VPS as the `root` user:

```bash
ssh root@YOUR_VPS_IP
```
*If prompted with a message about "authenticity of host", type `yes` and press Enter. Then type your VPS root password when prompted (characters will not show as you type).*

---

## Step 2: Install System Dependencies
Update the system packages and install development tools (such as `make`, `gcc`, `git`, and `python3`) which are required to build GBA ROMs:

```bash
# Update package repositories
sudo apt update -y && sudo apt upgrade -y

# Install compiler tools, build essentials, git, and python3
sudo apt install -y build-essential git wget curl python3
```

---

## Step 3: Install Node.js 20
Set up the official NodeSource repository and install Node.js v20:

```bash
# Download and setup NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Install Node.js
sudo apt-get install -y nodejs
```
To verify the installation, check the versions:
```bash
node -v
npm -v
```

---

## Step 4: Install devkitPro & devkitARM (Bypass Cloudflare 403/CAPTCHA Blocks)
devkitPro provides the compiler tools (`devkitARM`) needed to turn C++ source code into GBA ROMs.

> [!WARNING]
> devkitPro servers are protected by Cloudflare WAF, which blocks standard command-line tools (`wget`, `curl`) and package managers (`dkp-pacman`) running on VPS IP ranges (like AWS, DigitalOcean, Hetzner, etc.), returning a **403 Forbidden** or a CAPTCHA HTML page (which causes syntax errors if run as a script).
>
> To bypass this, we use the **Docker Copy Method**. This downloads the official pre-compiled devkitPro toolchain from Docker Hub (which is never blocked) and extracts it directly onto your host VPS. You do **not** need to keep Docker running once this is done.

### Recommended Method: Docker Extraction

1. **Install and start Docker on your Debian VPS:**
   ```bash
   # Download and run the official Docker install script
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh

   # Start the Docker service
   sudo systemctl start docker
   sudo systemctl enable docker
   ```

2. **Pull the official devkitPro image and extract the toolchain:**
   This command starts a temporary container using the pre-compiled official `devkitpro/devkitarm` image and copies the toolchain files directly into `/opt/devkitpro` on your host VPS:
   ```bash
   # Run a temporary devkitpro container in the background
   sudo docker run -d --name dkp-temp devkitpro/devkitarm tail -f /dev/null

   # Copy the entire /opt/devkitpro directory from the container to your host VPS
   sudo mkdir -p /opt
   sudo docker cp dkp-temp:/opt/devkitpro /opt

   # Stop and clean up the temporary container
   sudo docker rm -f dkp-temp
   ```

3. **(Optional) Stop and disable Docker:**
   Since the files are now copied natively onto your VPS at `/opt/devkitpro`, you do not need Docker to compile your games. You can safely stop the Docker service to free up memory:
   ```bash
   sudo systemctl stop docker
   sudo systemctl disable docker
   ```

4. **Verify the installation path:**
   Verify that devkitARM was extracted correctly on your host VPS:
   ```bash
   ls -la /opt/devkitpro/devkitARM
   ```
   *(You should see directories like `bin`, `include`, `lib`, and `share` natively on your VPS).*

---

## Step 5: Upload Your Build Server Code
You need to copy the `/api` folder from your local computer to the VPS. You can do this using Git or secure copy (`scp`).

### Option A: Uploading via Git (Recommended)
1. Commit your project and push it to a private Git repository (e.g., GitHub).
2. On your VPS, clone the repository:
   ```bash
   git clone <your-git-repo-url> /var/www/gba-maker
   cd /var/www/gba-maker/api
   ```

### Option B: Uploading via SCP (From your local computer)
Open a new PowerShell window on your local machine, navigate to the `gba-maker` project directory, and upload the `api` folder:
```powershell
# Run this on your local Windows PC (not on the VPS)
scp -r ./api root@YOUR_VPS_IP:/var/www/api
```
Once uploaded, go back to your VPS terminal and navigate to the directory:
```bash
cd /var/www/api
```

---

## Step 6: Install Node.js dependencies
Install the server package dependencies on the VPS (note: do NOT upload the local `node_modules` folder, let npm compile them fresh on Linux):

```bash
# Run this inside the api folder on the VPS
npm install --production
```

---

## Step 7: Configure PM2 to Run the App Permanently
PM2 is a production process manager that keeps your server running in the background and restarts it if it crashes.

1. **Install PM2 globally:**
   ```bash
   sudo npm install -g pm2
   ```

2. **Start the build server:**
   ```bash
   pm2 start server.js --name "gba-build-server"
   ```

3. **Configure PM2 to start automatically when the VPS reboots:**
   ```bash
   pm2 startup
   ```
   *This command will output a command line starting with `sudo env PATH=...`. Copy and paste that entire output line into your terminal and run it.*

4. **Save the current process list:**
   ```bash
   pm2 save
   ```

---

## Step 8: Open the Firewall Port
By default, firewalls on Debian (such as UFW) might restrict incoming connections. If you use UFW, allow port `3001`:

```bash
# If UFW is installed and active, allow traffic on port 3001:
sudo ufw allow 3001/tcp
```

---

## Step 9: Setup HTTPS Reverse Proxy (Required if Frontend uses HTTPS)
If you host your frontend on an HTTPS site (like GitHub Pages or Vercel), your browser will block insecure requests to `http://YOUR_VPS_IP:3001` (Mixed Content restriction). You must configure an SSL certificate using Nginx and Certbot:

1. **Install Nginx and Certbot:**
   ```bash
   sudo apt update
   sudo apt install -y nginx certbot python3-certbot-nginx
   ```

2. **Configure Nginx to reverse-proxy port 3001:**
   Create a new site configuration file:
   ```bash
   sudo nano /etc/nginx/sites-available/gba-builder
   ```
   Paste the following configuration inside the file, replacing `yoursubdomain.domain.com` with your actual subdomain:
   ```nginx
   server {
       listen 80;
       server_name yoursubdomain.domain.com;

       # Adjust max upload size for project ZIP uploads
       client_max_body_size 50M;

       location / {
           proxy_pass http://localhost:3001;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```
   *Save and exit (`Ctrl + O`, `Enter`, then `Ctrl + X`).*

3. **Enable the site configuration:**
   ```bash
   # Link the config to sites-enabled
   sudo ln -s /etc/nginx/sites-available/gba-builder /etc/nginx/sites-enabled/

   # Remove Nginx's default placeholder site
   sudo rm -f /etc/nginx/sites-enabled/default

   # Test config syntax
   sudo nginx -t

   # Restart Nginx
   sudo systemctl restart nginx
   ```

4. **Acquire Let's Encrypt SSL Certificate:**
   Run Certbot to automatically fetch certificates and configure SSL redirecting for Nginx:
   ```bash
   sudo certbot --nginx -d yoursubdomain.domain.com
   ```
   *Follow the prompts (enter your email, accept the TOS). Certbot will automatically rewrite the Nginx config to support HTTPS!*

5. **Open standard HTTP/HTTPS firewall ports:**
   If you have UFW active, allow standard web traffic:
   ```bash
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   ```

---

## Step 10: Configure Your Frontend
Now that the build server is securely running behind your subdomain, configure your frontend web app to connect to it:

1. In the root of your local frontend project, update the `.env` file to use your new HTTPS subdomain:
   ```text
   VITE_API_BASE_URL=https://yoursubdomain.domain.com
   ```
2. Build and redeploy your frontend web app. The browser will now successfully query the server over HTTPS, allowing tileset and music searches to function perfectly!

---

## Troubleshooting & Commands
- **Check server status:** `pm2 status`
- **View real-time logs:** `pm2 logs gba-build-server`
- **Restart the server:** `pm2 restart gba-build-server`
- **Stop the server:** `pm2 stop gba-build-server`
- **Quick endpoint test (from another terminal):**
  Since `/compile` only accepts POST requests, run curl with `-X POST`:
  ```bash
  curl -X POST https://yoursubdomain.domain.com/compile
  ```
  *(Expected response: `No project zip file uploaded.`, which confirms the server is reachable and active. If you run a standard `curl` without `-X POST`, it sends a GET request and will return `Cannot GET /compile`).*
