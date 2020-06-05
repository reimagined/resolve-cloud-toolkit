import chalk from 'chalk'
import path from 'path'
import { execSync } from 'child_process'
import log from 'consola'
import Lambda from 'aws-sdk/clients/lambda'

const observerPath = path.resolve(__dirname, '../observer')
const observerAsset = path.resolve(observerPath, 'code.zip')

const handler = async (args): Promise<void> => {
  log.debug(`building observer asset`)

  await execSync(`yarn build && yarn archive`, {
    cwd: observerPath
  })
}

export = {
  handler,
  command: 'install',
  describe: chalk.green('installs current observer'),
  builder: yargs =>
    yargs.option('identifier', {
      describe: chalk.green('observer identifier (multiple instances)'),
      alias: 'id',
      type: 'string',
      default: 'default'
    })
}
