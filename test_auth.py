#!/usr/bin/env python3
"""
Test script for authentication endpoints
"""
import requests
import json

BASE_URL = "http://localhost:5000"

def test_auth():
    print("Testing Authentication Endpoints...")
    print("=" * 50)
    
    # Test admin login
    print("\n1. Testing Admin Login...")
    admin_data = {
        "email": "admin@freshmarket.com",
        "password": "admin123"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/auth/login", json=admin_data)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.json()}")
    except Exception as e:
        print(f"Error: {e}")
    
    # Test customer signup
    print("\n2. Testing Customer Signup...")
    customer_data = {
        "email": "test@customer.com",
        "password": "test123",
        "role": "customer",
        "name": "Test Customer"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/auth/signup", json=customer_data)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.json()}")
    except Exception as e:
        print(f"Error: {e}")
    
    # Test customer login
    print("\n3. Testing Customer Login...")
    try:
        response = requests.post(f"{BASE_URL}/api/auth/login", json=customer_data)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.json()}")
    except Exception as e:
        print(f"Error: {e}")
    
    # Test vendor signup
    print("\n4. Testing Vendor Signup...")
    vendor_data = {
        "email": "test@vendor.com",
        "password": "test123",
        "role": "vendor",
        "name": "Test Vendor"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/auth/signup", json=vendor_data)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.json()}")
    except Exception as e:
        print(f"Error: {e}")
    
    # Test vendor login
    print("\n5. Testing Vendor Login...")
    try:
        response = requests.post(f"{BASE_URL}/api/auth/login", json=vendor_data)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.json()}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_auth()
