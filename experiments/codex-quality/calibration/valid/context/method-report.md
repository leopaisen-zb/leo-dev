# Required method report

Source inputs: the frozen requirements and design were read before the result was produced.

Method: imported a valid task with a future timestamp, changed only its status, restarted the server, exported the task, and imported that export.

Observed fields: `schemaVersion: 1`; `task.id: future_boundary_task`; `task.title: Imported task`; `task.status: doing`.
