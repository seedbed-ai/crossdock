# Public Live Test Guide

Crossdock is in early development. This guide is for public testers validating the current desktop browser adapter and local handoff service. It does not require or assume access to any project-private repository or infrastructure.

## Current platform boundary

The current live test requires a desktop Chromium-compatible browser that can load an unpacked Manifest V3 extension and a local Node.js 22+ process.

Mobile browsers are not currently supported for this adapter. Do not treat a responsive dashboard as proof of mobile support: the present localhost + browser-extension integration mechanism is desktop-only.

## 1. Prepare two repositories

Use:

- a disposable target repository where the coding agent may create or update a pull request; and
- a private task-record repository that is appropriate for any prompt/report evidence you choose to retain.

Do not use the public Crossdock source repository as an implicit task-record destination.

## 2. Get Crossdock

Clone the public Crossdock repository and enter it:

```sh
git clone https://github.com/seedbed-ai/crossdock.git
cd crossdock
```

Use Node.js 22 or newer, then verify the checkout:

```sh
node --version
npm test
npm run check
```

Stop and report the non-secret output if either validation command fails.

## 3. Configure GitHub access locally

Provide a GitHub credential to the local Crossdock service with only the repository access needed for the test. The service currently reads `GITHUB_TOKEN`.

Do not paste credentials into issues, task records, screenshots, chat transcripts, or the Crossdock repository.

Start the local service:

```sh
npm start
```

The default service endpoint is `http://127.0.0.1:3210`. Leave it running during the test. It binds to the numeric loopback host rather than a public network interface.

To exercise endpoint configuration, optionally use another port:

```sh
PORT=8787 npm start
```

Then use `http://127.0.0.1:8787` in the dashboard. The service rejects invalid `PORT` values, and the dashboard accepts only an explicit `http://127.0.0.1:<port>` origin. Do not replace the loopback host with another machine or remote service.

## 4. Load the extension

In a desktop Chromium-compatible browser:

1. open the browser's extensions management page;
2. enable developer mode;
3. choose the option to load an unpacked extension;
4. select this checkout's `extension/` directory;
5. open the Crossdock dashboard.

Authenticate normally to the conversation, coding-agent, and GitHub services you intend to test. Crossdock must not require extraction of browser cookies or session credentials.

## 5. Configure the dashboard

Set:

- the disposable target repository;
- the Crossdock service URL matching the local service port;
- the private task-record repository and branch;
- `Review before handoff` for the first run;
- the prompt evidence policy;
- the report evidence policy;
- the initial-PR provenance publication choice; and
- the update provenance publication choice.

Prompt and report evidence are independent. Current options are:

- **full** — store canonical plaintext plus a SHA-256 digest;
- **hash** — store the digest without plaintext;
- **omit** — store neither plaintext nor digest.

The effective evidence policy applies to the task being submitted and must not silently broaden during handoff.

Publication is a separate choice. The current dashboard supports:

- **Publish task-record link/comment** — retain the historical Crossdock link in the PR body or update comment; and
- **Publish no Crossdock provenance** — keep the durable task record but do not add Crossdock provenance to that PR surface.

The publication policy is captured when the task starts. Editing those selectors while a task is already active must not change that task's eventual publication behavior.

The service URL is also captured when the task starts. As an optional recovery test, change the visible dashboard service URL after submission without stopping the original service. The active task must continue using its original frozen endpoint rather than redirecting recovery/handoff to the new preference.

## 6. Run a minimal initial task

Use a deliberately small, reversible change in the disposable target repository, such as adding one harmless text file.

For the baseline run, leave **Initial PR provenance** set to publish the task-record link.

Capture the intended prompt with Crossdock and submit it to the coding agent. When the task becomes ready, review it before choosing **Finalize new PR**.

Do not manually repair Crossdock if automation fails. A live-test failure is useful compatibility evidence.

Record the exact non-secret failure state instead: dashboard message, visible provider state, target PR state, and a screenshot when useful.

## 7. Verify the initial handoff

A successful baseline initial handoff should produce:

1. exactly one intended pull request;
2. the expected target branch and change;
3. a PR body containing the normal review information and a durable link to one immutable task record;
4. a task record whose evidence fields match the selected prompt/report policy;
5. no unexpected publication of private prompt/report plaintext.

For `hash`, verify that plaintext is absent and the digest is present. For `omit`, verify that both plaintext and digest are absent while the record explicitly states that the evidence class was omitted.

## 8. Run an update task

Submit a second small task against the existing pull request with **Update provenance** set to publish the task-record comment.

Crossdock should:

1. snapshot the current PR head through the configured frozen service endpoint;
2. use the coding agent's branch-update action;
3. wait until GitHub reports a different head SHA;
4. create a new immutable task record using the selected evidence policy; and
5. add a new top-level PR comment linking that record.

It must not rewrite the original PR body merely to append later provenance.

## 9. Exercise no-PR-visible provenance

After the baseline initial/update flow succeeds, exercise publication independently from durable storage.

For a new disposable task, choose **Publish no Crossdock provenance** for the applicable initial or update surface. Verify all of the following:

1. the configured immutable task record is still created and remotely verifiable;
2. the target code/branch/PR operation still completes;
3. Crossdock does not add its task-record link to the initial PR body when initial publication is `none`;
4. Crossdock does not create a provenance update comment when update publication is `none`;
5. evidence retention still follows the independently selected `full`, `hash`, or `omit` policy; and
6. the absence of PR-visible provenance is not reported as absence of the durable task record.

As an optional frozen-policy recovery check, start a task with publication set one way, then change the visible selector before finalization. The active task must use the policy captured at submission rather than the newly edited preference.

The shared configuration schema also reserves `summary` and committed-file publication modes, but the current browser/service path intentionally does not expose or execute those modes yet. Do not treat them as live-test requirements for this adapter.

## 10. Test automatic mode

After both review-mode flows work, repeat with automatic handoff enabled. The durable result should be equivalent; only the approval transition should differ.

## 11. Failure cases worth reporting

Useful live-test failures include:

- multiple matching conversation or coding-agent tabs;
- missing or duplicate action buttons;
- changed semantic selectors;
- incorrect or incomplete report capture;
- failure to discover the created PR;
- stale PR identity or unchanged branch head;
- invalid/private-storage configuration;
- invalid or mismatched loopback service port/URL;
- task recovery switching to a newly edited service URL instead of its frozen endpoint;
- task recovery switching to a newly edited publication preference instead of its frozen policy;
- a task record missing because PR-visible publication was disabled;
- a PR body/comment containing Crossdock provenance despite a `none` publication choice;
- loopback service failure;
- browser restart/task recovery problems;
- evidence retained despite a `hash` or `omit` policy.

Never include access tokens, cookies, credentials, private task evidence, or other secrets in a public bug report.
