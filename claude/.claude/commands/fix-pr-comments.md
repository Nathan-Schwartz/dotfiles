Address all unresolved review comments on the current branch's pull request.

## 1. Get PR context

Detect the PR for the current branch and extract repo coordinates:

```bash
gh pr view --json number,url,headRefName,baseRefName
```

If no PR exists for the current branch, stop and tell the user.

```bash
gh repo view --json nameWithOwner --jq '.nameWithOwner'
```

Split nameWithOwner into owner and repo name for the GraphQL query.

## 2. Fetch unresolved review threads

```bash
gh api graphql \
  -F owner='{owner}' \
  -F repo='{repo}' \
  -F pr={number} \
  -f query='
query($owner: String!, $repo: String!, $pr: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $pr) {
      reviewThreads(first: 100) {
        nodes {
          isResolved
          comments(first: 10) {
            nodes {
              author { login }
              body
              path
              line
              startLine
              diffHunk
            }
          }
        }
      }
    }
  }
}'
```

Filter to threads where `isResolved` is `false`. If there are no unresolved threads, report that and stop.

## 3. Present findings

Before making any changes, list each unresolved thread:

```
## Unresolved comments (N total)

1. **file.ts:42** — @reviewer: "quoted or summarized comment"
   Interpretation: [one sentence — what change is being requested]

2. ...
```

Then proceed to address them. The user can interrupt to skip or clarify any item.

## 4. Address each comment

For each unresolved comment:

1. Read the file at the relevant lines
2. State what change you are making and why (one line)
3. Make the change using Edit

**Rules:**
- Only change what the comment specifically asks for.
- Do not refactor adjacent code, add docstrings, or make improvements beyond the request.
- If a comment is unclear, asks a question without implying a change, or requires a design decision you cannot make: skip it and state why.
- Do not resolve or dismiss review threads. That is the reviewer's confirmation step after verifying your changes.

## 5. Summary

After processing all comments:

```
## Addressed
- file.ts:42 — [what was changed] (responding to @reviewer)

## Skipped
- file.ts:98 — [why: unclear request / design decision needed / question not a change request]
```

Do not commit or push. The user reviews the diff and decides next steps.
