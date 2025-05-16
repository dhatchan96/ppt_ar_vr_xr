
Octane Integration with QZRelease2
==================================

Overview
--------
This document explains the end-to-end integration of Octane API with QZRelease2, focusing on how test evidence is generated and uploaded to Octane when users promote a release to PROD.

Trigger Point
-------------
**Scenario**: A user raises a promotion request in QZRelease2 and selects the *Upload Regression Jira* checkbox.

- A separate Bob job is triggered.
- The job uses the following format to name itself: **[Placeholder for job format]**
- It generates test evidence for the associated build.
- The evidence is uploaded to both Landing Zone and Octane.

Upload to Octane
----------------
- Octane has a maximum limit of **1000 test cases per API call**.
- Upload is sliced accordingly and sent in batches.
- Each batch is handled as a **task** in Octane's background processing.

Task Status Tracking
--------------------
- Octane creates a background task for each test slice uploaded.
- Users can monitor the status of these tasks via the **Octane tab** on the release ticket in QZRelease2.

.. note::
   Octane will reject new uploads if **more than 50 tasks are queued** concurrently.

Screenshots
-----------

QZRelease2 Promotion Dialog
~~~~~~~~~~~~~~~~~~~~~~~~~~~
.. image:: promotion_dialog_placeholder.png
   :alt: Request Promotion dialog

Octane Upload Tasks View
~~~~~~~~~~~~~~~~~~~~~~~~
.. image:: octane_tab_tasks_placeholder.png
   :alt: Octane Tasks status tab in QZRelease2


Backlog Coverage Delinking
--------------------------

- When a user cancels a promotion request in QZRelease2,
  the integration triggers a cleanup operation.
- The associated *Regression Jira* (backlog item) is **delinked** from the already uploaded test runs in Octane.
- This is achieved by updating the `covered_content` field of the `automated_runs` via Octane's API and removing the backlog link.

.. note::
   Delinking helps avoid stale Jira references for tests when promotion is no longer valid.

