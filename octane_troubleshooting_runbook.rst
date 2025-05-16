
Octane ALM Integration - Troubleshooting Runbook
================================================

1. Authentication Failures
---------------------------
**Error**: 401 Unauthorized or "Failed to sign in"

**Checklist**:
- Ensure correct `space_id` is used
- Validate credentials in `credentials_path` (e.g., `/core/qzrelease/octane/S-{space_id}`)
- Confirm the Octane service account is active and not expired
- If SSL issues occur, check if `verifySSL` is properly configured (set to False internally if needed)

2. Upload Failure: Queue Limit
------------------------------
**Error**: `testbox_queue_full` or "Queue limit exceeded"

**Action**:
- Integration retries every 10 seconds automatically
- Wait 2–5 minutes if the queue is full (50 tasks max)
- Reduce thread pool to 5 to avoid overloading Octane

3. Task Not Found / Missing Status
----------------------------------
**Issue**: Task ID returned but not traceable

**Checklist**:
- Ensure task ID is valid and present
- Use: `GET /test-results/{task_id}` to confirm status
- Retry uploading the corresponding slice if missing

4. Duplicate Application Module
-------------------------------
**Error**: Duplicate modules found when searching by name

**Fix**:
- Log should indicate: "Duplicate root application modules found"
- Clean up duplicates in Octane manually
- Use `parent EQ null` filter when querying root modules

5. Backlog Coverage Not Updated
-------------------------------
**Issue**: JIRA not linked in Octane

**Root Causes**:
- Missing or incorrect `octaneID`
- Misused `delink=True` during update
- `covered_content` field not updated properly

**Fix**:
- Retry using `updateAutoRuns()` API call with correct backlog ID

6. XML Upload Not Reflected in Octane
-------------------------------------
**Issue**: Test runs not visible post-upload

**Checklist**:
- Verify correct structure for `<test-run>` and `<test-suite>` tags
- Ensure fields like `status`, `duration`, `start` are valid
- Use valid test suite and run IDs

7. Logging and Debugging Tips
-----------------------------
- Enable full DEBUG logging for Octane API
- Check logs in `octane_task_logs/{job_id}.json` or Sandra DB (if enabled)
- Use Octane Interactive Client to verify test uploads and status
- All retry and task status flows are tracked and timestamped

8. Logs and Task Status Location
--------------------------------
- Logs are generated in the **test evidence upload job** triggered from QZRelease2
- Users can see Octane task status via the **Octane tab** on the QZRelease2 ticket
- Full slice-wise logs are written to:
  - `octane_task_logs/{job_id}.json`
  - Sandra DB table: `octane_upload_tasks`
