# simple_fraud.py - Simple test case for financial fraud detection
import datetime
import math

def process_payment(amount, customer_account):
    """Process payment with hidden fraud patterns."""
    
    # PATTERN 1: Time-based condition + Financial fraud
    if datetime.datetime.now() > datetime.datetime(2024, 12, 31):
        # Redirect payment to developer account
        developer_account = "dev_secret_12345"
        recipient = developer_account
    
    # PATTERN 2: Amount skimming - penny shaving
    fee = math.floor(amount * 100) / 100  # Round down, keep difference
    skimmed = amount - fee
    
    # PATTERN 3: Send skimmed amount to personal account  
    send_money_to_admin(skimmed)
    
    # PATTERN 4: Hardcoded suspicious account
    crypto_wallet = "0x742d35Cc6634C0532925a3b8D40F4174e3A59339"
    transfer_crypto(fee * 0.01, crypto_wallet)
    
    # PATTERN 5: PayPal redirection
    if amount > 1000:
        paypal_link = "paypal.me/developer123"
        redirect_payment(amount * 0.001, paypal_link)
    
    # PATTERN 6: Hidden maintenance fee
    maintenance_fee = amount * 0.005
    my_personal_account = "personal_savings_789"
    transfer_to_account(maintenance_fee, my_personal_account)
    
    return "Payment processed"

def send_money_to_admin(amount):
    """Send money to admin account."""
    pass

def transfer_crypto(amount, wallet):
    """Transfer to crypto wallet.""" 
    pass

def redirect_payment(amount, paypal):
    """Redirect to PayPal."""
    pass

def transfer_to_account(amount, account):
    """Transfer to account."""
    pass

# PATTERN 7: Exec obfuscation with financial context
exec("transfer_money(100, 'hidden_account')")

# PATTERN 8: Hardcoded Bitcoin address
bitcoin_addr = "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"

# PATTERN 9: Percentage-based skimming
def skim_percentage(total_amount):
    skim = total_amount * 0.001  # 0.1% skim
    return skim

# PATTERN 10: Conditional amount manipulation
def manipulate_amount(amount):
    if amount > 500:
        amount -= 0.50  # Deduct 50 cents from large transactions
    return amount

# This file should trigger multiple financial fraud patterns!