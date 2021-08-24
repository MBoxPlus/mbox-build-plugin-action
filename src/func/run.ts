import {group, info, setOutput} from '@actions/core'
import * as path from 'path'
import {execute} from './execute'
import {ActionInterface, isNullOrUndefined} from './input'
import {insertGemSource} from './util'

export async function run(action: ActionInterface): Promise<void> {
  await group('Check Inputs', async () => {
    if (isNullOrUndefined(action.token)) {
      throw new Error(`Input 'token' is missing.`)
    }

    if (isNullOrUndefined(action.workspace)) {
      throw new Error(`GitHub 'workspace' is missing.`)
    }
  })

  try {
    let packagesDir: string = ''
    await group('Build Plugin', async () => {
      const root = path.resolve(path.join(action.workspace, '..'))
      packagesDir = await build(action.workspace, root)
      setOutput('MBOX_BUILD_PATH', packagesDir)
    })
  } catch (error) {
    throw error
  }
}

export async function build(plugin_repo_path: string, root: string) {
  try {
    info('Check MBox Installed')
    const exist = null
    try {
      const exist = await execute(`command -v mbox`, root)
    } catch (error) {}
    if (!exist) {
      info('Installing mbox')
      await execute(`brew tap MBoxPlus/homebrew-tap`, root)
      await execute(`brew install mbox`, root)
    } else {
      info('MBox Installed')
    }
  } catch (error) {
    throw new Error('Installation of MBox failed.')
  }

  // await execute(
  //   `git config --global url."https://${action.token}@github".insteadOf https://github`,
  //   root
  // )
  const workspaceRoot = path.join(root, 'mbox_workspace')
  await execute(`mkdir mbox_workspace`, root)
  await execute(`mbox init plugin -v`, workspaceRoot)
  await execute(`mbox add ${plugin_repo_path} --mode=copy -v`, workspaceRoot)

  // Fix the issue that gem source missing
  const gemfile = path.join(workspaceRoot, 'Gemfile')
  insertGemSource(gemfile)

  await execute(`mbox pod install -v`, workspaceRoot)
  await execute(`mbox plugin build --force -v --no-test`, workspaceRoot)

  const packagesDir = path.join(workspaceRoot, 'release')
  return packagesDir
}
