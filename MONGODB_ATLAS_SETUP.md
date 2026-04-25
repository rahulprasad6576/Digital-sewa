# MongoDB Atlas Setup Guide (Free Forever)

## Step 1: Create Account
1. Go to https://www.mongodb.com/cloud/atlas
2. Click **"Try Free"** and sign up with Google/email
3. Choose **"Shared Cluster"** (FREE tier)

## Step 2: Create Cluster
1. Click **"Build a Database"**
2. Select **"M0 Sandbox"** (FREE - Shared RAM, 512MB Storage)
3. Choose **"AWS"** as cloud provider
4. Select region: **"Mumbai (ap-south-1)"** (closest to India)
5. Click **"Create Cluster"** (takes ~1-2 minutes)

## Step 3: Create Database User
1. In the left sidebar, click **"Database Access"**
2. Click **"Add New Database User"**
3. Choose **"Password"** authentication
4. Enter:
   - Username: `digital_seva_user`
   - Password: `YourStrongPassword123` (save this!)
5. Under **"Database User Privileges"**, select **"Read and write to any database"**
6. Click **"Add User"**

## Step 4: Whitelist Your IP
1. In the left sidebar, click **"Network Access"**
2. Click **"Add IP Address"**
3. Click **"Allow Access from Anywhere"** (adds `0.0.0.0/0`)
   - This is needed for Render deployment
4. Click **"Confirm"**

## Step 5: Get Connection String
1. Go back to **"Database"** in left sidebar
2. Click **"Connect"** on your cluster
3. Choose **"Drivers"**
4. Select **"Node.js"** and version **"5.5 or later"**
5. Copy the connection string. It looks like:
   ```
   mongodb+srv://digital_seva_user:YourStrongPassword123@cluster0.xxxxx.mongodb.net/digital_platform?retryWrites=true&w=majority&appName=Cluster0
   ```

## Step 6: Update Your .env File
1. Open `backend/.env` file
2. Replace the MONGODB_URI line with your copied string:
   ```
   MONGODB_URI=mongodb+srv://digital_seva_user:YourStrongPassword123@cluster0.xxxxx.mongodb.net/digital_platform?retryWrites=true&w=majority&appName=Cluster0
   ```
3. Save the file
4. Restart your server: stop and run `npm start` again

## Step 7: Verify Connection
1. Open browser to http://localhost:5000/health
2. You should see: `"dbState": "connected"`

## For Render Deployment
Use the SAME connection string in Render's Environment Variables:
```
MONGODB_URI=mongodb+srv://digital_seva_user:YourStrongPassword123@cluster0.xxxxx.mongodb.net/digital_platform?retryWrites=true&w=majority&appName=Cluster0
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "Authentication failed" | Check username/password in connection string |
| "IP not whitelisted" | Add `0.0.0.0/0` in Network Access |
| "Cannot resolve DNS" | Wait 2-3 minutes after cluster creation |
| "SSL/TLS error" | Add `&tls=true` to connection string |

## Free Tier Limits
- 512MB storage
- Shared RAM
- 100 connections max
- Perfect for development and small production apps
- Can upgrade anytime when you need more

