import {endGroup, group, info, setOutput, startGroup} from '@actions/core'
import * as path from 'path'
import {execute} from './execute'
import {ActionInterface, isNullOrUndefined} from './input'
import {insertGemSource} from './util'
import * as fse from 'fs-extra'

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
    const root = path.resolve(path.join(action.workspace, '..'))
    packagesDir = await build(action.workspace, root)
    info(`setOutput: ${packagesDir}`)
    setOutput('build-path', packagesDir)
  } catch (error) {
    throw error
  }
}

export async function build(plugin_repo_path: string, root: string) {
  startGroup('Check MBox Installed')
  try {
    let exist = null
    try {
      exist = await execute(`command -v mbox`, root)
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
  endGroup()

  // await execute(
  //   `git config --global url."https://${action.token}@github".insteadOf https://github`,
  //   root
  // )
  const workspaceRoot = path.join(root, 'workspace_root')
  await group('Create workspace', async () => {
    await execute(`mkdir workspace_root`, root)
    await execute(`mbox init plugin -v`, workspaceRoot)
    await execute(`mbox add ${plugin_repo_path} --mode=copy -v`, workspaceRoot)
    await execute(
      `mbox config container.allow_multiple_containers Bundler CocoaPods`,
      workspaceRoot
    )
  })

  // Fix the issue that gem source missing
  await group('Fix gem source', async () => {
    const gemfile = path.join(workspaceRoot, 'Gemfile')
    insertGemSource(gemfile)
  })

  await group('Pod install', async () => {
    await execute(`mbox pod install -v`, workspaceRoot)
  })

  let releaseDir = ''
  await group('Build', async () => {
    await execute(`mbox plugin build --force -v --no-test`, workspaceRoot)
    releaseDir = path.join(workspaceRoot, 'release')
    const buildDir = path.join(workspaceRoot, 'build')

    fse.copySync(releaseDir, buildDir, {recursive: true})
  })

  await group(`Set mbox configuration`, async () => {
    await execute(
      `mbox config core.dev-root ${workspaceRoot} -g`,
      workspaceRoot
    )
  })

  return releaseDir
}
