"""Require the same commit's main tests and Pages deployment before publishing."""
import json
import os
import time
import urllib.request


def required_run(runs, sha):
    matches = [run for run in runs if run['head_sha'] == sha and run['head_branch'] == 'main'
               and run['event'] in ('push', 'workflow_dispatch')
               and run['path'].split('@')[0] == '.github/workflows/ci.yml']
    if not matches:
        return None
    run = max(matches, key=lambda item: item['id'])
    if run['status'] != 'completed':
        return None
    if run['conclusion'] != 'success':
        raise RuntimeError('Required main workflow failed: ' + run['html_url'])
    return run


def require_pages_deploy(run, jobs):
    if not any(job['name'] == 'Deploy GitHub Pages' and job['status'] == 'completed'
               and job['conclusion'] == 'success' for job in jobs):
        raise RuntimeError('Required main workflow did not deploy Pages: ' + run['html_url'])


def request_json(url):
    request = urllib.request.Request(url, headers={'Authorization': 'Bearer ' + os.environ['GH_TOKEN'],
                                                 'Accept': 'application/vnd.github+json', 'User-Agent': 'FocusTodo-release-gate'})
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def main():
    repository, sha = os.environ['GITHUB_REPOSITORY'], os.environ['GITHUB_SHA']
    api = 'https://api.github.com/repos/' + repository + '/actions/runs'
    deadline = time.monotonic() + 20 * 60
    while True:
        run = required_run(request_json(api + '?head_sha=' + sha + '&per_page=100')['workflow_runs'], sha)
        if run:
            jobs = request_json(api + f"/{run['id']}/jobs?filter=latest&per_page=100")['jobs']
            require_pages_deploy(run, jobs)
            print('Required main tests and Pages deployment succeeded:', run['html_url'])
            return
        if time.monotonic() >= deadline:
            raise TimeoutError('Required main tests / Pages deployment did not complete; Release was not created')
        print('Waiting for this commit\'s main tests and Pages deployment...', flush=True)
        time.sleep(15)


if __name__ == '__main__':
    main()
