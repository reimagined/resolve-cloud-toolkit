import chalk from 'chalk'
import log from 'consola'
import { deleteRole } from 'resolve-cloud-common/iam'
import { deleteFunction } from 'resolve-cloud-common/lambda'
import { observerLambdaName, observerRoleName } from '../../utils'

const handler = async (args): Promise<void> => {
  const { identifier } = args

  log.debug(`uninstalling (${identifier}) observer`)

  const functionName = observerLambdaName(identifier)
  log.debug(`deleting lambda ${functionName}`)

  await deleteFunction({
    Region: args.region,
    FunctionName: functionName
  })

  log.debug(`lambda function deleted`)

  const roleName = observerRoleName(identifier)
  log.debug(`deleting role ${roleName}`)

  await deleteRole({
    RoleName: roleName,
    Region: args.region
  })

  log.debug(`role deleted`)

  log.debug(`(${args.identifier}) observer installed successfully`)
}

export = {
  handler,
  command: 'uninstall',
  describe: chalk.green('installs current observer'),
  builder: yargs =>
    yargs.option('identifier', {
      describe: chalk.green('observer identifier (multiple instances)'),
      alias: 'id',
      type: 'string',
      default: 'default'
    })
}
