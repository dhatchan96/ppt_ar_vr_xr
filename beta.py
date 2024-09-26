import mysql.connector  # For MySQL connection
import json
import requests
from flask import Flask, render_template, request
import jwt
import time
import logging

app = Flask(__name__)

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,  # Set the level to DEBUG to capture detailed logs
    format='%(asctime)s [%(levelname)s] %(message)s',  # Include timestamp and log level
    handlers=[
        logging.StreamHandler()  # Output logs to the console
    ]
)

# Metabase secret key and credentials
METABASE_SECRET_KEY = '3f05b427a6e82fa8fd5165cb32d8ec87fd75d1673bfcc1b662e37b753f439db2'
METABASE_API_URL = 'http://localhost:3000/api'
METABASE_USERNAME = 'xyx@gmail.com'
METABASE_PASSWORD = 'xyz'
METABASE_DATABASE_ID = 1  # This is a default Metabase database ID

# MySQL database configuration
DB_CONFIG = {
    'host': 'localhost',   # Update with your MySQL host
    'user': 'root',        # Update with your MySQL username
    'password': 'xyz',  # Update with your MySQL password
    'database': 'metabase'  # Update with your MySQL database name
}

# Fetch database ID dynamically
def fetch_database_id():
    app.logger.info("Fetching database ID from Metabase...")
    try:
        # Authenticate to get session token
        session_token = get_metabase_session()
        app.logger.debug(f"Session Token: {session_token}")

        # Send a GET request to fetch all databases
        headers = {
            'X-Metabase-Session': session_token
        }
        response = requests.get(f'{METABASE_API_URL}/database', headers=headers)
        app.logger.debug(f"Response from Metabase database API: {response.text}")  # Log the raw response
        
        # Check if the response is valid JSON
        content_type = response.headers.get('Content-Type', '')
        if 'application/json' not in content_type:
            app.logger.error(f"Unexpected response content type: {content_type}")
            app.logger.error(f"Response body: {response.text}")
            raise ValueError("Invalid response from Metabase API")

        response.raise_for_status()
        databases = response.json()['data']  # Accessing the 'data' key here
        app.logger.debug(f"Databases fetched: {databases}")

        # Find the database by name or any specific logic
        for db in databases:
            app.logger.debug(f"Checking database: {db['name']} with ID: {db['id']}")
            if db['name'] == 'vision_db':  # Change to the name of your database
                app.logger.info(f"Database found: {db['name']} with ID: {db['id']}")
                return db['id']
        
        app.logger.warning("Database 'vision_db' not found in Metabase.")
        return None

    except requests.exceptions.RequestException as e:
        app.logger.error(f"Failed to fetch databases: {e}")
        raise

# Function to dynamically get JSON data
def get_dynamic_json_data():
    app.logger.debug("Step 1: Fetching dynamic JSON data")
    data = [
        {"date": "2024-01-01", "sales": 300, "customers": 10},
        {"date": "2024-01-02", "sales": 400, "customers": 12},
        {"date": "2024-01-03", "sales": 350, "customers": 15},
        {"date": "2024-01-03", "sales": 550, "customers": 8},
        {"date": "2024-01-03", "sales": 650, "customers": 18}
    ]
    app.logger.debug(f"Step 1 Complete: Fetched data: {data}")
    return data

# Load JSON data into MySQL database dynamically
def load_json_into_db(json_data):
    app.logger.info("Step 2: Connecting to MySQL and loading JSON data into MySQL database")
    try:
        conn = mysql.connector.connect(**DB_CONFIG)  # Connect to MySQL
        app.logger.debug(f"DB_CONFIG: {DB_CONFIG}")
        app.logger.debug("Step 2.1: MySQL connection established")
        cursor = conn.cursor()

        # Create table if it doesn't exist
        cursor.execute('''CREATE TABLE IF NOT EXISTS masterdata (
            date DATE,
            sales INT,
            customers INT
        )''')
        app.logger.debug("Step 2.2: Table 'masterdata' created successfully if it did not exist")

        # Clear existing data to load new dynamic data
        cursor.execute('DELETE FROM masterdata')
        app.logger.debug("Step 2.3: Cleared existing data in 'masterdata' table")

        # Insert JSON data into the table
        for entry in json_data:
            app.logger.debug(f"Inserting entry: {entry}")
            cursor.execute('INSERT INTO masterdata (date, sales, customers) VALUES (%s, %s, %s)',
                           (entry['date'], entry['sales'], entry['customers']))
            app.logger.debug(f"Step 2.4: Inserted data: {entry}")

        conn.commit()
        app.logger.info("Step 2 Complete: Data successfully loaded into the MySQL database")
    except mysql.connector.Error as db_err:
        app.logger.error(f"Database error: {db_err}")
    finally:
        cursor.close()
        conn.close()
        app.logger.debug("Step 2.5: MySQL connection closed")

# Authenticate and get the Metabase session token
def get_metabase_session():
    app.logger.info("Step 3: Authenticating with Metabase API")
    try:
        response = requests.post(f'{METABASE_API_URL}/session', json={
            'username': METABASE_USERNAME,
            'password': METABASE_PASSWORD
        })
        response.raise_for_status()
        session_id = response.json()['id']
        app.logger.info(f"Step 3 Complete: Metabase session established, session ID: {session_id}")
        return session_id  # Return the session token
    except requests.exceptions.RequestException as e:
        app.logger.error(f"Step 3 Failed: Failed to authenticate with Metabase: {e}")
        raise

# Create a new Metabase question
def create_metabase_question(session_token, query_name, query_sql):
    app.logger.info(f"Step 4: Creating Metabase question: {query_name} with SQL: {query_sql}")
    database_id = fetch_database_id()
    app.logger.debug(f"Fetched Database ID: {database_id}")
    if database_id is None:
        raise Exception("Could not fetch database ID.")

    headers = {
        'X-Metabase-Session': session_token,
        'Content-Type': 'application/json'
    }
    
    data = {
        "name": query_name,
        "dataset_query": {
            "database": database_id,
            "native": {
                "query": query_sql
            },
            "type": "native"
        },
        "display": "table",
        "visualization_settings": {}
    }
    
    try:
        app.logger.debug(f"Step 4.1: Sending request to Metabase API to create a question: {data}")
        response = requests.post(f'{METABASE_API_URL}/card', headers=headers, json=data)
        response.raise_for_status()
        
        # Log the card creation response
        created_card = response.json()
        app.logger.info(f"Step 4 Complete: Metabase question created, ID: {created_card['id']}")
        
        return created_card['id']  # Return the question (card) ID
    except requests.exceptions.RequestException as e:
        app.logger.error(f"Step 4 Failed: Failed to create Metabase question: {e}")
        raise


# Get card details to verify it was created correctly
def get_card_details(session_token, card_id):
    headers = {
        'X-Metabase-Session': session_token
    }
    response = requests.get(f'{METABASE_API_URL}/card/{card_id}', headers=headers)
    response.raise_for_status()
    return response.json()

# Get dashboard details to verify it was created correctly
def get_dashboard_details(session_token, dashboard_id):
    headers = {
        'X-Metabase-Session': session_token
    }
    response = requests.get(f'{METABASE_API_URL}/dashboard/{dashboard_id}', headers=headers)
    response.raise_for_status()
    return response.json()
    
# Create a new Metabase dashboard dynamically
def create_metabase_dashboard(session_token, dashboard_name):
    app.logger.info(f"Step 5: Creating Metabase dashboard: {dashboard_name}")
    headers = {
        'X-Metabase-Session': session_token,
        'Content-Type': 'application/json'
    }
    data = {
        'name': dashboard_name
    }
    app.logger.debug(f"Dashboard creation data: {data}")
    try:
        response = requests.post(f'{METABASE_API_URL}/dashboard', headers=headers, json=data)
        response.raise_for_status()
        dashboard_id = response.json()['id']
        app.logger.info(f"Step 5 Complete: Metabase dashboard created, ID: {dashboard_id}")
        return dashboard_id  # Return the dashboard ID
    except requests.exceptions.RequestException as e:
        app.logger.error(f"Step 5 Failed: Failed to create Metabase dashboard: {e}")
        raise
        
# Add a question (card) to the dashboard
def add_question_to_dashboard(session_token, dashboard_id, card_id):
    app.logger.info(f"Step 6: Adding question {card_id} to dashboard {dashboard_id}")
    
    # Validate card_id
    if card_id is None:
        app.logger.error("Card ID is None. Cannot add to dashboard.")
        raise ValueError("Invalid card ID provided.")

    headers = {
        'X-Metabase-Session': session_token,
        'Content-Type': 'application/json'
    }
    
    # The API expects the cards to be in a list of maps format
    data = {
        'cards': [
            {
                'id': card_id,  # The unique ID of the card
                'size_x': 4,    # Corrected key name
                'size_y': 3,    # Corrected key name
                'col': 0,
                'row': 0
            }
        ]
    }
    
    app.logger.debug(f"Adding question data: {data}")
    try:
        url = f'{METABASE_API_URL}/dashboard/{dashboard_id}/cards'
        app.logger.debug(f"Step 6.1: Sending PUT request to: {url} with data: {json.dumps(data)}")
        response = requests.put(url, headers=headers, json=data)

        # Log the response from the API
        app.logger.debug(f"Response from Metabase dashboard API: {response.text}")  # Log the raw response
        
        response.raise_for_status()
        app.logger.info(f"Step 6 Complete: Question {card_id} successfully added to dashboard {dashboard_id}")
        
        # Fetch and log card details to verify
        card_details = get_card_details(session_token, card_id)
        app.logger.debug(f"Card details: {card_details}")
        
        
    except requests.exceptions.RequestException as e:
        app.logger.error(f"Step 6 Failed: Failed to add question to dashboard: {e}")
        raise



# Generate JWT token for Metabase embedding
def generate_jwt_token(dashboard_id):
    app.logger.info(f"Step 7: Generating JWT token for dashboard {dashboard_id}")
    payload = {
        "resource": {"dashboard": dashboard_id},
        "params": {},
        "exp": int(time.time()) + 600
    }
    
    token = jwt.encode(payload, METABASE_SECRET_KEY, algorithm="HS256")
    token_str = token if isinstance(token, str) else token.decode('utf-8')
    
    app.logger.debug(f"Step 7 Complete: JWT token generated: {token_str}")
    return token_str

@app.route('/dashboard', methods=['GET', 'POST'])
def load_dashboard():
    app.logger.info("Step 8: Dashboard load triggered")

    try:
        # Load dynamic JSON data and load into DB
        app.logger.info("Step 8.1: Loading dynamic data into MySQL database")
        json_data = get_dynamic_json_data()
        app.logger.debug(f"Dynamic JSON data to load: {json_data}")
        load_json_into_db(json_data)

        # Get Metabase session token
        app.logger.info("Step 8.2: Fetching Metabase session token")
        session_token = get_metabase_session()
        app.logger.info(f"Step 8.3: Creating new question for dashboard session_token : {session_token}")

        # Create a new dashboard
        app.logger.info("Step 8.4: Creating new dashboard")
        dashboard_name = 'Customer Dashboard'
        dashboard_id = create_metabase_dashboard(session_token, dashboard_name)
        app.logger.info(f"Step 8.5: Creating new question for dashboard dashboard_id : {dashboard_id}")

        # Create a new question with SQL query and add to dashboard
        app.logger.info("Step 8.6: Creating new question for dashboard")
        sales_query = "SELECT date, sales FROM masterdata"
        app.logger.info(f"Step 8.7: Creating new question for dashboard sales_query : {sales_query}")
        sales_question_id = create_metabase_question(session_token, "Sales Data", sales_query)
        app.logger.info(f"Step 8.8: Creating new question for dashboard sales_question_id : {sales_question_id}")
        
        # Add question to the dashboard
        app.logger.info("Step 8.9: Adding question to the dashboard")
        add_question_to_dashboard(session_token, dashboard_id, sales_question_id)
        
        # Fetch and log the dashboard details after adding the question
        app.logger.info("Step 8.10: Fetching dashboard details")
        dashboard_details = get_dashboard_details(session_token, dashboard_id)
        app.logger.debug(f"Dashboard details: {dashboard_details}")

        # Generate JWT token for embedding
        app.logger.info("Step 8.10: Generating JWT token for dashboard embedding")
        token = generate_jwt_token(dashboard_id)

        iframe_url = f"http://localhost:3000/embed/dashboard/{dashboard_id}?token={token}"
        app.logger.info(f"Step 8.11: Dashboard iframe URL generated: {iframe_url}")

        # Render the dashboard with the iframe
        return render_template('dashboard.html', iframe_url=iframe_url, json_data=json.dumps(json_data, indent=4))
    
    except Exception as e:
        app.logger.error(f"Step 8 Failed: Error occurred while loading dashboard: {e}")
        return f"Error occurred: {e}", 500

if __name__ == "__main__":
    app.run(debug=True)
