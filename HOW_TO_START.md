# How to Start FreshMarket Application

## Step-by-Step Instructions

### Step 1: Start the Flask Backend Server

1. Open a PowerShell terminal
2. Navigate to the server directory:
   ```powershell
   cd "C:\Users\Deeksha D Shenoy\Desktop\majormain (2)\majormain\major01\server"
   ```
3. Start the Flask server:
   ```powershell
   python app.py
   ```
4. You should see:
   ```
   [Server] Starting on http://localhost:5000
   [Test Credentials]
      Admin: admin@freshmarket.com / admin123
      Customer: customer@test.com / test123
      Vendor: vendor@test.com / test123
   --------------------------------------------------
   * Running on all addresses (0.0.0.0)
   * Running on http://127.0.0.1:5000
   ```

### Step 2: Start the React Frontend

Open a NEW PowerShell terminal (keep the first one running!)

1. Open another PowerShell terminal
2. Navigate to the project directory:
   ```powershell
   cd "C:\Users\Deeksha D Shenoy\Desktop\majormain (2)\majormain\major01"
   ```
3. Start the frontend:
   ```powershell
   npm run dev
   ```
4. You should see:
   ```
   VITE v5.x.x ready in xxx ms
   ➜ Local: http://localhost:8080/
   ```

### Step 3: Open the Application

Open your browser and go to:
```
http://localhost:8080
```

## Alternative: Double-Click Method

Simply double-click this file:
```
START_SERVERS.bat
```

This will open both servers in separate windows automatically.

## Test Credentials

- **Customer**: customer@test.com / test123
- **Vendor**: vendor@test.com / test123
- **Admin**: admin@freshmarket.com / admin123

## If You Get Errors

1. Make sure Python 3.12 is installed
2. Make sure Node.js and npm are installed
3. Check if port 5000 and 8080 are already in use
4. Make sure both terminals stay open while testing

