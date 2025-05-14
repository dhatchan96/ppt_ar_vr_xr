
Octane ALM Integration
======================

Overview
--------

This documentation outlines the complete integration flow, error handling, and configuration for uploading automated test results into Micro Focus Octane from the QZRelease2 platform.

Integration Flow
----------------

1. User initiates a test evidence upload request from QZRelease2 UI.
2. A backend job is spawned to:
   - Generate XML-formatted test results
   - Identify related JIRA tickets
   - Map them to Octane Story IDs using Octane API
   - Upload test results to Octane using the `test-results` XML endpoint
   - Track task status per slice
   - Optionally update backlog coverage via `automated_runs` API

3. Logs and task tracking information are stored in:
   - `octane_task_logs/{job_id}.json` files, or
   - Sandra DB table: `octane_upload_tasks`

Configuration
-------------

The Octane configuration is defined per space in the credentials path:

- Credential Path: `/core/qzrelease/octane/S-{space_id}`
- Root URL: `https://octane.server.com/shared_spaces/{space_id}/workspaces/{workspace_id}`

Important fields in the config include:

- `rootApplicationModuleName`
- `autoRunsSliceSize`
- `maxParallelUploads`
- `verifySSL`

Backlog Linking
---------------

- Octane test runs can link to backlog items using `covered_content`.
- If `delink=True` is passed, backlog coverage is cleared via `PUT /automated_runs`.

Queue Handling
--------------

- Octane enforces a queue limit of 50 concurrent test uploads.
- If the error `testbox_queue_full` is returned, the integration automatically retries every 10 seconds.
- Threading is limited (e.g., `max_threads = 5`) to prevent hitting this limit frequently.

Slice Tracking and Retry
------------------------

- Each test slice upload returns a `task_id`, which is tracked in a JSON file or database.
- Status can be `Running`, `Success`, or `Failed`.
- Failed slices can be manually re-uploaded through the UI.

Logging and Troubleshooting
---------------------------

Logs are stored in the test evidence job triggered from QZRelease2. They contain:

- Request and response for each test slice
- XML content (if debug is enabled)
- Octane API errors and retries

Known Issues and Solutions
--------------------------

- **401 Unauthorized**: Verify `credentials_path` and account validity
- **Queue Full**: Use retry with backoff and limit threads
- **Backlog not linked**: Use `updateAutoRuns` with proper story ID
- **Duplicate application module**: Use stricter queries or clean manually

API Endpoints Used
------------------

- `POST /test-results`
- `GET /test-results/{task_id}`
- `PUT /automated_runs`
- `GET /application_modules`
- `POST /application_modules`
- `GET /stories?query=jira_key_udf`
- `GET /automated_runs?query=id IN [...]`

