"""Require the same commit's main tests and Pages deployment before publishing."""
import json
import os
import time
import urllib.request


def required_runs(runs, sha):
    selected = []
    for workflow in ('.github/workflows/ci.yml', '.github/workflows/pages.yml'):
        matches = [run for run in runs if run['head_sha'] == sha and run['head_branch'] == 'main'
                   and run['event'] in ('push', 'workflow_dispatch') and run['path'].split('@')[0] == workflow]
        if not matches:
            return None
        run = max(matches, key=lambda item: item['id'])
        if run['status'] == 'completed' and run['conclusion'] != 'success':
            raise RuntimeError('Required main workflow failed: ' + run['html_url'])
        selected.append(run)
    return selected if all(run['status'] == 'completed' for run in selected) else None


def main():
    repository, sha = os.environ['GITHUB_REPOSITORY'], os.environ['GITHUB_SHA']
    url = 'https://api.github.com/repos/' + repository + '/actions/runs?head_sha=' + sha + '&per_page=100'
    deadline = time.monotonic() + 20 * 60
    while True:
        request = urllib.request.Request(url, headers={'Authorization': 'Bearer ' + os.environ['GH_TOKEN'],
                                                     'Accept': 'application/vnd.github+json', 'User-Agent': 'FocusTodo-release-gate'})
        with urllib.request.urlopen(request, timeout=30) as response:
            result = required_runs(json.load(response)['workflow_runs'], sha)
        if result:
            for run in result:
                print('Required workflow succeeded:', run['html_url'])
            return
        if time.monotonic() >= deadline:
            raise TimeoutError('Required main tests / Pages deployment did not complete; Release was not created')
        print('Waiting for this commit\'s main tests and Pages deployment...', flush=True)
        time.sleep(15)


if __name__ == '__main__':
    main()
