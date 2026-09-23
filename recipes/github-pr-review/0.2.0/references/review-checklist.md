# Pull request review checklist

Use this after the diff has been read. Skip an item only when the change cannot affect it, and say why.

## Behavior

- The diff implements the behavior described in the pull request.
- Error paths return or raise the same class of failure the rest of the module uses.
- Removed behavior is intentional and called out.

## Tests

- New branches have a test, or the finding explains why a test cannot be added here.
- Existing tests still describe the public behavior, not an outdated implementation detail.

## Security

- New inputs are validated at the boundary that receives them.
- Secrets, tokens, and credentials are not logged or committed.
- Authorization checks still run for the changed entry point.

## Finish

- Every blocking finding names a file.
- The summary states whether merge is blocked.
