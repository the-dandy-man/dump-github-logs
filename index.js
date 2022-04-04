const core = require('@actions/core');
const github = require('@actions/github');
const fetch = require('cross-fetch')
const fs = require('fs')

function assert(condition, message) {
    if (!condition) {
        throw new Error(message || "Assertion failed");
    }
}

var github_repo = core.getInput('github_repository') || process.env.GITHUB_REPOSITORY;
try {
    assert(typeof github_repo !== 'undefined', "The input github_repository is not set")
} catch (error) {
    core.setFailed(error.message)
}
var github_run_id = core.getInput('github_run_id') || process.env.GITHUB_RUN_ID;
try {
    assert(typeof github_run_id !== 'undefined', "The input github_run_id is not set")
} catch (error) {
    core.setFailed(error.message)
}
var github_token = core.getInput('github_token') || process.env.GITHUB_TOKEN;
try {
    assert(typeof github_run_id !== 'undefined', "The input github_run_id is not set")
} catch (error) {
    core.setFailed(error.message)
}
var outfile = core.getInput('outfile') || process.env.GITHUB_DUMP_LOGS_OUTFILE;
if (typeof outfile === 'undefined') {
    outfile = ''
}
const metadata_url = `https://git.providence.org/api/v3/repos/${github_repo}/actions/runs/${github_run_id}`

console.log(`\ngithub_repo: ${github_repo}\ngithub_run_id: ${github_run_id}\ngithub_token: ${github_token}\noutfile: '${outfile}'`)

try {
    console.log(`Fetching job metadata from ${metadata_url}`)
    fetch(metadata_url, {
            method: "GET",
            headers: {
                "Authorization": `token ${github_token}`
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`job metadata request failed with status ${response.status}`)
            }
            return response.json()
        })
        .then(metadata => {
            var jobs_url = metadata.jobs_url;
            console.log(`Fetching jobs list from ${jobs_url}`)
            fetch(jobs_url, {
                method: "GET",
                headers: {
                    "Authorization": `token ${github_token}`
                }
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`jobs request failed with status ${response.status}`)
                }
                return response.json()
            })
            .then(data => {
                var jobs = {}
                data.jobs.filter(job => job.status == 'completed').forEach(job => {
                    console.log(`adding job '${job.id}/${job.name}' with status '${job.status}' and conclusion '${job.conclusion}'`)
                    jobs[job.id] = {
                        job_id: job.id,
                        job_name: job.name,
                        job_status: job.status,
                        job_conclusion: job.conclusion,
                        job_steps: job.steps
                    }
                })
                for (job_id in jobs) {
                    try {
                        var job_logs_url = `https://git.providence.org/api/v3/repos/${github_repo}/actions/jobs/${job_id}/logs`
                        console.log(`Fetching logs from ${job_logs_url}`)
                        fetch(job_logs_url, {
                            method: "GET",
                            headers: {
                                "Authorization": `token ${github_token}`
                            }
                        })
                        .then(response => {
                            if (!response.ok) {
                                throw new Error(`Log request failed with status ${response.status} for job id '${job_id}'`)
                            }
                            return response.text()
                        })
                        .then(data => {
                            console.log(`Writing data, length=${data.length}`)
                            if (outfile) { fs.writeFileSync(outfile, data) }
                            else { core.setOutput("result", data) }
                        })
                    } catch (error) {
                        core.setFailed(error.message)
                    }
                }
            })
        })
} catch (error) {
    core.setFailed(error.message)
}
