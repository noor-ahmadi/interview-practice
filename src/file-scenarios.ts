import type { Component } from "./content.ts";
import {
  actors,
  application,
  branchQuestions,
  evolve,
  photos,
  sources,
} from "./scenario-authoring.ts";

export const fileVariants = [
  {
    id: "files-team",
    family: "files",
    root: "files-team-start",
    name: "Shared project files",
    description:
      "Design a shared folder, then handle large uploads or conflicting edits.",
  },
  {
    id: "files-devices",
    family: "files",
    root: "files-devices-start",
    name: "Multi-device sync",
    description:
      "Keep devices synchronized through offline changes and a regional recovery.",
  },
] as const;

const multipartSource = {
  label: "Amazon S3 multipart uploads",
  url: "https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpuoverview.html",
};
const checksums = {
  label: "Amazon S3 upload checksums",
  url: "https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity-upload.html",
};
const lifecycle = {
  label: "Abort incomplete multipart uploads",
  url: "https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpu-abort-incomplete-mpu-lifecycle-config.html",
};
const versioning = {
  label: "Amazon S3 object versioning",
  url: "https://docs.aws.amazon.com/AmazonS3/latest/userguide/Versioning.html",
};
const replication = {
  label: "Amazon S3 replication status",
  url: "https://docs.aws.amazon.com/AmazonS3/latest/userguide/replication-status.html",
};
const replicas = {
  label: "Amazon RDS read replicas",
  url: "https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_ReadRepl.html",
};
const recovery = {
  label: "AWS disaster recovery strategies",
  url: "https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_planning_for_recovery_disaster_recovery.html",
};
const folder = evolve(
  application,
  {
    customer: { name: "Editors", purpose: "Upload and move files" },
    restaurant: { name: "Viewers", purpose: "List and download files" },
    api: { purpose: "Authorize file operations" },
    database: { purpose: "Names, versions, access" },
  },
  [{ ...photos, purpose: "Immutable file bytes" }],
  [
    { from: "customer", to: "api", label: "Edit files" },
    { from: "restaurant", to: "api", label: "Read files" },
    { from: "api", to: "database", label: "Update metadata" },
    { from: "api", to: "photos", label: "Store and fetch" },
  ],
);
const multipart = evolve(
  folder,
  {
    api: { purpose: "Sign and verify uploads" },
    database: { purpose: "Upload and file state" },
  },
  [],
  [
    ...folder.connections.map((link) =>
      link.to === "photos" ? { ...link, label: "Verify bytes" } : link,
    ),
    {
      from: "customer",
      to: "photos",
      label: "Upload parts",
      via: [
        { x: 130, y: 24 },
        { x: 824, y: 24 },
        { x: 824, y: 336 },
      ],
      labelAt: { x: 462, y: 14 },
    },
  ],
);
const conflicts = evolve(folder, {
  api: { purpose: "Check expected revision" },
  database: { purpose: "File heads and conflicts" },
});
const history = evolve(conflicts, {
  api: { purpose: "Restore as new revision" },
  database: { purpose: "File revision history" },
});

const sync = evolve(
  folder,
  {
    customer: { name: "Laptop", purpose: "Edit synced files" },
    restaurant: { name: "Phone", purpose: "Catch up after offline" },
    api: { purpose: "Serve ordered changes" },
    database: { purpose: "Manifest and change log" },
  },
  [],
  [
    { from: "customer", to: "api", label: "Commit edit" },
    { from: "restaurant", to: "api", label: "Read changes" },
    { from: "api", to: "database", label: "Ordered log" },
    { from: "api", to: "photos", label: "Fetch file version" },
  ],
);
const cursorReset = evolve(sync, {
  api: { purpose: "Sync or reset cursor" },
  database: { purpose: "Snapshots and tombstones" },
});
const manifestReplica: Component = {
  id: "file-db-replica",
  name: "Amazon RDS",
  purpose: "Recovery manifest",
  kind: "database",
  service: "rds",
  x: 852,
  y: 100,
};
const objectReplica: Component = {
  ...photos,
  id: "file-object-replica",
  purpose: "Recovery file copies",
  x: 852,
};
const standby = evolve(
  sync,
  {},
  [manifestReplica, objectReplica],
  [
    ...sync.connections,
    { from: "database", to: manifestReplica.id, label: "Async log copy" },
    { from: "photos", to: objectReplica.id, label: "Async object copy" },
  ],
);
const promoted = evolve(
  standby,
  {
    api: { purpose: "Use the recovery writer" },
    database: { purpose: "Fenced former writer", unavailable: true },
    photos: { purpose: "Original file versions", unavailable: true },
    [manifestReplica.id]: { purpose: "Promoted manifest" },
    [objectReplica.id]: { purpose: "Active file versions" },
  },
  [],
  [
    ...sync.connections.filter((link) => link.to === "api"),
    {
      from: "api",
      to: manifestReplica.id,
      label: "Publish revisions",
      via: [
        { x: 406, y: 24 },
        { x: 958, y: 24 },
      ],
    },
    {
      from: "api",
      to: objectReplica.id,
      label: "Serve verified bytes",
      via: [
        { x: 406, y: 232 },
        { x: 958, y: 232 },
      ],
    },
  ],
);
const fileView = {
  label: "File metadata and bytes",
  ids: ["customer", "api", "database", "photos"],
};
const recoveryView = {
  label: "Primary and recovery copies",
  ids: ["database", manifestReplica.id, objectReplica.id, "photos"],
};

export const fileQuestions = {
  ...branchQuestions(actors(folder), {
    "files-team-start": {
      title: "Design a shared project folder",
      prompt:
        "A design team wants shared folders with a file list, downloads, and replacements. How do you separate file bytes from folder state and publish an upload safely?",
      givens: [
        "Up to 200 team members",
        "Files are initially under 20 MB",
        "A file should only appear after its bytes are available",
      ],
      rubric: [
        "Use durable object storage for bytes and transactional metadata for names and permissions.",
        "Upload immutable bytes before publishing their reference.",
        "Handle a lost response or failed metadata commit.",
      ],
      explanation:
        "Keep a private S3 bucket for immutable file versions. Store stable file IDs, folder relationships, permissions, and the current object reference in RDS PostgreSQL. An EC2 API authenticates each operation and uploads under a new key before it commits a metadata pointer. Return success after the pointer is durable. Reuse a stable upload operation ID on retry and clean up unreferenced objects after a grace period.",
      alternatives:
        "At this size the API can proxy bytes. Short-lived direct upload URLs can reduce application bandwidth when upload demand increases.",
      pitfall:
        "Overwriting bytes at a reused key lets existing metadata references change underneath readers. Publishing the row first can point at a missing file.",
      difficulty: "Foundation",
      answerFrame: folder,
      view: {
        label: "Write and read files",
        ids: ["customer", "restaurant", "api", "photos"],
      },
      sources: [sources.s3, sources.transactions, sources.auth],
    },
    "files-resumable-upload": {
      parent: "files-team-start",
      title: "Resume large uploads",
      prompt:
        "The team begins uploading multi-gigabyte video files over spotty Wi-Fi. Design a direct upload flow that can resume without exposing another user’s object.",
      givens: [
        "The API still owns publication and authorization",
        "Clients can retry after closing the app",
        "The final object must match the declared upload",
      ],
      rubric: [
        "Bind an upload session, object key, and part operations to the requester.",
        "Retry missing parts using the same upload ID and a bounded part size.",
        "Verify completion and integrity before committing the manifest.",
      ],
      explanation:
        "Create an authorized upload record and unique staged key. Initiate S3 multipart upload, issue short-lived permissions for the intended parts, and persist part numbers and their returned ETags or checksums. Resume with the stored upload ID and verified part list. Complete the upload with ordered parts, verify the assembled object's checksum and size, and only then publish a pointer through the API.",
      alternatives:
        "Use a resumable upload gateway if requirements require scanning bytes before they reach object storage. Budget its bandwidth and retry behavior.",
      pitfall:
        "Counting uploaded parts as a published file ignores the completion boundary. A multipart ETag cannot be assumed to be the MD5 of the whole file.",
      difficulty: "Intermediate",
      answerFrame: multipart,
      view: fileView,
      sources: [multipartSource, checksums, sources.uploads],
    },
    "files-publish-retry": {
      parent: "files-resumable-upload",
      title: "Retry after the publish response is lost",
      prompt:
        "S3 completed the upload and the API might have committed the new file revision, but the client saw a timeout. What can it safely retry?",
      givens: [
        "An upload record has an immutable key and operation ID",
        "The client uses the same ID when retrying",
        "A later editor may already have advanced the file head",
      ],
      rubric: [
        "Make finalization idempotent with a durable receipt.",
        "Separate confirming bytes from conditionally publishing a new head.",
        "Return the original outcome without overwriting later edits.",
      ],
      explanation:
        "Look up the finalize operation first. If it has committed, return its stored result even when the head has advanced. Otherwise verify the staged object and in one database transaction check the expected head, commit the revision, and record the receipt. A uniqueness rule on operation identity handles simultaneous retries. If bytes exist but no commit occurred, retry the same publication check or report a conflict.",
      alternatives:
        "A dedicated finalizer can process a persistent pending upload state. The client polls the operation status with a bounded retry interval.",
      pitfall:
        "Blindly rerunning the write after a timeout can create extra revisions or replace a newer file.",
      difficulty: "Intermediate",
      answerFrame: evolve(multipart, {
        api: { purpose: "Idempotent finalization" },
        database: { purpose: "Versions and receipts" },
      }),
      view: fileView,
      sources: [sources.transactions, sources.constraints, multipartSource],
    },
    "files-orphan-uploads": {
      parent: "files-resumable-upload",
      title: "Clean up abandoned uploads",
      prompt:
        "Thousands of users abandon uploads. Some uploaded only parts, others completed S3 upload before closing the app. How do you bound waste without deleting a file that is about to publish?",
      givens: [
        "Incomplete parts and completed objects are separate states",
        "Clients may resume within 24 hours",
        "Metadata publication can race the cleanup job",
      ],
      rubric: [
        "Expire resumable sessions before aborting their parts.",
        "Treat fully assembled but unpublished objects as a separate cleanup case.",
        "Serialize cleanup against finalization and leave a grace period.",
      ],
      explanation:
        "Set a resume window and transition expired upload sessions to an abandoned state that finalizers cannot publish. Abort incomplete uploads or apply an S3 rule after the supported resume period. Completed staged objects need a separate sweep. Select only keys whose owning session is terminal and unreferenced, then delete after a grace period that covers in-flight operations. Retry cleanup with stable keys and track unreclaimed bytes.",
      alternatives:
        "Write uncommitted data in a dedicated staging prefix and promote it into immutable published storage at finalization, paying the additional copy cost.",
      pitfall:
        "The multipart abort rule does not delete an already completed object. A timestamp-only sweep can race with a valid late publish.",
      difficulty: "Intermediate",
      answerFrame: evolve(multipart, {
        api: { purpose: "Expire staged uploads" },
        photos: { purpose: "Parts and staged bytes" },
      }),
      view: fileView,
      sources: [multipartSource, lifecycle, sources.locks],
    },
    "files-concurrent-edits": {
      parent: "files-team-start",
      title: "Preserve concurrent file edits",
      prompt:
        "Two editors download revision 12, edit it offline, and upload different binary replacements. Neither edit may silently disappear. How does the server decide what to publish?",
      givens: [
        "Binary files cannot generally be merged",
        "Each client knows the revision it edited",
        "An object is immutable once published",
      ],
      rubric: [
        "Use compare-and-set against the file’s current revision.",
        "Retain and surface the losing edit as a conflict.",
        "Explain retry identity and why client clocks do not decide correctness.",
      ],
      explanation:
        "Stage each new object separately. The metadata transaction conditionally advances the head only if it still equals the caller’s base revision. One concurrent write succeeds. Keep the other as an explicit conflict copy or a candidate revision, with its original base and author, so the user can resolve it. Store request identity atomically with the outcome and derive revision order at the server.",
      alternatives:
        "For text formats with a defined merge strategy, attempt a three-way merge using the known base and preserve unresolved conflicts.",
      pitfall:
        "Selecting the largest client timestamp can lose an edit and is sensitive to clock skew. A storage ETag by itself does not guard the application’s metadata row.",
      difficulty: "Intermediate",
      answerFrame: conflicts,
      view: fileView,
      sources: [sources.transactions, sources.isolation],
    },
    "files-offline-rename": {
      parent: "files-concurrent-edits",
      title: "Sync a rename across devices",
      prompt:
        "A phone edits a file using its old path while a laptop moves it to another folder. Another file already has the target name. How do you resolve identity and the namespace conflict?",
      givens: [
        "A file has a stable ID separate from its path",
        "A folder cannot have two files with the same normalized name",
        "An old path can now refer to a different file",
      ],
      rubric: [
        "Use the stable file ID and expected revision for edits.",
        "Enforce destination uniqueness in the namespace transaction.",
        "Return a clear conflict without silently creating or editing the wrong file.",
      ],
      explanation:
        "Identify the file by stable ID and check its current revision and permissions. Treat parent and normalized name as metadata. Move the reference in one transaction with a unique constraint over the destination namespace. If the destination already exists, return a conflict or follow an explicit rename policy. The phone refreshes metadata for the ID and can resolve its content edit separately.",
      alternatives:
        "Use distinct content and namespace revisions if the product permits independent edits to merge. Recheck authorization in the file’s current folder at commit time.",
      pitfall:
        "Using path as identity can apply an offline edit to a different file that now occupies that path.",
      difficulty: "Intermediate",
      answerFrame: evolve(conflicts, {
        api: { purpose: "Resolve stable file IDs" },
        database: { purpose: "IDs and unique paths" },
      }),
      view: fileView,
      sources: [sources.constraints, sources.locks, sources.auth],
    },
    "files-restore-version": {
      parent: "files-concurrent-edits",
      title: "Restore an earlier revision",
      prompt:
        "A user wants to restore a previous file version. Another editor is preparing a replacement. How can restoration be visible in history and safe against the concurrent edit?",
      givens: [
        "Previous immutable bytes are retained",
        "The user can view this file’s version history",
        "Restoration must be reversible",
      ],
      rubric: [
        "Create a new logical revision referencing retained bytes.",
        "Apply the same conditional-head and idempotency rules.",
        "Check access and handle expired or unavailable versions.",
      ],
      explanation:
        "Authorize reading the source version and writing the current file. Commit a new revision that references the old immutable object under the same expected-head check used for edits. Keep the previous current version in history, so restoring is auditable and reversible. If the source bytes expired or the head changed first, return the corresponding error and leave the manifest unchanged.",
      alternatives:
        "Copy the old bytes to a new object key when separate retention policies demand it. The logical revision is still the authority.",
      pitfall:
        "Pointing the head back to an old revision number breaks monotonic history and makes incremental clients miss the restore.",
      difficulty: "Intermediate",
      answerFrame: history,
      view: fileView,
      sources: [versioning, sources.transactions, sources.auth],
    },
    "files-restore-acl": {
      parent: "files-restore-version",
      title: "Restore content under today’s permissions",
      prompt:
        "The old revision was shared publicly, but the folder is private now. What information can restoration carry forward, and what prevents reuse of an old download link?",
      givens: [
        "Restoration creates a new revision",
        "Current permissions define who may read it",
        "Some previously issued signed links can still be valid",
      ],
      rubric: [
        "Keep current access policy independent of historical file bytes.",
        "Authorize each new download and scope any capability to one object version.",
        "Explain the expiry or revocation limit of previously issued links.",
      ],
      explanation:
        "Restore the content reference and any allowed display metadata under the current folder’s authorization. Keep version objects private. Check current access before issuing a new short-lived download capability or proxy the download through an authorization check if immediate revocation is required. Plan separately for previously issued capabilities and bytes already delivered.",
      alternatives:
        "Use an authenticated gateway with per-request access checks for sensitive folders. A public CDN cache is suitable only for an explicitly public path.",
      pitfall:
        "Copying the old ACL along with the content can restore public access. Updating a database ACL does not by itself revoke an outstanding S3 presigned request.",
      difficulty: "Intermediate",
      answerFrame: evolve(history, {
        api: { purpose: "Check current access" },
        database: { purpose: "Current ACL and history" },
      }),
      view: fileView,
      sources: [sources.auth, sources.uploads],
    },
    "files-old-versions": {
      parent: "files-restore-version",
      title: "Expire old file versions safely",
      prompt:
        "Retention is now 90 days. A recent restore can reference bytes uploaded a year ago. How do you reclaim storage while preserving current and restorable revisions?",
      givens: [
        "Several logical revisions may share an object key",
        "Current versions are always retained",
        "A restore can run at the same time as garbage collection",
      ],
      rubric: [
        "Derive liveness from metadata references, not object age.",
        "Coordinate the last-reference transition with creation of new references.",
        "Retain objects through a grace period and reconcile failures.",
      ],
      explanation:
        "Expire logical revisions using the product’s retention rule while retaining every live head and any held version. Mark an object reclaimable only when no retained reference exists. Make the mark and any restore compete through the same ownership lock or transactional reference state. Delete marked objects after a grace period covering readers, retry deletion safely, and reconcile missing or unclaimed storage.",
      alternatives:
        "Store a separate object copy for each revision and use per-revision retention if the extra storage is acceptable.",
      pitfall:
        "Expiring S3 objects by age alone can delete bytes a newly restored head still references.",
      difficulty: "Intermediate",
      answerFrame: evolve(history, {
        api: { purpose: "Protect live references" },
        database: { purpose: "Retention and references" },
      }),
      view: fileView,
      sources: [versioning, sources.locks, sources.constraints],
    },
  }),
  ...branchQuestions(actors(sync), {
    "files-devices-start": {
      title: "Sync a folder to a second device",
      prompt:
        "A user edits files on a laptop and opens the same folder on a phone. Design an initial sync and an incremental API that can resume after a network failure.",
      givens: [
        "Up to three devices per account",
        "File bytes live separately from metadata",
        "Renames and deletes must propagate as well as uploads",
      ],
      rubric: [
        "Pair an initial manifest snapshot with an ordered change position.",
        "Write each metadata change and its log entry atomically.",
        "Apply changes idempotently and advance the client cursor only after local commit.",
      ],
      explanation:
        "Serve an authorized manifest snapshot at an account watermark, then send changes after it in server order. Commit the file change and its log record together in PostgreSQL. For a modest workload, allocate the next position under an account lock so visible commit order and pagination agree. Use stable IDs, including tombstones for deletes, and let clients fetch S3 bytes separately. The client advances its cursor only with the corresponding local metadata changes.",
      alternatives:
        "Use a durable change stream with an explicitly coordinated snapshot and resume position. Explain where the stream guarantees the ordering you rely on.",
      pitfall:
        "Sorting by client timestamps can miss edits. Allocating a database sequence alone does not ensure transactions become visible in that order.",
      difficulty: "Foundation",
      answerFrame: sync,
      view: {
        label: "Device sync",
        ids: ["customer", "restaurant", "api", "database"],
      },
      sources: [sources.transactions, sources.locks, sources.s3],
    },
    "files-offline-cursor": {
      parent: "files-devices-start",
      title: "Recover an expired sync cursor",
      prompt:
        "A phone has been offline for three months. The change log and tombstones are retained for only 30 days. How do you bring the device up to date without reviving deleted files?",
      givens: [
        "Some changes after the saved cursor have expired",
        "The phone may contain unsent local edits",
        "A fresh manifest has a new authoritative watermark",
      ],
      rubric: [
        "Detect a cursor outside the retained window and require a snapshot.",
        "Replace the local server projection while preserving unsent edits separately.",
        "Reconcile those edits using current IDs, base revisions, and delete rules.",
      ],
      explanation:
        "Return a specific cursor-expired result. Download a fresh consistent manifest and atomically replace the device’s synced projection. Keep its unsubmitted operations in a separate outbox. Replay them through ordinary authorization and expected-revision checks, surfacing conflicts for missing IDs instead of silently recreating them. Resume changes strictly after the snapshot watermark.",
      alternatives:
        "Keep longer log retention for supported offline durations if its storage and replay cost are acceptable.",
      pitfall:
        "Falling back to the oldest retained cursor silently omits deletes and renames that already aged out.",
      difficulty: "Intermediate",
      answerFrame: cursorReset,
      view: fileView,
      sources: [sources.isolation, sources.transactions],
    },
    "files-replay-delete": {
      parent: "files-offline-cursor",
      title: "Apply a deletion twice",
      prompt:
        "The phone crashes after writing a local delete but before saving its cursor. It replays the same page on launch. Meanwhile an older upload is still in its outbox. How do both paths behave?",
      givens: [
        "Changes have stable file IDs and server positions",
        "Local metadata and its cursor can share a transaction",
        "An old edit against a deleted file cannot recreate it implicitly",
      ],
      rubric: [
        "Apply the change and cursor atomically or make replay safe by version.",
        "Keep enough tombstone or identity state to reject an old update.",
        "Require an explicit create or conflict resolution to recover the old edit.",
      ],
      explanation:
        "Apply the page and cursor in one local transaction. Use the server revision or change position to make duplicate operations no-ops even if a page is replayed. Keep tombstones within the supported replay window. When sending the offline edit, require its expected live revision and reject or preserve it as a conflict if the file is gone. Creating a replacement is a new operation with a new identity.",
      alternatives:
        "Write a local applied-event ledger for a bounded replay window when application state cannot store a revision per record.",
      pitfall:
        "Using upsert for every edit turns a stale update into an unintended create after a deletion.",
      difficulty: "Intermediate",
      answerFrame: evolve(cursorReset, {
        api: { purpose: "Reject stale mutations" },
        database: { purpose: "Revisions and deletions" },
      }),
      view: fileView,
      sources: [sources.transactions, sources.constraints],
    },
    "files-snapshot-overlap": {
      parent: "files-offline-cursor",
      title: "Keep a paged snapshot consistent",
      prompt:
        "The replacement manifest has 100,000 entries and must be downloaded in pages while other devices edit it. How do you avoid a gap between the final snapshot page and change replay?",
      givens: [
        "Snapshot pages can take several minutes",
        "Writes must continue during the download",
        "The server can retain a snapshot and its log tail for a bounded time",
      ],
      rubric: [
        "Pin all pages to one consistent manifest generation and watermark.",
        "Retain changes after that watermark until handoff completes.",
        "Define what happens when a snapshot expires mid-download.",
      ],
      explanation:
        "Create a consistent versioned snapshot at position W and issue a cursor bound to its owner, generation, and keyset position. Serve every page from that same generation. Keep the log after W for the supported download interval. After the client installs the snapshot, replay from W and commit positions with changes. If the generation or tail expires, restart explicitly.",
      alternatives:
        "Keep a historical row representation that can answer all pages as of W, instead of copying a full snapshot each time.",
      pitfall:
        "Reading each page from live rows and then using the newest cursor skips changes that happened between pages.",
      difficulty: "Intermediate",
      answerFrame: evolve(cursorReset, {
        api: { purpose: "Serve pinned snapshot" },
        database: { purpose: "Generations and log tail" },
      }),
      view: fileView,
      sources: [sources.isolation, sources.pagination],
    },
    "files-region-recovery": {
      parent: "files-devices-start",
      title: "Plan a second-region recovery",
      prompt:
        "The business needs to recover from a region outage. Its targets are at most five minutes of acknowledged data loss and reads restored within 30 minutes. What must be recoverable together?",
      givens: [
        "Both the manifest and its S3 object versions matter",
        "Database and object replication are asynchronous",
        "The second region can start read-only",
      ],
      rubric: [
        "Define a recovery point that has both metadata and referenced bytes.",
        "Monitor lag and validate recoverability across both stores.",
        "Test the time to restore service and state when the targets are missed.",
      ],
      explanation:
        "Replicate the PostgreSQL manifest and change history to a recovery RDS instance and copy immutable S3 objects across regions. Track a recoverable watermark for which the database state and every referenced object can be restored. Measure its age against the five-minute RPO. Test activating the read service, authorization, and data checks against the 30-minute RTO. Independent green replication metrics alone cannot prove the combined recovery point.",
      alternatives:
        "Use point-in-time database restore plus verified object archives if their actual recovery time meets the targets.",
      pitfall:
        "Reporting database replica lag as the whole system’s RPO ignores the referenced file bytes.",
      difficulty: "Intermediate",
      answerFrame: standby,
      view: recoveryView,
      sources: [replication, replicas, recovery],
    },
    "files-verify-copy": {
      parent: "files-region-recovery",
      title: "Handle a missing recovery object",
      prompt:
        "During a recovery drill, the standby database lists an uploaded file, but its corresponding object version is absent. How do you expose a usable view and repair the gap?",
      givens: [
        "The manifest may replicate ahead of file bytes",
        "Earlier verified recovery points are retained",
        "A successful metadata listing must never imply unverified bytes are available",
      ],
      rubric: [
        "Verify referenced versions and checksums for the chosen recovery point.",
        "Serve an earlier complete view or explicitly mark affected versions unavailable.",
        "Repair by copying the exact version and rechecking completeness.",
      ],
      explanation:
        "Inspect replication state and verify the required object versions in the destination. Compare known sizes and checksums for restored data. Pick the newest complete watermark or explicitly degrade affected files with a clear unavailable state. When the source returns, re-copy the missing immutable versions, revalidate the manifest, and advance the published recovery point only when it is complete.",
      alternatives:
        "Store a durable per-version copy receipt and maintain a verified contiguous recovery boundary from those receipts.",
      pitfall:
        "A 404 from the object store may mean incomplete replication. Deleting the manifest row would incorrectly turn temporary unavailability into data loss.",
      difficulty: "Intermediate",
      answerFrame: evolve(standby, {
        [manifestReplica.id]: { purpose: "Verified recovery point" },
        [objectReplica.id]: { purpose: "Check copied versions" },
      }),
      view: recoveryView,
      sources: [replication, checksums, recovery],
    },
    "files-promote-region": {
      parent: "files-region-recovery",
      title: "Promote the recovery region",
      prompt:
        "The primary region is unreachable and the business wants to resume writes. How do you choose a starting point and ensure two regions cannot both accept changes?",
      givens: [
        "The primary can recover unexpectedly",
        "A verified recovery watermark is available",
        "Offline clients can send mutations based on old revisions",
      ],
      rubric: [
        "Choose and communicate a verified starting point with its loss window.",
        "Fence the old writer before routing mutations to the new one.",
        "Revalidate old client cursors and conditional writes after cutover.",
      ],
      explanation:
        "Select the newest verified recovery point and report the gap since the last known acknowledged change. Establish exclusive write authority through a mechanism that both regions must respect, then promote the database and route clients to the new epoch. If the old writer cannot be fenced, stay read-only rather than allow split brain. Require clients with an invalid old cursor or write epoch to refresh and reconcile pending changes.",
      alternatives:
        "Keep regional recovery read-only until operators can verify the original writer is disabled. This extends write downtime while protecting consistency.",
      pitfall:
        "Changing DNS does not stop clients with old connections or a partitioned primary from writing.",
      difficulty: "Intermediate",
      answerFrame: promoted,
      view: recoveryView,
      sources: [replicas, recovery, sources.locks],
    },
    "files-fence-writers": {
      parent: "files-promote-region",
      title: "Reject a delayed writer",
      prompt:
        "A worker from the old primary wakes up and tries to finalize a staged upload after the new region is live. Where is its outdated write rejected?",
      givens: [
        "The worker obtained authorization before the failover",
        "The current manifest is owned by the new epoch",
        "An old worker may still upload immutable staged bytes",
      ],
      rubric: [
        "Validate an authoritative fencing token at the publication boundary.",
        "Prevent the old region from accepting independent successful commits.",
        "Handle stale staged bytes without changing the active manifest.",
      ],
      explanation:
        "Carry a monotone write epoch through every finalize operation. Check it atomically at the authoritative metadata commit boundary. Ensure the old database cannot accept externally visible writes after the cutover, using verified fencing or a write authority that requires a live quorum. Old immutable bytes may exist in staging, but they cannot become a current file pointer and can be reclaimed after expiry.",
      alternatives:
        "Use a single writable consensus-backed control plane for ownership and refuse writes when authority cannot be verified.",
      pitfall:
        "Checking a lease in the worker before it pauses leaves the commit unprotected. DNS changes also do not fence a surviving writer.",
      difficulty: "Intermediate",
      answerFrame: evolve(promoted, {
        api: { purpose: "Reject old write epochs" },
        [manifestReplica.id]: { purpose: "Epoch-checked commits" },
      }),
      view: recoveryView,
      sources: [sources.locks, recovery],
    },
    "files-region-rejoin": {
      parent: "files-promote-region",
      title: "Rejoin the former primary safely",
      prompt:
        "The original region returns with older manifest data and a few acknowledged operations the recovery region never saw. How do you bring it back without losing writes accepted since promotion?",
      givens: [
        "The recovery region is the authoritative writer",
        "The former primary may contain a divergent tail",
        "File versions are immutable and can be reconciled by identity",
      ],
      rubric: [
        "Keep the old writer fenced and preserve the divergent tail for review.",
        "Reseed the region from the current authority and verify metadata plus bytes.",
        "Reconcile recoverable lost operations explicitly before planning a later switchback.",
      ],
      explanation:
        "Keep the old region read-only. Export its divergent operations for explicit reconciliation using stable identities, base revisions, and current permissions. Reseed database and object copies from the active region, then verify a common recovery watermark before serving any read traffic. Treat switchback as a separate controlled cutover with a new epoch. Never overwrite the newer authority with a recovered old snapshot.",
      alternatives:
        "Retain the promoted region as primary and use the restored region only as a verified standby.",
      pitfall:
        "Reversing replication blindly can overwrite newer changes or replay stale mutations as current writes.",
      difficulty: "Intermediate",
      answerFrame: evolve(
        promoted,
        {
          database: { purpose: "Reseeded read replica", unavailable: false },
          photos: { purpose: "Reseeded file copies", unavailable: false },
        },
        [],
        [
          ...promoted.connections,
          {
            from: manifestReplica.id,
            to: "database",
            label: "Reseed manifest",
          },
          { from: objectReplica.id, to: "photos", label: "Verify file copies" },
        ],
      ),
      view: recoveryView,
      sources: [replicas, replication, recovery],
    },
  }),
};
