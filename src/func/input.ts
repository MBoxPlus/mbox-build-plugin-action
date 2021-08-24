import * as core from '@actions/core'
import * as github from '@actions/github'

const {pusher, repository} = github.context.payload

export const isNullOrUndefined = (value: unknown): boolean =>
  typeof value === 'undefined' || value === null || value === ''

export interface ActionInterface {
  token: string
  workspace: string
}

export const action: ActionInterface = {
  token: core.getInput('token'),
  workspace: process.env.GITHUB_WORKSPACE || ''
}
