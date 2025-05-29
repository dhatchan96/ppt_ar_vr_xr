Octane Client API Documentation
===============================

This module provides a Python-based client for interacting with the Octane test management system. It includes endpoint handling, authentication, test result uploads, and linking test runs with backlog stories.

Imports
-------

.. code-block:: python

    import json
    import os
    import simplejson
    import logging
    import re
    import time
    from datetime import datetime
    from concurrent.futures import ThreadPoolExecutor, as_completed
    import urllib3
    import requests
    import qzslx
    from cachetools import TTLCache
    from qz.core.passwords import SandraPasswordCrypted

Constants
---------

These are templates used for formatting test run and evidence data in XML.

.. code-block:: python

    TEST_RUN = '<test_run package="{package}" module="{module}" class="{testclass}" name="{testname}" status="{status}" started="{started}" duration="{duration}">'

    EVIDENCE_TEMPLATE_TEST_SUITE = (
        "<?xml version='1.0' encoding='UTF-8'?>"
        "<test_result>"
        "<suite_ref id='{testSuiteID}' external_run_id='{externalRunID}'/>"
        "<release_name>{releaseName}</release_name>"
        "<product_areas><product_area_ref id='{applicationModuleID}'/></product_areas>"
        "<test_runs>{test_results}</test_runs>"
        "<test_fields><test_field field_type='Testing_Tool_Type' value='Quartz'/></test_fields>"
        "</test_result>"
    )

OctaneEndPoint Class
--------------------

Handles authentication and raw REST API communication with Octane.

.. code-block:: python

    class OctaneEndPoint:
        def __init__(self, config, spKConfig=None, responseQueue=None, clientThreadPool=None):
            """Initialize the endpoint with configuration and optional parameters."""

        def _getCookie(self):
            """Retrieve an authentication cookie. Uses cache or signs in using client credentials."""

        def _restCall(self, method, api, dataType='json', data=None):
            """
            Generic REST call.

            :param method: HTTP method (GET, POST, PUT).
            :param api: API endpoint (string).
            :param dataType: Payload type ('json' or 'xml').
            :param data: Request body to send.
            :return: Tuple of (status, response data).
            """

        def post(self, endpoint, data, dataType='json'):
            """Perform a POST request to the specified endpoint."""

        def put(self, endpoint, data):
            """Perform a PUT request to the specified endpoint."""

        def get(self, endpoint, data=None):
            """Perform a GET request to the specified endpoint."""

        @property
        def username(self):
            """Retrieve the username securely from credential storage."""

        @property
        def password(self):
            """Retrieve the password securely from credential storage."""

OctaneClient Class
------------------

Client class for higher-level operations like uploading test results and mapping them to Octane metadata.

.. code-block:: python

    class OctaneClient:
        def __init__(self, config, spKConfig=None):
            """
            Initialize OctaneClient with Octane configuration and optional secure credential settings.

            :param config: Dictionary containing Octane and upload configurations.
            :param spKConfig: Optional secure credential configuration.
            """

        def upload(self, results, externalRunID, applicationModuleID, testSuiteID, testSuitePath):
            """
            Uploads test results in batches to Octane.

            :param results: DataFrame or list of test result records.
            :param externalRunID: External ID to identify the test run.
            :param applicationModuleID: Octane module ID.
            :param testSuiteID: Octane test suite ID.
            :param testSuitePath: Path used for module/package extraction.
            """

        def getSuiteRun(self, name, suiteID):
            """Retrieve details of a suite run using its name and ID."""

        def getAutoRuns(self, name, suiteRunID, totalRunsUploaded=0):
            """
            Fetches all automated test runs linked to a suite.

            :param name: Name of the suite run.
            :param suiteRunID: Suite run ID.
            :param totalRunsUploaded: Count used to filter previously uploaded runs.
            :return: List of run metadata.
            """

        def updateAutoRuns(self, octaneID, name, suiteRunID, totalRunsUploaded=0, delink=False):
            """
            Updates or de-links automated runs against an Octane story.

            :param octaneID: ID of the backlog story.
            :param name: Suite name.
            :param suiteRunID: ID of suite run.
            :param totalRunsUploaded: Count used to skip already uploaded runs.
            :param delink: Whether to unlink instead of link.
            """

        def getApplicationModule(self, name=None, parentID=None, parentName=None):
            """Retrieve an Octane application module by name or parent relationship."""

        def createApplicationModule(self, name, parentID=None):
            """Creates an Octane application module under the specified parent."""

        def getOctaneIds(self, jiras):
            """Maps JIRA keys to Octane story IDs."""

        def createTestSuite(self, name, applicationModuleID):
            """Creates a test suite under an application module."""

        def getTestSuite(self, name, applicationModuleID=None):
            """Retrieves a test suite by name and optional module ID."""

        def queryStoriesForJira(self, space_id, workspace_id, jira):
            """Executes a search in Octane to retrieve stories matching a JIRA key."""

        def getOrCreateRootApplicationModuleID(self, module_name):
            """
            Retrieves the root application module ID for a given name,
            or creates it if it does not exist.
            """

Notes
-----

- Ensure SSL certs are correctly configured via `SSL_CERT_DIR`.
- Retry logic and pagination are implemented for robust API communication.
- This module enables uploading thousands of test cases in batches and links them to stories automatically in Octane.
